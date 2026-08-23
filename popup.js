/**
 * SpeedPulse - Extension Controller with Synchronized Settings & Live Updates
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Persistent Storage Helper ---
  const Storage = {
    async get(key, defaultValue) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise(resolve => {
          chrome.storage.local.get([key], result => {
            resolve(result[key] !== undefined ? result[key] : defaultValue);
          });
        });
      }
      try {
        const item = localStorage.getItem(key);
        return item !== null ? JSON.parse(item) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    },
    async set(key, value) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise(resolve => {
          chrome.storage.local.set({ [key]: value }, resolve);
        });
      }
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    }
  };

  // --- UI Elements ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');

  // Sub-panels
  const testLiveView = document.getElementById('test-live-view');
  const testFinishView = document.getElementById('test-finish-view');

  // Live Test View Elements
  const btnStart = document.getElementById('btn-start');
  const btnText = btnStart.querySelector('.btn-text');
  const phaseStatus = document.getElementById('phase-status');
  const statusIndicator = document.querySelector('.status-indicator');

  const liveSpeedVal = document.getElementById('live-speed-val');
  const displayUnitLabel = document.getElementById('display-unit-label');
  const currentPhaseLabel = document.getElementById('current-phase-label');

  const metricPing = document.getElementById('metric-ping');
  const metricJitter = document.getElementById('metric-jitter');
  const metricDownload = document.getElementById('metric-download');
  const metricUpload = document.getElementById('metric-upload');
  const metricDownloadUnit = document.getElementById('metric-download-unit');
  const metricUploadUnit = document.getElementById('metric-upload-unit');

  const barDownload = document.getElementById('bar-download');
  const barUpload = document.getElementById('bar-upload');

  const cardPing = document.getElementById('card-ping');
  const cardJitter = document.getElementById('card-jitter');
  const cardDownload = document.getElementById('card-download');
  const cardUpload = document.getElementById('card-upload');

  const netIsp = document.getElementById('net-isp');
  const netLocation = document.getElementById('net-location');

  // Finish Screen Elements
  const finishGradeBadge = document.getElementById('finish-grade-badge');
  const finishTimestamp = document.getElementById('finish-timestamp');
  const finishSummaryDesc = document.getElementById('finish-summary-desc');

  const finishValDownload = document.getElementById('finish-val-download');
  const finishUnitDownload = document.getElementById('finish-unit-download');
  const finishValUpload = document.getElementById('finish-val-upload');
  const finishUnitUpload = document.getElementById('finish-unit-upload');

  const finishValPing = document.getElementById('finish-val-ping');
  const finishValJitter = document.getElementById('finish-val-jitter');
  const finishValStability = document.getElementById('finish-val-stability');

  const breakdownStream = document.getElementById('breakdown-stream');
  const breakdownGaming = document.getElementById('breakdown-gaming');
  const breakdownFile = document.getElementById('breakdown-file');

  const finishNetIsp = document.getElementById('finish-net-isp');
  const finishNetIp = document.getElementById('finish-net-ip');

  const btnTestAgain = document.getElementById('btn-test-again');
  const btnCopyResults = document.getElementById('btn-copy-results');
  const copyTextLabel = document.getElementById('copy-text-label');

  // History Elements
  const historyList = document.getElementById('history-list');
  const histStatCount = document.getElementById('hist-stat-count');
  const histStatAvg = document.getElementById('hist-stat-avg');
  const histStatTop = document.getElementById('hist-stat-top');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // Settings Elements
  const settingTheme = document.getElementById('setting-theme');
  const settingUnit = document.getElementById('setting-unit');
  const settingDuration = document.getElementById('setting-duration');
  const settingStreams = document.getElementById('setting-streams');

  // Visualizers
  const gauge = new SpeedGauge('gaugeCanvas');
  const waveform = new LiveWaveformChart('waveformCanvas');

  let engine = null;
  let isTesting = false;
  let lastTestResult = null;
  let currentSettings = {
    theme: 'dark',
    unit: 'Mbps',
    duration: 'standard',
    streams: '4'
  };

  // --- Theme Management ---
  function applyTheme(themeChoice) {
    let effectiveTheme = themeChoice;
    if (themeChoice === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    gauge.render();
    waveform.render();
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    currentSettings.theme = newTheme;
    settingTheme.value = newTheme;
    applyTheme(newTheme);
    Storage.set('speedpulse_settings', currentSettings);
  }

  btnThemeToggle.addEventListener('click', toggleTheme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentSettings.theme === 'system') {
      applyTheme('system');
    }
  });

  // --- Unit Conversion Helper ---
  function convertSpeed(mbps) {
    if (!mbps || isNaN(mbps)) return '0.0';
    if (currentSettings.unit === 'MB/s') {
      const val = mbps / 8;
      return val >= 100 ? val.toFixed(1) : val.toFixed(2);
    }
    if (currentSettings.unit === 'Kbps') {
      return (mbps * 1000).toFixed(0);
    }
    return mbps >= 100 ? mbps.toFixed(1) : mbps.toFixed(2);
  }

  function updateUnitLabels() {
    gauge.setUnit(currentSettings.unit);
    displayUnitLabel.textContent = currentSettings.unit;
    metricDownloadUnit.textContent = currentSettings.unit;
    metricUploadUnit.textContent = currentSettings.unit;
    finishUnitDownload.textContent = currentSettings.unit;
    finishUnitUpload.textContent = currentSettings.unit;

    if (lastTestResult) {
      finishValDownload.textContent = convertSpeed(lastTestResult.download);
      finishValUpload.textContent = convertSpeed(lastTestResult.upload);
      if (metricDownload.textContent !== '--') {
        metricDownload.textContent = convertSpeed(lastTestResult.download);
      }
      if (metricUpload.textContent !== '--') {
        metricUpload.textContent = convertSpeed(lastTestResult.upload);
      }
    }
  }

  // --- Tab Navigation ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      if (targetTab === 'history-tab') {
        loadHistory();
      }
    });
  });

  // --- Settings Loading & Saving ---
  async function loadSettings() {
    const saved = await Storage.get('speedpulse_settings', currentSettings);
    currentSettings = { ...currentSettings, ...saved };
    settingTheme.value = currentSettings.theme || 'dark';
    settingUnit.value = currentSettings.unit || 'Mbps';
    settingDuration.value = currentSettings.duration || 'standard';
    settingStreams.value = String(currentSettings.streams || '4');
    applyTheme(currentSettings.theme);
    updateUnitLabels();
  }

  async function handleSettingChange() {
    currentSettings.theme = settingTheme.value;
    currentSettings.unit = settingUnit.value;
    currentSettings.duration = settingDuration.value;
    currentSettings.streams = settingStreams.value;

    applyTheme(currentSettings.theme);
    updateUnitLabels();
    await Storage.set('speedpulse_settings', currentSettings);
  }

  settingTheme.addEventListener('change', handleSettingChange);
  settingUnit.addEventListener('change', handleSettingChange);
  settingDuration.addEventListener('change', handleSettingChange);
  settingStreams.addEventListener('change', handleSettingChange);

  // --- Network Info ---
  async function initNetworkInfo() {
    const tempEngine = new SpeedTestEngine();
    try {
      const info = await tempEngine.getNetworkInfo();
      netIsp.textContent = info.isp || 'Broadband ISP';
      netLocation.textContent = info.location ? `${info.ip} (${info.location})` : info.ip;
      finishNetIsp.textContent = info.isp || 'Broadband ISP';
      finishNetIp.textContent = info.location ? `${info.ip} (${info.location})` : info.ip;
    } catch (e) {
      netIsp.textContent = 'Connected';
      netLocation.textContent = 'Local Network';
      finishNetIsp.textContent = 'Connected';
      finishNetIp.textContent = 'Local Network';
    }
  }

  // --- Sub-panel View Switchers ---
  function showLiveView() {
    testFinishView.classList.remove('active');
    testLiveView.classList.add('active');
  }

  function showFinishView() {
    testLiveView.classList.remove('active');
    testFinishView.classList.add('active');
  }

  // --- Reset UI ---
  function resetTestUI() {
    showLiveView();
    gauge.setValue(0, 'idle');
    waveform.reset('#3b82f6');
    liveSpeedVal.textContent = '0.0';
    currentPhaseLabel.textContent = 'READY';
    currentPhaseLabel.className = 'phase-tag';
    phaseStatus.textContent = 'Connecting...';
    statusIndicator.classList.add('busy');

    metricPing.textContent = '--';
    metricJitter.textContent = '--';
    metricDownload.textContent = '--';
    metricUpload.textContent = '--';

    barDownload.style.width = '0%';
    barUpload.style.width = '0%';

    [cardPing, cardJitter, cardDownload, cardUpload].forEach(c => c.classList.remove('active'));
  }

  // --- Render Finish Screen & Breakdown ---
  function renderFinishScreen(result) {
    lastTestResult = result;
    const down = result.download || 0;
    const up = result.upload || 0;
    const ping = result.ping || 0;
    const jitter = result.jitter || 0;

    // Numbers & Units
    finishValDownload.textContent = convertSpeed(down);
    finishUnitDownload.textContent = currentSettings.unit;
    finishValUpload.textContent = convertSpeed(up);
    finishUnitUpload.textContent = currentSettings.unit;

    finishValPing.innerHTML = `${ping} <small>ms</small>`;
    finishValJitter.innerHTML = `${jitter} <small>ms</small>`;
    finishValStability.textContent = jitter < 8 ? 'Excellent' : (jitter < 25 ? 'Good' : 'Moderate');
    finishTimestamp.textContent = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    // Connection Grade
    if (down >= 200 && ping <= 35) {
      finishGradeBadge.textContent = 'Excellent Connection';
      finishGradeBadge.className = 'finish-grade-badge excellent';
      finishSummaryDesc.textContent = 'High-bandwidth & ultra-low latency. Ready for heavy 4K/8K workloads and large file transfers.';
    } else if (down >= 60) {
      finishGradeBadge.textContent = 'Fast Connection';
      finishGradeBadge.className = 'finish-grade-badge good';
      finishSummaryDesc.textContent = 'Fast broadband speed. Optimal for smooth 4K streaming, online gaming, and multi-device use.';
    } else if (down >= 20) {
      finishGradeBadge.textContent = 'Good Connection';
      finishGradeBadge.className = 'finish-grade-badge good';
      finishSummaryDesc.textContent = 'Reliable speed for HD streaming, video conferencing, and general web browsing.';
    } else {
      finishGradeBadge.textContent = 'Moderate Speed';
      finishGradeBadge.className = 'finish-grade-badge fair';
      finishSummaryDesc.textContent = 'Standard speed suitable for everyday web browsing and standard definition video.';
    }

    // Breakdown 1: Streaming
    if (down >= 100) {
      breakdownStream.textContent = 'Multiple 4K/8K streams simultaneously';
    } else if (down >= 25) {
      breakdownStream.textContent = 'Smooth 4K UHD playback with zero buffer';
    } else if (down >= 10) {
      breakdownStream.textContent = 'Full HD (1080p) smooth playback';
    } else {
      breakdownStream.textContent = 'Standard Definition (SD) playback';
    }

    // Breakdown 2: Gaming & Calls
    if (ping <= 20 && jitter <= 6) {
      breakdownGaming.textContent = 'Ultra-low latency (<20ms), optimal competitive gaming & crystal calls';
    } else if (ping <= 45) {
      breakdownGaming.textContent = 'Low latency (<45ms), smooth video calls and online gaming';
    } else {
      breakdownGaming.textContent = 'Moderate latency, acceptable for video calls and casual gaming';
    }

    // Breakdown 3: 1GB File Transfer Calculation
    if (down > 0) {
      const secondsFor1GB = Math.max(1, Math.round((1024 * 8) / down));
      if (secondsFor1GB < 60) {
        breakdownFile.textContent = `Approx ~${secondsFor1GB} seconds for a 1 GB file`;
      } else {
        const mins = Math.floor(secondsFor1GB / 60);
        const secs = secondsFor1GB % 60;
        breakdownFile.textContent = `Approx ~${mins}m ${secs}s for a 1 GB file`;
      }
    } else {
      breakdownFile.textContent = 'Unavailable';
    }

    // Network Metadata
    if (result.network) {
      finishNetIsp.textContent = result.network.isp || 'Broadband ISP';
      finishNetIp.textContent = result.network.location ? `${result.network.ip} (${result.network.location})` : result.network.ip;
    }

    showFinishView();
  }

  // --- Speed Test Execution ---
  async function startSpeedTest() {
    if (isTesting) {
      if (engine) engine.abort();
      setTestInactive();
      phaseStatus.textContent = 'Test cancelled';
      statusIndicator.classList.remove('busy');
      return;
    }

    isTesting = true;
    btnText.textContent = 'Cancel';
    btnStart.classList.add('cancel');
    resetTestUI();

    // Map duration settings accurately
    let downloadMs = 9000;
    let uploadMs = 8000;
    if (currentSettings.duration === 'quick') {
      downloadMs = 5000;
      uploadMs = 4500;
    } else if (currentSettings.duration === 'thorough') {
      downloadMs = 15000;
      uploadMs = 12000;
    }

    const streamsCount = parseInt(currentSettings.streams, 10) || 4;

    engine = new SpeedTestEngine({
      downloadDuration: downloadMs,
      uploadDuration: uploadMs,
      concurrentStreams: streamsCount
    });

    try {
      await engine.runFullTest({
        onPhaseChange: (phase, text) => {
          phaseStatus.textContent = text;
          currentPhaseLabel.textContent = phase.toUpperCase();
          currentPhaseLabel.className = `phase-tag ${phase}`;

          [cardPing, cardJitter, cardDownload, cardUpload].forEach(c => c.classList.remove('active'));
          if (phase === 'ping') {
            cardPing.classList.add('active');
            cardJitter.classList.add('active');
            gauge.setColor('ping');
            waveform.reset('#0ea5e9');
          } else if (phase === 'download') {
            cardDownload.classList.add('active');
            gauge.setColor('download');
            waveform.reset('#3b82f6');
          } else if (phase === 'upload') {
            cardUpload.classList.add('active');
            gauge.setColor('upload');
            waveform.reset('#8b5cf6');
          }
        },

        onNetworkInfo: (info) => {
          netIsp.textContent = info.isp || 'Broadband ISP';
          netLocation.textContent = info.location ? `${info.ip} (${info.location})` : info.ip;
          finishNetIsp.textContent = info.isp || 'Broadband ISP';
          finishNetIp.textContent = info.location ? `${info.ip} (${info.location})` : info.ip;
        },

        onPingProgress: (data) => {
          metricPing.textContent = Math.round(data.current);
          gauge.setValue(Math.min(data.current, 100));
        },

        onPingComplete: (data) => {
          metricPing.textContent = data.ping;
          metricJitter.textContent = data.jitter;
        },

        onDownloadProgress: (data) => {
          liveSpeedVal.textContent = convertSpeed(data.speedMbps);
          metricDownload.textContent = convertSpeed(data.speedMbps);
          gauge.setValue(data.speedMbps);
          waveform.addPoint(data.speedMbps);
          barDownload.style.width = `${Math.min(data.progress * 100, 100)}%`;
        },

        onDownloadComplete: (data) => {
          metricDownload.textContent = convertSpeed(data.speedMbps);
          barDownload.style.width = '100%';
        },

        onUploadProgress: (data) => {
          liveSpeedVal.textContent = convertSpeed(data.speedMbps);
          metricUpload.textContent = convertSpeed(data.speedMbps);
          gauge.setValue(data.speedMbps);
          waveform.addPoint(data.speedMbps);
          barUpload.style.width = `${Math.min(data.progress * 100, 100)}%`;
        },

        onUploadComplete: (data) => {
          metricUpload.textContent = convertSpeed(data.speedMbps);
          barUpload.style.width = '100%';
        },

        onComplete: async (result) => {
          setTestInactive();
          gauge.setValue(result.download, 'success');
          statusIndicator.classList.remove('busy');

          // Save to history & render finish screen
          await saveResultToHistory(result);
          renderFinishScreen(result);
        },

        onError: (err) => {
          if (err.message !== 'Aborted') {
            phaseStatus.textContent = 'Connection error';
          }
          setTestInactive();
          statusIndicator.classList.remove('busy');
        }
      });
    } catch (e) {
      setTestInactive();
    }
  }

  function setTestInactive() {
    isTesting = false;
    btnText.textContent = 'Start Test';
    btnStart.classList.remove('cancel');
    [cardPing, cardJitter, cardDownload, cardUpload].forEach(c => c.classList.remove('active'));
  }

  btnStart.addEventListener('click', startSpeedTest);
  btnTestAgain.addEventListener('click', () => {
    resetTestUI();
    startSpeedTest();
  });

  // --- Copy Results ---
  btnCopyResults.addEventListener('click', async () => {
    if (!lastTestResult) return;
    const text = `SpeedPulse Results:\nDownload: ${convertSpeed(lastTestResult.download)} ${currentSettings.unit}\nUpload: ${convertSpeed(lastTestResult.upload)} ${currentSettings.unit}\nPing: ${lastTestResult.ping} ms | Jitter: ${lastTestResult.jitter} ms\nISP: ${lastTestResult.network?.isp || 'Broadband'}`;
    
    try {
      await navigator.clipboard.writeText(text);
      copyTextLabel.textContent = 'Copied!';
      setTimeout(() => {
        copyTextLabel.textContent = 'Copy';
      }, 2000);
    } catch (e) {
      alert(text);
    }
  });

  // --- History Management ---
  async function saveResultToHistory(result) {
    const history = await Storage.get('speedpulse_history', []);
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      download: result.download,
      upload: result.upload,
      ping: result.ping,
      jitter: result.jitter,
      isp: result.network?.isp || 'Broadband ISP',
      ip: result.network?.ip || ''
    };
    history.unshift(entry);
    if (history.length > 50) history.pop();
    await Storage.set('speedpulse_history', history);
  }

  async function loadHistory() {
    const history = await Storage.get('speedpulse_history', []);
    renderHistoryStats(history);
    renderHistoryList(history);
  }

  function renderHistoryStats(history) {
    histStatCount.textContent = history.length;
    if (history.length === 0) {
      histStatAvg.innerHTML = `0 <small>${currentSettings.unit}</small>`;
      histStatTop.innerHTML = `0 <small>${currentSettings.unit}</small>`;
      return;
    }

    const totalDown = history.reduce((sum, item) => sum + (item.download || 0), 0);
    const avgDown = totalDown / history.length;
    const topDown = Math.max(...history.map(item => item.download || 0));

    histStatAvg.innerHTML = `${convertSpeed(avgDown)} <small>${currentSettings.unit}</small>`;
    histStatTop.innerHTML = `${convertSpeed(topDown)} <small>${currentSettings.unit}</small>`;
  }

  function renderHistoryList(history) {
    if (!history || history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>No tests recorded yet.</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = history.map(item => `
      <div class="history-item-card">
        <div class="history-item-header">
          <span>${item.date}</span>
          <span>${item.isp}</span>
        </div>
        <div class="history-item-grid">
          <div class="hist-metric">
            <span class="hist-metric-lbl">DOWNLOAD</span>
            <span class="hist-metric-val down">${convertSpeed(item.download)} ${currentSettings.unit}</span>
          </div>
          <div class="hist-metric">
            <span class="hist-metric-lbl">UPLOAD</span>
            <span class="hist-metric-val up">${convertSpeed(item.upload)} ${currentSettings.unit}</span>
          </div>
          <div class="hist-metric">
            <span class="hist-metric-lbl">PING</span>
            <span class="hist-metric-val">${item.ping} ms</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // --- Export ---
  btnExportCsv.addEventListener('click', async () => {
    const history = await Storage.get('speedpulse_history', []);
    if (history.length === 0) return;

    const headers = ['Date', `Download (${currentSettings.unit})`, `Upload (${currentSettings.unit})`, 'Ping (ms)', 'Jitter (ms)', 'ISP', 'IP'];
    const rows = history.map(h => [
      `"${h.date}"`,
      convertSpeed(h.download),
      convertSpeed(h.upload),
      h.ping,
      h.jitter,
      `"${h.isp}"`,
      `"${h.ip}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csvContent, 'speedtest-history.csv', 'text/csv');
  });

  btnExportJson.addEventListener('click', async () => {
    const history = await Storage.get('speedpulse_history', []);
    if (history.length === 0) return;
    const jsonContent = JSON.stringify(history, null, 2);
    downloadFile(jsonContent, 'speedtest-history.json', 'application/json');
  });

  btnClearHistory.addEventListener('click', async () => {
    if (confirm('Clear all test history?')) {
      await Storage.set('speedpulse_history', []);
      loadHistory();
    }
  });

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  loadSettings();
  initNetworkInfo();
});
