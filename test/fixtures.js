'use strict';

/**
 * A synthetic snapshot that looks like an already well-optimized Windows PC.
 * Tests can override any top-level field or nested `state` value.
 */
function reg(value, kind = 'DWord') {
  return { exists: true, value, kind };
}

function makeSnapshot(overrides = {}) {
  const base = {
    admin: false,
    computer: {
      name: 'NOVA-TEST',
      manufacturer: 'Test',
      model: 'Test rig',
      totalRam: 32 * 1024 ** 3,
      memoryUsagePercent: 40,
    },
    os: {
      name: 'Windows 11 Pro',
      version: '10.0.22631',
      build: 22621,
      uptimeSeconds: 3600,
    },
    cpu: { name: 'Test CPU', cores: 8, threads: 16 },
    gpus: [
      {
        name: 'NVIDIA GeForce RTX 4070',
        driverVersion: '1.0.0.0',
        driverDate: null,
        refreshRate: 165,
      },
    ],
    physicalDisks: [{ id: 'Disk 0', mediaType: 'SSD', size: 1_000_000_000_000 }],
    bootDisk: { id: 'C:', size: 1_000_000_000_000, free: 500_000_000_000 },
    adapters: [
      {
        name: 'Ethernet',
        description: 'Intel Ethernet',
        mediaType: '802.3',
        status: 'Up',
        linkSpeed: '1 Gbps',
        allowComputerToTurnOffDevice: false,
      },
    ],
    startupCount: 3,
    startup: [],
    power: { name: 'Nova Gaming', guid: '11111111-1111-1111-1111-111111111111' },
    nagle: [],
    pendingReboot: false,
    security: {
      defender: { antivirusEnabled: true, realTimeProtectionEnabled: true },
      firewall: [
        { name: 'Domain', enabled: true },
        { name: 'Private', enabled: true },
        { name: 'Public', enabled: true },
      ],
      secureBoot: true,
    },
    state: {
      gameMode: { autoGameMode: reg(1), allowAutoGameMode: reg(1) },
      gameDvr: { gameDvrEnabled: reg(0), appCaptureEnabled: reg(0) },
      hags: reg(2),
      windowed: reg(1),
      backgroundApps: reg(1),
      transparency: reg(0),
      gamesTask: {
        gpuPriority: reg(8),
        priority: reg(6),
        schedulingCategory: reg('High', 'String'),
        sfioPriority: reg('High', 'String'),
      },
      networkThrottling: reg(-1),
      systemResponsiveness: reg(0),
      mouse: {
        mouseSpeed: reg('0', 'String'),
        threshold1: reg('0', 'String'),
        threshold2: reg('0', 'String'),
      },
      deliveryOptimization: reg(0),
      win32PrioritySeparation: reg(38),
      powerThrottlingOff: reg(1),
      fseBehavior: reg(2),
      pagingExecutive: reg(1),
      fastStartup: reg(0),
      usbSelectiveSuspend: reg(1),
      tdrDelay: reg(8),
      allowTelemetry: reg(0),
      minAnimate: reg('0', 'String'),
      fastUdp: { fastSend: reg(1500), doNotUse: reg(0) },
      disableUserTos: reg(0),
      audioTask: {
        gpuPriority: reg(8),
        priority: reg(6),
        schedulingCategory: reg('High', 'String'),
        sfioPriority: reg('High', 'String'),
      },
      menuShowDelay: reg('0', 'String'),
      mpo: reg(5),
      gamePriority: true,
      dscpPolicies: true,
      nonBestEffortLimit: reg(0),
      nicDejitter: { optimized: true },
      msiMode: { optimized: true, gpu: 1, nic: 1 },
      tcpAutotuning: {
        autoTuning: 'Normal',
        scalingHeuristics: 'Disabled',
        rss: 'Enabled',
      },
    },
  };

  return {
    ...base,
    ...overrides,
    state: { ...base.state, ...(overrides.state || {}) },
  };
}

module.exports = { makeSnapshot };
