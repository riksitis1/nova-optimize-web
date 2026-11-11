# Windows performance audit

Reviewed for Nexa 1.11.0 on 2026-11-11. This is an audit of the app's controls and common Windows tuning categories. It is not an exhaustive catalogue of every driver, firmware, game, or Windows build. No measured FPS improvement is claimed by this release.

## Changes made after inspection

| Finding | Resolution |
| --- | --- |
| `SystemResponsiveness=0` was described as reserving 0% CPU | Retired. Microsoft documents that values below 10 are treated as 20. |
| Forced working-set trimming was still callable through the API | Removed the bridge implementation. The old endpoint returns HTTP 410. Use selected app closure and startup controls instead. |
| Kernel paging, global scheduler/power/fullscreen overrides, old background-app registry value, AFD UDP values and DSCP policies lacked a sound universal gaming recommendation | Retired eight controls from new application. Existing IDs and backup restoration remain available. |
| A saved backup made a setting appear optimized even if Windows no longer reported the target value | Current configuration and Nexa's saved backup are tracked separately. |
| Incomplete registry read could allow a write without a complete backup | Validate every original value before writing. |
| Empty or partial restore responses could discard backups | Fail the restore and retain the backup for retry. |
| Network failure could automatically repeat a POST | Retry network failures only for GET/HEAD. A lost mutation response requires a rescan. |
| Appx removal returned success without re-enumerating packages | Verify the exact package family is absent. Report failed/unknown outcomes per item. |
| Failed app inventory could be shown as no installed apps | Show inventory failure separately from an empty inventory. |

## Performance decisions

| Category | Decision and expected scope |
| --- | --- |
| Game Mode | Retain as the low-risk default, with no FPS guarantee. |
| Windowed graphics | Suggest on Windows 11 22H2+. DX10/11 presentation can benefit. Restart the game and compare. |
| Game graphics, resolution and render distance | Retain per-game previews and backups. These change actual rendering or simulation work. Visual quality is a trade-off. |
| GPU selection | Link to Windows per-app graphics settings. Select the correct GPU on hybrid systems. |
| HAGS | Keep situational. OS version alone does not prove driver/GPU support. Verify the toggle in Windows and benchmark. |
| Capture and overlays | Optional background recording control. Keep manual capture separate. Close recorders only when selected. |
| Power plan | Desktop and AC-aware suggestion. Exclude known dual-CCD X3D models. Higher power can increase heat without improving frame time. |
| Background apps | Measure running processes, ask selected apps to close gracefully, report processes still running. Never force-kill a game or purge its memory. |
| Startup apps | Review individual entries to reduce persistent background work. Existing protection rules are a heuristic, not complete knowledge of every vendor. |
| Optional app removal | Exact publisher/family allowlist, current account only. Preserve Store, gaming services, frameworks and security packages. Uninstalling may delete app data. |
| Windows app background policy | Optional on supported editions. Does not cover ordinary desktop processes and can disrupt sync, notifications or audio. Existing per-app exceptions remain authoritative. |
| Suggestions, advertising ID, Widgets, activity and feedback | Treat as behavior/privacy preferences. Filter policy support by Windows build and edition. No FPS claim. |
| Delivery Optimization | Optional peer sharing restriction. Windows Update continues working. Does not increase ISP bandwidth. |
| RAM caches and working sets | Let Windows manage them. Emptying a working set can cause later page faults when those pages are accessed again. |
| Page file and memory compression | Do not disable them. Review memory commit and available RAM. Keep system-managed paging as the ordinary baseline. |
| Shader and browser caches | Explicit selection. Shader deletion can make the next game session worse while shaders rebuild. Disk cleanup is not a RAM/FPS measurement. |
| DNS and network settings | Measure resolution and route behavior independently of FPS. Most advanced TCP controls do not help UDP game traffic. |
| Timers, HPET, dynamic tick and boot flags | Do not add global overrides. Debugging options are not universal gaming recommendations. |
| Security, VBS/HVCI, Defender and updates | Keep security choices outside automatic optimization. Disabling protection has a real security trade-off. |
| Services and scheduled tasks | No broad service-disabling preset. Dependencies and installed features vary by PC. |
| BIOS, EXPO/XMP, Resizable BAR, cooling and drivers | Advisory/manual work. Require hardware support, stability checks and vendor instructions. Never flash firmware or overclock automatically. |

## WinUtil compatibility

The interaction follows scan → select preset/apps → review → run → per-item outcomes → undo supported settings. Nexa implements its own Minimal/Standard presets. It does not claim WinUtil feature parity, copy its entire service list, or execute `irm | iex`. Store links help find removed apps again, but reinstalling is not restoration of deleted app data.

## Evidence

- [Microsoft performance guidance](https://support.microsoft.com/en-us/windows/experience/performance-optimization/tips-to-improve-pc-performance-in-windows)
- [MMCSS settings and clamping behavior](https://learn.microsoft.com/en-us/windows/win32/procthread/multimedia-class-scheduler-service)
- [Working sets, page faults and trimming](https://learn.microsoft.com/en-us/windows/win32/memory/working-set)
- [System-managed page files](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/how-to-determine-the-appropriate-page-file-size-for-64-bit-versions-of-windows)
- [Windowed game optimizations](https://support.microsoft.com/en-au/windows/hardware/display-graphics/optimizations-for-windowed-games-in-windows-11)
- [HAGS design and testing](https://devblogs.microsoft.com/directx/hardware-accelerated-gpu-scheduling/)
- [App privacy and background policies](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-privacy)
- [Experience policy edition support](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-experience)
- [Boot configuration options](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/bcdedit--set)
- [Memory integrity protection](https://support.microsoft.com/en-us/windows/security/windows-security/device-security-in-the-windows-security-app)
- [WinUtil presets](https://github.com/ChrisTitusTech/winutil/blob/main/config/preset.json)
- [WinUtil tweak workflow](https://winutil.christitus.com/guides/tweaks/)

## Validation limits

Automated tests exercise backend validation, package targeting, mocked PowerShell removal, partial failure, original-value restoration, retired endpoints and browser interactions. Read-only scans can verify detected hardware and installed apps. These checks do not establish real gaming gains or successful uninstall behavior across every Windows installation. Validate performance with repeated PresentMon captures of the same game scene, settings and background workload, and undo regressions.
