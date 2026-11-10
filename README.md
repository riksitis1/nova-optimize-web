# Nexa Optimize

[![CI](https://github.com/riksitis1/nova-optimize-web/actions/workflows/ci.yml/badge.svg)](https://github.com/riksitis1/nova-optimize-web/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v1.5.0-b8ff2c.svg)](https://github.com/riksitis1/nova-optimize-web/releases)
[![Anti-Cheat Safe](https://img.shields.io/badge/Anti--Cheat-Safe-38ef7d.svg)](SECURITY.md)

A free, local-first Windows gaming performance, latency reduction, and system configuration suite. Zero accounts, zero ads, zero telemetry, zero background daemons, and zero paywalls.

Nexa scans your PC, explains what is actually worth changing, applies only the changes you select, backs up every value before modification, and lets you undo individual settings or all changes in 1 click.

![Nexa Optimize](public/assets/logo.svg)

---

## What It Does

- **Hardware-Aware Readiness Scan:** A transparent configuration score based on safe, reversible settings and real system findings. It does not promise a specific FPS gain.
- **25 Documented, Reversible Optimizations:**
  - **Safe (12):** Game Mode, Game DVR background recording off, windowed flip-model presentation, background app limits, transparency effects, high-performance power plan, Delivery Optimization P2P off, exclusive fullscreen for older games, Fast Startup off, reduced diagnostic data collection, window animations off, and menu show delay.
  - **Caution (3):** Hardware-accelerated GPU scheduling, network adapter power saving, and keeping kernel/drivers in RAM.
  - **Advanced, opt-in (10):** Multimedia network throttling, system responsiveness, mouse acceleration, Nagle/TCP acknowledgements, TCP auto-tuning/RSS, Win32 priority separation, global power throttling, AFD fast datagram, DSCP 46 QoS, and MPO bypass.
  - Advanced and caution controls are excluded from the readiness score and from the one-click safe fix. Apply them one at a time and undo anything that does not help.
- **Legacy Undo:** Seven tweaks removed in v1.5.0 (IFEO priorities, MMCSS audio, USB selective suspend, TDR delay, NIC EEE/flow control, PCIe MSI) remain undoable if an older version applied them.
- **Smart Stale Shader Cache Cleanup:** Purges stale compiled shader files (older than 30 days) from `DXCache`, `GLCache`, and `D3DSCache` while keeping recent shaders intact. This can reclaim disk space and reduce unnecessary shader recompilation.
- **Per-Game Video Profiles:** Clean, reversible visual config editors for **Fortnite** (`GameUserSettings.ini`), **Counter-Strike 2** (`cs2_video.txt`), and **Minecraft: Java Edition** (`options.txt`).
- **Network Lab:** Game-route latency diagnostics over ICMP/TCP, packet jitter, packet loss, DNS benchmark, DNS flush, and speed testing with bufferbloat grading.
- **Activity & Emergency Restore:** Exact per-action backups stored in `data/state.json`, a full audit trail, and 1-click "Undo all".

---

## Cryptographic Release Verification

To verify the integrity of your downloaded installer or archive using Windows PowerShell:

```powershell
# For the Self-Extracting Setup
Get-FileHash .\Nexa-Optimize-Setup-v1.5.0.cmd -Algorithm SHA256

# For the Portable Source Archive
Get-FileHash .\Nexa-Optimize-v1.5.0.zip -Algorithm SHA256
```

Official SHA-256 release hashes are published and attested on the [GitHub Releases](https://github.com/riksitis1/nova-optimize-web/releases) page and [Official Portal](https://nova-optimize.onrender.com).

---

## Security & Anti-Cheat Compliance

Nexa Optimize follows a conservative, auditable safety standard:

- **No Kernel Drivers or Game Memory Access:** Nexa does not install kernel drivers (`.sys`), inject DLLs, hook game memory, or attach debuggers. It avoids the techniques anti-cheat systems commonly flag, but no software can guarantee compatibility with every anti-cheat update.
- **Loopback Only:** Binds strictly to `127.0.0.1` with a random per-launch bearer token.
- **Zero Telemetry:** No user tracking, no metrics, and no network analytics. Everything remains local on your PC.
- **No Destructive System Changes:** Nexa does not disable Windows Defender, Windows Firewall, SmartScreen, UAC, Core Isolation, or Windows Update. It does not install drivers, overclock hardware, or delete personal files.

For detailed security specifications, see [SECURITY.md](SECURITY.md).

---

## Requirements & Quick Start

1. **Windows 10 or Windows 11 (64-bit)**
2. **Node.js 18+ LTS** (Installer auto-detects and installs via `winget` if missing)
3. Run `Nexa-Optimize-Setup-v1.5.0.cmd` or extract `Nexa-Optimize-v1.5.0.zip` and run `Install Nexa.bat`.

---

## Development & Testing

Nexa has **zero npm dependencies** and runs on the Node.js standard library and Windows PowerShell 5.1+:

```powershell
# Run syntax checks across all modules
node tools/check.js

# Run test suites covering actions, revert mechanics, and network logic
node tools/test.js

# Rebuild release packages and update checksums
powershell -ExecutionPolicy Bypass -File tools/build.ps1
```

---

## License

MIT License. See [LICENSE](LICENSE) for full legal text and disclaimers.
