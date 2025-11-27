const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const ffprobePath = require('ffprobe-static').path;
const ffmpegPath = require('ffmpeg-static');

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mkv', 'mp4', 'mov', 'avi', 'webm', 'ts', 'flv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});

ipcMain.handle('probe-file', async (event, filePath) => {
  const streams = await probeStreams(filePath);
  return streams;
});

ipcMain.handle('extract-stream', async (event, { filePath, streamIndex, codecType }) => {
  if (!filePath || typeof streamIndex !== 'number') {
    throw new Error('Invalid extraction payload.');
  }

  const outputPath = buildOutputPath(filePath, codecType, streamIndex);
  await extractStream(filePath, streamIndex, outputPath);
  return outputPath;
});

function probeStreams(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      ['-v', 'quiet', '-print_format', 'json', '-show_streams', filePath],
      (error, stdout) => {
        if (error) {
          reject(new Error(`无法获取视频信息: ${error.message}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          const streams = (parsed.streams || []).map((stream) => ({
            index: stream.index,
            codec_type: stream.codec_type,
            codec_name: stream.codec_name,
            language: stream.tags?.language,
            title: stream.tags?.title,
            duration: stream.duration,
          }));
          resolve(streams);
        } catch (parseError) {
          reject(new Error('解析 ffprobe 输出失败。'));
        }
      }
    );
  });
}

function buildOutputPath(filePath, codecType, streamIndex) {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const ext = pickExtension(codecType);
  const candidate = path.join(dir, `${baseName}-${codecType || 'stream'}-${streamIndex}${ext}`);
  return uniquePath(candidate);
}

function pickExtension(codecType) {
  switch (codecType) {
    case 'video':
      return '.mp4';
    case 'audio':
      return '.aac';
    case 'subtitle':
      return '.srt';
    default:
      return '.bin';
  }
}

function uniquePath(candidate) {
  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  const dir = path.dirname(candidate);
  const ext = path.extname(candidate);
  const base = path.basename(candidate, ext);

  let counter = 1;
  let current = path.join(dir, `${base}-${counter}${ext}`);
  while (fs.existsSync(current)) {
    counter += 1;
    current = path.join(dir, `${base}-${counter}${ext}`);
  }
  return current;
}

function extractStream(filePath, streamIndex, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = ['-y', '-i', filePath, '-map', `0:${streamIndex}`, '-c', 'copy', outputPath];
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs, { stdio: 'ignore' });

    ffmpeg.on('error', (error) => reject(new Error(`无法启动 ffmpeg: ${error.message}`)));
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg 退出代码: ${code}`));
      }
    });
  });
}
