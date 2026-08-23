# SpeedPulse - Internet Speed Tester

SpeedPulse is a fast, clean, and lightweight browser extension (Manifest V3) for measuring internet download speed, upload speed, latency (ping), and jitter.

![SpeedPulse](icons/icon128.png)

## Features

- **Accurate Multi-Stream Testing**:
  - **Download**: Multi-stream concurrent chunk downloading via Anycast CDN edge endpoints (`speed.cloudflare.com`).
  - **Upload**: Multi-stream POST chunk transfers.
  - **Latency & Jitter**: Statistical round-trip time (RTT) probing with jitter calculation.
  - **Network Info**: Auto-detects client IP, ISP, and location.
- **Clean Interface**:
  - Minimal circular progress gauge with crisp scale markings.
  - Real-time live waveform chart.
  - Clean data cards for Ping, Jitter, Download, and Upload.
- **History & Export**:
  - Automatically logs test results locally.
  - Export to **CSV** or **JSON**.
- **Preferences**:
  - Toggle speed units (**Mbps**, **MB/s**, **Kbps**).
  - Configurable test duration and stream count.

## Installation

1. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory (`c:\Users\DELL\Documents\antigravity\clever-hopper`).
4. Pin the extension to your toolbar.
