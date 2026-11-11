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
    return applyRegistryOperations(ctx, operations, backup);
  };
}

async function applyRegistryOperations(ctx, operations, entries) {
  if (!Array.isArray(entries) || entries.length !== operations.length || entries.some((entry, index) => {
    const operation = operations[index];
    return !entry || typeof entry.exists !== 'boolean' ||
      ['hive', 'path', 'name'].some((key) => String(entry[key]).toLowerCase() !== String(operation[key]).toLowerCase()) ||
      (entry.exists && (!entry.kind || !Object.hasOwn(entry, 'value')));
  })) throw new Error('Windows did not return a complete registry backup. No settings were changed.');
  const backup = { kind: 'registry', entries };
  let message;
  let changed = entries;
  try {
    const results = await ctx.ps('registry.apply', { operations });
    const failures = results.filter((result) => !result.ok);
    if (!failures.length && results.length === entries.length) return backup;
    message = failures.map((result) => [result.name, result.error].join(': ')).join('; ') || 'Incomplete registry response.';
    changed = entries.filter((_, index) => results[index]?.ok !== false);
  } catch (error) {
    message = error.message;
  }
  if (changed.length) {
    try {
      await registryRevert(ctx, { ...backup, entries: changed });
    } catch (error) {
      throw Object.assign(new Error(message + ' | Rollback failed: ' + error.message), { backup });
    }
  }
  throw new Error(message);
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
    if (!Array.isArray(results) || results.length !== operations.length) throw new Error('Windows did not confirm every restored registry value. Backup retained.');
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
const DELIVERY_OPTIMIZATION_POLICY_PATH = 'SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization';

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
  { name: 'NexaQoS_CS2', exe: 'cs2.exe' },
  { name: 'NexaQoS_Fortnite', exe: 'FortniteClient-Win64-Shipping.exe' },
  { name: 'NexaQoS_Roblox', exe: 'RobloxPlayerBeta.exe' },
  { name: 'NexaQoS_Minecraft', exe: 'javaw.exe' },
  { name: 'NexaQoS_Valorant', exe: 'VALORANT-Win64-Shipping.exe' },
  { name: 'NexaQoS_Apex', exe: 'r5apex.exe' },
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

// Only low-risk defaults affect the readiness score or run in bulk.
const configuredActions = [
  regAction({
    id: 'game-mode',
    name: 'Enable Windows Game Mode',
    category: 'Gaming',
    description: 'Tells Windows to reduce background interruptions while a game is running.',
    note: 'Safe and reversible. The effect varies by game and hardware; it is not a guaranteed FPS boost.',
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
    description: 'Disables Windows game capture for this user.',
    note: 'Use this if you do not use Xbox Game Bar to record or save clips. Other recording apps have their own settings.',
    impact: 'low',
    risk: 'caution',
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
    id: 'capture-history',
    name: 'Stop recording in the background',
    description: 'Turns off Windows’ “Record what happened” buffer for your account.',
    note: 'Manual recording remains available if capture is enabled. Saved clips stay on disk.',
    risk: 'caution',
    appliesTo: (snapshot) => snapshot.state?.gameDvr?.history?.exists === true,
    writes: [{ hive: HKCU, path: GAME_DVR_APP_PATH, name: 'HistoricalCaptureEnabled', kind: 'DWord', value: 0 }],
    isOptimized: (snapshot) => isNumber(snapshot.state?.gameDvr?.history, 0),
    currentValue: (snapshot) => isNumber(snapshot.state?.gameDvr?.history, 1) ? 'On' : 'Off',
  }),
  regAction({
    id: 'hags',
    name: 'Enable hardware-accelerated GPU scheduling',
    category: 'Gaming',
    description: 'Enables hardware-accelerated GPU scheduling (HAGS) on supported Windows 10/11 builds.',
    note: 'Requires a reboot. Some systems see no change or slightly worse frame pacing; undo it if that happens.',
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
      'Enables the DirectX swap-effect upgrade setting that can let borderless and windowed games use modern flip-model presentation on Windows 11 22H2+.',
    note: 'Effect depends on the game, GPU driver, and Windows version. Windows 11 22H2 or newer.',
    impact: 'low',
    risk: 'caution',
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

      return applyRegistryOperations(ctx, operations, backup);
    },
  }),
  regAction({
    id: 'background-apps',
    name: 'Limit background apps',
    category: 'Performance',
    description: 'Stops Store apps from running background work when you are not using them.',
    note: 'Some background sync and notification features may be delayed. Reversible.',
    impact: 'low',
    risk: 'caution',
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
    risk: 'caution',
    writes: [{ hive: HKCU, path: THEMES_PATH, name: 'EnableTransparency', kind: 'DWord', value: 0 }],
    isOptimized: (snapshot) => isNumber(snapshot.state.transparency, 0),
    currentValue: (snapshot) => (isNumber(snapshot.state?.transparency, 0) ? 'Transparency off (0)' : 'Transparency on (1)'),
  }),
  regAction({
    id: 'network-throttling',
    name: 'Disable multimedia network throttling',
    category: 'Network',
    description:
      'Sets NetworkThrottlingIndex to 0xFFFFFFFF, disabling the documented Windows multimedia network throttling behavior.',
    note: 'Advanced. It does not raise your internet plan speed and may not change game latency. Test before keeping it.',
    impact: 'high',
    risk: 'advanced',
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
    name: 'Reduce background multimedia reservation',
    category: 'Performance',
    description:
      'Sets SystemResponsiveness to 0, reducing the CPU time Windows reserves for background multimedia tasks. Windows uses 20 by default.',
    note: 'Advanced. Background audio and video work may become less smooth. Effect on games varies.',
    impact: 'high',
    risk: 'advanced',
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
    name: 'Try the Windows High performance plan',
    category: 'Performance',
    description: 'Switches to the standard Windows High performance plan when it is available.',
    note: 'Compare frame times and temperatures on your desktop. Undo restores your original power plan.',
    impact: 'medium',
    risk: 'caution',
    requiresAdmin: true,
    requiresReboot: false,
    kind: 'power',
    appliesTo: (snapshot) => snapshot.computer?.isLaptop === false && Boolean(snapshot.power?.guid) &&
      !/\b(?:7900|7950|9900|9950)X3D\w*/i.test(snapshot.cpu?.name || ''),
    isOptimized: (snapshot) => {
      const name = String(snapshot.power?.name || '').toLowerCase();
      const guid = String(snapshot.power?.guid || '').toLowerCase();
      return (
        name.includes('nexa gaming') ||
        name.includes('nova gaming') ||
        name.includes('high performance') ||
        name.includes('ultimate performance') ||
        guid === '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c' ||
        guid === 'e9a42b02-d5df-448d-aa00-03f14749eb61'
      );
    },
    currentValue: (snapshot) => snapshot.power?.name || 'Balanced',
    async apply(ctx) {
      const result = await ctx.ps('power.activateNexa');
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
      if (!Array.isArray(results) || results.length !== backup.adapters.length || results.some((item) => item.ok !== true)) {
        throw new Error('Could not confirm restoration of every adapter. Backup retained so you can retry.');
      }
      return { ok: true };
    },
  },
  {
    id: 'delivery-optimization',
    name: 'Stop Windows Update P2P bandwidth sharing',
    category: 'Network',
    description:
      'Turns off Delivery Optimization peer-to-peer sharing through the documented Group Policy value, so Windows Update does not upload update fragments to other PCs in the background.',
    note: 'Normal Windows updates still work. This does not disable Windows Update or speed up your connection by itself.',
    impact: 'medium',
    risk: 'caution',
    requiresAdmin: true,
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
        hive: HKLM,
        path: DELIVERY_OPTIMIZATION_POLICY_PATH,
        name: 'DODownloadMode',
        kind: 'DWord',
        value: 0,
      },
    ]),
    revert: registryRevert,
  },
  {
    id: 'tcp-autotuning',
    name: 'Restore normal TCP auto-tuning and RSS',
    category: 'Network',
    description:
      'Resets Windows TCP receive-window auto-tuning to Normal, disables window-shrinking heuristics, and enables Receive-Side Scaling (RSS).',
    note: 'Advanced. These are already the defaults on most systems. This does not raise your ISP speed limit; it only restores Windows throughput behavior.',
    impact: 'high',
    risk: 'advanced',
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
    name: 'Foreground CPU quantum priority',
    category: 'Gaming',
    description: 'Sets Win32PrioritySeparation to 0x26 (38), giving foreground windows shorter, more frequent CPU quantums.',
    note: 'Advanced. Windows default is 0x02 on many systems. The effect on modern games is small and varies; benchmark before keeping it.',
    impact: 'high',
    risk: 'advanced',
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
    name: 'Disable background CPU power throttling',
    category: 'Performance',
    description: 'Disables Windows Power Throttling globally.',
    note: 'Advanced. On Intel hybrid CPUs (12th Gen+ / Core Ultra), this can let background apps schedule onto P-cores. Recommended only if you understand the trade-off.',
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
    name: 'Exclusive fullscreen for older games',
    category: 'Gaming',
    description:
      'Tells Windows to let older games use true exclusive fullscreen instead of the borderless compatibility layer.',
    note: 'Modern games already use flip-model presentation, so expect little change there. Fully reversible.',
    impact: 'low',
    risk: 'caution',
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
    name: 'Keep Windows kernel and drivers in RAM',
    category: 'Performance',
    description: 'Keeps Windows kernel code and drivers resident in physical RAM instead of paging them to disk.',
    note: 'Caution. Most useful on systems with 16 GB+ RAM. On 8 GB systems it can increase memory pressure. Reversible.',
    impact: 'high',
    risk: 'caution',
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
    name: 'Clean kernel state on boot (disable Fast Startup)',
    category: 'Performance',
    description: 'Disables Windows Fast Startup so shutdown performs a full cold boot, resetting kernel and driver state each time.',
    note: 'Boot may take slightly longer, but drivers and kernel state are refreshed. Reversible.',
    impact: 'medium',
    risk: 'caution',
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
    id: 'telemetry-stutter',
    name: 'Reduce Windows diagnostic data collection',
    category: 'Performance',
    description: 'Sets the documented AllowTelemetry policy to 0 to reduce Windows diagnostic data collection.',
    note: 'Windows 10/11 Pro may treat 0 as Basic instead of fully off; Enterprise/Education honor 0. This is a privacy setting, not an FPS tweak.',
    impact: 'medium',
    risk: 'caution',
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
      isNumber(snapshot?.state?.allowTelemetry, 0) ? 'Telemetry policy = 0' : 'Diagnostic uploads active',
  }),
  regAction({
    id: 'window-animations',
    name: 'Disable window animations',
    category: 'Performance',
    description: 'Disables window minimize and maximize animations.',
    note: 'User-level visual setting. Immediate effect.',
    impact: 'low',
    risk: 'caution',
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
    name: 'AFD fast datagram transmit',
    category: 'Network',
    description: 'Sets the AFD FastSendDatagramThreshold to 1,500 bytes and clears DoNotUseFastDatagram.',
    note: 'Advanced. This can reduce kernel buffering for small UDP packets on some systems, but Microsoft does not document a latency guarantee. Results vary; some systems see no change.',
    impact: 'high',
    risk: 'advanced',
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
    name: 'Enable network QoS and DSCP 46 tagging',
    category: 'Network',
    description:
      'Creates Windows QoS policies that mark matching game traffic with DSCP 46 (Expedited Forwarding) and removes the default QoS bandwidth reservation.',
    note: 'Advanced. Your router or ISP must honor DSCP for this to matter; many home routers ignore it. Reversible.',
    impact: 'high',
    risk: 'advanced',
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
  regAction({
    id: 'menu-delay',
    name: 'Remove the menu show delay',
    category: 'Performance',
    description: 'Removes the default 400 ms delay before context menus and tooltips appear.',
    note: 'User-level visual setting. Immediate effect.',
    impact: 'low',
    risk: 'caution',
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
    name: 'Disable Multiplane Overlays (MPO)',
    category: 'Gaming',
    description: 'Disables Multiplane Overlays (MPO) by setting OverlayTestMode to 5.',
    note: 'Advanced. Use this only if you see VRR/G-Sync flicker or black screens when Alt-Tabbing on multi-monitor setups. Requires a reboot.',
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
];

// Keep old backups resolvable without offering unsupported global overrides again.
const retiredIds = new Set([
  'system-responsiveness', 'paging-executive', 'fast-udp', 'dscp-qos',
  'win32-priority', 'power-throttling', 'fullscreen-optimizations', 'background-apps',
]);
const actions = configuredActions.filter((action) => !retiredIds.has(action.id));
const legacyActions = [
  ...configuredActions.filter((action) => retiredIds.has(action.id)).map((action) => ({
    ...action,
    legacy: true,
    description: 'An older Nexa version offered this global override. Restore your saved setting with Undo.',
    note: 'Retired after the performance audit. This setting is undo-only.',
    currentValue: () => 'Legacy override — original setting saved for Undo',
  })),
  regAction({
    id: 'game-process-priority',
    name: 'Anti-Cheat-Safe Game CPU & I/O Priority',
    category: 'Gaming',
    description:
      'Configures Windows kernel Image File Execution Options (IFEO) PerfOptions to grant High CPU Priority (3) and High Disk I/O Priority (3) to competitive game executables.',
    note: 'Removed in v1.5.0. This legacy tweak is undo-only.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    legacy: true,
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
    id: 'gpu-priority',
    name: 'Raise the Games task priority',
    category: 'Gaming',
    description: 'Sets the Windows multimedia Games profile to high priority for GPU and thread scheduling.',
    note: 'Removed in v1.5.0. This legacy tweak is undo-only.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    legacy: true,
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
    id: 'usb-polling',
    name: 'Disable USB Selective Suspend for Input Devices',
    category: 'Gaming',
    description: 'Prevents Windows from putting USB root hubs into low-power sleep states.',
    note: 'Removed in v1.5.0. This legacy tweak is undo-only.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    legacy: true,
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
    description: 'Extends the Windows GPU Timeout Detection and Recovery (TDR) threshold from 2 seconds to 8 seconds.',
    note: 'Removed in v1.5.0. This legacy tweak is undo-only.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    legacy: true,
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
  {
    id: 'nic-low-jitter',
    name: 'NIC Hardware De-Jitter (Disable EEE & Flow Control)',
    category: 'Network',
    description:
      'Disables IEEE 802.3az Energy-Efficient Ethernet (EEE), Green Ethernet PHY sleep states, and Flow Control pause frames on physical Ethernet adapters.',
    note: 'Removed in v1.5.0. This legacy tweak is undo-only.',
    impact: 'high',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: true,
    kind: 'nic-low-jitter',
    legacy: true,
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
    description: 'Sets the Windows Multimedia Class Scheduler Service (MMCSS) Audio task profile to match the Games profile.',
    note: 'Removed in v1.5.0. This legacy tweak is undo-only.',
    impact: 'medium',
    risk: 'safe',
    requiresAdmin: true,
    requiresReboot: false,
    legacy: true,
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
  {
    id: 'pcie-msi-mode',
    name: 'Enable PCIe Message Signaled Interrupts (MSI Mode)',
    category: 'Gaming',
    description:
      'Switches the primary GPU and PCIe Ethernet controller from legacy shared pin interrupts (INTx) to Message Signaled Interrupts (MSI).',
    note: 'Removed in v1.5.0. This legacy tweak is undo-only.',
    impact: 'high',
    risk: 'advanced',
    requiresAdmin: true,
    requiresReboot: true,
    kind: 'pcie-msi-mode',
    legacy: true,
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

const WORKSTATION_EDITIONS = /^(?:Professional(?:N|EducationN?|WorkstationN?)?|Enterprise(?:N|S|SN|G|GN)?|EducationN?|IoTEnterpriseS?)$/i;
const ENTERPRISE_EDITIONS = /^(?:Enterprise(?:N|S|SN|G|GN)?|EducationN?|IoTEnterpriseS?)$/i;
const WINDOWS_POLICIES = 'Software\\Policies\\Microsoft\\Windows';

function debloatPolicy({ id, name, description, note, path, key, value, build = 14393, editions = WORKSTATION_EDITIONS }) {
  return regAction({
    id,
    name,
    description,
    note,
    category: 'Performance',
    risk: 'caution',
    requiresAdmin: true,
    appliesTo: (snapshot) => snapshot.os?.build >= build && editions.test(snapshot.os?.edition || ''),
    writes: [{ hive: HKLM, path, name: key, kind: 'DWord', value }],
    isOptimized: (snapshot) => isNumber(snapshot.state?.debloat?.[id], value),
  });
}

const debloatActions = [
  debloatPolicy({
    id: 'store-background-policy',
    name: 'Restrict Windows app background tasks',
    description: 'Blocks background work for Windows apps covered by the App Privacy policy.',
    note: 'Optional. Can interrupt notifications, mail sync, and background audio. Desktop programs are unaffected. Per-app policy exceptions still apply. Restart affected apps after changing this setting.',
    path: WINDOWS_POLICIES + '\\AppPrivacy',
    key: 'LetAppsRunInBackground',
    value: 2,
    build: 15063,
  }),
  debloatPolicy({
    id: 'advertising-id',
    name: 'Turn off the Windows advertising ID',
    description: 'Stops Windows apps from using the shared advertising ID.',
    note: 'Apps can still show ads. This changes personalization, not frame rate.',
    path: WINDOWS_POLICIES + '\\AdvertisingInfo',
    key: 'DisabledByGroupPolicy',
    value: 1,
  }),
  debloatPolicy({
    id: 'feedback-prompts',
    name: 'Suppress Windows feedback prompts',
    description: 'Stops Windows from asking for feedback through notifications.',
    note: 'Applies on supported Enterprise and Education editions.',
    path: WINDOWS_POLICIES + '\\DataCollection',
    key: 'DoNotShowFeedbackNotifications',
    value: 1,
    editions: ENTERPRISE_EDITIONS,
  }),
  debloatPolicy({
    id: 'consumer-suggestions',
    name: 'Turn off Microsoft consumer suggestions',
    description: 'Disables suggested apps and consumer promotions in Windows.',
    note: 'Applies on supported Enterprise and Education editions. Installed apps are kept.',
    path: WINDOWS_POLICIES + '\\CloudContent',
    key: 'DisableWindowsConsumerFeatures',
    value: 1,
    editions: ENTERPRISE_EDITIONS,
  }),
  debloatPolicy({
    id: 'windows-tips',
    name: 'Hide Windows tips',
    description: 'Stops the Windows tips and introductory suggestions covered by this policy.',
    note: 'Applies on supported Enterprise and Education editions.',
    path: WINDOWS_POLICIES + '\\CloudContent',
    key: 'DisableSoftLanding',
    value: 1,
    editions: ENTERPRISE_EDITIONS,
  }),
  debloatPolicy({
    id: 'activity-feed',
    name: 'Turn off Windows Activity Feed',
    description: 'Prevents apps and Windows from publishing activities to Activity Feed.',
    note: 'This changes activity tracking. It does not erase existing activity history.',
    path: WINDOWS_POLICIES + '\\System',
    key: 'EnableActivityFeed',
    value: 0,
    build: 16299,
  }),
  debloatPolicy({
    id: 'windows-widgets',
    name: 'Turn off the Windows 11 Widgets board',
    description: 'Disables the Widgets board and its taskbar content.',
    note: 'Undo to use Widgets again. A sign-out may be needed to refresh the taskbar.',
    path: 'Software\\Policies\\Microsoft\\Dsh',
    key: 'AllowNewsAndInterests',
    value: 0,
    build: 22000,
  }),
];

const byId = new Map([...actions, ...legacyActions, ...debloatActions].map((action) => [action.id, action]));

function getAction(id) {
  return byId.get(id) || null;
}

function serializeAction(action, snapshot, applied = {}) {
  let optimized = false;
  let applicable = true;
  let currentValue = null;
  const isAppliedByNexa = Boolean(applied && applied[action.id]);
  try {
    applicable = Boolean(action.appliesTo(snapshot));
  } catch {
    applicable = false;
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
    legacy: Boolean(action.legacy),
    applicable,
    optimized,
    appliedByNexa: isAppliedByNexa,
    appliedByNova: isAppliedByNexa,
    currentValue,
  };
}

function getPublicActions(snapshot, applied = {}) {
  const active = actions.map((action) => serializeAction(action, snapshot, applied));
  const undoable = [...legacyActions, ...debloatActions]
    .filter((action) => applied && applied[action.id])
    .map((action) => serializeAction(action, snapshot, applied));
  return [...active, ...undoable];
}

module.exports = { actions, legacyActions, getAction, getPublicActions, serializeAction };
