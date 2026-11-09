# Security & Integrity Policy

Nova Optimize is built on a strict, auditable, and non-destructive systems engineering architecture. We prioritize system stability, anti-cheat safety, and user privacy above all else.

---

## 1. Anti-Cheat Safety & Operating Boundaries

Nova Optimize is 100% compliant with modern competitive gaming anti-cheat platforms, including **Valve Anti-Cheat (VAC)**, **Easy Anti-Cheat (EAC)**, **BattlEye**, **Riot Vanguard**, and **Roblox Hyperion**:

- **No Kernel Drivers:** Nova does not install, load, or bundle third-party kernel drivers (`.sys` files) or kernel bypasses.
- **No DLL Injection or Memory Hooking:** Nova never injects dynamic-link libraries, never attaches debuggers, and never reads or writes the virtual memory (`VirtualAlloc`, `WriteProcessMemory`) of running game processes.
- **Pure Native Windows APIs:** All performance parameters are applied through documented Windows NT kernel registry policies, Group Policy QoS Packet Scheduler (`pacer.sys`), Image File Execution Options (`PerfOptions`), MMCSS multimedia scheduling, and NDIS network driver parameters.
- **Game Config Safety:** Competitive game tweaks (CS2, Fortnite, Minecraft) modify only official plaintext configuration files (`cs2_video.txt`, `GameUserSettings.ini`, `options.txt`) while games are closed.

---

## 2. Local-Only Loopback Architecture & Zero Telemetry

- **Strict `127.0.0.1` Loopback:** The Nova local server binds strictly to the localhost loopback address (`127.0.0.1`). It cannot be accessed over LAN or WAN.
- **Session Authentication:** Every launch generates a cryptographically random per-session bearer token. All API requests validate the token, the HTTP `Host` header, and reject cross-origin requests.
- **Zero Telemetry:** Nova contains zero telemetry, analytics, tracking beacons, advertising SDKs, or cloud synchronization. Everything Nova measures or configures stays 100% local on your PC.

---

## 3. Cryptographic State Preservation & Full Reversibility

- **Automated Pre-Change Backups:** Before applying any tweak, Nova records the exact pre-existing registry values, types, and existence states into `data/state.json`.
- **Atomic Revert:** Restoring an action (`Undo`) restores the recorded state or deletes newly created keys, returning Windows to its stock configuration without side effects.
- **Hardware-Aware Safety:** Nova detects dual-CCD AMD 3D V-Cache processors (`7900X3D`, `7950X3D`, `9950X3D`) to protect CCD core parking, and Intel 12th+ Gen hybrid CPUs to preserve EcoQoS background scheduling.
- **System Restore Checkpoints:** Nova integrates directly with Windows System Restore, enabling full system restore points before applying batches of optimizations.

---

## 4. Reporting a Vulnerability

If you discover a security vulnerability or safety edge case in Nova Optimize, please report it responsibly:

1. Submit a private advisory via **[GitHub Security Advisories](https://github.com/riksitis1/nova-optimize-web/security/advisories)**.
2. Alternatively, open an issue labeled `security` on the repository with technical reproduction steps.

Security issues are triaged immediately and patched in public point releases.

