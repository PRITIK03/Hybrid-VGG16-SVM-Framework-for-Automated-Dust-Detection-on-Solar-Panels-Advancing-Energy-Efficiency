'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const form = $('#uploadForm');
  const fileInput = $('#fileInput');
  const dropArea = $('#dropArea');
  const analyzeButton = $('#analyzeBtn');
  const errorAlert = $('#errorAlert');
  const historyKey = 'solaris-analysis-history-v1';
  const maxBytes = 8 * 1024 * 1024;
  let selectedFile = null;
  let previewUrl = null;
  let history = readHistory();

  function readHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || '[]');
      return Array.isArray(saved) ? saved.filter((entry) => Number.isFinite(entry.value) && typeof entry.date === 'string').slice(0, 20) : [];
    } catch (_) {
      return [];
    }
  }

  function persistHistory() {
    try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch (_) { /* Keep analysis usable when storage is disabled. */ }
  }

  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.hidden = false;
  }

  function clearError() {
    errorAlert.textContent = '';
    errorAlert.hidden = true;
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function setFile(file) {
    clearError();
    if (!file) return;
    const validType = ['image/jpeg', 'image/png'].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
    if (!validType) { showError('Choose a JPG or PNG image to continue.'); return; }
    if (file.size > maxBytes) { showError('This image exceeds the 8 MB upload limit. Choose a smaller file.'); return; }
    selectedFile = file;
    $('#dropArea').hidden = true;
    $('#selectedFile').hidden = false;
    $('#fileName').textContent = file.name;
    $('#fileSize').textContent = `${formatSize(file.size)} · Ready to analyze`;
    const thumb = $('#fileThumb');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    const image = document.createElement('img');
    image.src = previewUrl;
    image.alt = '';
    thumb.replaceChildren(image);
  }

  function resetFile() {
    selectedFile = null;
    fileInput.value = '';
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    $('#selectedFile').hidden = true;
    $('#dropArea').hidden = false;
    $('#fileThumb').innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    clearError();
  }

  function getCondition(value) {
    if (value < 20) return { title: 'Excellent condition', label: 'LOW DUST', className: 'low', message: 'Minimal dust detected. Panels look clean; continue routine monitoring and inspect again during your next maintenance cycle.' };
    if (value < 50) return { title: 'Moderate buildup', label: 'MODERATE', className: 'moderate', message: 'Dust accumulation is building. Consider scheduling a routine clean to help maintain panel performance.' };
    return { title: 'Cleaning recommended', label: 'HIGH DUST', className: 'high', message: 'Significant dust detected. Arrange a panel cleaning and reinspect afterward to assess the change.' };
  }

  function showResult(data, filename) {
    const value = Math.max(0, Math.min(100, Number(data.dustiness)));
    if (!Number.isFinite(value)) throw new Error('The analysis returned an invalid dust reading. Please try again.');
    const condition = getCondition(value);
    $('#emptyInsight').hidden = true;
    const card = $('#resultCard');
    card.hidden = false;
    $('#resultSummary').textContent = `Analysis complete for ${filename}.`;
    $('#resultStatusText').textContent = 'COMPLETE';
    $('#conditionTitle').textContent = condition.title;
    $('#recommendationText').textContent = condition.message;
    $('#resultFileName').textContent = filename;
    $('#resultTimestamp').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('#gaugeNumber').textContent = `${Math.round(value)}%`;
    const ring = $('#gaugeValue');
    ring.style.strokeDashoffset = String(345.58 * (1 - value / 100));
    ring.style.stroke = value >= 50 ? '#c97966' : value >= 20 ? '#c4a258' : '#72a47b';
    $('#resultStatus').style.background = value >= 50 ? '#f8ebe8' : value >= 20 ? '#f8f2e5' : '#eff6ef';
    $('#resultStatus').style.color = value >= 50 ? '#a85549' : value >= 20 ? '#9b7a3f' : '#54805e';
    history.unshift({ value: Number(value.toFixed(2)), name: filename, date: new Date().toISOString() });
    history = history.slice(0, 20);
    persistHistory();
    renderHistory();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderHistory() {
    $('#scanCount').textContent = String(history.length);
    const latest = history[0];
    $('#lastReading').textContent = latest ? String(Math.round(latest.value)) : '—';
    $('#lastReadingUnit').textContent = latest ? '%' : '';
    $('#lastReadingNote').textContent = latest ? getCondition(latest.value).title : 'Run your first panel inspection';
    const empty = $('#historyEmpty');
    const content = $('#historyContent');
    const clearButton = $('#clearHistory');
    empty.hidden = history.length > 0;
    content.hidden = history.length === 0;
    clearButton.hidden = history.length === 0;
    if (!history.length) return;
    renderChart(history.slice(0, 10).reverse());
    const list = $('#historyList');
    list.replaceChildren();
    history.slice(0, 4).forEach((entry) => {
      const condition = getCondition(entry.value);
      const row = document.createElement('div');
      row.className = 'history-row';
      const name = document.createElement('span');
      name.className = 'history-row-name';
      name.textContent = entry.name || 'Panel image';
      const date = document.createElement('span');
      date.className = 'history-row-date';
      const parsed = new Date(entry.date);
      date.textContent = Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const badge = document.createElement('span');
      badge.className = `history-badge ${condition.className}`;
      badge.textContent = `${Math.round(entry.value)}% · ${condition.label}`;
      row.append(name, date, badge);
      list.append(row);
    });
  }

  function renderChart(entries) {
    const width = 660;
    const height = 87;
    const left = 5;
    const right = width - 5;
    const top = 8;
    const bottom = 68;
    const points = entries.map((entry, index) => {
      const x = entries.length === 1 ? width / 2 : left + index * (right - left) / (entries.length - 1);
      const y = bottom - (Math.max(0, Math.min(100, entry.value)) / 100) * (bottom - top);
      return { x, y, value: entry.value };
    });
    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
    const circles = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3.5" fill="#fff" stroke="#63906b" stroke-width="2"><title>${Math.round(point.value)}% dust</title></circle>`).join('');
    const area = `${left},${bottom} ${polyline} ${right},${bottom}`;
    $('#historyChart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#a9c5a7" stop-opacity=".32"/><stop offset="100%" stop-color="#a9c5a7" stop-opacity="0"/></linearGradient></defs><line x1="${left}" y1="8" x2="${right}" y2="8" stroke="#edf0eb" stroke-dasharray="3 5"/><line x1="${left}" y1="38" x2="${right}" y2="38" stroke="#edf0eb" stroke-dasharray="3 5"/><line x1="${left}" y1="68" x2="${right}" y2="68" stroke="#edf0eb"/><polygon points="${area}" fill="url(#chartFill)"/><polyline points="${polyline}" fill="none" stroke="#63906b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${circles}</svg>`;
    $('#historyChart').setAttribute('aria-label', `Dust level trend across ${entries.length} recent scans.`);
  }

  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => setFile(fileInput.files && fileInput.files[0]));
  $('#removeFile').addEventListener('click', resetFile);
  ['dragenter', 'dragover'].forEach((event) => dropArea.addEventListener(event, (eventObject) => {
    eventObject.preventDefault();
    dropArea.classList.add('drag-active');
  }));
  ['dragleave', 'drop'].forEach((event) => dropArea.addEventListener(event, (eventObject) => {
    eventObject.preventDefault();
    dropArea.classList.remove('drag-active');
  }));
  dropArea.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (file) setFile(file);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();
    if (!selectedFile) { showError('Choose a panel image before starting the analysis.'); return; }
    const originalLabel = analyzeButton.querySelector('span').textContent;
    analyzeButton.disabled = true;
    analyzeButton.classList.add('is-loading');
    analyzeButton.querySelector('span').textContent = 'Analyzing panel…';
    try {
      const body = new FormData();
      body.append('file', selectedFile);
      const response = await fetch('/analyze', { method: 'POST', body });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('The server returned an unreadable response. Please try again.'); }
      if (!response.ok) throw new Error(data.error || 'Analysis failed. Please try again.');
      if (data.success !== true || data.dustiness === undefined) throw new Error(data.error || 'The server did not return a dust assessment.');
      showResult(data, selectedFile.name);
    } catch (error) {
      showError(error.message || 'Unable to reach the analysis service. Check your connection and try again.');
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.classList.remove('is-loading');
      analyzeButton.querySelector('span').textContent = originalLabel;
    }
  });

  $('#clearHistory').addEventListener('click', () => {
    history = [];
    persistHistory();
    renderHistory();
  });

  const date = new Date();
  $('#todayLabel').textContent = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  renderHistory();
})();
