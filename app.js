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
  // 25 ACTIONS REGISTRY TRANSPARENCY DRAWER
  // ====================================================================
  const ACTIONS = [
    {
      "id": "game-mode",
      "name": "Enable Windows Game Mode",
      "category": "Gaming",
      "catGroup": "gpu",
      "impact": "medium",
      "risk": "safe",
      "keyPath": "HKCU:\\Software\\Microsoft\\GameBar",
      "stockVal": "AutoGameModeEnabled absent / 0",
      "optVal": "AutoGameModeEnabled = 1 · AllowAutoGameMode = 1",
      "revertNote": "Restores the previous Game Mode values or deletes them if they did not exist.",
      "description": "Tells Windows to reduce background interruptions while a game is running."
    },
    {
      "id": "game-dvr",
      "name": "Disable background game recording",
      "category": "Gaming",
      "catGroup": "gpu",
      "impact": "low",
      "risk": "safe",
      "keyPath": "HKCU:\\System\\GameConfigStore · HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR",
      "stockVal": "GameDVR_Enabled = 1 · AppCaptureEnabled = 1",
      "optVal": "GameDVR_Enabled = 0 · AppCaptureEnabled = 0",
      "revertNote": "Restores the exact previous recording values.",
      "description": "Stops Windows Game DVR from recording gameplay in the background. Manual capture tools still work."
    },
    {
      "id": "hags",
      "name": "Enable hardware-accelerated GPU scheduling",
      "category": "Gaming",
      "catGroup": "gpu",
      "impact": "medium",
      "risk": "caution",
      "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers",
      "stockVal": "HwSchMode = 1 (or absent)",
      "optVal": "HwSchMode = 2",
      "revertNote": "Restores the previous HwSchMode value. Requires a reboot.",
      "description": "Enables hardware-accelerated GPU scheduling (HAGS) on supported Windows 10/11 builds."
    },
    {
      "id": "windowed-optimizations",
      "name": "Optimize windowed games",
      "category": "Gaming",
      "catGroup": "gpu",
      "impact": "low",
      "risk": "safe",
      "keyPath": "HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences · HKCU:\\Software\\Microsoft\\DirectX\\GraphicsSettings",
      "stockVal": "SwapEffectUpgradeEnable absent / 0",
      "optVal": "SwapEffectUpgradeEnable = 1 (other DirectX tokens preserved)",
      "revertNote": "Restores the exact prior DirectX strings and values.",
      "description": "Enables the DirectX swap-effect upgrade setting that can let borderless and windowed games use modern flip-model presentation on Windows 11 22H2+."
    },
    {
      "id": "background-apps",
      "name": "Limit background apps",
      "category": "Performance",
      "catGroup": "cpu",
      "impact": "low",
      "risk": "safe",
      "keyPath": "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications",
      "stockVal": "GlobalUserDisabled absent / 0",
      "optVal": "GlobalUserDisabled = 1",
      "revertNote": "Restores the previous background-app policy value.",
      "description": "Stops Store apps from running background work when you are not using them."
    },
    {
      "id": "transparency",
      "name": "Disable transparency effects",
      "category": "Performance",
      "catGroup": "gpu",
      "impact": "low",
      "risk": "safe",
      "keyPath": "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
      "stockVal": "EnableTransparency = 1",
      "optVal": "EnableTransparency = 0",
      "revertNote": "Restores the previous transparency value.",
      "description": "Turns off Windows acrylic and transparency effects. Most useful on integrated graphics."
    },
    {
      "id": "network-throttling",
      "name": "Disable multimedia network throttling",
      "category": "Network",
      "catGroup": "network",
      "impact": "high",
      "risk": "advanced",
      "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile",
      "stockVal": "NetworkThrottlingIndex = 10 (0x0A)",
      "optVal": "NetworkThrottlingIndex = 0xFFFFFFFF",
      "revertNote": "Restores the previous throttling index.",
      "description": "Sets NetworkThrottlingIndex to 0xFFFFFFFF, disabling the documented Windows multimedia network throttling behavior."
    },
    {
      "id": "system-responsiveness",
      "name": "Reduce background multimedia reservation",
      "category": "Performance",
      "catGroup": "cpu",
      "impact": "high",
      "risk": "advanced",
      "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile",
      "stockVal": "SystemResponsiveness = 20",
      "optVal": "SystemResponsiveness = 0",
      "revertNote": "Restores the previous multimedia reservation value.",
      "description": "Sets SystemResponsiveness to 0, reducing the CPU time Windows reserves for background multimedia tasks. Windows uses 20 by default."
    },
    {
      "id": "mouse-acceleration",
      "name": "Disable mouse acceleration",
      "category": "Gaming",
      "catGroup": "input",
      "impact": "low",
      "risk": "advanced",
      "keyPath": "HKCU:\\Control Panel\\Mouse",
      "stockVal": "MouseSpeed = 1 · Threshold1 = 6 · Threshold2 = 10",
      "optVal": "MouseSpeed = 0 · Threshold1 = 0 · Threshold2 = 0",
      "revertNote": "Restores the exact previous pointer values.",
      "description": "Turns off Enhance Pointer Precision in Windows."
    },
    {
      "id": "power-plan",
      "name": "Activate the Nexa Gaming power plan",
      "category": "Performance",
      "catGroup": "cpu",
      "impact": "medium",
      "risk": "safe",
      "keyPath": "powercfg /duplicatescheme · active power scheme",
      "stockVal": "Current Windows power plan (for example Balanced)",
      "optVal": "Nexa Gaming high-performance plan active",
      "revertNote": "Reactivates the exact original plan GUID and removes the created plan when possible.",
      "description": "Creates a high-performance Windows power plan and makes it active. Your original plan is remembered."
    },
    {
      "id": "nagle",
      "name": "Reduce TCP acknowledgement delay",
      "category": "Network",
      "catGroup": "network",
      "impact": "low",
      "risk": "advanced",
      "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\{GUID}",
      "stockVal": "TcpAckFrequency / TCPNoDelay absent",
      "optVal": "TcpAckFrequency = 1 · TCPNoDelay = 1",
      "revertNote": "Restores or deletes both values for every adapter recorded in the backup.",
      "description": "Sets TcpAckFrequency and TCPNoDelay on active network adapters for lower TCP latency."
    },
    {
      "id": "adapter-power",
      "name": "Stop network adapter power saving",
      "category": "Network",
      "catGroup": "network",
      "impact": "low",
      "risk": "caution",
      "keyPath": "Network adapter power management (PnP / WMI)",
      "stockVal": "Allow the computer to turn off this device = On",
      "optVal": "Allow the computer to turn off this device = Off",
      "revertNote": "Restores the recorded power-management state per adapter.",
      "description": "Prevents Windows from turning off active Ethernet and Wi-Fi adapters to save power."
    },
    {
      "id": "delivery-optimization",
      "name": "Stop Windows Update P2P bandwidth sharing",
      "category": "Network",
      "catGroup": "network",
      "impact": "medium",
      "risk": "safe",
      "keyPath": "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization",
      "stockVal": "DODownloadMode absent (P2P allowed)",
      "optVal": "DODownloadMode = 0 (P2P sharing off)",
      "revertNote": "Restores the previous policy value or deletes it if it did not exist.",
      "description": "Turns off Delivery Optimization peer-to-peer sharing through the documented Group Policy value, so Windows Update does not upload update fragments to other PCs in the background."
    },
    {
      "id": "tcp-autotuning",
      "name": "Restore normal TCP auto-tuning and RSS",
      "category": "Network",
      "catGroup": "network",
      "impact": "high",
      "risk": "advanced",
      "keyPath": "netsh int tcp global · TCP global parameters",
      "stockVal": "Windows defaults (usually Normal / Disabled / Enabled)",
      "optVal": "AutoTuning = Normal · Heuristics = Disabled · RSS = Enabled",
      "revertNote": "Restores the exact TCP global state captured before the change.",
      "description": "Resets Windows TCP receive-window auto-tuning to Normal, disables window-shrinking heuristics, and enables Receive-Side Scaling (RSS)."
    },
    {
      "id": "win32-priority",
      "name": "Foreground CPU quantum priority",
      "category": "Gaming",
      "catGroup": "cpu",
      "impact": "high",
      "risk": "advanced",
      "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl",
      "stockVal": "Win32PrioritySeparation = 0x02 (2) on many systems",
      "optVal": "Win32PrioritySeparation = 0x26 (38)",
      "revertNote": "Restores the previous priority-separation value.",
      "description": "Sets Win32PrioritySeparation to 0x26 (38), giving foreground windows shorter, more frequent CPU quantums."
    },
    {
      "id": "power-throttling",
      "name": "Disable background CPU power throttling",
      "category": "Performance",
      "catGroup": "cpu",
      "impact": "medium",
      "risk": "advanced",
      "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling",
      "stockVal": "PowerThrottlingOff absent / 0",
      "optVal": "PowerThrottlingOff = 1",
      "revertNote": "Restores the previous power-throttling value.",
      "description": "Disables Windows Power Throttling globally."
    },
    {
      "id": "fullscreen-optimizations",
      "name": "Exclusive fullscreen for older games",
      "category": "Gaming",
      "catGroup": "gpu",
      "impact": "low",
      "risk": "safe",
      "keyPath": "HKCU:\\System\\GameConfigStore",
      "stockVal": "GameDVR_FSEBehaviorMode = 0 / Windows default",
      "optVal": "GameDVR_FSEBehaviorMode = 2 · HonorUserFSEBehaviorMode = 1",
      "revertNote": "Restores the exact previous fullscreen compatibility values.",
      "description": "Tells Windows to let older games use true exclusive fullscreen instead of the borderless compatibility layer."
    },
    {
      "id": "paging-executive",
      "name": "Keep Windows kernel and drivers in RAM",
      "category": "Performance",
      "catGroup": "cpu",
      "impact": "high",
      "risk": "caution",
      "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management",
      "stockVal": "DisablePagingExecutive absent / 0",
      "optVal": "DisablePagingExecutive = 1",
      "revertNote": "Restores the previous memory-management value.",
      "description": "Keeps Windows kernel code and drivers resident in physical RAM instead of paging them to disk."
    },
    {
      "id": "fast-startup",
      "name": "Clean kernel state on boot (disable Fast Startup)",
      "category": "Performance",
      "catGroup": "cpu",
      "impact": "medium",
      "risk": "safe",
      "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power",
      "stockVal": "HiberbootEnabled = 1",
      "optVal": "HiberbootEnabled = 0",
      "revertNote": "Restores the previous Fast Startup value.",
      "description": "Disables Windows Fast Startup so shutdown performs a full cold boot, resetting kernel and driver state each time."
    },
    {
      "id": "telemetry-stutter",
      "name": "Reduce Windows diagnostic data collection",
      "category": "Performance",
      "catGroup": "cpu",
      "impact": "medium",
      "risk": "safe",
      "keyPath": "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
      "stockVal": "AllowTelemetry absent / default",
      "optVal": "AllowTelemetry = 0",
      "revertNote": "Restores the previous telemetry policy value.",
      "description": "Sets the documented AllowTelemetry policy to 0 to reduce Windows diagnostic data collection."
    },
    {
      "id": "window-animations",
      "name": "Disable window animations",
      "category": "Performance",
      "catGroup": "input",
      "impact": "low",
      "risk": "safe",
      "keyPath": "HKCU:\\Control Panel\\Desktop\\WindowMetrics",
      "stockVal": "MinAnimate = 1",
      "optVal": "MinAnimate = 0",
      "revertNote": "Restores the previous animation value.",
      "description": "Disables window minimize and maximize animations."
    },
    {
      "id": "fast-udp",
      "name": "AFD fast datagram transmit",
      "category": "Network",
      "catGroup": "network",
      "impact": "high",
      "risk": "advanced",
      "keyPath": "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters",
      "stockVal": "FastSendDatagramThreshold absent · DoNotUseFastDatagram absent",
      "optVal": "FastSendDatagramThreshold = 1500 · DoNotUseFastDatagram = 0",
      "revertNote": "Restores or deletes both AFD values.",
      "description": "Sets the AFD FastSendDatagramThreshold to 1,500 bytes and clears DoNotUseFastDatagram."
    },
    {
      "id": "dscp-qos",
      "name": "Enable network QoS and DSCP 46 tagging",
      "category": "Network",
      "catGroup": "network",
      "impact": "high",
      "risk": "advanced",
      "keyPath": "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\* · HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters",
      "stockVal": "No Nexa QoS policies · DisableUserTOSSetting = 1",
      "optVal": "DSCP Value = 46 · Throttle Rate = -1 · NonBestEffortLimit = 0 · DisableUserTOSSetting = 0",
      "revertNote": "Deletes the created QoS policies and restores the previous TOS and bandwidth values.",
      "description": "Creates Windows QoS policies that mark matching game traffic with DSCP 46 (Expedited Forwarding) and removes the default QoS bandwidth reservation."
    },
    {
      "id": "menu-delay",
      "name": "Remove the menu show delay",
      "category": "Performance",
      "catGroup": "input",
      "impact": "low",
      "risk": "safe",
      "keyPath": "HKCU:\\Control Panel\\Desktop",
      "stockVal": "MenuShowDelay = 400",
      "optVal": "MenuShowDelay = 0",
      "revertNote": "Restores the previous menu delay.",
      "description": "Removes the default 400 ms delay before context menus and tooltips appear."
    },
    {
      "id": "mpo-bypass",
      "name": "Disable Multiplane Overlays (MPO)",
      "category": "Gaming",
      "catGroup": "gpu",
      "impact": "medium",
      "risk": "advanced",
      "keyPath": "HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm",
      "stockVal": "OverlayTestMode absent (MPO enabled)",
      "optVal": "OverlayTestMode = 5 (MPO disabled)",
      "revertNote": "Restores or deletes OverlayTestMode. Requires a reboot.",
      "description": "Disables Multiplane Overlays (MPO) by setting OverlayTestMode to 5."
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
          No optimizations found matching "${escapeHtml(q)}". Try searching "DSCP", "Priority", "Delivery", or clear the filter.
        </div>`;
      return;
    }

    drawerContainer.innerHTML = filtered.map((a) => `
      <article class="action-tile" data-cat="${escapeHtml(a.catGroup)}">
        <div class="action-tile-head">
          <h4>${escapeHtml(a.name)}</h4>
          <span class="action-cat-pill">${escapeHtml(a.category)} · ${escapeHtml(a.risk.charAt(0).toUpperCase() + a.risk.slice(1))}</span>
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
