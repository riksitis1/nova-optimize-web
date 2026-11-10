# Nexa Optimize

[![License: Proprietary Freeware](https://img.shields.io/badge/License-Proprietary%20Freeware-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v1.9.0-b8ff2c.svg)](https://github.com/riksitis1/nova-optimize-web/releases)
[![No Kernel Drivers](https://img.shields.io/badge/No%20Kernel%20Drivers-38ef7d.svg)](SECURITY.md)

A free, local-first Windows gaming performance, latency diagnostics, and system configuration suite. Zero accounts, zero ads, zero telemetry, zero background daemons, and zero paywalls.

Nexa scans your PC, explains what is actually worth changing, applies only the changes you select, backs up every value before modification, and lets you undo individual settings or all changes in 1 click.

![Nexa Optimize](public/assets/logo.svg)

---

## What It Does

- **Hardware-Aware Readiness Scan:** A transparent configuration score based on safe, reversible settings and real system findings. It does not promise a specific FPS gain.
- **26 Documented, Reversible Optimizations:**
  - **One-click (1):** Windows Game Mode.
  - **Situational (15):** Capture, windowed graphics, background apps, visual effects, Windows power plans, Windows Update sharing, fullscreen behavior, Fast Startup, diagnostics, GPU scheduling, network adapter power saving, and kernel paging.
  - **Advanced, opt-in (10):** Multimedia network throttling, system responsiveness, mouse acceleration, Nagle/TCP acknowledgements, TCP auto-tuning/RSS, Win32 priority separation, global power throttling, AFD fast datagram, DSCP 46 QoS, and MPO bypass.
  - Advanced and caution controls are excluded from the readiness score and from the one-click safe fix. Apply them one at a time and undo anything that does not help.
- **Legacy Undo:** Seven tweaks removed in v1.5.0 (IFEO priorities, MMCSS audio, USB selective suspend, TDR delay, NIC EEE/flow control, PCIe MSI) remain undoable if an older version applied them.
- **Windows gaming setup:** Inspect your primary display mode, AC power, memory commit, and page-file configuration. Review applicable Windows changes and optionally lower CPU priority for running cloud-sync apps.
- **Frame-time benchmark:** Import two raw PresentMon CSVs to compare average FPS, 1% lows, and 99th-percentile frame time. Captures are processed locally. [PresentMon capture format](https://github.com/GameTechDev/PresentMon/blob/main/README-CaptureApplication.md#metric-and-csv-column-definitions)
- **Pre-game prep:** Samples CPU use for supported apps with open windows. Select the apps you want Windows to ask to close.
- **Cleanup:** Shader caches require explicit selection. Clearing them can cause stutter while games rebuild shaders. Cleanup also lists supported optional Windows apps you can uninstall for your account.
- **Max FPS profiles:** Preview and apply lower graphics settings for Fortnite, Counter-Strike 2, and Minecraft Java. Nexa keeps the original values for restore. On a dual-GPU PC, use the Windows graphics shortcut to select the high-performance GPU for your game. Compare average FPS and 1% lows in the same scene to decide which profile works best.
- **Network Lab:** Game-route latency diagnostics over ICMP/TCP, packet jitter, packet loss, DNS benchmark, DNS flush, and speed testing with bufferbloat grading.
- **Activity & Emergency Restore:** Exact per-action backups stored in `data/state.json`, a full audit trail, and 1-click "Undo all".

---

## Windows gaming references

- [Windowed graphics optimizations and per-app GPU preferences](https://support.microsoft.com/en-us/windows/hardware/display-graphics/optimizations-for-windowed-games-in-windows-11)
- [Display refresh rate and Dynamic Refresh Rate](https://support.microsoft.com/en-us/windows/hardware/display-graphics/change-the-refresh-rate-on-your-monitor-in-windows)
- [System-managed page files and memory commit](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/how-to-determine-the-appropriate-page-file-size-for-64-bit-versions-of-windows)
- [Windows process priority classes](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities)
- [AMD dual-CCD Ryzen X3D gaming setup](https://community.amd.com/t5/gaming/how-to-set-up-your-system-with-a-new-amd-ryzen-9-7950x3d-or/ba-p/589464)

## Cryptographic Release Verification

To verify the integrity of your downloaded installer or archive using Windows PowerShell:

```powershell
# For the Self-Extracting Setup
Get-FileHash .\Nexa-Optimize-Setup-v1.9.0.cmd -Algorithm SHA256

# For the Portable Source Archive
Get-FileHash .\Nexa-Optimize-v1.9.0.zip -Algorithm SHA256
```

Official SHA-256 checksums are published in `version.json` and on the download page. The built-in updater verifies the checksum before installing an update.

---

## Security & Anti-Cheat Boundaries

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
3. Run `Nexa-Optimize-Setup-v1.9.0.cmd` or extract `Nexa-Optimize-v1.9.0.zip` and run `Install Nexa.bat`.

---

## Development & Testing

Nexa has **zero npm dependencies** and runs on the Node.js standard library and Windows PowerShell 5.1+:

```powershell
# Run syntax checks across all modules
node tools/check.js

# Run test suites covering actions, revert mechanics, and network logic
node tools/test.js

# Rebuild release packages and update checksums
node tools/build.js
```

---

## License

Proprietary Freeware. See [LICENSE](LICENSE) for the full EULA and disclaimers.
