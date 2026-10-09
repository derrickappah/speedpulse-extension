const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

let browserPath = null;
for (const p of edgePaths) {
  if (fs.existsSync(p)) {
    browserPath = p;
    break;
  }
}

console.log('Using browser:', browserPath);

const storeDir = path.join(__dirname, 'store_assets');
if (!fs.existsSync(storeDir)) {
  fs.mkdirSync(storeDir, { recursive: true });
}

// 1. Generate Small Promo Tile (440x280) HTML
const smallPromoHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 440px;
    height: 280px;
    background: #0e1217;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f1f5f9;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    border: 1px solid #1f2631;
  }
  .bg-accent {
    position: absolute;
    width: 280px;
    height: 280px;
    background: radial-gradient(circle, rgba(37,99,235,0.18) 0%, rgba(14,18,23,0) 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .icon-box {
    width: 76px;
    height: 76px;
    margin-bottom: 12px;
    z-index: 2;
  }
  .icon-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  h1 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.5px;
    z-index: 2;
    margin-bottom: 6px;
  }
  h1 span {
    color: #3b82f6;
  }
  p {
    font-size: 13px;
    color: #94a3b8;
    z-index: 2;
    text-align: center;
    max-width: 340px;
  }
  .badges {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    z-index: 2;
  }
  .badge {
    background: #171c24;
    border: 1px solid #262e3b;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
  }
  .badge.primary {
    border-color: #2563eb;
    color: #3b82f6;
  }
</style>
</head>
<body>
  <div class="bg-accent"></div>
  <div class="icon-box">
    <img src="file:///${path.resolve(__dirname, 'icons', 'speedometer.svg').replace(/\\/g, '/')}">
  </div>
  <h1>Speed<span>Pulse</span></h1>
  <p>Accurate Real-Time Internet Speed Tester</p>
  <div class="badges">
    <span class="badge primary">Multi-Stream</span>
    <span class="badge">Ping & Jitter</span>
    <span class="badge">No Ads</span>
  </div>
</body>
</html>`;

// 2. Generate Marquee Promo Tile (1400x560) HTML
const marqueePromoHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1400px;
    height: 560px;
    background: #0e1217;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 60px 80px;
    overflow: hidden;
    position: relative;
  }
  .glow-left {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(37,99,235,0.15) 0%, rgba(14,18,23,0) 70%);
    top: 50%;
    left: 20%;
    transform: translate(-50%, -50%);
  }
  .left-content {
    max-width: 600px;
    z-index: 2;
  }
  .logo-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }
  .logo-img {
    width: 54px;
    height: 54px;
  }
  .logo-text {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  .logo-text span {
    color: #3b82f6;
  }
  .hero-title {
    font-size: 46px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -1px;
    margin-bottom: 18px;
    color: #ffffff;
  }
  .hero-desc {
    font-size: 18px;
    color: #94a3b8;
    line-height: 1.5;
    margin-bottom: 28px;
  }
  .feature-pills {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pill {
    background: #171c24;
    border: 1px solid #262e3b;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #cbd5e1;
  }
  .pill.highlight {
    border-color: #2563eb;
    color: #60a5fa;
    background: rgba(37,99,235,0.1);
  }
  .right-preview {
    z-index: 2;
    width: 440px;
    background: #171c24;
    border: 1px solid #262e3b;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  }
  .preview-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .preview-badge {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    font-size: 13px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 6px;
  }
  .preview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  .card {
    background: #0e1217;
    border: 1px solid #262e3b;
    padding: 16px;
    border-radius: 10px;
  }
  .card-label {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 6px;
  }
  .card-val {
    font-size: 30px;
    font-weight: 800;
    color: #f1f5f9;
  }
  .card-val small {
    font-size: 13px;
    color: #94a3b8;
    font-weight: 500;
  }
  .latency-bar {
    display: flex;
    justify-content: space-between;
    background: #0e1217;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    color: #94a3b8;
  }
  .latency-bar span strong {
    color: #f1f5f9;
  }
</style>
</head>
<body>
  <div class="glow-left"></div>
  <div class="left-content">
    <div class="logo-row">
      <img class="logo-img" src="file:///${path.resolve(__dirname, 'icons', 'speedometer.svg').replace(/\\/g, '/')}">
      <div class="logo-text">Speed<span>Pulse</span></div>
    </div>
    <div class="hero-title">Accurate Internet Speed Test at Your Fingertips.</div>
    <div class="hero-desc">Measure download, upload, ping, and jitter in real-time with zero clutter, zero ads, and edge-server accuracy.</div>
    <div class="feature-pills">
      <span class="pill highlight">⚡ Cloudflare Anycast Edge</span>
      <span class="pill">⏱️ Latency & Jitter</span>
      <span class="pill">📊 Performance Breakdown</span>
      <span class="pill">🌓 Dark/Light Mode</span>
    </div>
  </div>

  <div class="right-preview">
    <div class="preview-header">
      <span class="preview-badge">Excellent Connection</span>
      <span style="font-size:13px; color:#64748b;">Fast & Stable</span>
    </div>
    <div class="preview-grid">
      <div class="card">
        <div class="card-label" style="color:#3b82f6;">DOWNLOAD</div>
        <div class="card-val">428.5 <small>Mbps</small></div>
      </div>
      <div class="card">
        <div class="card-label" style="color:#8b5cf6;">UPLOAD</div>
        <div class="card-val">185.2 <small>Mbps</small></div>
      </div>
    </div>
    <div class="latency-bar">
      <span>Ping: <strong>11 ms</strong></span>
      <span>Jitter: <strong>1.4 ms</strong></span>
      <span>Stability: <strong>99.8%</strong></span>
    </div>
  </div>
</body>
</html>`;

// 3. Generate Screenshots (1280x800) HTML
function makeScreenshotHTML(title, subtitle, viewMode) {
  const isFinish = viewMode === 'finish';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px;
    height: 800px;
    background: #0a0d13;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f1f5f9;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .bg-glow {
    position: absolute;
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(37,99,235,0.12) 0%, rgba(10,13,19,0) 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .header-text {
    text-align: center;
    margin-bottom: 24px;
    z-index: 2;
  }
  .header-text h2 {
    font-size: 34px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.5px;
    margin-bottom: 6px;
  }
  .header-text h2 span {
    color: #3b82f6;
  }
  .header-text p {
    font-size: 16px;
    color: #94a3b8;
  }
  .extension-frame {
    width: 370px;
    height: 560px;
    background: #0e1217;
    border: 1px solid #262e3b;
    border-radius: 12px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.6);
    overflow: hidden;
    z-index: 2;
  }
  .extension-frame iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="header-text">
    <h2>${title}</h2>
    <p>${subtitle}</p>
  </div>
  <div class="extension-frame">
    <iframe src="file:///${path.resolve(__dirname, 'popup.html').replace(/\\/g, '/')}"></iframe>
  </div>
</body>
</html>`;
}

// Write temp HTML files
fs.writeFileSync(path.join(storeDir, 'temp_small.html'), smallPromoHTML);
fs.writeFileSync(path.join(storeDir, 'temp_marquee.html'), marqueePromoHTML);
fs.writeFileSync(path.join(storeDir, 'temp_screen1.html'), makeScreenshotHTML('Speed<span>Pulse</span> Internet Speed Tester', 'Accurate, real-time download & upload measurement', 'live'));
fs.writeFileSync(path.join(storeDir, 'temp_screen2.html'), makeScreenshotHTML('Comprehensive <span>Performance Breakdown</span>', 'Detailed real-world streaming, gaming & latency analysis', 'finish'));

console.log('Generated temp HTML templates.');

if (browserPath) {
  const tempProfileDir = path.join(os.tmpdir(), `edge_store_${Date.now()}`);

  const jobs = [
    { html: 'temp_small.html', out: 'small_promo_440x280.png', w: 440, h: 280 },
    { html: 'temp_marquee.html', out: 'marquee_promo_1400x560.png', w: 1400, h: 560 },
    { html: 'temp_screen1.html', out: 'screenshot_1280x800_live.png', w: 1280, h: 800 },
    { html: 'temp_screen2.html', out: 'screenshot_1280x800_breakdown.png', w: 1280, h: 800 }
  ];

  jobs.forEach(job => {
    const htmlPath = path.join(storeDir, job.html).replace(/\\/g, '/');
    const outPath = path.join(storeDir, job.out).replace(/\\/g, '/');
    try {
      execSync(`"${browserPath}" --headless --disable-gpu --user-data-dir="${tempProfileDir}" --force-device-scale-factor=1 --window-size=${job.w},${job.h} --default-background-color=0e1217ff --screenshot="${outPath}" "file:///${htmlPath}"`, { timeout: 15000 });
      console.log(`Rendered: ${job.out}`);
    } catch (e) {
      console.error(`Error rendering ${job.out}:`, e.message);
    }
  });

  // Clean temp files
  ['temp_small.html', 'temp_marquee.html', 'temp_screen1.html', 'temp_screen2.html'].forEach(f => {
    try { fs.unlinkSync(path.join(storeDir, f)); } catch(e){}
  });

  try { fs.rmSync(tempProfileDir, { recursive: true, force: true }); } catch(e){}
}
