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
  const maxHistory = 100;
  const pageSize = 8;
  let selectedFile = null;
  let previewUrl = null;
  let history = readHistory();
  let visibleRows = pageSize;
  let latestValue = history[0] ? history[0].value : null;

  function readHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((entry) => {
        const value = Number(entry && entry.value);
        return Number.isFinite(value) && value >= 0 && value <= 100 && typeof (entry.date || entry.timestamp) === 'string' || Number.isFinite(value) && value >= 0 && value <= 100 && Number.isFinite(entry.timestamp);
      }).map((entry) => ({
        value: Number(entry.value),
        name: typeof entry.name === 'string' ? entry.name.slice(0, 180) : 'Panel image',
        site: typeof entry.site === 'string' ? entry.site.slice(0, 60) : '',
        panel: typeof entry.panel === 'string' ? entry.panel.slice(0, 60) : '',
        date: typeof entry.date === 'string' ? entry.date : new Date(entry.timestamp).toISOString()
      })).slice(0, maxHistory);
    } catch (_) {
      return [];
    }
  }

  function persistHistory() {
    try {
      localStorage.setItem(historyKey, JSON.stringify(history));
      return true;
    } catch (_) {
      return false;
    }
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
    if (!validType) { showError('Choose a JPG or PNG image.'); return; }
    if (file.size > maxBytes) { showError('Image exceeds the 8 MB limit. Choose a smaller file.'); return; }
    selectedFile = file;
    dropArea.hidden = true;
    $('#selectedFile').hidden = false;
    $('#fileName').textContent = file.name;
    $('#fileSize').textContent = `${formatSize(file.size)} · Ready`;
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
    dropArea.hidden = false;
    const thumb = $('#fileThumb');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6" stroke-linecap="round" stroke-linejoin="round"/>';
    thumb.replaceChildren(icon);
    clearError();
  }

  function getCondition(value) {
    if (value < 20) return { title: 'Low dust', label: 'LOW DUST', className: 'low', message: 'Minimal dust detected. Continue routine monitoring.' };
    if (value < 50) return { title: 'Moderate dust', label: 'MODERATE', className: 'moderate', message: 'Dust is building. Consider a routine clean and reinspect afterward.' };
    return { title: 'High dust', label: 'HIGH DUST', className: 'high', message: 'Significant dust detected. Arrange cleaning and reinspect afterward.' };
  }

  function displayDate(value, options) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], options);
  }

  function showResult(data, filename, metadata) {
    const value = Number(data.dustiness);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('The analysis returned an invalid dust reading. Please try again.');
    const condition = getCondition(value);
    latestValue = value;
    $('#emptyInsight').hidden = true;
    const card = $('#resultCard');
    card.hidden = false;
    const context = [metadata.site, metadata.panel].filter(Boolean).join(' · ');
    $('#resultSummary').textContent = context || 'Inspection complete';
    $('#resultStatusText').textContent = 'COMPLETE';
    $('#conditionTitle').textContent = condition.title;
    $('#recommendationText').textContent = condition.message;
    $('#resultFileName').textContent = [metadata.site, metadata.panel, filename].filter(Boolean).join(' · ');
    $('#resultTimestamp').textContent = displayDate(new Date(), { hour: '2-digit', minute: '2-digit' });
    $('#gaugeNumber').textContent = `${Math.round(value)}%`;
    const ring = $('#gaugeValue');
    ring.style.strokeDashoffset = String(345.58 * (1 - value / 100));
    ring.style.stroke = value >= 50 ? '#c97966' : value >= 20 ? '#c4a258' : '#72a47b';
    $('#resultStatus').style.background = value >= 50 ? '#f8ebe8' : value >= 20 ? '#f8f2e5' : '#eff6ef';
    $('#resultStatus').style.color = value >= 50 ? '#a85549' : value >= 20 ? '#9b7a3f' : '#54805e';
    history.unshift({ value: Number(value.toFixed(2)), name: filename, site: metadata.site, panel: metadata.panel, date: new Date().toISOString() });
    history = history.slice(0, maxHistory);
    visibleRows = pageSize;
    persistHistory();
    renderHistory();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function filteredHistory() {
    const query = ($('#historySearch')?.value || '').trim().toLocaleLowerCase();
    const condition = $('#conditionFilter')?.value || 'all';
    return history.filter((entry) => {
      const matchesText = !query || [entry.site, entry.panel, entry.name].some((value) => String(value || '').toLocaleLowerCase().includes(query));
      const matchesCondition = condition === 'all' || getCondition(entry.value).className === condition;
      return matchesText && matchesCondition;
    });
  }

  function renderHistory() {
    $('#scanCount').textContent = String(history.length);
    const latest = history[0];
    $('#lastReading').textContent = latest ? String(Math.round(latest.value)) : '—';
    $('#lastReadingUnit').textContent = latest ? '%' : '';
    $('#lastReadingNote').textContent = latest ? getCondition(latest.value).title : 'No inspections';
    const empty = $('#historyEmpty');
    const content = $('#historyContent');
    const clearButton = $('#clearHistory');
    const exportButton = $('#exportHistory');
    const toolbar = $('#historyToolbar');
    empty.hidden = history.length > 0;
    content.hidden = history.length === 0;
    clearButton.hidden = history.length === 0;
    exportButton.hidden = history.length === 0;
    toolbar.hidden = history.length === 0;
    if (!history.length) return;

    const matches = filteredHistory();
    const list = $('#historyList');
    list.replaceChildren();
    matches.slice(0, visibleRows).forEach((entry) => {
      const condition = getCondition(entry.value);
      const row = document.createElement('div');
      row.className = 'history-row';
      const name = document.createElement('span');
      name.className = 'history-row-name';
      name.textContent = [entry.site, entry.panel, entry.name].filter(Boolean).join(' · ') || 'Panel image';
      name.title = name.textContent;
      const date = document.createElement('span');
      date.className = 'history-row-date';
      date.textContent = displayDate(entry.date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const badge = document.createElement('span');
      badge.className = `history-badge ${condition.className}`;
      badge.textContent = `${Math.round(entry.value)}% · ${condition.label}`;
      row.append(name, date, badge);
      list.append(row);
    });
    $('#historyRangeLabel').textContent = matches.length === 1 ? '1 INSPECTION' : `${matches.length} INSPECTIONS`;
    $('#historyNoResults').hidden = matches.length > 0;
    $('#loadMore').hidden = matches.length <= visibleRows;
    renderChart(matches.slice(0, 10).reverse());
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
    $('#historyChart').setAttribute('aria-label', `Dust level trend across ${entries.length} recent inspections.`);
  }

  function csvCell(value) {
    let text = String(value ?? '');
    // Spreadsheet applications may interpret cells beginning with formula characters.
    if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const rows = [['Date', 'Site / array', 'Panel ID', 'Image', 'Dust level (%)', 'Condition']];
    history.forEach((entry) => rows.push([
      displayDate(entry.date, { dateStyle: 'medium', timeStyle: 'short' }),
      entry.site,
      entry.panel,
      entry.name,
      Number(entry.value).toFixed(2),
      getCondition(entry.value).title
    ]));
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solaris-inspections-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openKpiDialog(kind) {
    const dialog = $('#kpiDialog');
    if (!dialog || typeof dialog.showModal !== 'function') {
      document.querySelector('#history')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const entries = history;
    const average = entries.length ? entries.reduce((sum, entry) => sum + entry.value, 0) / entries.length : null;
    const highCount = entries.filter((entry) => entry.value >= 50).length;
    const sites = new Set(entries.map((entry) => entry.site.trim()).filter(Boolean)).size;
    const recent = entries.slice(0, 10);
    const previous = entries.slice(10, 20);
    const recentAverage = recent.length ? recent.reduce((sum, entry) => sum + entry.value, 0) / recent.length : null;
    const previousAverage = previous.length ? previous.reduce((sum, entry) => sum + entry.value, 0) / previous.length : null;
    let title;
    let description;
    let stats;
    if (kind === 'dust') {
      title = 'Dust readings';
      description = entries.length ? 'Summary of readings stored in this browser.' : 'Run an inspection to start collecting readings.';
      const change = recentAverage !== null && previousAverage !== null ? `${recentAverage - previousAverage > 0 ? '+' : ''}${(recentAverage - previousAverage).toFixed(1)} pts vs previous 10` : 'Needs 11 scans to compare';
      stats = [['Latest', latestValue === null ? '—' : `${latestValue.toFixed(1)}%`], ['Average', average === null ? '—' : `${average.toFixed(1)}%`], ['High dust', `${highCount} of ${entries.length}`], ['Trend', change]];
    } else {
      title = 'Scan activity';
      description = entries.length ? 'Inspection log summary. Records remain on this device.' : 'Your first inspection will appear here.';
      stats = [['Total scans', String(entries.length)], ['Sites tagged', String(sites)], ['Latest scan', entries[0] ? displayDate(entries[0].date, { dateStyle: 'medium' }) : '—'], ['Stored', 'This browser']];
    }
    $('#kpiTitle').textContent = title;
    $('#kpiDescription').textContent = description;
    const container = $('#kpiStats');
    container.replaceChildren();
    stats.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'kpi-stat';
      const name = document.createElement('span');
      name.textContent = label;
      const result = document.createElement('strong');
      result.textContent = value;
      item.append(name, result);
      container.append(item);
    });
    dialog.showModal();
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
    const metadata = {
      site: ($('#siteName').value || '').trim().slice(0, 60),
      panel: ($('#panelName').value || '').trim().slice(0, 60)
    };
    analyzeButton.disabled = true;
    analyzeButton.classList.add('is-loading');
    analyzeButton.querySelector('span').textContent = 'Analyzing…';
    try {
      const body = new FormData();
      body.append('file', selectedFile);
      const response = await fetch('/analyze', { method: 'POST', body });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('The server returned an unreadable response. Please try again.'); }
      if (!response.ok) throw new Error(data.error || (response.status === 429 ? 'Too many requests. Wait a moment and try again.' : 'Analysis failed. Please try again.'));
      if (data.success !== true || data.dustiness === undefined) throw new Error(data.error || 'The server did not return a dust assessment.');
      showResult(data, selectedFile.name, metadata);
    } catch (error) {
      showError(error.message || 'Unable to reach the analysis service. Check your connection and try again.');
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.classList.remove('is-loading');
      analyzeButton.querySelector('span').textContent = 'Run panel analysis';
    }
  });

  $('#clearHistory').addEventListener('click', () => {
    if (!history.length) return;
    history = [];
    latestValue = null;
    visibleRows = pageSize;
    persistHistory();
    renderHistory();
  });
  $('#historySearch').addEventListener('input', () => { visibleRows = pageSize; renderHistory(); });
  $('#conditionFilter').addEventListener('change', () => { visibleRows = pageSize; renderHistory(); });
  $('#loadMore').addEventListener('click', () => { visibleRows += pageSize; renderHistory(); });
  $('#resetFilters').addEventListener('click', () => {
    $('#historySearch').value = '';
    $('#conditionFilter').value = 'all';
    visibleRows = pageSize;
    renderHistory();
  });
  $('#exportHistory').addEventListener('click', exportCsv);
  document.querySelectorAll('.metric-detail').forEach((button) => button.addEventListener('click', () => openKpiDialog(button.dataset.kpi)));

  const date = new Date();
  $('#todayLabel').textContent = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  renderHistory();
})();
