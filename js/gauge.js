/**
 * SpeedPulse - Dynamic Speedometer Gauge & Live Waveform Chart
 */

class SpeedGauge {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.currentValue = 0;
    this.targetValue = 0;
    this.animationId = null;
    this.unit = 'Mbps';
    this.colorTheme = {
      idle: '#3b82f6',
      ping: '#0ea5e9',
      download: '#3b82f6',
      upload: '#8b5cf6',
      success: '#10b981'
    };
    this.activeColor = this.colorTheme.idle;
    this.setupDPI();
    this.render();
  }

  setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 280;
    this.height = rect.height || 210;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  setColor(colorKey) {
    this.activeColor = this.colorTheme[colorKey] || colorKey;
  }

  setUnit(unit) {
    this.unit = unit || 'Mbps';
    this.render();
  }

  getScaleMarks() {
    if (this.unit === 'MB/s') {
      return [
        { val: 0, label: '0', isMajor: true },
        { val: 1.25, label: '1', isMajor: false },
        { val: 6.25, label: '6', isMajor: false },
        { val: 12.5, label: '12', isMajor: true },
        { val: 31.25, label: '30', isMajor: false },
        { val: 62.5, label: '60', isMajor: true },
        { val: 125, label: '125', isMajor: true }
      ];
    }
    if (this.unit === 'Kbps') {
      return [
        { val: 0, label: '0', isMajor: true },
        { val: 10000, label: '10k', isMajor: false },
        { val: 50000, label: '50k', isMajor: false },
        { val: 100000, label: '100k', isMajor: true },
        { val: 250000, label: '250k', isMajor: false },
        { val: 500000, label: '500k', isMajor: true },
        { val: 1000000, label: '1M', isMajor: true }
      ];
    }
    // Default Mbps
    return [
      { val: 0, label: '0', isMajor: true },
      { val: 10, label: '10', isMajor: false },
      { val: 50, label: '50', isMajor: false },
      { val: 100, label: '100', isMajor: true },
      { val: 250, label: '250', isMajor: false },
      { val: 500, label: '500', isMajor: true },
      { val: 1000, label: '1000', isMajor: true }
    ];
  }

  valueToAngle(rawVal) {
    const minAngle = 0.8 * Math.PI;
    const maxAngle = 2.2 * Math.PI;
    const totalSpan = maxAngle - minAngle;

    if (rawVal <= 0) return minAngle;

    // Normalize value to 0..1000 equivalent
    let val = rawVal;
    if (this.unit === 'MB/s') val = rawVal * 8;
    if (this.unit === 'Kbps') val = rawVal / 1000;

    let norm = 0;
    if (val <= 10) {
      norm = (val / 10) * 0.20;
    } else if (val <= 100) {
      norm = 0.20 + ((val - 10) / 90) * 0.35;
    } else if (val <= 500) {
      norm = 0.55 + ((val - 100) / 400) * 0.25;
    } else {
      norm = 0.80 + Math.min((val - 500) / 500, 1) * 0.20;
    }

    norm = Math.min(Math.max(norm, 0), 1);
    return minAngle + norm * totalSpan;
  }

  setValue(val, colorKey = null) {
    this.targetValue = Math.max(0, val);
    if (colorKey) this.setColor(colorKey);
    this.startAnimation();
  }

  startAnimation() {
    if (this.animationId) return;

    const animate = () => {
      const diff = this.targetValue - this.currentValue;
      if (Math.abs(diff) < 0.05) {
        this.currentValue = this.targetValue;
        this.render();
        this.animationId = null;
        return;
      }

      this.currentValue += diff * 0.22;
      this.render();
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2 + 12;
    const radius = w * 0.36;

    ctx.clearRect(0, 0, w, h);

    const startAngle = 0.8 * Math.PI;
    const endAngle = 2.2 * Math.PI;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // 1. Background Arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle, false);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = isLight ? '#e2e8f0' : '#1e2632';
    ctx.stroke();
    ctx.restore();

    // 2. Active Progress Arc
    const currentAngle = this.valueToAngle(this.currentValue);
    if (this.currentValue > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, currentAngle, false);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = this.activeColor;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Clean Tick Marks
    const marks = this.getScaleMarks();
    marks.forEach(mark => {
      const angle = this.valueToAngle(mark.val);
      const isMajor = mark.isMajor;
      const innerR = radius - (isMajor ? 12 : 8);
      const outerR = radius - 4;

      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * outerR;
      const y2 = cy + Math.sin(angle) * outerR;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? (isLight ? '#94a3b8' : '#475569') : (isLight ? '#cbd5e1' : '#334155');
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isMajor) {
        const textR = radius - 20;
        const tx = cx + Math.cos(angle) * textR;
        const ty = cy + Math.sin(angle) * textR;
        ctx.fillStyle = isLight ? '#475569' : '#64748b';
        ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mark.label, tx, ty);
      }
      ctx.restore();
    });
  }
}

/**
 * Clean Live Waveform Chart
 */
class LiveWaveformChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.points = [];
    this.maxPoints = 35;
    this.color = '#3b82f6';
    this.setupDPI();
  }

  setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 280;
    this.height = rect.height || 38;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  setColor(color) {
    this.color = color;
  }

  addPoint(val) {
    this.points.push(val);
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    this.render();
  }

  reset(color = '#3b82f6') {
    this.points = [];
    this.color = color;
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    ctx.clearRect(0, 0, w, h);

    if (this.points.length < 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, h - 4);
      ctx.lineTo(w, h - 4);
      ctx.strokeStyle = isLight ? '#e2e8f0' : '#1e2632';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }

    const maxVal = Math.max(...this.points, 10);
    const step = w / (this.maxPoints - 1);
    const startIndex = this.maxPoints - this.points.length;

    // Translucent fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startIndex * step, h);

    this.points.forEach((p, idx) => {
      const x = (startIndex + idx) * step;
      const y = h - (p / maxVal) * (h - 8) - 4;
      if (idx === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (startIndex + idx - 1) * step;
        const prevY = h - (this.points[idx - 1] / maxVal) * (h - 8) - 4;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
      }
    });

    const lastX = (startIndex + this.points.length - 1) * step;
    const lastY = h - (this.points[this.points.length - 1] / maxVal) * (h - 8) - 4;
    ctx.lineTo(lastX, lastY);
    ctx.lineTo(lastX, h);
    ctx.closePath();

    ctx.fillStyle = this.color + (isLight ? '22' : '18');
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    this.points.forEach((p, idx) => {
      const x = (startIndex + idx) * step;
      const y = h - (p / maxVal) * (h - 8) - 4;
      if (idx === 0) ctx.moveTo(x, y);
      else {
        const prevX = (startIndex + idx - 1) * step;
        const prevY = h - (this.points[idx - 1] / maxVal) * (h - 8) - 4;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
      }
    });
    ctx.lineTo(lastX, lastY);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.SpeedGauge = SpeedGauge;
  window.LiveWaveformChart = LiveWaveformChart;
}
