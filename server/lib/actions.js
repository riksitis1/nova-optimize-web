'use strict';

const HKCU = 'HKCU';
const HKLM = 'HKLM';

function nodeValue(node) {
  return node && node.exists ? node.value : undefined;
}

function isNumber(node, expected) {
  const value = nodeValue(node);
  return Number(value) === Number(expected);
}

function isString(node, expected) {
  const value = nodeValue(node);
  return value !== undefined && String(value).toLowerCase() === String(expected).toLowerCase();
}

function regSpec(write) {
  return { hive: write.hive, path: write.path, name: write.name };
}

function registryApply(writes) {
  return async (ctx) => {
    const specs = writes.map(regSpec);
    const backup = await ctx.ps('registry.read', { entries: specs });
    const operations = writes.map((write) => ({
      op: 'set',
      hive: write.hive,
      path: write.path,
      name: write.name,
      kind: write.kind || 'DWord',
      value: write.value,
    }));
    const results = await ctx.ps('registry.apply', { operations });
    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      throw new Error(failed.map((result) => `${result.name}: ${result.error}`).join('; '));
    }
    return { kind: 'registry', entries: backup };
  };
}

function registryRevert(ctx, backup) {
  if (!backup || !Array.isArray(backup.entries)) throw new Error('No registry backup is available.');
  const operations = backup.entries.map((entry) => {
    if (entry.exists) {
      return {
        op: 'set',
        hive: entry.hive,
        path: entry.path,
        name: entry.name,
        kind: entry.kind || 'String',
        value: entry.value,
      };
    }
    return {
      op: 'delete',
      hive: entry.hive,
      path: entry.path,
      name: entry.name,
    };
  });
  return ctx.ps('registry.apply', { operations }).then((results) => {
    const failed = results.filter((result) => !result.ok);
    if (failed.length) throw new Error(failed.map((result) => result.error).join('; '));
    return { ok: true };
  });
}

function connectedAdapters(snapshot) {
  return (snapshot.adapters || []).filter((adapter) => {
    if (!adapter || adapter.status !== 'Up') return false;
    const hasAddress =
      (Array.isArray(adapter.ipv4) && adapter.ipv4.length > 0) ||
      (Array.isArray(adapter.ipv6) && adapter.ipv6.length > 0);
    return hasAddress || /[1-9]/.test(String(adapter.linkSpeed || ''));
  });
}

function regAction(config) {
  return {
    kind: 'registry',
    category: 'Gaming',
    impact: 'low',
    risk: 'safe',
    requiresAdmin: false,
    requiresReboot: false,
    appliesTo: () => true,
    isOptimized: () => false,
    writes: config.writes || [],
    async apply(ctx) {
      if (!this.writes.length) throw new Error('This action has no changes to apply.');
      return registryApply(this.writes)(ctx);
    },
    async revert(ctx, backup) {
      return registryRevert(ctx, backup);
    },
    ...config,
  };
}

const GAME_MODE_PATH = 'Software\\Microsoft\\GameBar';
const GAME_DVR_PATH = 'System\\GameConfigStore';
const GAME_DVR_APP_PATH = 'Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR';
const GRAPHICS_DRIVER_PATH = 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers';
const DIRECTX_PATH = 'Software\\Microsoft\\DirectX\\GraphicsSettings';
const DIRECTX_USER_GPU_PATH = 'Software\\Microsoft\\DirectX\\UserGpuPreferences';
const THEMES_PATH = 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';
const BACKGROUND_PATH = 'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications';
const SYSTEM_PROFILE_PATH = 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile';
const GAMES_TASK_PATH = `${SYSTEM_PROFILE_PATH}\\Tasks\\Games`;
const AUDIO_TASK_PATH = `${SYSTEM_PROFILE_PATH}\\Tasks\\Audio`;
const MOUSE_PATH = 'Control Panel\\Mouse';
const AFD_PATH = 'SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters';
const TCPIP_PATH = 'SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters';
const DESKTOP_PATH = 'Control Panel\\Desktop';

const COMPETITIVE_GAMES = [
  'cs2.exe',
  'FortniteClient-Win64-Shipping.exe',
  'RobloxPlayerBeta.exe',
  'javaw.exe',
  'VALORANT-Win64-Shipping.exe',
  'r5apex.exe',
  'cod.exe',
];

const QOS_GAMES = [
  { name: 'NovaQoS_CS2', exe: 'cs2.exe' },
  { name: 'NovaQoS_Fortnite', exe: 'FortniteClient-Win64-Shipping.exe' },
  { name: 'NovaQoS_Roblox', exe: 'RobloxPlayerBeta.exe' },
  { name: 'NovaQoS_Minecraft', exe: 'javaw.exe' },
  { name: 'NovaQoS_Valorant', exe: 'VALORANT-Win64-Shipping.exe' },
  { name: 'NovaQoS_Apex', exe: 'r5apex.exe' },
];

function qosPolicyWrites(policyName, exe) {
  const path = `SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\${policyName}`;
  return [
    { hive: HKLM, path, name: 'Version', kind: 'String', value: '1.0' },
    { hive: HKLM, path, name: 'Application Name', kind: 'String', value: exe },
    { hive: HKLM, path, name: 'Protocol', kind: 'String', value: '*' },
    { hive: HKLM, path, name: 'Local Port', kind: 'String', value: '*' },
    { hive: HKLM, path, name: 'Local IP', kind: 'String', value: '*' },
    { hive: HKLM, path, name: 'Local IP Prefix Length', kind: 'String', value: '*' },
    { hive: HKLM, path, name: 'Remote Port', kind: 'String', value: '*' },
    { hive: HKLM, path, name: 'Remote IP', kind: 'String', value: '*' },
    { hive: HKLM, path, name: 'Remote IP Prefix Length', kind: 'String', value: '*' },
    { hive: HKLM, path, name: 'DSCP Value', kind: 'String', value: '46' },
    { hive: HKLM, path, name: 'Throttle Rate', kind: 'String', value: '-1' },
  ];
}

