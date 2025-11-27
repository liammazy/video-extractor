const selectFileBtn = document.getElementById('selectFile');
const exportBtn = document.getElementById('exportBtn');
const fileNameLabel = document.getElementById('fileName');
const streamList = document.getElementById('streamList');
const statusBox = document.getElementById('status');

let currentFile = null;
let streams = [];

selectFileBtn.addEventListener('click', async () => {
  resetStatus();
  const filePath = await window.api.selectFile();
  if (!filePath) {
    return;
  }

  currentFile = filePath;
  fileNameLabel.textContent = truncateName(filePath);
  statusBox.textContent = '正在读取视频信息...';

  try {
    streams = await window.api.probeFile(filePath);
    renderStreams(streams);
    statusBox.textContent = '读取完成。请选择要导出的资源。';
  } catch (error) {
    streamList.innerHTML = '<div class="error">读取视频信息失败，请检查文件是否有效。</div>';
    streamList.classList.add('empty');
    statusBox.textContent = error.message || '读取失败。';
  }
});

exportBtn.addEventListener('click', async () => {
  resetStatus();
  if (!currentFile) {
    statusBox.textContent = '请先选择视频文件。';
    return;
  }

  const selected = document.querySelector('input[name="streamSelect"]:checked');
  if (!selected) {
    statusBox.textContent = '请先选择需要导出的资源。';
    return;
  }

  const streamIndex = Number(selected.value);
  const stream = streams.find((s) => s.index === streamIndex);

  statusBox.textContent = '正在导出，请稍候...';
  exportBtn.disabled = true;

  try {
    const outputPath = await window.api.extractStream({
      filePath: currentFile,
      streamIndex,
      codecType: stream?.codec_type,
    });
    statusBox.textContent = `导出完成：${outputPath}`;
  } catch (error) {
    statusBox.textContent = error.message || '导出失败。';
  } finally {
    exportBtn.disabled = false;
  }
});

function renderStreams(data) {
  if (!data || data.length === 0) {
    streamList.textContent = '未找到可用的流。';
    streamList.classList.add('empty');
    return;
  }

  streamList.innerHTML = '';
  streamList.classList.remove('empty');

  data.forEach((stream) => {
    const item = document.createElement('label');
    item.className = 'stream-item';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'streamSelect';
    radio.value = stream.index;

    const info = document.createElement('div');
    info.className = 'details';
    info.innerHTML = `
      <div class="line"><strong>类型：</strong>${stream.codec_type || '未知'} / ${stream.codec_name || '未知'}</div>
      <div class="line"><strong>语言：</strong>${stream.language || '未知'}</div>
      <div class="line"><strong>标题：</strong>${stream.title || '无'} | <strong>索引：</strong>${stream.index}</div>
    `;

    item.appendChild(radio);
    item.appendChild(info);
    streamList.appendChild(item);
  });
}

function truncateName(fullPath) {
  const parts = fullPath.split(/\\|\//);
  const name = parts[parts.length - 1];
  return name.length > 42 ? `${name.slice(0, 20)}...${name.slice(-18)}` : name;
}

function resetStatus() {
  statusBox.textContent = '';
}
