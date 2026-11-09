'use strict';

const { actions, serializeAction } = require('./actions');

const SEVERITY_POINTS = { high: 14, medium: 7, low: 3, info: 0 };
const SYSTEM_SEVERITY_POINTS = { high: 14, medium: 7, low: 3, info: 0 };
const ACTION_SEVERITY_POINTS = { high: 1.8, medium: 1.0, low: 0.5, info: 0 };

function getFindingDeduction(finding) {
  if (!finding.scored || finding.severity === 'info') return 0;
  if (finding.actionId) {
    return ACTION_SEVERITY_POINTS[finding.severity] || 0;
  }
  return SYSTEM_SEVERITY_POINTS[finding.severity] || 0;
}
const CATEGORY_LABELS = {
  Performance: 'Performance',
  Gaming: 'Gaming',
  Network: 'Network',
  Security: 'Security',
};

function round(value) {
  return Math.round(value);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
}

function addFinding(findings, finding) {
  findings.push({
    severity: 'low',
    scored: true,
    category: 'Performance',
    ...finding,
  });
}

function analyze(snapshot, applied = {}) {
  const findings = [];
  const optimized = [];
  const publicActions = actions.map((action) => serializeAction(action, snapshot, applied));

  for (const action of actions) {
    const info = publicActions.find((item) => item.id === action.id);
    if (!info || !info.applicable) continue;
    if (info.optimized) {
      optimized.push({ id: action.id, name: action.name, category: action.category });
      continue;
    }
    addFinding(findings, {
      id: `action-${action.id}`,
      severity: action.impact === 'high' ? 'high' : action.impact === 'medium' ? 'medium' : 'low',
      category: action.category,
      title: action.name,
      description: action.description,
      detail: action.note,
      actionId: action.id,
      scored: action.risk !== 'advanced',
      risk: action.risk,
      requiresAdmin: !!action.requiresAdmin,
      requiresReboot: !!action.requiresReboot,
    });
  }

  const startupCount = Number(snapshot.startupCount) || 0;
  if (startupCount > 6) {
    addFinding(findings, {
      id: 'startup-load',
      severity: startupCount > 12 ? 'high' : startupCount > 8 ? 'medium' : 'low',
      category: 'Performance',
      title: `${startupCount} programs start with Windows`,
      description: 'Every startup app adds boot time and background work. Keep only what you actually need.',
      detail: 'Review the Startup page. Nothing is changed unless you toggle it.',
      page: 'startup',
    });
  }

  const bootDisk = snapshot.bootDisk;
  if (bootDisk && bootDisk.size > 0) {
    const freePercent = (bootDisk.free / bootDisk.size) * 100;
    if (freePercent < 10) {
      addFinding(findings, {
        id: 'disk-space',
        severity: 'high',
        category: 'Performance',
        title: `Boot drive is ${Math.round(freePercent)}% free`,
        description: `Only ${formatBytes(bootDisk.free)} is available on ${bootDisk.id}. Windows and games need breathing room.`,
        detail: 'Use the Cleanup page or move large files to another drive. Aim for at least 15–20% free.',
        page: 'cleanup',
      });
    } else if (freePercent < 20) {
      addFinding(findings, {
        id: 'disk-space',
        severity: 'medium',
        category: 'Performance',
        title: `Boot drive is ${Math.round(freePercent)}% free`,
        description: `${formatBytes(bootDisk.free)} free on ${bootDisk.id}. Some games and Windows updates need more room.`,
        detail: 'A cleanup pass can help. Aim for at least 15–20% free.',
        page: 'cleanup',
      });
    }
  }

  const computer = snapshot.computer || {};
  if (computer.totalRam > 0 && computer.totalRam < 16 * 1024 ** 3) {
    addFinding(findings, {
      id: 'ram-capacity',
      severity: 'info',
      category: 'Performance',
      title: `${Math.round(computer.totalRam / 1024 ** 3)} GB of RAM installed`,
      description: '16 GB is the comfortable baseline for modern gaming. 32 GB helps with heavy multitasking and some sims.',
      detail: 'Nexa will not pretend a registry tweak can add RAM.',
      scored: false,
    });
  }

  if (computer.memoryUsagePercent >= 90) {
    addFinding(findings, {
      id: 'ram-pressure',
      severity: 'low',
      category: 'Performance',
      title: 'Memory is almost full',
      description: `Windows reports ${computer.memoryUsagePercent}% memory in use.`,
      detail: 'Close heavy background apps or restart if memory stays pinned.',
    });
  }

  const os = snapshot.os || {};
  if (os.uptimeSeconds > 7 * 86_400) {
    addFinding(findings, {
      id: 'uptime',
      severity: 'low',
      category: 'Performance',
      title: 'Windows has been running for over a week',
      description: 'A restart clears leaked memory and resets some driver state.',
      detail: 'This is a cheap, safe maintenance step — no tweak required.',
      scored: false,
    });
  }

  const gpus = Array.isArray(snapshot.gpus) ? snapshot.gpus : [];
  const primaryGpu = gpus.find((gpu) => !/Microsoft Basic/i.test(gpu.name || '')) || gpus[0];
  if (primaryGpu) {
    const age = daysSince(primaryGpu.driverDate);
    if (age !== null && age > 365) {
      const vendor = /nvidia/i.test(primaryGpu.name)
        ? 'NVIDIA'
        : /amd|radeon/i.test(primaryGpu.name)
          ? 'AMD'
          : /intel/i.test(primaryGpu.name)
            ? 'Intel'
            : 'your GPU vendor';
      addFinding(findings, {
        id: 'gpu-driver',
        severity: age > 730 ? 'medium' : 'low',
        category: 'Performance',
        title: 'GPU driver is over a year old',
        description: `${primaryGpu.name.trim()} driver ${primaryGpu.driverVersion || ''} is dated ${primaryGpu.driverDate}.`,
        detail: `Newer drivers often fix stutter and game bugs. Download directly from ${vendor}, not a random driver pack.`,
        scored: age > 730,
        link: /nvidia/i.test(primaryGpu.name)
          ? 'https://www.nvidia.com/Download/index.aspx'
          : /amd|radeon/i.test(primaryGpu.name)
            ? 'https://www.amd.com/en/support'
            : /intel/i.test(primaryGpu.name)
              ? 'https://www.intel.com/content/www/us/en/download-center/home.html'
              : null,
        linkLabel: 'Open driver page',
      });
    }
    if (primaryGpu.refreshRate && primaryGpu.refreshRate < 100) {
      addFinding(findings, {
        id: 'refresh-rate',
        severity: 'info',
        category: 'Gaming',
        title: `Display is running at ${primaryGpu.refreshRate} Hz`,
        description: 'Higher refresh rates make motion clearer and reduce perceived latency.',
        detail: 'Check Windows display settings and your monitor menu. Use the highest rate your monitor supports.',
        scored: false,
      });
    }
  }

  const hasHdd = Array.isArray(snapshot.physicalDisks)
    ? snapshot.physicalDisks.some((disk) => String(disk.mediaType || '').toLowerCase() === 'hdd')
    : false;
  if (hasHdd) {
    addFinding(findings, {
      id: 'hdd',
      severity: 'medium',
      category: 'Performance',
      title: 'A mechanical hard drive was detected',
      description: 'An SSD is the single biggest responsiveness upgrade for most PCs.',
      detail: 'Move Windows and your main games to an SSD. No software tweak replaces an SSD.',
      scored: false,
    });
  }

  const connectedAdapter = (adapter) => {
    if (!adapter || adapter.status !== 'Up') return false;
    const hasAddress =
      (Array.isArray(adapter.ipv4) && adapter.ipv4.length > 0) ||
      (Array.isArray(adapter.ipv6) && adapter.ipv6.length > 0);
    return hasAddress || /[1-9]/.test(String(adapter.linkSpeed || ''));
  };
  const wifiPattern = /wi-?fi|wireless|802\.11/i;
  const wifi = (snapshot.adapters || []).find(
    (adapter) => connectedAdapter(adapter) && wifiPattern.test(`${adapter.mediaType} ${adapter.description} ${adapter.name}`),
  );
  const ethernet = (snapshot.adapters || []).find(
    (adapter) => connectedAdapter(adapter) && !wifiPattern.test(`${adapter.mediaType} ${adapter.description} ${adapter.name}`),
  );
  if (wifi && !ethernet) {
    const speed = String(wifi.linkSpeed || '');
    addFinding(findings, {
      id: 'wifi',
      severity: 'low',
      category: 'Network',
      title: 'Wi-Fi is the active network link',
      description: `Connected through ${wifi.name} at ${speed && !/^0\s*bps$/i.test(speed) ? speed : 'an unknown speed'}.`,
      detail: 'For competitive games, Ethernet is still the most reliable way to reduce jitter and packet loss.',
      scored: false,
    });
  }

  if (ethernet && /100\s*mbps/i.test(ethernet.linkSpeed || '')) {
    addFinding(findings, {
      id: 'link-speed',
      severity: 'low',
      category: 'Network',
      title: 'Ethernet link is running at 100 Mbps',
      description: 'A 100 Mbps link is fine for gaming traffic but can bottleneck downloads and updates.',
      detail: 'Check the cable (Cat 5e or better) and router/switch port. A bad cable often forces 100 Mbps.',
      scored: false,
    });
  }

  if (snapshot.security) {
    const defender = snapshot.security.defender;
    if (defender && defender.antivirusEnabled === false) {
      addFinding(findings, {
        id: 'defender-off',
        severity: 'high',
        category: 'Security',
        title: 'Antivirus protection is disabled',
        description: 'Windows reports that its antivirus engine is off.',
        detail: 'Nexa never disables security software. Turn protection back on in Windows Security.',
        scored: true,
      });
    } else if (defender && defender.realTimeProtectionEnabled === false) {
      addFinding(findings, {
        id: 'defender-realtime-off',
        severity: 'medium',
        category: 'Security',
        title: 'Real-time protection is off',
        description: 'Windows Defender real-time protection is disabled.',
        detail: 'Turn it back on in Windows Security unless you intentionally use another antivirus.',
        scored: true,
      });
    }
    const firewall = Array.isArray(snapshot.security.firewall) ? snapshot.security.firewall : [];
    const disabledFirewall = firewall.filter((profile) => profile.enabled === false);
    if (disabledFirewall.length > 0) {
      addFinding(findings, {
        id: 'firewall-off',
        severity: 'high',
        category: 'Security',
        title: 'A Windows Firewall profile is off',
        description: `${disabledFirewall.map((profile) => profile.name).join(', ')} firewall profile is disabled.`,
        detail: 'Re-enable it in Windows Security. A firewall has no meaningful FPS cost.',
        scored: true,
      });
    }
    if (snapshot.security.secureBoot === false) {
      addFinding(findings, {
        id: 'secure-boot',
        severity: 'low',
        category: 'Security',
        title: 'Secure Boot is off',
        description: 'Secure Boot helps prevent tampered boot loaders from running.',
        detail: 'You can enable it in BIOS/UEFI if your system supports it. Some older setups may not.',
        scored: true,
      });
    }
  }

  if (snapshot.pendingReboot) {
    addFinding(findings, {
      id: 'pending-reboot',
      severity: 'low',
      category: 'Performance',
      title: 'A reboot is pending',
      description: 'Windows has updates or file changes waiting for a restart.',
      detail: 'Some optimization changes only take effect after a reboot.',
      scored: false,
    });
  }

  if (snapshot.os?.build > 0 && snapshot.os.build < 22000) {
    addFinding(findings, {
      id: 'windows-10-eos',
      severity: 'info',
      category: 'Security',
      title: 'Running on Windows 10',
      description: 'Windows 10 reached end of mainstream support in October 2025, and newer DirectX windowed flip-model features require Windows 11 22H2+.',
      detail: 'Windows 10 still works well for gaming, but keep security updates current or plan an upgrade when convenient.',
      scored: false,
    });
  }

  const memoryModules = Array.isArray(snapshot.memoryModules) ? snapshot.memoryModules : [];
  const ramSpeed = memoryModules.find((mod) => Number(mod.speed) > 0)?.speed;
  if (ramSpeed && !snapshot.computer?.isLaptop && (ramSpeed === 2133 || ramSpeed === 2400 || ramSpeed === 4800)) {
    addFinding(findings, {
      id: 'ram-xmp',
      severity: 'info',
      category: 'Performance',
      title: `Memory is running at ${ramSpeed} MT/s (base JEDEC speed)`,
      description: 'Desktop DDR4 (2133/2400) and DDR5 (4800) kits often default to base speeds until XMP or EXPO is enabled in BIOS.',
      detail: 'If your memory kit is rated higher, enabling XMP/EXPO in BIOS can improve 1% low frame rates in CPU-bound games.',
      scored: false,
    });
  }

  const scoredFindings = findings.filter((finding) => finding.scored && finding.severity !== 'info');
  const categoryScores = {};
  for (const category of Object.keys(CATEGORY_LABELS)) {
    const deductions = scoredFindings
      .filter((finding) => finding.category === category)
      .reduce((sum, finding) => sum + getFindingDeduction(finding), 0);
    categoryScores[category] = Math.max(0, Math.round(100 - deductions));
  }
  const totalDeduction = scoredFindings.reduce((sum, finding) => sum + getFindingDeduction(finding), 0);
  const score = Math.max(10, Math.min(100, Math.round(100 - totalDeduction)));
  const potentialDeduction = scoredFindings
    .filter((finding) => finding.actionId || finding.page === 'cleanup' || finding.page === 'startup')
    .reduce((sum, finding) => sum + getFindingDeduction(finding), 0);
  const potentialScore = Math.max(score, Math.min(100, Math.round(100 - totalDeduction + potentialDeduction)));

  const rank =
    score >= 90 ? 'Dialed in' : score >= 75 ? 'Solid setup' : score >= 60 ? 'Room to improve' : 'Needs attention';
  const summary =
    score >= 90
      ? scoredFindings.length === 0
        ? 'All recommended Windows gaming, power, and network parameters are active.'
        : `Core configuration is optimized, with ${scoredFindings.length} optional adjustment${scoredFindings.length === 1 ? '' : 's'} listed below.`
      : score >= 75
        ? 'Most settings are configured well. Review the recommended items below to finish tuning.'
        : score >= 60
          ? 'Several Windows power, scheduling, or network settings can be improved. Apply changes below and test in-game.'
          : 'Multiple high-impact settings are reducing performance or adding latency. Apply the recommended fixes below first.';

  const quickWins = findings
    .filter((finding) => finding.scored && finding.severity !== 'info' && (finding.actionId || finding.page))
    .sort((a, b) => (SEVERITY_POINTS[b.severity] || 0) - (SEVERITY_POINTS[a.severity] || 0))
    .slice(0, 4);

  return {
    generatedAt: new Date().toISOString(),
    score,
    potentialScore,
    rank,
    summary,
    categoryScores,
    findings,
    optimized,
    quickWins,
    actions: publicActions,
    counts: {
      issues: scoredFindings.length,
      totalFindings: findings.length,
      optimized: optimized.length,
    },
  };
}

module.exports = { analyze, formatBytes };