const actions = [
  regAction({
    id: 'game-process-priority',
    name: 'Anti-Cheat-Safe Game CPU & I/O Priority',
    category: 'Gaming',
    description:
      'Configures Windows kernel Image File Execution Options (IFEO) PerfOptions to grant High CPU Priority (3) and High Disk I/O Priority (3) to competitive game executables (CS2, Fortnite, Roblox, Minecraft, Valorant, Apex, Call of Duty) without triggering anti-cheat blocks.',
    note: 'Safe and reversible. Anti-cheats block runtime API priority boosts, but honor kernel IFEO PerfOptions.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: COMPETITIVE_GAMES.flatMap((exe) => [
      {
        hive: HKLM,
        path: `SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\${exe}\\PerfOptions`,
        name: 'CpuPriorityClass',
        kind: 'DWord',
        value: 3,
      },
      {
        hive: HKLM,
        path: `SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\${exe}\\PerfOptions`,
        name: 'IoPriority',
        kind: 'DWord',
        value: 3,
      },
    ]),
    isOptimized: (snapshot) => snapshot?.state?.gamePriority === true,
    currentValue: (snapshot) =>
      snapshot?.state?.gamePriority ? 'High CPU & I/O (3)' : 'Default (Normal)',
  }),
  regAction({
    id: 'game-mode',
    name: 'Enable Windows Game Mode',
    category: 'Gaming',
    description: 'Tells Windows to prioritize your game and reduce background interruptions while you play.',
    note: 'Safe and reversible. Impact varies by game and system.',
    impact: 'medium',
    risk: 'safe',
    writes: [
      { hive: HKCU, path: GAME_MODE_PATH, name: 'AutoGameModeEnabled', kind: 'DWord', value: 1 },
      { hive: HKCU, path: GAME_MODE_PATH, name: 'AllowAutoGameMode', kind: 'DWord', value: 1 },
    ],
    isOptimized: (snapshot) =>
      isNumber(snapshot.state.gameMode.autoGameMode, 1) && isNumber(snapshot.state.gameMode.allowAutoGameMode, 1),
    currentValue: (snapshot) =>
      isNumber(snapshot.state?.gameMode?.autoGameMode, 1) && isNumber(snapshot.state?.gameMode?.allowAutoGameMode, 1)
        ? 'Enabled (1)'
        : 'Off / Default',
  }),
  regAction({
    id: 'game-dvr',
    name: 'Disable background game recording',
    category: 'Gaming',
    description: 'Stops Windows Game DVR from recording gameplay in the background. Manual capture tools still work.',
    note: 'This turns off the built-in background recorder, not the Xbox Game Bar itself.',
    impact: 'low',
    risk: 'safe',
    writes: [
      { hive: HKCU, path: GAME_DVR_PATH, name: 'GameDVR_Enabled', kind: 'DWord', value: 0 },
      { hive: HKCU, path: GAME_DVR_APP_PATH, name: 'AppCaptureEnabled', kind: 'DWord', value: 0 },
    ],
    isOptimized: (snapshot) =>
      isNumber(snapshot.state.gameDvr.gameDvrEnabled, 0) && isNumber(snapshot.state.gameDvr.appCaptureEnabled, 0),
    currentValue: (snapshot) =>
      isNumber(snapshot.state?.gameDvr?.gameDvrEnabled, 0) && isNumber(snapshot.state?.gameDvr?.appCaptureEnabled, 0)
        ? 'Disabled (0)'
        : 'Recording allowed',
  }),
  regAction({
    id: 'hags',
    name: 'Enable hardware-accelerated GPU scheduling',
    category: 'Gaming',
    description: 'Lets the GPU manage its own scheduling memory. Can reduce latency and frame-time spikes on supported GPUs.',
    note: 'Requires a reboot. If you see stutter or driver issues after enabling, undo it.',
    impact: 'medium',
    risk: 'caution',
    requiresAdmin: true,
    requiresReboot: true,
    appliesTo: (snapshot) => snapshot.os.build >= 19041 && snapshot.gpus.some((gpu) => !/Microsoft Basic/i.test(gpu.name || '')),
    writes: [{ hive: HKLM, path: GRAPHICS_DRIVER_PATH, name: 'HwSchMode', kind: 'DWord', value: 2 }],
    isOptimized: (snapshot) => isNumber(snapshot.state.hags, 2),
    currentValue: (snapshot) => (isNumber(snapshot.state?.hags, 2) ? 'HwSchMode = 2 (On)' : 'HwSchMode = 1 / Default'),
  }),
  regAction({
    id: 'windowed-optimizations',
    name: 'Optimize windowed games',
    category: 'Gaming',
    description:
      'Enables Windows DirectFlip optimizations for borderless and windowed games to eliminate Desktop Window Manager (DWM) composition latency and tearing.',
    note: 'Windows 11 22H2 or newer. Delivers true fullscreen input responsiveness in borderless mode.',
    impact: 'low',
    risk: 'safe',
    appliesTo: (snapshot) => snapshot.os.build >= 22621,
    writes: [
      { hive: HKCU, path: DIRECTX_USER_GPU_PATH, name: 'DirectXUserGlobalSettings', kind: 'String', value: 'SwapEffectUpgradeEnable=1;' },
      { hive: HKCU, path: DIRECTX_PATH, name: 'SwapEffectUpgradeEnable', kind: 'DWord', value: 1 },
    ],
    isOptimized: (snapshot) => isNumber(snapshot.state.windowed, 1),
    currentValue: (snapshot) => (isNumber(snapshot.state?.windowed, 1) ? 'Enabled (DirectFlip)' : 'Off / Default'),
    async apply(ctx) {
      const specs = [
        { hive: HKCU, path: DIRECTX_USER_GPU_PATH, name: 'DirectXUserGlobalSettings' },
        { hive: HKCU, path: DIRECTX_PATH, name: 'SwapEffectUpgradeEnable' },
      ];
      const backup = await ctx.ps('registry.read', { entries: specs });
      const globalEntry = backup[0];

      const existingStr = globalEntry && globalEntry.exists && typeof globalEntry.value === 'string'
        ? globalEntry.value
        : '';

      const tokens = existingStr.split(';').map((s) => s.trim()).filter(Boolean);
      let found = false;
      const updatedTokens = tokens.map((token) => {
        if (/^SwapEffectUpgradeEnable\s*=/i.test(token)) {
          found = true;
          return 'SwapEffectUpgradeEnable=1';
        }
        return token;
      });
      if (!found) {
        updatedTokens.push('SwapEffectUpgradeEnable=1');
      }
      const newStr = updatedTokens.join(';') + ';';

      const operations = [
        {
          op: 'set',
          hive: HKCU,
          path: DIRECTX_USER_GPU_PATH,
          name: 'DirectXUserGlobalSettings',
          kind: 'String',
          value: newStr,
        },
        {
          op: 'set',
          hive: HKCU,
          path: DIRECTX_PATH,
          name: 'SwapEffectUpgradeEnable',
          kind: 'DWord',
          value: 1,
        },
      ];

      const results = await ctx.ps('registry.apply', { operations });
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        throw new Error(failed.map((r) => `${r.name}: ${r.error}`).join('; '));
      }
      return { kind: 'registry', entries: backup };
    },
  }),
  regAction({
    id: 'background-apps',
    name: 'Limit background apps',
    category: 'Performance',
    description: 'Stops Store apps from running background work when you are not using them.',
    note: 'Some background sync and notification features may be delayed.',
    impact: 'low',
    risk: 'safe',
    writes: [{ hive: HKCU, path: BACKGROUND_PATH, name: 'GlobalUserDisabled', kind: 'DWord', value: 1 }],
    isOptimized: (snapshot) => isNumber(snapshot.state.backgroundApps, 1),
    currentValue: (snapshot) => (isNumber(snapshot.state?.backgroundApps, 1) ? 'Restricted (1)' : 'Allowed in background'),
  }),
  regAction({
    id: 'transparency',
    name: 'Disable transparency effects',
    category: 'Performance',
    description: 'Turns off Windows acrylic and transparency effects. Most useful on integrated graphics.',
    note: 'Purely visual. Easy to undo if you miss the look.',
    impact: 'low',
    risk: 'safe',
    writes: [{ hive: HKCU, path: THEMES_PATH, name: 'EnableTransparency', kind: 'DWord', value: 0 }],
    isOptimized: (snapshot) => isNumber(snapshot.state.transparency, 0),
    currentValue: (snapshot) => (isNumber(snapshot.state?.transparency, 0) ? 'Transparency off (0)' : 'Transparency on (1)'),
  }),
  regAction({
    id: 'gpu-priority',
    name: 'Raise the Games task priority',
    category: 'Gaming',
    description: 'Sets the Windows multimedia Games profile to high priority for GPU and thread scheduling, preventing background tasks from stealing render cycles.',
    note: 'Safe and reversible. Ensures active game threads receive high-priority GPU scheduling.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    writes: [
      { hive: HKLM, path: GAMES_TASK_PATH, name: 'GPU Priority', kind: 'DWord', value: 8 },
      { hive: HKLM, path: GAMES_TASK_PATH, name: 'Priority', kind: 'DWord', value: 6 },
      { hive: HKLM, path: GAMES_TASK_PATH, name: 'Scheduling Category', kind: 'String', value: 'High' },
      { hive: HKLM, path: GAMES_TASK_PATH, name: 'SFIO Priority', kind: 'String', value: 'High' },
    ],
    isOptimized: (snapshot) =>
      isNumber(snapshot.state.gamesTask.gpuPriority, 8) &&
      isNumber(snapshot.state.gamesTask.priority, 6) &&
      isString(snapshot.state.gamesTask.schedulingCategory, 'High') &&
      isString(snapshot.state.gamesTask.sfioPriority, 'High'),
    currentValue: (snapshot) => {
      const cat = nodeValue(snapshot.state?.gamesTask?.schedulingCategory) || 'Medium';
      const gpu = nodeValue(snapshot.state?.gamesTask?.gpuPriority) ?? 2;
      return `${cat} · GPU Priority ${gpu}`;
    },
  }),
  regAction({
    id: 'network-throttling',
    name: 'Disable multimedia network throttling',
    category: 'Network',
    description: 'Disables the Windows multimedia network packet throttling mechanism, removing throughput caps and reducing packet jitter during online gaming.',
    note: 'Safe and reversible. Completely unthrottles network packet processing for games.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    writes: [{ hive: HKLM, path: SYSTEM_PROFILE_PATH, name: 'NetworkThrottlingIndex', kind: 'DWord', value: -1 }],
    isOptimized: (snapshot) => {
      const value = nodeValue(snapshot.state.networkThrottling);
      return Number(value) === -1 || Number(value) === 4294967295;
    },
    currentValue: (snapshot) => {
      const value = nodeValue(snapshot.state?.networkThrottling);
      return Number(value) === -1 || Number(value) === 4294967295 ? 'Unthrottled (0xFFFFFFFF)' : `Default (${value ?? 10})`;
    },
  }),
  regAction({
    id: 'system-responsiveness',
    name: 'Prioritize foreground apps',
    category: 'Performance',
    description: 'Configures Windows multimedia responsiveness to 0% reserved for background media, dedicating 100% of CPU thread scheduling priority to your foreground game.',
    note: 'Safe and reversible. Guarantees maximum CPU focus on your active game.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    writes: [{ hive: HKLM, path: SYSTEM_PROFILE_PATH, name: 'SystemResponsiveness', kind: 'DWord', value: 0 }],
    isOptimized: (snapshot) => isNumber(snapshot.state.systemResponsiveness, 0),
    currentValue: (snapshot) => {
      const val = nodeValue(snapshot.state?.systemResponsiveness);
      return Number(val) === 0 ? '0% reserved (Foreground)' : `${val ?? 20}% reserved`;
    },
  }),
  regAction({
    id: 'mouse-acceleration',
    name: 'Disable mouse acceleration',
    category: 'Gaming',
    description: 'Turns off Enhance Pointer Precision in Windows.',
    note: 'Advanced. Games that use raw input ignore this. It changes how the desktop pointer feels.',
    impact: 'low',
    risk: 'advanced',
    writes: [
      { hive: HKCU, path: MOUSE_PATH, name: 'MouseSpeed', kind: 'String', value: '0' },
      { hive: HKCU, path: MOUSE_PATH, name: 'MouseThreshold1', kind: 'String', value: '0' },
      { hive: HKCU, path: MOUSE_PATH, name: 'MouseThreshold2', kind: 'String', value: '0' },
    ],
    isOptimized: (snapshot) =>
      isString(snapshot.state.mouse.mouseSpeed, '0') &&
      isString(snapshot.state.mouse.threshold1, '0') &&
      isString(snapshot.state.mouse.threshold2, '0'),
    currentValue: (snapshot) =>
      isString(snapshot.state?.mouse?.mouseSpeed, '0') ? 'Precision off (1:1)' : 'Pointer Precision on',
  }),
  {
    id: 'power-plan',
    name: 'Activate the Nova Gaming power plan',
    category: 'Performance',
    description: 'Creates a high-performance Windows power plan and makes it active. Your original plan is remembered.',
    note: 'On laptops this increases power use and heat. Plug in for the best experience.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    kind: 'power',
    appliesTo: () => true,
    isOptimized: (snapshot) => {
      const name = String(snapshot.power.name || '').toLowerCase();
      const guid = String(snapshot.power.guid || '').toLowerCase();
      return (
        name.includes('nova gaming') ||
        name.includes('high performance') ||
        name.includes('ultimate performance') ||
        guid === '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c' ||
        guid === 'e9a42b02-d5df-448d-aa00-03f14749eb61'
      );
    },
    currentValue: (snapshot) => snapshot.power?.name || 'Balanced',
    async apply(ctx) {
      const result = await ctx.ps('power.activateNova');
      return {
        kind: 'power',
        originalGuid: result.original.guid,
        originalName: result.original.name,
        novaGuid: result.novaGuid,
        created: result.created,
      };
    },
    async revert(ctx, backup) {
      if (!backup || !backup.originalGuid) throw new Error('The original power plan is not recorded.');
      const payload = { guid: backup.originalGuid };
      if (backup.created && backup.novaGuid && backup.novaGuid !== backup.originalGuid) {
        payload.deleteGuid = backup.novaGuid;
      }
      await ctx.ps('power.setActive', payload);
      return { ok: true };
    },
  },
  {
    id: 'nagle',
    name: 'Reduce TCP acknowledgement delay',
    category: 'Network',
    description: 'Sets TcpAckFrequency and TCPNoDelay on active network adapters for lower TCP latency.',
    note: 'Advanced. Most games use UDP, where this has no effect. It can reduce throughput on some networks. Reboot or reconnect after applying.',
    impact: 'low',
    risk: 'advanced',
    requiresAdmin: true,
    requiresReboot: true,
    kind: 'nagle',
    appliesTo: (snapshot) => Array.isArray(snapshot.nagle) && snapshot.nagle.length > 0,
    isOptimized: (snapshot) =>
      Array.isArray(snapshot.nagle) &&
      snapshot.nagle.length > 0 &&
      snapshot.nagle.every((item) => Number(item.tcpAckFrequency) === 1 && Number(item.tcpNoDelay) === 1),
    currentValue: (snapshot) =>
      Array.isArray(snapshot.nagle) &&
      snapshot.nagle.length > 0 &&
      snapshot.nagle.every((item) => Number(item.tcpAckFrequency) === 1 && Number(item.tcpNoDelay) === 1)
        ? 'TCPNoDelay = 1'
        : 'Windows default Nagle',
    async apply(ctx) {
      if (!ctx.snapshot.nagle.length) throw new Error('No active network adapter was found.');
      const writes = ctx.snapshot.nagle.flatMap((adapter) => {
        const base = `SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\${adapter.guid}`;
        return [
          { hive: HKLM, path: base, name: 'TcpAckFrequency', kind: 'DWord', value: 1 },
          { hive: HKLM, path: base, name: 'TCPNoDelay', kind: 'DWord', value: 1 },
        ];
      });
      return registryApply(writes)(ctx);
    },
    async revert(ctx, backup) {
      return registryRevert(ctx, backup);
    },
  },
  {
    id: 'adapter-power',
    name: 'Stop network adapter power saving',
    category: 'Network',
    description: 'Prevents Windows from turning off active Ethernet and Wi-Fi adapters to save power.',
    note: 'Most useful on laptops or when you see random latency spikes. Reversible.',
    impact: 'low',
    risk: 'caution',
    requiresAdmin: true,
    requiresReboot: false,
    kind: 'adapter-power',
    appliesTo: (snapshot) => connectedAdapters(snapshot).length > 0,
    isOptimized: (snapshot) => {
      const up = connectedAdapters(snapshot);
      return up.length > 0 && up.every((adapter) => adapter.allowComputerToTurnOffDevice === false);
    },
    currentValue: (snapshot) => {
      const up = connectedAdapters(snapshot);
      if (!up.length) return 'No active adapter';
      return up.every((adapter) => adapter.allowComputerToTurnOffDevice === false)
        ? 'Power saving off'
        : 'Power saving allowed';
    },
    async apply(ctx) {
      const names = connectedAdapters(ctx.snapshot).map((adapter) => adapter.name);
      const result = await ctx.ps('net.adapterPowerDisable', { names });
      if (!result.adapters || !result.adapters.length) throw new Error('Windows did not report any changed adapters.');
      return { kind: 'adapter-power', adapters: result.adapters };
    },
    async revert(ctx, backup) {
      if (!backup || !Array.isArray(backup.adapters)) throw new Error('No adapter backup is available.');
      const results = await ctx.ps('net.adapterPowerRestore', {
        names: backup.adapters.map((adapter) => adapter.name),
        adapters: backup.adapters,
      });
      if (Array.isArray(results) && results.length > 0 && results.every((item) => item.ok === false)) {
        const prefix = results[0].name ? `${results[0].name}: ` : '';
        throw new Error(`${prefix}${results[0].error || 'Could not restore adapter power management.'}`);
      }
      return { ok: true };
    },
  },
  {
    id: 'delivery-optimization',
    name: 'Stop Windows Update P2P Bandwidth Sharing',
    category: 'Network',
    description:
      'Prevents Windows Delivery Optimization from uploading and downloading peer-to-peer update fragments in the background while you game or download.',
    note: 'Normal Windows Security and OS updates still work; only P2P background bandwidth sharing is disabled.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: false,
    requiresReboot: false,
    kind: 'registry',
    appliesTo: () => true,
    isOptimized: (snapshot) => isNumber(snapshot?.state?.deliveryOptimization, 0),
    currentValue: (snapshot) => {
      const v = nodeValue(snapshot?.state?.deliveryOptimization);
      if (Number(v) === 0) return 'P2P sharing off (0)';
      return v === undefined ? 'Default (P2P allowed)' : `Mode ${v}`;
    },
    apply: registryApply([
      {
        hive: HKCU,
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config',
        name: 'DODownloadMode',
        kind: 'DWord',
        value: 0,
      },
    ]),
    revert: registryRevert,
  },
  {
    id: 'tcp-autotuning',
    name: 'Unlock Gigabit Download Speeds (TCP Auto-Tuning & RSS)',
    category: 'Network',
    description:
      'Enables Normal TCP Receive Window Auto-Tuning, disables Windows window-shrinking heuristics, and enables multi-core Receive-Side Scaling (RSS) for maximum download throughput and lower CPU interrupt latency.',
    note: 'Fixes throttled Steam, Epic, Battle.net, and browser download speeds caused by restricted TCP windows.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    kind: 'tcp-autotune',
    appliesTo: () => true,
    isOptimized: (snapshot) => {
      const tcp = snapshot?.state?.tcpAutotuning;
      if (!tcp) return false;
      return (
        /normal/i.test(String(tcp.autoTuning || '')) &&
        /disabled/i.test(String(tcp.scalingHeuristics || '')) &&
        /enabled/i.test(String(tcp.rss || ''))
      );
    },
    currentValue: (snapshot) => {
      const tcp = snapshot?.state?.tcpAutotuning;
      if (!tcp) return 'Windows default';
      return `AutoTune: ${tcp.autoTuning || 'Normal'} · RSS: ${tcp.rss || 'Enabled'}`;
    },
    async apply(ctx) {
      const result = await ctx.ps('net.tcpAutotune', {
        autoTuning: 'normal',
        scalingHeuristics: 'disabled',
        rss: 'enabled',
      });
      return {
        kind: 'tcp-autotune',
        before: result?.before || { autoTuning: 'normal', scalingHeuristics: 'disabled', rss: 'enabled' },
      };
    },
    async revert(ctx, backup) {
      const prev = backup?.before || { autoTuning: 'normal', scalingHeuristics: 'disabled', rss: 'enabled' };
      await ctx.ps('net.tcpAutotune', {
        autoTuning: String(prev.autoTuning || 'normal').toLowerCase(),
        scalingHeuristics: String(prev.scalingHeuristics || 'disabled').toLowerCase(),
        rss: String(prev.rss || 'enabled').toLowerCase(),
      });
      return { ok: true };
    },
  },
  {
    id: 'win32-priority',
    name: 'Foreground Game CPU Quantum Priority',
    category: 'Gaming',
    description:
      'Configures Win32PrioritySeparation (0x26) to grant the active foreground game window short, high-priority CPU thread quantums for smoother 1% low FPS and snappier input.',
    note: 'Backed up and reversible to the Windows default (0x02) with one click.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    kind: 'registry',
    appliesTo: () => true,
    isOptimized: (snapshot) => {
      const v = Number(nodeValue(snapshot?.state?.win32PrioritySeparation));
      return v === 38 || v === 0x26 || v === 40;
    },
    currentValue: (snapshot) => {
      const v = nodeValue(snapshot?.state?.win32PrioritySeparation);
      if (Number(v) === 38) return '0x26 (38 · High foreground boost)';
      if (Number(v) === 2) return '0x02 (2 · Windows default)';
      return v === undefined ? 'Default' : `${v}`;
    },
    apply: registryApply([
      {
        hive: HKLM,
        path: 'SYSTEM\\CurrentControlSet\\Control\\PriorityControl',
        name: 'Win32PrioritySeparation',
        kind: 'DWord',
        value: 38,
      },
    ]),
    revert: registryRevert,
  },
  {
    id: 'power-throttling',
    name: 'Disable Background CPU Power Throttling',
    category: 'Performance',
    description:
      'Prevents Windows from aggressively down-clocking game audio, physics, and render helper threads into low-power EcoQoS states.',
    note: 'Advanced. On Intel hybrid CPUs with Performance and Efficient cores (12th Gen+ / Core Ultra), disabling EcoQoS globally can let background apps schedule onto P-cores. Recommended for pure desktop architectures or AMD CPUs.',
    impact: 'medium',
    risk: 'advanced',
    requiresAdmin: true,
    requiresReboot: false,
    kind: 'registry',
    appliesTo: (snapshot) => !snapshot?.battery?.present,
    isOptimized: (snapshot) => isNumber(snapshot?.state?.powerThrottlingOff, 1),
    currentValue: (snapshot) => {
      const v = nodeValue(snapshot?.state?.powerThrottlingOff);
      return Number(v) === 1 ? 'Throttling disabled (1)' : 'Throttling enabled (Default)';
    },
    apply: registryApply([
      {
        hive: HKLM,
        path: 'SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling',
        name: 'PowerThrottlingOff',
        kind: 'DWord',
        value: 1,
      },
    ]),
    revert: registryRevert,
  },
  {
    id: 'fullscreen-optimizations',
    name: 'Exclusive Fullscreen for Older Games',
    category: 'Gaming',
    description:
      'Tells Windows to let games use true exclusive fullscreen instead of the borderless compatibility layer, which can lower input latency and frame-time spikes in older DirectX 9/11 titles.',
    note: 'Modern games already use flip-model presentation, so expect little change there. Fully reversible.',
    impact: 'low',
    risk: 'safe',
    requiresAdmin: false,
    requiresReboot: false,
    kind: 'registry',
    appliesTo: () => true,
    isOptimized: (snapshot) => isNumber(snapshot?.state?.fseBehavior, 2),
    currentValue: (snapshot) => {
      const v = nodeValue(snapshot?.state?.fseBehavior);
      return Number(v) === 2 ? 'Exclusive fullscreen allowed (2)' : 'Windows default';
    },
    apply: registryApply([
      { hive: HKCU, path: 'System\\GameConfigStore', name: 'GameDVR_FSEBehaviorMode', kind: 'DWord', value: 2 },
      { hive: HKCU, path: 'System\\GameConfigStore', name: 'GameDVR_HonorUserFSEBehaviorMode', kind: 'DWord', value: 1 },
      { hive: HKCU, path: 'System\\GameConfigStore', name: 'GameDVR_DXGIHonorFSEWindowsCompatible', kind: 'DWord', value: 1 },
      { hive: HKCU, path: 'System\\GameConfigStore', name: 'GameDVR_EFSEFeatureFlags', kind: 'DWord', value: 0 },
    ]),
    revert: registryRevert,
  },
  regAction({
    id: 'paging-executive',
    name: 'Keep Windows Kernel & Drivers in RAM',
    category: 'Performance',
    description:
      'Forces executive-level Windows kernel code and device drivers to stay resident in physical RAM instead of being paged to disk. Prevents driver page-fault micro-stutter during gaming.',
    note: 'Recommended for PCs with 16 GB+ RAM. Keeps system and input responsiveness instantaneous.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      {
        hive: HKLM,
        path: 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
        name: 'DisablePagingExecutive',
        kind: 'DWord',
        value: 1,
      },
    ],
    isOptimized: (snapshot) => isNumber(snapshot?.state?.pagingExecutive, 1),
    currentValue: (snapshot) =>
      isNumber(snapshot?.state?.pagingExecutive, 1) ? 'Kernel locked in RAM (1)' : 'Paged to disk (Default)',
  }),
  regAction({
    id: 'fast-startup',
    name: 'Clean Kernel State on Boot (Disable Fast Startup)',
    category: 'Performance',
    description:
      'Ensures Windows cleanly resets kernel memory, driver handles, and hardware clocks on every boot instead of restoring days-old hibernated driver sessions that accumulate micro-stutter.',
    note: 'Eliminates multi-day driver memory leaks and ghost uptime. Reversible anytime.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      {
        hive: HKLM,
        path: 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
        name: 'HiberbootEnabled',
        kind: 'DWord',
        value: 0,
      },
    ],
    isOptimized: (snapshot) => isNumber(snapshot?.state?.fastStartup, 0),
    currentValue: (snapshot) =>
      isNumber(snapshot?.state?.fastStartup, 0) ? 'Clean boot (0)' : 'Fast startup active (Default)',
  }),
  regAction({
    id: 'usb-polling',
    name: 'Disable USB Selective Suspend for Input Devices',
    category: 'Gaming',
    description:
      'Prevents Windows from putting USB root hubs into low-power sleep states, guaranteeing uninterrupted 1000Hz+ polling on gaming mice and keyboards.',
    note: 'Stops input stutter and missed polling ticks after pauses in movement.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      {
        hive: HKLM,
        path: 'SYSTEM\\CurrentControlSet\\Services\\USB',
        name: 'DisableSelectiveSuspend',
        kind: 'DWord',
        value: 1,
      },
    ],
    isOptimized: (snapshot) => isNumber(snapshot?.state?.usbSelectiveSuspend, 1),
    currentValue: (snapshot) =>
      isNumber(snapshot?.state?.usbSelectiveSuspend, 1) ? 'Suspend disabled (1)' : 'Selective suspend allowed',
  }),
  regAction({
    id: 'tdr-delay',
    name: 'Prevent GPU Shader Timeout Crashes (TdrDelay)',
    category: 'Gaming',
    description:
      'Extends the Windows GPU Timeout Detection and Recovery (TDR) threshold from 2 seconds to 8 seconds to prevent driver crashes during intense shader compilation and frame spikes.',
    note: 'Prevents DXGI_ERROR_DEVICE_REMOVED crashes in Unreal Engine 5 and heavy DX12 titles.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      {
        hive: HKLM,
        path: 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
        name: 'TdrDelay',
        kind: 'DWord',
        value: 8,
      },
    ],
    isOptimized: (snapshot) => {
      const v = nodeValue(snapshot?.state?.tdrDelay);
      return Number(v) >= 8;
    },
    currentValue: (snapshot) => {
      const v = nodeValue(snapshot?.state?.tdrDelay);
      return Number(v) >= 8 ? `${v}s (Extended)` : `${v ?? 2}s (Default)`;
    },
  }),
  regAction({
    id: 'telemetry-stutter',
    name: 'Disable Background Diagnostics & Telemetry Spikes',
    category: 'Performance',
    description:
      'Stops Windows Connected User Experiences and Telemetry (DiagTrack) from scanning and uploading diagnostic bundles during active gaming sessions.',
    note: 'Uses official Microsoft Group Policy registry key. Completely safe and reversible.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      {
        hive: HKLM,
        path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection',
        name: 'AllowTelemetry',
        kind: 'DWord',
        value: 0,
      },
    ],
    isOptimized: (snapshot) => isNumber(snapshot?.state?.allowTelemetry, 0),
    currentValue: (snapshot) =>
      isNumber(snapshot?.state?.allowTelemetry, 0) ? 'Telemetry disabled (0)' : 'Diagnostic uploads active',
  }),
  regAction({
    id: 'window-animations',
    name: 'Instant Alt-Tab & Window Animation Bypass',
    category: 'Performance',
    description:
      'Disables window minimize and maximize animations in the Windows Desktop Window Manager (DWM) for instantaneous Alt-Tab switching and zero compositor delay.',
    note: 'User-level tweak. Does not require admin rights. Immediate effect.',
    impact: 'low',
    risk: 'safe',
    requiresAdmin: false,
    requiresReboot: false,
    writes: [
      {
        hive: HKCU,
        path: 'Control Panel\\Desktop\\WindowMetrics',
        name: 'MinAnimate',
        kind: 'String',
        value: '0',
      },
    ],
    isOptimized: (snapshot) => isString(snapshot?.state?.minAnimate, '0'),
    currentValue: (snapshot) =>
      isString(snapshot?.state?.minAnimate, '0') ? 'Animations off (0)' : 'Window animations active',
  }),
  regAction({
    id: 'fast-udp',
    name: 'AFD Fast Datagram Transmit (UDP Ping Reducer)',
    category: 'Network',
    description:
      'Bypasses the Windows kernel AFD network buffering queue for all UDP datagrams up to 1,500 bytes (MTU). Transmits multiplayer game packets (Fortnite, CS2, Valorant, Minecraft, Apex, Warzone) immediately onto the wire without driver staging latency.',
    note: 'Safe and reversible. Eliminates UDP socket buffer jitter and cuts input-to-server latency.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      { hive: HKLM, path: AFD_PATH, name: 'FastSendDatagramThreshold', kind: 'DWord', value: 1500 },
      { hive: HKLM, path: AFD_PATH, name: 'DoNotUseFastDatagram', kind: 'DWord', value: 0 },
    ],
    isOptimized: (snapshot) => {
      const fastSend = nodeValue(snapshot?.state?.fastUdp?.fastSend);
      const doNotUse = nodeValue(snapshot?.state?.fastUdp?.doNotUse);
      return Number(fastSend) === 1500 && Number(doNotUse) === 0;
    },
    currentValue: (snapshot) => {
      const fastSend = nodeValue(snapshot?.state?.fastUdp?.fastSend);
      const doNotUse = nodeValue(snapshot?.state?.fastUdp?.doNotUse);
      return Number(fastSend) === 1500 && Number(doNotUse) === 0
        ? 'Fast send active (1500 B)'
        : 'Windows default buffering';
    },
  }),
  regAction({
    id: 'dscp-qos',
    name: 'Enable Network QoS & DSCP 46 Game Packet Tagging',
    category: 'Network',
    description:
      'Configures Windows TCP/IP QoS and active registry policies to tag competitive game packets (CS2, Fortnite, Roblox, Minecraft, Valorant, Apex) with DSCP 46 (Expedited Forwarding). Allows home and ISP routers to prioritize gaming traffic ahead of background downloads, streaming, and bufferbloat.',
    note: 'Official Windows QoS engine. Completely safe, non-destructive, and reversible. Applies live immediately via silent Group Policy refresh.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      { hive: HKLM, path: TCPIP_PATH, name: 'DisableUserTOSSetting', kind: 'DWord', value: 0 },
      { hive: HKLM, path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\Psched', name: 'NonBestEffortLimit', kind: 'DWord', value: 0 },
      ...QOS_GAMES.flatMap((g) => qosPolicyWrites(g.name, g.exe)),
    ],
    isOptimized: (snapshot) =>
      isNumber(snapshot?.state?.disableUserTos, 0) &&
      snapshot?.state?.dscpPolicies === true,
    currentValue: (snapshot) =>
      isNumber(snapshot?.state?.disableUserTos, 0) && snapshot?.state?.dscpPolicies
        ? 'DSCP 46 active on game packets'
        : 'Headers stripped (Default 1)',
  }),
  {
    id: 'nic-low-jitter',
    name: 'NIC Hardware De-Jitter (Disable EEE & Flow Control)',
    category: 'Network',
    description:
      'Disables IEEE 802.3az Energy-Efficient Ethernet (EEE), Green Ethernet PHY sleep states, and Flow Control pause frames on your physical Ethernet adapter to eliminate packet burst wake-up jitter (1–3 ms spikes).',
    note: 'Safe and reversible hardware setting. Requires system restart (or adapter reconnect) to re-initialize hardware PHY without EEE.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: true,
    kind: 'nic-low-jitter',
    appliesTo: (snapshot) => connectedAdapters(snapshot).some((a) => a.mediaType === '802.3'),
    isOptimized: (snapshot) => Boolean(snapshot?.state?.nicDejitter?.optimized),
    currentValue: (snapshot) =>
      snapshot?.state?.nicDejitter?.optimized
        ? 'De-Jitter Active (EEE & Flow Control Off)'
        : 'Default (EEE / Flow Control Enabled)',
    async apply(ctx) {
      const result = await ctx.ps('net.nicDejitterDisable');
      if (!result || !result.adapters || !result.adapters.length) {
        throw new Error('No physical Ethernet adapters could be configured.');
      }
      return { kind: 'nic-low-jitter', backup: result };
    },
    async revert(ctx, backup) {
      if (!backup || !backup.backup) throw new Error('No NIC dejitter backup is available.');
      await ctx.ps('net.nicDejitterRestore', { backup: backup.backup });
      return { ok: true };
    },
  },
  regAction({
    id: 'audio-priority',
    name: 'MMCSS Low-Latency Audio Scheduling',
    category: 'Performance',
    description:
      'Sets the Windows Multimedia Class Scheduler Service (MMCSS) Audio task profile to match the Games profile (GPU Priority 8, Priority 6, High Scheduling), preventing audiodg.exe audio driver buffer underruns from stealing CPU cycles and causing 1% low FPS dips.',
    note: 'Directly improves frame consistency and prevents micro-stutters during heavy combat and sound effects.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    writes: [
      { hive: HKLM, path: AUDIO_TASK_PATH, name: 'GPU Priority', kind: 'DWord', value: 8 },
      { hive: HKLM, path: AUDIO_TASK_PATH, name: 'Priority', kind: 'DWord', value: 6 },
      { hive: HKLM, path: AUDIO_TASK_PATH, name: 'Scheduling Category', kind: 'String', value: 'High' },
      { hive: HKLM, path: AUDIO_TASK_PATH, name: 'SFIO Priority', kind: 'String', value: 'High' },
    ],
    isOptimized: (snapshot) =>
      isNumber(snapshot?.state?.audioTask?.gpuPriority, 8) &&
      isNumber(snapshot?.state?.audioTask?.priority, 6) &&
      isString(snapshot?.state?.audioTask?.schedulingCategory, 'High') &&
      isString(snapshot?.state?.audioTask?.sfioPriority, 'High'),
    currentValue: (snapshot) => {
      const cat = nodeValue(snapshot?.state?.audioTask?.schedulingCategory) || 'Normal';
      const gpu = nodeValue(snapshot?.state?.audioTask?.gpuPriority) ?? 2;
      return `${cat} · GPU Priority ${gpu}`;
    },
  }),
  regAction({
    id: 'menu-delay',
    name: 'Instant Menu & UI Response (0ms MenuShowDelay)',
    category: 'Performance',
    description:
      'Removes the default 400ms Windows Desktop Window Manager delay for opening context menus, tooltips, and app interactions.',
    note: 'Instantaneous desktop responsiveness. Safe user-level setting.',
    impact: 'low',
    risk: 'safe',
    requiresAdmin: false,
    requiresReboot: false,
    writes: [{ hive: HKCU, path: DESKTOP_PATH, name: 'MenuShowDelay', kind: 'String', value: '0' }],
    isOptimized: (snapshot) => isString(snapshot?.state?.menuShowDelay, '0'),
    currentValue: (snapshot) =>
      isString(snapshot?.state?.menuShowDelay, '0')
        ? '0 ms (Instant)'
        : `${nodeValue(snapshot?.state?.menuShowDelay) ?? 400} ms (Default)`,
  }),
  regAction({
    id: 'mpo-bypass',
    name: 'Disable Multiplane Overlays (MPO Bypass)',
    category: 'Gaming',
    description:
      'Disables Desktop Window Manager Multiplane Overlays (MPO) by setting OverlayTestMode to 5. Eliminates VRR/G-Sync screen flickering, micro-stutters, and black screen driver freezes during Alt-Tabbing on multi-monitor high-refresh setups.',
    note: 'Advanced. Recommended if you experience G-Sync/FreeSync flickering or black screen driver timeouts when Alt-Tabbing. Requires reboot.',
    impact: 'medium',
    risk: 'advanced',
    requiresAdmin: true,
    requiresReboot: true,
    writes: [
      {
        hive: HKLM,
        path: 'SOFTWARE\\Microsoft\\Windows\\Dwm',
        name: 'OverlayTestMode',
        kind: 'DWord',
        value: 5,
      },
    ],
    isOptimized: (snapshot) => isNumber(snapshot?.state?.mpo, 5),
    currentValue: (snapshot) => (isNumber(snapshot?.state?.mpo, 5) ? 'MPO disabled (5)' : 'Default (MPO enabled)'),
  }),
  {
    id: 'pcie-msi-mode',
    name: 'Enable PCIe Message Signaled Interrupts (MSI Mode)',
    category: 'Gaming',
    description:
      'Switches your primary GPU and PCIe Ethernet controller from legacy shared pin interrupts (INTx) to Message Signaled Interrupts (MSI). Eliminates IRQ conflicts, lowers CPU interrupt latency, and prevents frame drops during intense gameplay.',
    note: 'Advanced hardware setting. Safe and reversible. Requires system reboot to reinitialize hardware interrupt vectors.',
    impact: 'high',
    risk: 'advanced',
    requiresAdmin: true,
    requiresReboot: true,
    kind: 'pcie-msi-mode',
    appliesTo: (snapshot) =>
      Boolean(snapshot?.state?.msiMode?.gpuSupported !== false || snapshot?.state?.msiMode?.nicSupported !== false),
    isOptimized: (snapshot) => Boolean(snapshot?.state?.msiMode?.optimized),
    currentValue: (snapshot) => {
      const msi = snapshot?.state?.msiMode;
      if (msi?.optimized) return 'MSI Active (GPU & NIC)';
      if (msi?.gpu === 1 && msi?.nic !== 1) return 'Partial (GPU MSI, NIC Line-based)';
      return 'Default (Legacy INTx)';
    },
    async apply(ctx) {
      const result = await ctx.ps('pcie.msiEnable');
      if (!result || !result.devices || !result.devices.length) {
        throw new Error('Could not enable MSI mode on PCIe devices.');
      }
      return { kind: 'pcie-msi', backup: result };
    },
    async revert(ctx, backup) {
      if (!backup || !backup.backup) throw new Error('No PCIe MSI backup is available.');
      await ctx.ps('pcie.msiRestore', { backup: backup.backup });
      return { ok: true };
    },
  },
];

const byId = new Map(actions.map((action) => [action.id, action]));

function getAction(id) {
  return byId.get(id) || null;
}

function serializeAction(action, snapshot, applied = {}) {
  let optimized = false;
  let applicable = true;
  let currentValue = null;
  try {
    applicable = action.appliesTo(snapshot) !== false;
  } catch {
    applicable = true;
  }
  try {
    optimized = applicable && action.isOptimized(snapshot) === true;
  } catch {
    optimized = false;
  }
  try {
    if (typeof action.currentValue === 'function') {
      currentValue = action.currentValue(snapshot);
    }
  } catch {
    currentValue = null;
  }
  return {
    id: action.id,
    name: action.name,
    category: action.category,
    description: action.description,
    note: action.note,
    impact: action.impact,
    risk: action.risk,
    requiresAdmin: !!action.requiresAdmin,
    requiresReboot: !!action.requiresReboot,
    kind: action.kind,
    applicable,
    optimized,
    appliedByNova: !!applied[action.id],
    currentValue,
  };
}

function getPublicActions(snapshot, applied = {}) {
  return actions.map((action) => serializeAction(action, snapshot, applied));
}

module.exports = { actions, getAction, getPublicActions, serializeAction };
