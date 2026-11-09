'use strict';

(function () {
  const consentCheckbox = document.getElementById('legal-consent');
  const consentHint = document.getElementById('consent-hint');
  const downloadBtns = document.querySelectorAll('[data-requires-consent="true"]');

  function syncConsentState() {
    const agreed = Boolean(consentCheckbox && consentCheckbox.checked);
    downloadBtns.forEach((btn) => {
      btn.classList.toggle('is-disabled', !agreed);
      btn.setAttribute('aria-disabled', agreed ? 'false' : 'true');
    });
    if (consentHint) {
      consentHint.textContent = agreed
        ? 'Downloads unlocked. Create a Windows System Restore Point before applying system-wide changes.'
        : 'Accept the legal terms above to enable the download links.';
      consentHint.classList.toggle('is-ready', agreed);
    }
  }

  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', syncConsentState);
    syncConsentState();
  }

  downloadBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (!consentCheckbox || !consentCheckbox.checked) {
        event.preventDefault();
        if (consentHint) {
          consentHint.textContent = 'Please check the legal agreement box above before downloading Nexa Optimize.';
        }
        if (consentCheckbox) consentCheckbox.focus();
      }
    });
  });

  // Preview tabs
  const previewTabs = document.querySelectorAll('.preview-tab');
  const previewPanels = {
    overview: document.getElementById('preview-overview'),
    games: document.getElementById('preview-games'),
    tweaks: document.getElementById('preview-tweaks'),
    network: document.getElementById('preview-network'),
  };

  previewTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-preview');
      previewTabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      Object.entries(previewPanels).forEach(([key, panel]) => {
        if (!panel) return;
        const show = key === target;
        panel.classList.toggle('active', show);
        panel.hidden = !show;
      });
    });
  });

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy');
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        const prev = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = prev;
        }, 1800);
      } catch {
        // Clipboard fallback
      }
    });
  });

  // Legal modal
  const modal = document.getElementById('legal-modal');
  const openBtn = document.getElementById('open-legal-modal');
  const closeBtn = document.getElementById('close-legal-modal');
  const acceptModalBtn = document.getElementById('accept-from-modal');

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    if (openBtn) openBtn.focus();
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (acceptModalBtn) {
    acceptModalBtn.addEventListener('click', () => {
      if (consentCheckbox) {
        consentCheckbox.checked = true;
        syncConsentState();
      }
      closeModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.hidden) {
      closeModal();
    }
  });

  // ====================================================================
  // 32 ACTIONS REGISTRY TRANSPARENCY DRAWER
  // ====================================================================
  const ACTIONS = [
  {
    "id": "game-process-priority",
    "name": "Anti-Cheat-Safe Game CPU & I/O Priority",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "high",
    "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\<Game.exe>\\PerfOptions",
    "stockVal": "Key absent (Normal CPU & I/O Priority)",
    "optVal": "CpuPriorityClass = 3 (High), IoPriority = 3 (High)",
    "revertNote": "Removes the PerfOptions key entirely.",
    "description": "Configures Windows kernel Image File Execution Options (IFEO) PerfOptions to grant High CPU Priority (3) and High Disk I/O Priority (3) to competitive game executables (CS2, Fortnite, Roblox, Minecraft, Valorant, Apex, Call of Duty) without triggering anti-cheat blocks."
  },
  {
    "id": "game-mode",
    "name": "Enable Windows Game Mode",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "medium",
    "keyPath": "HKCU:\\Software\\Microsoft\\GameBar\\AutoGameModeEnabled",
    "stockVal": "AutoGameModeEnabled = 1 (or 0)",
    "optVal": "AutoGameModeEnabled = 1 (Windows Game Mode Active)",
    "revertNote": "Restores recorded GameBar value.",
    "description": "Tells Windows to prioritize your game and reduce background interruptions while you play."
  },
  {
    "id": "game-dvr",
    "name": "Disable background game recording",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "low",
    "keyPath": "HKCU:\\System\\GameConfigStore\\GameDVR_Enabled",
    "stockVal": "GameDVR_Enabled = 1 (Background capture buffer active)",
    "optVal": "GameDVR_Enabled = 0 (Zero GPU video encode overhead)",
    "revertNote": "Restores stock DWORD (1).",
    "description": "Stops Windows Game DVR from recording gameplay in the background. Manual capture tools still work."
  },
  {
    "id": "hags",
    "name": "Enable hardware-accelerated GPU scheduling",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "medium",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\HwSchMode",
    "stockVal": "HwSchMode = 1 (Disabled)",
    "optVal": "HwSchMode = 2 (Hardware GPU Scheduling Active)",
    "revertNote": "Restores previous HwSchMode value.",
    "description": "Lets the GPU manage its own scheduling memory. Can reduce latency and frame-time spikes on supported GPUs."
  },
  {
    "id": "windowed-optimizations",
    "name": "Optimize windowed games",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "low",
    "keyPath": "HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences\\DirectXUserGlobalSettings",
    "stockVal": "SwapEffectUpgradeEnable=0; or absent",
    "optVal": "SwapEffectUpgradeEnable=1; (DirectFlip borderless)",
    "revertNote": "Preserves other flags, restores previous string.",
    "description": "Enables Windows DirectFlip optimizations for borderless and windowed games to eliminate Desktop Window Manager (DWM) composition latency and tearing."
  },
  {
    "id": "background-apps",
    "name": "Limit background apps",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "low",
    "keyPath": "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications\\GlobalUserDisabled",
    "stockVal": "GlobalUserDisabled = 0 (Store apps run in background)",
    "optVal": "GlobalUserDisabled = 1 (Limits background Store apps)",
    "revertNote": "Restores stock DWORD (0).",
    "description": "Stops Store apps from running background work when you are not using them."
  },
  {
    "id": "transparency",
    "name": "Disable transparency effects",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "low",
    "keyPath": "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\\EnableTransparency",
    "stockVal": "EnableTransparency = 1 (DWM acrylic effects on)",
    "optVal": "EnableTransparency = 0 (Frees integrated GPU cycles)",
    "revertNote": "Restores stock DWORD (1).",
    "description": "Turns off Windows acrylic and transparency effects. Most useful on integrated graphics."
  },
  {
    "id": "gpu-priority",
    "name": "Raise the Games task priority",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "high",
    "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games",
    "stockVal": "GPU Priority = 8, Priority = 2, Category = Medium",
    "optVal": "GPU Priority = 8, Priority = 6, Category = High",
    "revertNote": "Restores stock MMCSS Games task profile.",
    "description": "Sets the Windows multimedia Games profile to high priority for GPU and thread scheduling, preventing background tasks from stealing render cycles."
  },
  {
    "id": "network-throttling",
    "name": "Disable multimedia network throttling",
    "category": "Network",
    "catGroup": "network",
    "impact": "high",
    "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\NetworkThrottlingIndex",
    "stockVal": "NetworkThrottlingIndex = 10 (10 packets/ms limit)",
    "optVal": "NetworkThrottlingIndex = 0xFFFFFFFF (Disabled)",
    "revertNote": "Restores recorded DWORD (10).",
    "description": "Disables the Windows multimedia network packet throttling mechanism, removing throughput caps and reducing packet jitter during online gaming."
  },
  {
    "id": "system-responsiveness",
    "name": "Prioritize foreground apps",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "high",
    "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\SystemResponsiveness",
    "stockVal": "SystemResponsiveness = 20 (20% reserved for background)",
    "optVal": "SystemResponsiveness = 0 or 10 (100% foreground CPU priority)",
    "revertNote": "Restores stock DWORD (20).",
    "description": "Configures Windows multimedia responsiveness to 0% reserved for background media, dedicating 100% of CPU thread scheduling priority to your foreground game."
  },
  {
    "id": "mouse-acceleration",
    "name": "Disable mouse acceleration",
    "category": "Gaming",
    "catGroup": "input",
    "impact": "low",
    "keyPath": "HKCU:\\Control Panel\\Mouse\\MouseSpeed",
    "stockVal": "MouseSpeed = \"1\", Threshold1 = \"6\", Threshold2 = \"10\"",
    "optVal": "MouseSpeed = \"0\", Thresholds = \"0\" (Raw 1:1 Response)",
    "revertNote": "Restores recorded pointer threshold values.",
    "description": "Turns off Enhance Pointer Precision in Windows."
  },
  {
    "id": "power-plan",
    "name": "Activate the Nexa Gaming power plan",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "medium",
    "keyPath": "Windows Power Schemes (powercfg)",
    "stockVal": "Balanced Scheme (381b4222-f694-41f0-9685-ff5bb260df2e)",
    "optVal": "Nexa High Performance (preserves AMD X3D core parking)",
    "revertNote": "Re-activates original active Windows power scheme.",
    "description": "Creates a high-performance Windows power plan and makes it active. Your original plan is remembered."
  },
  {
    "id": "nagle",
    "name": "Reduce TCP acknowledgement delay",
    "category": "Network",
    "catGroup": "network",
    "impact": "low",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\<Adapter>",
    "stockVal": "TcpAckFrequency = 2, TCPNoDelay = 0",
    "optVal": "TcpAckFrequency = 1, TCPNoDelay = 1",
    "revertNote": "Restores previous interface DWORDs.",
    "description": "Sets TcpAckFrequency and TCPNoDelay on active network adapters for lower TCP latency."
  },
  {
    "id": "adapter-power",
    "name": "Stop network adapter power saving",
    "category": "Network",
    "catGroup": "network",
    "impact": "low",
    "keyPath": "PnPCapabilities = 24 & Device Power Management WMI",
    "stockVal": "AllowComputerToTurnOffDevice = True",
    "optVal": "PnPCapabilities = 24 (OS sleep disabled on active NIC)",
    "revertNote": "Restores previous PnPCapabilities state.",
    "description": "Prevents Windows from turning off active Ethernet and Wi-Fi adapters to save power."
  },
  {
    "id": "delivery-optimization",
    "name": "Stop Windows Update P2P Bandwidth Sharing",
    "category": "Network",
    "catGroup": "network",
    "impact": "high",
    "keyPath": "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization\\DODownloadMode",
    "stockVal": "DODownloadMode = 1 (P2P background bandwidth upload)",
    "optVal": "DODownloadMode = 0 (HTTP only, no P2P sharing)",
    "revertNote": "Restores previous DODownloadMode value.",
    "description": "Prevents Windows Delivery Optimization from uploading and downloading peer-to-peer update fragments in the background while you game or download."
  },
  {
    "id": "tcp-autotuning",
    "name": "Unlock Gigabit Download Speeds (TCP Auto-Tuning & RSS)",
    "category": "Network",
    "catGroup": "network",
    "impact": "high",
    "keyPath": "netsh int tcp set global autotuninglevel=normal rss=enabled",
    "stockVal": "Restricted or disabled by legacy ISP settings",
    "optVal": "autotuninglevel = normal, rss = enabled",
    "revertNote": "Restores initial netsh autotuning level.",
    "description": "Enables Normal TCP Receive Window Auto-Tuning, disables Windows window-shrinking heuristics, and enables multi-core Receive-Side Scaling (RSS) for maximum download throughput and lower CPU interrupt latency."
  },
  {
    "id": "win32-priority",
    "name": "Foreground Game CPU Quantum Priority",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "high",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl\\Win32PrioritySeparation",
    "stockVal": "Win32PrioritySeparation = 2 (0x2)",
    "optVal": "Win32PrioritySeparation = 38 (0x26 Short, Variable 3:1)",
    "revertNote": "Restores recorded stock DWORD (2).",
    "description": "Configures Win32PrioritySeparation (0x26) to grant the active foreground game window short, high-priority CPU thread quantums for smoother 1% low FPS and snappier input."
  },
  {
    "id": "power-throttling",
    "name": "Disable Background CPU Power Throttling",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "medium",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling\\PowerThrottlingOff",
    "stockVal": "0 (or absent - EcoQoS active)",
    "optVal": "PowerThrottlingOff = 1 (Preserves hybrid Intel P/E cores)",
    "revertNote": "Restores stock DWORD or deletes key.",
    "description": "Prevents Windows from aggressively down-clocking game audio, physics, and render helper threads into low-power EcoQoS states."
  },
  {
    "id": "fullscreen-optimizations",
    "name": "Exclusive Fullscreen for Older Games",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "low",
    "keyPath": "HKCU:\\System\\GameConfigStore\\GameDVR_FSEBehaviorMode",
    "stockVal": "GameDVR_FSEBehaviorMode = 0 (FSO compatibility active)",
    "optVal": "GameDVR_FSEBehaviorMode = 2 (Exclusive Fullscreen)",
    "revertNote": "Restores stock DWORD (0).",
    "description": "Tells Windows to let games use true exclusive fullscreen instead of the borderless compatibility layer, which can lower input latency and frame-time spikes in older DirectX 9/11 titles."
  },
  {
    "id": "paging-executive",
    "name": "Keep Windows Kernel & Drivers in RAM",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "high",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\DisablePagingExecutive",
    "stockVal": "DisablePagingExecutive = 0 (Pages kernel to disk)",
    "optVal": "DisablePagingExecutive = 1 (Locks kernel & drivers in RAM)",
    "revertNote": "Restores stock DWORD (0).",
    "description": "Forces executive-level Windows kernel code and device drivers to stay resident in physical RAM instead of being paged to disk. Prevents driver page-fault micro-stutter during gaming."
  },
  {
    "id": "fast-startup",
    "name": "Clean Kernel State on Boot (Disable Fast Startup)",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "medium",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power\\HiberbootEnabled",
    "stockVal": "HiberbootEnabled = 1 (Hibernates driver session)",
    "optVal": "HiberbootEnabled = 0 (100% clean kernel boot)",
    "revertNote": "Restores stock DWORD (1).",
    "description": "Ensures Windows cleanly resets kernel memory, driver handles, and hardware clocks on every boot instead of restoring days-old hibernated driver sessions that accumulate micro-stutter."
  },
  {
    "id": "usb-polling",
    "name": "Disable USB Selective Suspend for Input Devices",
    "category": "Gaming",
    "catGroup": "input",
    "impact": "medium",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\USB\\DisableSelectiveSuspend",
    "stockVal": "DisableSelectiveSuspend = 0 (Can sleep USB ports)",
    "optVal": "DisableSelectiveSuspend = 1 (Continuous 1000Hz+ polling)",
    "revertNote": "Restores stock DWORD (0).",
    "description": "Prevents Windows from putting USB root hubs into low-power sleep states, guaranteeing uninterrupted 1000Hz+ polling on gaming mice and keyboards."
  },
  {
    "id": "tdr-delay",
    "name": "Prevent GPU Shader Timeout Crashes (TdrDelay)",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "medium",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\TdrDelay",
    "stockVal": "TdrDelay = 2 seconds",
    "optVal": "TdrDelay = 8 (Extends GPU timeout for heavy shaders)",
    "revertNote": "Restores 2-second default.",
    "description": "Extends the Windows GPU Timeout Detection and Recovery (TDR) threshold from 2 seconds to 8 seconds to prevent driver crashes during intense shader compilation and frame spikes."
  },
  {
    "id": "telemetry-stutter",
    "name": "Disable Background Diagnostics & Telemetry Spikes",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "medium",
    "keyPath": "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection\\AllowTelemetry",
    "stockVal": "AllowTelemetry = 1 or 3 (Active telemetry)",
    "optVal": "AllowTelemetry = 0 (Security level, DiagTrack stopped)",
    "revertNote": "Restores recorded policy value.",
    "description": "Stops Windows Connected User Experiences and Telemetry (DiagTrack) from scanning and uploading diagnostic bundles during active gaming sessions."
  },
  {
    "id": "window-animations",
    "name": "Instant Alt-Tab & Window Animation Bypass",
    "category": "Performance",
    "catGroup": "input",
    "impact": "low",
    "keyPath": "HKCU:\\Control Panel\\Desktop\\WindowMetrics\\MinAnimate",
    "stockVal": "MinAnimate = \"1\" (Animations enabled)",
    "optVal": "MinAnimate = \"0\" (Instant zero-delay Alt-Tab)",
    "revertNote": "Restores string \"1\".",
    "description": "Disables window minimize and maximize animations in the Windows Desktop Window Manager (DWM) for instantaneous Alt-Tab switching and zero compositor delay."
  },
  {
    "id": "fast-udp",
    "name": "AFD Fast Datagram Transmit (UDP Ping Reducer)",
    "category": "Network",
    "catGroup": "network",
    "impact": "high",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters\\FastSendDatagramThreshold",
    "stockVal": "1024 bytes (or absent)",
    "optVal": "FastSendDatagramThreshold = 65536 (Instant UDP transmit)",
    "revertNote": "Restores previous DWORD or deletes property.",
    "description": "Bypasses the Windows kernel AFD network buffering queue for all UDP datagrams up to 1,500 bytes (MTU). Transmits multiplayer game packets (Fortnite, CS2, Valorant, Minecraft, Apex, Warzone) immediately onto the wire without driver staging latency."
  },
  {
    "id": "dscp-qos",
    "name": "Enable Network QoS & DSCP 46 Game Packet Tagging",
    "category": "Network",
    "catGroup": "network",
    "impact": "high",
    "keyPath": "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\<GamePolicy> & DisableUserTOSSetting",
    "stockVal": "No QoS policies; DisableUserTOSSetting = 1",
    "optVal": "DSCP 46 (Expedited Forwarding) + silent gpupdate refresh",
    "revertNote": "Deletes QoS registry policies and restores default TOS.",
    "description": "Configures Windows TCP/IP QoS and active registry policies to tag competitive game packets (CS2, Fortnite, Roblox, Minecraft, Valorant, Apex) with DSCP 46 (Expedited Forwarding). Allows home and ISP routers to prioritize gaming traffic ahead of background downloads, streaming, and bufferbloat."
  },
  {
    "id": "nic-low-jitter",
    "name": "NIC Hardware De-Jitter (Disable EEE & Flow Control)",
    "category": "Network",
    "catGroup": "network",
    "impact": "high",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}\\<Adapter>",
    "stockVal": "*EEE = \"1\", *FlowControl = \"3\" (Hardware sleep active)",
    "optVal": "*EEE = \"0\", *FlowControl = \"0\", *InterruptModeration = \"0\"",
    "revertNote": "Restores recorded adapter driver class values.",
    "description": "Disables IEEE 802.3az Energy-Efficient Ethernet (EEE), Green Ethernet PHY sleep states, and Flow Control pause frames on your physical Ethernet adapter to eliminate packet burst wake-up jitter (1–3 ms spikes)."
  },
  {
    "id": "audio-priority",
    "name": "MMCSS Low-Latency Audio Scheduling",
    "category": "Performance",
    "catGroup": "cpu",
    "impact": "medium",
    "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Audio",
    "stockVal": "Scheduling Category = Medium, Priority = 6",
    "optVal": "Scheduling Category = High, Priority = 8",
    "revertNote": "Restores stock MMCSS Audio task values.",
    "description": "Sets the Windows Multimedia Class Scheduler Service (MMCSS) Audio task profile to match the Games profile (GPU Priority 8, Priority 6, High Scheduling), preventing audiodg.exe audio driver buffer underruns from stealing CPU cycles and causing 1% low FPS dips."
  },
  {
    "id": "menu-delay",
    "name": "Instant Menu & UI Response (0ms MenuShowDelay)",
    "category": "Performance",
    "catGroup": "input",
    "impact": "low",
    "keyPath": "HKCU:\\Control Panel\\Desktop\\MenuShowDelay",
    "stockVal": "MenuShowDelay = \"400\" ms",
    "optVal": "MenuShowDelay = \"0\" ms (Instant interaction)",
    "revertNote": "Restores string \"400\".",
    "description": "Removes the default 400ms Windows Desktop Window Manager delay for opening context menus, tooltips, and app interactions."
  },
  {
    "id": "mpo-bypass",
    "name": "Disable Multiplane Overlays (MPO Bypass)",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "medium",
    "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm\\OverlayTestMode",
    "stockVal": "Property does not exist on stock Windows",
    "optVal": "OverlayTestMode = 5 (Disables MPO flickering)",
    "revertNote": "Deletes OverlayTestMode property completely.",
    "description": "Disables Desktop Window Manager Multiplane Overlays (MPO) by setting OverlayTestMode to 5. Eliminates VRR/G-Sync screen flickering, micro-stutters, and black screen driver freezes during Alt-Tabbing on multi-monitor high-refresh setups."
  },
  {
    "id": "pcie-msi-mode",
    "name": "Enable PCIe Message Signaled Interrupts (MSI Mode)",
    "category": "Gaming",
    "catGroup": "gpu",
    "impact": "high",
    "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\...\\Device Parameters\\Interrupt Management\\...\\MSISupported",
    "stockVal": "Line-based INTx legacy interrupts (MSISupported = 0)",
    "optVal": "MSISupported = 1 (Direct vector interrupts on GPU/NIC)",
    "revertNote": "Restores recorded MSISupported value.",
    "description": "Switches your primary GPU and PCIe Ethernet controller from legacy shared pin interrupts (INTx) to Message Signaled Interrupts (MSI). Eliminates IRQ conflicts, lowers CPU interrupt latency, and prevents frame drops during intense gameplay."
  }
];

  const searchInput = document.getElementById('action-search-input');
  const filterPills = document.querySelectorAll('.filter-pill');
  const drawerContainer = document.getElementById('actions-drawer-container');

  let currentCategory = 'all';
  let searchQuery = '';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderActions() {
    if (!drawerContainer) return;
    const q = searchQuery.toLowerCase().trim();

    const filtered = ACTIONS.filter((action) => {
      const matchCat = currentCategory === 'all' || action.catGroup === currentCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        action.name.toLowerCase().includes(q) ||
        action.keyPath.toLowerCase().includes(q) ||
        action.description.toLowerCase().includes(q) ||
        action.category.toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      drawerContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--muted); background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius);">
          No optimizations found matching "${escapeHtml(q)}". Try searching "DSCP", "MSI", "Shader", "Priority", or clear the filter.
        </div>`;
      return;
    }

    drawerContainer.innerHTML = filtered.map((a) => `
      <article class="action-tile" data-cat="${escapeHtml(a.catGroup)}">
        <div class="action-tile-head">
          <h4>${escapeHtml(a.name)}</h4>
          <span class="action-cat-pill">${escapeHtml(a.category)}</span>
        </div>
        <p style="font-size:0.83rem;color:var(--muted);line-height:1.45">${escapeHtml(a.description)}</p>
        <div class="action-key-row" title="Registry or Command Target">
          <code>${escapeHtml(a.keyPath)}</code>
        </div>
        <div class="action-compare-grid">
          <div class="action-compare-col">
            <span>Stock Windows</span>
            <strong>${escapeHtml(a.stockVal)}</strong>
          </div>
          <div class="action-compare-col is-opt">
            <span>Nexa Optimized</span>
            <strong>${escapeHtml(a.optVal)}</strong>
          </div>
        </div>
        <div class="action-revert-note">
          <strong>Undo Revert:</strong> ${escapeHtml(a.revertNote)}
        </div>
      </article>
    `).join('');
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderActions();
    });
  }

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-cat') || 'all';
      renderActions();
    });
  });

  renderActions();

  // ====================================================================
  // LIVE GITHUB-BACKED VERIFIED REVIEWS
  // ====================================================================
  const reviewsContainer = document.getElementById('reviews-container');
  const reviewsScoreText = document.getElementById('reviews-score-text');
  const reviewsCountText = document.getElementById('reviews-count-text');
  const reviewsStarsDisplay = document.getElementById('reviews-stars-display');

  const GITHUB_REPO = 'riksitis1/nova-optimize-web';
  const REVIEWS_URL = `https://api.github.com/repos/${GITHUB_REPO}/issues?labels=verified-review&state=all`;

  function parseRating(body) {
    if (!body) return 5;
    const matchDrop = body.match(/(?:Star Rating|Rating)[^\d]*([1-5])/i);
    if (matchDrop) return parseInt(matchDrop[1], 10);
    const starCount = (body.match(/★/g) || []).length;
    if (starCount >= 1 && starCount <= 5) return starCount;
    return 5;
  }

  function parseSpecs(body) {
    if (!body) return [];
    const specsMatch = body.match(/### System Specs[^\r\n]*\r?\n+([\s\S]*?)(?=###|$)/i);
    const text = specsMatch ? specsMatch[1] : '';
    const chips = [];
    const cpuMatch = text.match(/CPU:\s*([^\r\n]+)/i);
    if (cpuMatch && cpuMatch[1].trim()) chips.push(`CPU: ${cpuMatch[1].trim()}`);
    const gpuMatch = text.match(/GPU:\s*([^\r\n]+)/i);
    if (gpuMatch && gpuMatch[1].trim()) chips.push(`GPU: ${gpuMatch[1].trim()}`);
    const scoreMatch = text.match(/Score:\s*([^\r\n]+)/i);
    if (scoreMatch && scoreMatch[1].trim()) chips.push(`Score: ${scoreMatch[1].trim()}`);
    return chips;
  }

  function parseFeedback(body) {
    if (!body) return 'Verified hardware report submitted via Nexa Optimize.';
    const feedMatch = body.match(/### Review[^\r\n]*\r?\n+([\s\S]*?)(?=###|$)/i);
    if (feedMatch && feedMatch[1].trim()) return feedMatch[1].trim();
    const clean = body.replace(/###[^\r\n]+/g, '').trim();
    return clean.slice(0, 480) || 'Verified hardware report submitted via Nexa Optimize.';
  }

  function starsHtml(rating) {
    const full = '★'.repeat(rating);
    const empty = '☆'.repeat(5 - rating);
    return `<span class="review-stars-row">${full}${empty}</span>`;
  }

  function renderEmptyReviews() {
    if (reviewsScoreText) reviewsScoreText.textContent = 'GitHub Review Stream Active · 0 Verified Reviews';
    if (reviewsCountText) reviewsCountText.textContent = '100% Real Community Benchmarks';
    if (reviewsStarsDisplay) {
      reviewsStarsDisplay.textContent = '☆☆☆☆☆';
      reviewsStarsDisplay.classList.add('is-empty');
    }
    if (reviewsContainer) {
      reviewsContainer.innerHTML = `
        <div class="empty-reviews-box">
          <div class="empty-reviews-icon">☆</div>
          <h3>No community reviews yet</h3>
          <p>Be the first to post an authentic hardware report or benchmark from inside Nexa Optimize or via GitHub! Every review submitted to our public repository is rendered here with 100% transparency.</p>
          <a href="https://github.com/${GITHUB_REPO}/issues/new?template=review.yml" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
            Submit a Verified Review on GitHub
          </a>
        </div>`;
    }
  }

  async function loadRealReviews() {
    try {
      const cacheKey = 'nexa_real_reviews_v1';
      const cached = sessionStorage.getItem(cacheKey);
      let issues = null;

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
            issues = parsed.data;
          }
        } catch {
          // Ignore cache parse error
        }
      }

      if (!issues) {
        const res = await fetch(REVIEWS_URL, {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (!res.ok) throw new Error(`GitHub API responded with status ${res.status}`);
        issues = await res.json();
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: issues }));
        } catch {}
      }

      const verifiedIssues = (Array.isArray(issues) ? issues : []).filter(
        (issue) => issue && !issue.pull_request
      );

      if (verifiedIssues.length === 0) {
        renderEmptyReviews();
        return;
      }

      let totalRating = 0;
      const reviews = verifiedIssues.map((issue) => {
        const rating = parseRating(issue.body || '');
        totalRating += rating;
        return {
          id: issue.id,
          number: issue.number,
          html_url: issue.html_url,
          created_at: new Date(issue.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          user: {
            login: issue.user?.login || 'anonymous',
            avatar_url: issue.user?.avatar_url || 'assets/logo.svg',
            html_url: issue.user?.html_url || `https://github.com/${GITHUB_REPO}`,
          },
          rating,
          chips: parseSpecs(issue.body || ''),
          feedback: parseFeedback(issue.body || ''),
        };
      });

      const avg = (totalRating / reviews.length).toFixed(1);
      if (reviewsScoreText) reviewsScoreText.textContent = `Average Rating: ${avg} / 5.0`;
      if (reviewsCountText) reviewsCountText.textContent = `${reviews.length} Verified Community Review${reviews.length === 1 ? '' : 's'} on GitHub`;
      if (reviewsStarsDisplay) {
        reviewsStarsDisplay.textContent = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
        reviewsStarsDisplay.classList.remove('is-empty');
      }

      if (reviewsContainer) {
        reviewsContainer.textContent = '';
        const grid = document.createElement('div');
        grid.className = 'reviews-grid';

        reviews.forEach((r) => {
          const article = document.createElement('article');
          article.className = 'review-card';

          const head = document.createElement('div');
          head.className = 'review-head';

          const img = document.createElement('img');
          const isSafeAvatar = typeof r.user.avatar_url === 'string' && r.user.avatar_url.startsWith('https://avatars.githubusercontent.com/');
          img.src = isSafeAvatar ? r.user.avatar_url : 'assets/logo.svg';
          img.alt = r.user.login;
          img.width = 36;
          img.height = 36;
          img.className = 'reviewer-avatar';
          head.appendChild(img);

          const meta = document.createElement('div');
          meta.className = 'reviewer-meta';

          const strong = document.createElement('strong');
          const userLink = document.createElement('a');
          const isSafeProfile = typeof r.user.html_url === 'string' && r.user.html_url.startsWith('https://github.com/');
          userLink.href = isSafeProfile ? r.user.html_url : `https://github.com/${GITHUB_REPO}`;
          userLink.target = '_blank';
          userLink.rel = 'noopener noreferrer';
          userLink.textContent = `@${r.user.login}`;
          strong.appendChild(userLink);
          meta.appendChild(strong);

          const time = document.createElement('time');
          time.textContent = r.created_at;
          meta.appendChild(time);
          head.appendChild(meta);

          const badge = document.createElement('span');
          badge.className = 'verified-badge';
          badge.textContent = 'GitHub Verified';
          head.appendChild(badge);

          article.appendChild(head);

          const starsDiv = document.createElement('div');
          const starsSpan = document.createElement('span');
          starsSpan.className = 'review-stars-row';
          starsSpan.textContent = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
          starsDiv.appendChild(starsSpan);
          article.appendChild(starsDiv);

          if (r.chips.length > 0) {
            const chipsDiv = document.createElement('div');
            chipsDiv.className = 'spec-chips';
            r.chips.forEach((c) => {
              const chip = document.createElement('span');
              chip.className = 'spec-chip';
              chip.textContent = c;
              chipsDiv.appendChild(chip);
            });
            article.appendChild(chipsDiv);
          }

          const bodyP = document.createElement('p');
          bodyP.className = 'review-body';
          bodyP.textContent = r.feedback;
          article.appendChild(bodyP);

          const foot = document.createElement('div');
          foot.className = 'review-foot';

          const footSpan = document.createElement('span');
          footSpan.textContent = 'Authentic Submission';
          foot.appendChild(footSpan);

          const issueLink = document.createElement('a');
          const isSafeIssue = typeof r.html_url === 'string' && r.html_url.startsWith('https://github.com/');
          issueLink.href = isSafeIssue ? r.html_url : `https://github.com/${GITHUB_REPO}/issues`;
          issueLink.target = '_blank';
          issueLink.rel = 'noopener noreferrer';
          issueLink.textContent = `View on GitHub #${r.number} →`;
          foot.appendChild(issueLink);

          article.appendChild(foot);
          grid.appendChild(article);
        });

        reviewsContainer.appendChild(grid);
      }
    } catch {
      renderEmptyReviews();
    }
  }

  loadRealReviews();
})();
