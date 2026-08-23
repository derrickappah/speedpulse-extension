/**
 * SpeedPulse - High-Accuracy Multi-Stream Internet Speed Test Engine
 * 
 * Accuracy Features:
 * - Edge Anycast server routing (<330 global edge locations via Cloudflare)
 * - TCP slow-start warmup filtering (discards initial ramp-up for true saturated bandwidth)
 * - Dynamic adaptive chunk streaming (auto-scales 1MB -> 50MB based on line speed)
 * - Real-time percentile & sliding-window calculation
 * - Statistical outlier rejection for Ping & Jitter
 */

class SpeedTestEngine {
  constructor(options = {}) {
    this.options = {
      pingCount: options.pingCount || 10,
      downloadDuration: options.downloadDuration || 9000, // ms
      uploadDuration: options.uploadDuration || 8000, // ms
      concurrentStreams: options.concurrentStreams || 4,
      warmupDuration: 1500, // ms (discard first 1.5s for peak accuracy)
      ...options
    };

    this.abortController = null;
    this.isRunning = false;
  }

  // Pre-generate reusable byte payloads
  _generatePayload(sizeInBytes) {
    const buffer = new Uint8Array(sizeInBytes);
    // Fill with semi-random bytes to prevent transparent HTTP compression
    for (let i = 0; i < sizeInBytes; i += 65536) {
      crypto.getRandomValues(buffer.subarray(i, Math.min(i + 65536, sizeInBytes)));
    }
    return buffer;
  }

  /**
   * Fetch ISP and Network Meta Information
   */
  async getNetworkInfo() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch('https://speed.cloudflare.com/meta', {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return {
          ip: data.clientIp || 'Unknown',
          isp: data.asOrganization || data.isp || 'Broadband ISP',
          asn: data.asn || '',
          city: data.city || '',
          country: data.country || '',
          location: [data.city, data.country].filter(Boolean).join(', ') || 'Global Edge'
        };
      }
    } catch (e) {
      // Fallback
    }

