# Nova Optimize

[![CI](https://github.com/riksitis1/nova-optimize-web/actions/workflows/ci.yml/badge.svg)](https://github.com/riksitis1/nova-optimize-web/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v1.4.0-b8ff2c.svg)](https://github.com/riksitis1/nova-optimize-web/releases)
[![Anti-Cheat Safe](https://img.shields.io/badge/Anti--Cheat-Safe-38ef7d.svg)](SECURITY.md)

A free, local-first Windows gaming performance, latency reduction, and system configuration suite. Zero accounts, zero ads, zero telemetry, zero background daemons, and zero paywalls.

Nova scans your PC, explains what is actually worth changing, applies only the changes you select, backs up every value before modification, and lets you undo individual settings or all changes in 1 click.

![Nova Optimize](assets/logo.svg)

---

## What It Does

- **Hardware-Aware Readiness Scan:** Transparent configuration score with hardware protection (AMD Dual-CCD 3D V-Cache parking preservation and Intel 12th+ Gen EcoQoS hybrid core preservation).
- **32 Documented System Optimizations:**
  - **CPU & Scheduling:** Anti-cheat safe IFEO process priority, Foreground CPU Quantum Boost (`Win32PrioritySeparation = 0x26`), MMCSS low-latency audio scheduling, Background CPU Power Throttling management, and paging executive kernel lock.
  - **Low-Latency Network & QoS:** Active DSCP 46 (Expedited Forwarding) kernel packet tagging for competitive titles (CS2, Fortnite, Valorant, Roblox, Apex, Minecraft), AFD Fast Datagram Transmit (UDP ping reducer), NIC Hardware De-Jitter (disabling Energy Efficient Ethernet & Flow Control), TCP Auto-Tuning, and Receive-Side Scaling (RSS).
  - **GPU & Presentation:** DirectFlip DX10/11 windowed optimizations (`SwapEffectUpgradeEnable`), Hardware-Accelerated GPU Scheduling (HAGS), PCIe Message Signaled Interrupts (MSI Mode), TdrDelay shader timeout protection, and Multiplane Overlay (MPO) bypass.
  - **Input & Display:** 1:1 linear mouse response, USB selective suspend bypass for input devices, instant menu show delay, and window animation bypass.
- **Smart Stale Shader Cache Cleanup:** Safely purges stale compiled shader files (>30 days old) from `DXCache`, `GLCache`, and `D3DSCache` to reclaim tens of gigabytes of disk space while keeping active shaders intact to prevent in-game compilation stutter.
- **Per-Game Video Profiles:** Clean, reversible visual config editors for **Fortnite** (`GameUserSettings.ini`), **Counter-Strike 2** (`cs2_video.txt`), and **Minecraft: Java Edition** (`options.txt`).
- **Network Lab:** Game-route latency diagnostics over ICMP/TCP, packet jitter, packet loss, DNS benchmark, DNS flush, and speed testing with bufferbloat grading.
- **Activity & Emergency Restore:** Cryptographic per-action backups stored in `data/state.json`, full audit trail, and 1-click "Undo all".

---

## Cryptographic Release Verification

To verify the integrity of your downloaded installer or archive using Windows PowerShell:

```powershell
# For the Self-Extracting Setup
Get-FileHash .\Nova-Optimize-Setup-v1.4.0.cmd -Algorithm SHA256

# For the Portable Source Archive
Get-FileHash .\Nova-Optimize-v1.4.0.zip -Algorithm SHA256
```

Official SHA-256 release hashes are published and attested on the [GitHub Releases](https://github.com/riksitis1/nova-optimize-web/releases) page and [Official Portal](https://nova-optimize.onrender.com).

---

## Security & Anti-Cheat Compliance

Nova Optimize strictly follows an elite systems engineering safety standard:

- **100% Anti-Cheat Compatible:** Compliant with Valve Anti-Cheat (VAC), Easy Anti-Cheat (EAC), BattlEye, Riot Vanguard, and Roblox Hyperion. Nova **never** injects DLLs, never hooks game memory, and bundles no kernel drivers (`.sys`).
- **Loopback Only:** Binds strictly to `127.0.0.1` with a random per-launch bearer token.
- **Zero Telemetry:** No user tracking, no metrics, and no network analytics. Everything remains 100% local on your PC.

For detailed security specifications, see [SECURITY.md](SECURITY.md).

---

## Requirements & Quick Start

1. **Windows 10 or Windows 11 (64-bit)**
2. **Node.js 18+ LTS** (Installer auto-detects and installs via `winget` if missing)
3. Run `Nova-Optimize-Setup-v1.4.0.cmd` or extract `Nova-Optimize-v1.4.0.zip` and run `Install Nova.bat`.

---

## Development & Testing

Nova has **zero npm dependencies** and runs on the Node.js standard library and Windows PowerShell 5.1+:

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
