# Privacy Policy for SpeedPulse

**Last updated:** October 9, 2026

SpeedPulse ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains our data practices.

---

### 1. Single Purpose
SpeedPulse is designed solely to measure and display real-time internet connection performance, including download speed, upload speed, latency (ping), and jitter.

---

### 2. Information We Handle
- **Network Performance Data**: During an active test, temporary network packets are transferred between your browser and edge test servers (Cloudflare) to compute your transfer rate and latency.
- **Local Settings & History**: Your speed preferences (units, duration, theme) and past test results are stored **locally on your device** using `chrome.storage.local`.
- **IP Address & ISP**: The extension temporarily queries edge server metadata to display your public IP and ISP name in the popup. **This information is never collected, logged, tracked, or sent to any third party or remote server.**

---

### 3. Data Collection and Selling
- **No Personal Data Collection**: We do not collect names, email addresses, passwords, browsing history, or personal identifiable information (PII).
- **No Third-Party Tracking**: We do not use analytics trackers, telemetry, or advertising SDKs.
- **No Data Selling**: We do not sell, rent, trade, or monetize user data under any circumstances.

---

### 4. Permissions
- `storage`: Used exclusively to persist your theme preference, display unit choices, and test history locally on your computer.
- `host_permissions` (`https://speed.cloudflare.com/*`, `https://1.1.1.1/*`): Required to perform latency probes and stream test data chunks directly against edge servers.

---

### 5. Third-Party Services
Speed tests communicate directly with Cloudflare Anycast edge servers (`speed.cloudflare.com`) to measure bandwidth. Network communications are governed by standard internet routing protocols.

---

### 6. Contact & Support
If you have questions about this privacy policy, you can open an issue on our GitHub repository:
https://github.com/derrickappah/speedpulse-extension/issues
