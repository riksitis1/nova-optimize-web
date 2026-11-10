# Security & Integrity Policy

Nexa Optimize is built on a strict, auditable, and non-destructive systems engineering architecture. We prioritize system stability, anti-cheat safety, and user privacy above all else.

---

## 1. Anti-Cheat Safety & Operating Boundaries

Nexa Optimize is designed to avoid the techniques that modern anti-cheat platforms commonly flag, including **Valve Anti-Cheat (VAC)**, **Easy Anti-Cheat (EAC)**, **BattlEye**, **Riot Vanguard**, and **Roblox Hyperion**:

- **No Kernel Drivers:** Nexa does not install, load, or bundle third-party kernel drivers (`.sys` files) or kernel bypasses.
- **No DLL Injection or Memory Hooking:** Nexa never injects dynamic-link libraries, never attaches debuggers, and never reads or writes the virtual memory (`VirtualAlloc`, `WriteProcessMemory`) of running game processes.
- **Documented Windows Settings Only:** Performance parameters are applied through documented Windows registry policies, Windows QoS Packet Scheduler settings, TCP/IP and AFD parameters, power management APIs, and standard game configuration files.
- **No Guarantee:** Anti-cheat software changes over time. No utility can guarantee compatibility with every anti-cheat update, but Nexa avoids kernel drivers, injection, and game-memory access.
- **Game Config Safety:** Competitive game tweaks (CS2, Fortnite, Minecraft) modify only official plaintext configuration files (`cs2_video.txt`, `GameUserSettings.ini`, `options.txt`) while games are closed.

---

## 2. Local-Only Loopback Architecture & Zero Telemetry

- **Strict `127.0.0.1` Loopback:** The Nexa local server binds strictly to the localhost loopback address (`127.0.0.1`). It cannot be accessed over LAN or WAN.
- **Session Authentication:** Every launch generates a cryptographically random per-session bearer token. All API requests validate the token, the HTTP `Host` header, and reject cross-origin requests.
- **Zero Telemetry:** Nexa contains zero telemetry, analytics, tracking beacons, advertising SDKs, or cloud synchronization. Everything Nexa measures or configures stays 100% local on your PC.

---

## 3. State Preservation & Full Reversibility

- **Automated Pre-Change Backups:** Before applying any tweak, Nexa records the exact pre-existing registry values, types, and existence states into `data/state.json`.
- **Atomic Revert:** Restoring an action (`Undo`) restores the recorded state or deletes values that did not exist. It does not guarantee that third-party software or later Windows updates will not change the same values again.
- **Conservative Public Action Set:** v1.5.0 exposes 25 actions: 12 safe, 3 caution, and 10 advanced. Caution and advanced actions are excluded from the readiness score and the one-click safe fix. Seven older tweaks are undo-only.
- **System Restore Checkpoints:** Nexa integrates directly with Windows System Restore, enabling full system restore points before applying batches of optimizations.

---

## 4. Reporting a Vulnerability

If you discover a security vulnerability or safety edge case in Nexa Optimize, please report it responsibly:

1. Submit a private advisory via **[GitHub Security Advisories](https://github.com/riksitis1/nova-optimize-web/security/advisories)**.
2. Alternatively, open an issue labeled `security` on the repository with technical reproduction steps.

Security issues are triaged immediately and patched in public point releases.