    try {
      const res = await fetch('https://1.1.1.1/cdn-cgi/trace', { cache: 'no-store' });
      const text = await res.text();
      const lines = text.split('\n');
      const info = {};
      lines.forEach(line => {
        const [k, v] = line.split('=');
        if (k && v) info[k.trim()] = v.trim();
      });
      return {
        ip: info.ip || 'Connected',
        isp: info.colo ? `Edge Location (${info.colo})` : 'Broadband Network',
        asn: info.asn || '',
        city: info.loc || '',
        country: info.loc || '',
        location: info.loc || 'Global'
      };
    } catch (err) {
      return {
        ip: 'Connected',
        isp: 'Internet Service Provider',
        asn: '',
        city: '',
        country: '',
        location: 'Local Network'
      };
    }
  }

  /**
   * Accurate Latency (Ping) and Jitter Probe
   */
  async measurePing(onProgress) {
    const pings = [];
    const count = this.options.pingCount;
    const pingUrl = 'https://speed.cloudflare.com/__down?bytes=0';

    for (let i = 0; i < count; i++) {
      if (this.abortController?.signal.aborted) break;

      const start = performance.now();
      try {
        await fetch(`${pingUrl}&t=${Date.now()}_${i}`, {
          signal: this.abortController.signal,
          cache: 'no-store',
          mode: 'cors'
        });
        const duration = performance.now() - start;
        pings.push(duration);

        if (onProgress) {
          onProgress({
            current: duration,
            progress: (i + 1) / count,
            pings: [...pings]
          });
        }
      } catch (err) {
        if (this.abortController?.signal.aborted) throw new Error('Aborted');
      }

      // 50ms pause between pings
      await new Promise(r => setTimeout(r, 50));
    }

    if (pings.length === 0) {
      throw new Error('Ping failed');
    }

    // Sort to remove extreme statistical outliers (top 15% discard)
    const sorted = [...pings].sort((a, b) => a - b);
    const validSamples = sorted.length > 4 ? sorted.slice(0, Math.ceil(sorted.length * 0.85)) : sorted;
    
    // Minimum RTT is the true network baseline physical latency
    const minPing = validSamples[0];
    const avgPing = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;

    // RFC-standard Jitter: mean absolute difference of consecutive RTTs
    let jitterSum = 0;
    for (let i = 1; i < pings.length; i++) {
      jitterSum += Math.abs(pings[i] - pings[i - 1]);
    }
    const jitter = pings.length > 1 ? jitterSum / (pings.length - 1) : 0;

    return {
      ping: Math.round(minPing * 10) / 10,
      avgPing: Math.round(avgPing * 10) / 10,
      jitter: Math.round(jitter * 10) / 10,
      samples: pings
    };
  }

  /**
   * Accurate Multi-Stream Download Speed Test
   */
  async measureDownload(onProgress) {
    const totalDuration = this.options.downloadDuration;
    const warmupMs = Math.min(this.options.warmupDuration, totalDuration * 0.25);
    const streams = this.options.concurrentStreams;

    const phaseController = new AbortController();
    const abortHandler = () => phaseController.abort();
    this.abortController.signal.addEventListener('abort', abortHandler);

    const startTime = performance.now();
    let isTestActive = true;
    let totalBytesAll = 0;
    
    // Samples recorded post-warmup for calculating true saturated throughput
    let warmupBytes = 0;
    let warmupPassed = false;
    let postWarmupStartTime = startTime + warmupMs;

    let lastSampleTime = startTime;
    let lastSampleBytes = 0;
    let currentFilteredMbps = 0;
    const speedSamples = [];

    // Progressive dynamic chunk sizing based on connection speed
    const getChunkSize = (instantMbps) => {
      if (instantMbps > 300) return 50000000; // 50MB for gigabit+
      if (instantMbps > 100) return 25000000; // 25MB for high speed
      if (instantMbps > 30) return 10000000;  // 10MB
      return 5000000;                         // 5MB
    };

    let currentEstimatedSpeed = 20;

    const streamWorker = async (streamIndex) => {
      while (isTestActive && !phaseController.signal.aborted) {
        const chunkSize = getChunkSize(currentEstimatedSpeed);
        const url = `https://speed.cloudflare.com/__down?bytes=${chunkSize}&stream=${streamIndex}&t=${Date.now()}`;

        try {
          const response = await fetch(url, {
            signal: phaseController.signal,
            cache: 'no-store',
            mode: 'cors'
          });

          if (!response.body) {
            const blob = await response.blob();
            totalBytesAll += blob.size;
            continue;
          }

          const reader = response.body.getReader();
          while (isTestActive && !phaseController.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytesAll += value.length;
            }
          }
        } catch (e) {
          if (phaseController.signal.aborted) return;
          await new Promise(r => setTimeout(r, 80));
        }
      }
    };

    // 100ms Sampling Monitor
    const monitorTimer = setInterval(() => {
      const now = performance.now();
      const elapsedTotal = now - startTime;
      const timeDelta = (now - lastSampleTime) / 1000;

      if (timeDelta > 0.05) {
        const byteDelta = totalBytesAll - lastSampleBytes;
        const instantMbps = (byteDelta * 8) / (timeDelta * 1000000);

        if (!warmupPassed && elapsedTotal >= warmupMs) {
          warmupPassed = true;
          warmupBytes = totalBytesAll;
          postWarmupStartTime = now;
        }

        if (warmupPassed) {
          speedSamples.push(instantMbps);
          // Moving average filter
          if (currentFilteredMbps === 0) {
            currentFilteredMbps = instantMbps;
          } else {
            currentFilteredMbps = 0.3 * instantMbps + 0.7 * currentFilteredMbps;
          }
        } else {
          currentFilteredMbps = instantMbps;
        }

        currentEstimatedSpeed = currentFilteredMbps;
        lastSampleTime = now;
        lastSampleBytes = totalBytesAll;

        const progressPercent = Math.min(elapsedTotal / totalDuration, 1);

        if (onProgress) {
          onProgress({
            speedMbps: Math.round(currentFilteredMbps * 100) / 100,
            instantMbps: Math.round(instantMbps * 100) / 100,
            bytesLoaded: totalBytesAll,
            progress: progressPercent,
            elapsed: elapsedTotal / 1000
          });
        }
      }

      if (elapsedTotal >= totalDuration) {
        isTestActive = false;
        phaseController.abort();
      }
    }, 100);

    // Launch streams
    const workers = [];
    for (let i = 0; i < streams; i++) {
      workers.push(streamWorker(i));
    }

    // Await duration completion
    await new Promise(resolve => {
      const checkTimer = setInterval(() => {
        if (!isTestActive || this.abortController?.signal.aborted) {
          clearInterval(checkTimer);
          resolve();
        }
      }, 50);
    });

    isTestActive = false;
    clearInterval(monitorTimer);
    phaseController.abort();
    this.abortController.signal.removeEventListener('abort', abortHandler);

    if (this.abortController?.signal.aborted) {
      throw new Error('Aborted');
    }

    // Accurate Final Speed Calculation:
    // Saturated throughput post TCP warmup
    const effectiveElapsed = (performance.now() - postWarmupStartTime) / 1000;
    const effectiveBytes = totalBytesAll - warmupBytes;
    let finalSpeedMbps = 0;

    if (effectiveElapsed > 0 && effectiveBytes > 0) {
      finalSpeedMbps = (effectiveBytes * 8) / (effectiveElapsed * 1000000);
    } else {
      const totalElapsed = (performance.now() - startTime) / 1000;
      finalSpeedMbps = (totalBytesAll * 8) / (totalElapsed * 1000000);
    }

    // If speed samples exist, use 90th percentile trimmed average for highest real-world accuracy
    if (speedSamples.length > 5) {
      speedSamples.sort((a, b) => a - b);
      const trimmed = speedSamples.slice(Math.floor(speedSamples.length * 0.1), Math.floor(speedSamples.length * 0.9));
      const sampleAvg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      finalSpeedMbps = 0.6 * finalSpeedMbps + 0.4 * sampleAvg;
    }

    return {
      speedMbps: Math.round(finalSpeedMbps * 100) / 100,
      totalBytes: totalBytesAll,
      duration: (performance.now() - startTime) / 1000
    };
  }

  /**
   * Accurate Multi-Stream Upload Speed Test
   */
  async measureUpload(onProgress) {
    const totalDuration = this.options.uploadDuration;
    const warmupMs = Math.min(this.options.warmupDuration, totalDuration * 0.25);
    const streams = this.options.concurrentStreams;

    const phaseController = new AbortController();
    const abortHandler = () => phaseController.abort();
    this.abortController.signal.addEventListener('abort', abortHandler);

    const startTime = performance.now();
    let isTestActive = true;
    let totalBytesAll = 0;

    let warmupBytes = 0;
    let warmupPassed = false;
    let postWarmupStartTime = startTime + warmupMs;

    let lastSampleTime = startTime;
    let lastSampleBytes = 0;
    let currentFilteredMbps = 0;
    const speedSamples = [];

    // Pre-allocated random payloads to avoid garbage collection delays
    const payload1MB = this._generatePayload(1000000);
    const payload5MB = this._generatePayload(5000000);
    const payload10MB = this._generatePayload(10000000);

    const getUploadPayload = (speed) => {
      if (speed > 150) return payload10MB;
      if (speed > 30) return payload5MB;
      return payload1MB;
    };

    let currentEstimatedSpeed = 15;

    const uploadWorker = async (streamIndex) => {
      while (isTestActive && !phaseController.signal.aborted) {
        const payload = getUploadPayload(currentEstimatedSpeed);
        const url = `https://speed.cloudflare.com/__up?stream=${streamIndex}&t=${Date.now()}`;

        try {
          const response = await fetch(url, {
            method: 'POST',
            body: payload,
            signal: phaseController.signal,
            cache: 'no-store',
            mode: 'cors'
          });

          if (response.ok) {
            totalBytesAll += payload.byteLength;
          }
        } catch (e) {
          if (phaseController.signal.aborted) return;
          await new Promise(r => setTimeout(r, 80));
        }
      }
    };

    const monitorTimer = setInterval(() => {
      const now = performance.now();
      const elapsedTotal = now - startTime;
      const timeDelta = (now - lastSampleTime) / 1000;

      if (timeDelta > 0.05) {
        const byteDelta = totalBytesAll - lastSampleBytes;
        const instantMbps = (byteDelta * 8) / (timeDelta * 1000000);

        if (!warmupPassed && elapsedTotal >= warmupMs) {
          warmupPassed = true;
          warmupBytes = totalBytesAll;
          postWarmupStartTime = now;
        }

        if (warmupPassed) {
          speedSamples.push(instantMbps);
          if (currentFilteredMbps === 0) {
            currentFilteredMbps = instantMbps;
          } else {
            currentFilteredMbps = 0.3 * instantMbps + 0.7 * currentFilteredMbps;
          }
        } else {
          currentFilteredMbps = instantMbps;
        }

        currentEstimatedSpeed = currentFilteredMbps;
        lastSampleTime = now;
        lastSampleBytes = totalBytesAll;

        const progressPercent = Math.min(elapsedTotal / totalDuration, 1);

        if (onProgress) {
          onProgress({
            speedMbps: Math.round(currentFilteredMbps * 100) / 100,
            instantMbps: Math.round(instantMbps * 100) / 100,
            bytesUploaded: totalBytesAll,
            progress: progressPercent,
            elapsed: elapsedTotal / 1000
          });
        }
      }

      if (elapsedTotal >= totalDuration) {
        isTestActive = false;
        phaseController.abort();
      }
    }, 100);

    const workers = [];
    for (let i = 0; i < streams; i++) {
      workers.push(uploadWorker(i));
    }

    await new Promise(resolve => {
      const checkTimer = setInterval(() => {
        if (!isTestActive || this.abortController?.signal.aborted) {
          clearInterval(checkTimer);
          resolve();
        }
      }, 50);
    });

    isTestActive = false;
    clearInterval(monitorTimer);
    phaseController.abort();
    this.abortController.signal.removeEventListener('abort', abortHandler);

    if (this.abortController?.signal.aborted) {
      throw new Error('Aborted');
    }

    const effectiveElapsed = (performance.now() - postWarmupStartTime) / 1000;
    const effectiveBytes = totalBytesAll - warmupBytes;
    let finalSpeedMbps = 0;

    if (effectiveElapsed > 0 && effectiveBytes > 0) {
      finalSpeedMbps = (effectiveBytes * 8) / (effectiveElapsed * 1000000);
    } else {
      const totalElapsed = (performance.now() - startTime) / 1000;
      finalSpeedMbps = (totalBytesAll * 8) / (totalElapsed * 1000000);
    }

    if (speedSamples.length > 5) {
      speedSamples.sort((a, b) => a - b);
      const trimmed = speedSamples.slice(Math.floor(speedSamples.length * 0.1), Math.floor(speedSamples.length * 0.9));
      const sampleAvg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      finalSpeedMbps = 0.6 * finalSpeedMbps + 0.4 * sampleAvg;
    }

    return {
      speedMbps: Math.round(finalSpeedMbps * 100) / 100,
      totalBytes: totalBytesAll,
      duration: (performance.now() - startTime) / 1000
    };
  }

  /**
   * Run Full Test Suite
   */
  async runFullTest(callbacks = {}) {
    this.abortController = new AbortController();
    this.isRunning = true;

    const result = {
      timestamp: new Date().toISOString(),
      network: null,
      ping: 0,
      avgPing: 0,
      jitter: 0,
      download: 0,
      upload: 0
    };

    try {
      // 1. Meta / ISP
      if (callbacks.onPhaseChange) callbacks.onPhaseChange('meta', 'Detecting network...');
      result.network = await this.getNetworkInfo();
      if (callbacks.onNetworkInfo) callbacks.onNetworkInfo(result.network);

      // 2. Ping & Jitter
      if (callbacks.onPhaseChange) callbacks.onPhaseChange('ping', 'Measuring latency...');
      const pingData = await this.measurePing(callbacks.onPingProgress);
      result.ping = pingData.ping;
      result.avgPing = pingData.avgPing;
      result.jitter = pingData.jitter;
      if (callbacks.onPingComplete) callbacks.onPingComplete(pingData);

      // 3. Download Speed
      if (callbacks.onPhaseChange) callbacks.onPhaseChange('download', 'Testing download speed...');
      const downloadData = await this.measureDownload(callbacks.onDownloadProgress);
      result.download = downloadData.speedMbps;
      if (callbacks.onDownloadComplete) callbacks.onDownloadComplete(downloadData);

      // 4. Upload Speed
      if (callbacks.onPhaseChange) callbacks.onPhaseChange('upload', 'Testing upload speed...');
      const uploadData = await this.measureUpload(callbacks.onUploadProgress);
      result.upload = uploadData.speedMbps;
      if (callbacks.onUploadComplete) callbacks.onUploadComplete(uploadData);

      // Complete
      if (callbacks.onPhaseChange) callbacks.onPhaseChange('complete', 'Test completed');
      if (callbacks.onComplete) callbacks.onComplete(result);

      this.isRunning = false;
      return result;
    } catch (err) {
      this.isRunning = false;
      if (callbacks.onError) callbacks.onError(err);
      throw err;
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
  }
}

if (typeof window !== 'undefined') {
  window.SpeedTestEngine = SpeedTestEngine;
}
