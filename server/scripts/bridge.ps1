param(
  [Parameter(Mandatory = $true)]
  [string]$Payload
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'

try {
  $requestJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload))
  $request = $requestJson | ConvertFrom-Json
  $op = [string]$request.op
  $p = $request.args
} catch {
  [Console]::Out.WriteLine('NOVA_JSON:{"ok":false,"error":"Invalid bridge payload"}')
  exit 0
}

function Send-Result {
  param($Data, [bool]$Ok = $true)
  if ($Ok) {
    $payload = [ordered]@{ ok = $true; data = $Data }
  } else {
    $payload = [ordered]@{ ok = $false; error = [string]$Data }
  }
  $json = $payload | ConvertTo-Json -Depth 14 -Compress
  [Console]::Out.WriteLine('NOVA_JSON:' + $json)
}

function Get-HiveRoot {
  param([string]$Hive)
  switch ($Hive.ToUpperInvariant()) {
    'HKCU' { return [Microsoft.Win32.Registry]::CurrentUser }
    'HKLM' { return [Microsoft.Win32.Registry]::LocalMachine }
    default { throw "Unsupported registry hive." }
  }
}

function Read-RegValue {
  param($Spec)
  $root = Get-HiveRoot $Spec.hive
  $key = $root.OpenSubKey([string]$Spec.path, $false)
  if ($null -eq $key) {
    return [ordered]@{ exists = $false; hive = $Spec.hive; path = $Spec.path; name = $Spec.name }
  }
  try {
    $name = [string]$Spec.name
    $names = @($key.GetValueNames())
    if ($names -notcontains $name) {
      return [ordered]@{ exists = $false; hive = $Spec.hive; path = $Spec.path; name = $name }
    }
    $kind = $key.GetValueKind($name).ToString()
    $value = $key.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    if ($kind -eq 'Binary') {
      $value = @($value | ForEach-Object { [int]$_ })
    } elseif ($kind -eq 'MultiString') {
      $value = @($value)
    }
    return [ordered]@{
      exists = $true
      hive = [string]$Spec.hive
      path = [string]$Spec.path
      name = $name
      value = $value
      kind = $kind
    }
  } finally {
    $key.Close()
  }
}

function Set-RegValue {
  param($Spec)
  $root = Get-HiveRoot $Spec.hive
  $key = $root.CreateSubKey([string]$Spec.path)
  if ($null -eq $key) { throw "Could not open registry key." }
  try {
    $name = [string]$Spec.name
    $kind = [string]$Spec.kind
    switch ($kind) {
      'DWord' { $key.SetValue($name, [int32]$Spec.value, [Microsoft.Win32.RegistryValueKind]::DWord) }
      'QWord' { $key.SetValue($name, [int64]$Spec.value, [Microsoft.Win32.RegistryValueKind]::QWord) }
      'Binary' {
        $bytes = [byte[]]@($Spec.value | ForEach-Object { [byte]$_ })
        $key.SetValue($name, $bytes, [Microsoft.Win32.RegistryValueKind]::Binary)
      }
      'MultiString' {
        $strings = [string[]]@($Spec.value)
        $key.SetValue($name, $strings, [Microsoft.Win32.RegistryValueKind]::MultiString)
      }
      'ExpandString' { $key.SetValue($name, [string]$Spec.value, [Microsoft.Win32.RegistryValueKind]::ExpandString) }
      default { $key.SetValue($name, [string]$Spec.value, [Microsoft.Win32.RegistryValueKind]::String) }
    }
  } finally {
    $key.Close()
  }
}

function Delete-RegValue {
  param($Spec)
  $root = Get-HiveRoot $Spec.hive
  $key = $root.OpenSubKey([string]$Spec.path, $true)
  if ($null -eq $key) { return $false }
  $deleted = $false
  try {
    $name = [string]$Spec.name
    if (@($key.GetValueNames()) -contains $name) {
      $key.DeleteValue($name, $false)
      $deleted = $true
    }
  } finally {
    $key.Close()
  }
  try {
    $path = [string]$Spec.path
    if ($path -match '(?i)(SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\NovaQoS_|SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\.+?\\PerfOptions)') {
      $k = $root.OpenSubKey($path, $false)
      if ($null -ne $k) {
        $valCount = @($k.GetValueNames()).Count
        $subCount = @($k.GetSubKeyNames()).Count
        $k.Close()
        if ($valCount -eq 0 -and $subCount -eq 0) {
          $root.DeleteSubKey($path, $false)
        }
      }
    }
  } catch { }
  return $deleted
}

function Get-PowerPlan {
  $raw = (& powercfg /getactivescheme 2>$null | Out-String).Trim()
  $guid = $null
  $name = 'Unknown'
  if ($raw -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') {
    $guid = $Matches[1].ToLowerInvariant()
  }
  if ($raw -match '\(([^)]+)\)') {
    $name = $Matches[1].Trim()
  }
  return [ordered]@{ guid = $guid; name = $name; raw = $raw }
}

function Test-PendingReboot {
  $checks = @(
    'SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending',
    'SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
  )
  foreach ($path in $checks) {
    $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($path, $false)
    if ($null -ne $key) { $key.Close(); return $true }
  }
  $session = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Session Manager', $false)
  if ($null -ne $session) {
    try {
      $pending = $session.GetValue('PendingFileRenameOperations', $null)
      if ($null -ne $pending -and @($pending).Count -gt 0) { return $true }
    } finally {
      $session.Close()
    }
  }
  return $false
}

function Get-StartupEntries {
  $entries = New-Object System.Collections.Generic.List[object]
  $runKeys = @(
    @{ hive = 'HKCU'; path = 'Software\Microsoft\Windows\CurrentVersion\Run'; source = 'User logon'; requiresAdmin = $false },
    @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Run'; source = 'System logon'; requiresAdmin = $true },
    @{ hive = 'HKLM'; path = 'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; source = 'System logon (32-bit)'; requiresAdmin = $true }
  )
  foreach ($item in $runKeys) {
    try {
      $root = Get-HiveRoot $item.hive
      $key = $root.OpenSubKey($item.path, $false)
      if ($null -eq $key) { continue }
      try {
        foreach ($name in @($key.GetValueNames())) {
          if ([string]::IsNullOrWhiteSpace($name)) { continue }
          $value = $key.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
          $kind = $key.GetValueKind($name).ToString()
          $entries.Add([ordered]@{
            type = 'registry'
            hive = $item.hive
            path = $item.path
            name = $name
            value = [string]$value
            kind = $kind
            source = $item.source
            command = [string]$value
            requiresAdmin = [bool]$item.requiresAdmin
          })
        }
      } finally {
        $key.Close()
      }
    } catch { }
  }

  $startupFolders = @(
    @{ path = [Environment]::GetFolderPath('Startup'); source = 'User startup folder'; requiresAdmin = $false },
    @{ path = [Environment]::GetFolderPath('CommonStartup'); source = 'All users startup folder'; requiresAdmin = $true }
  )
  foreach ($folder in $startupFolders) {
    try {
      if ([string]::IsNullOrWhiteSpace($folder.path) -or -not (Test-Path -LiteralPath $folder.path)) { continue }
      foreach ($file in @(Get-ChildItem -LiteralPath $folder.path -Force -File -ErrorAction SilentlyContinue)) {
        if ($file.Name -ieq 'desktop.ini') { continue }
        $entries.Add([ordered]@{
          type = 'file'
          filePath = $file.FullName
          name = $file.Name
          source = $folder.source
          command = $file.FullName
          kind = 'File'
          requiresAdmin = [bool]$folder.requiresAdmin
        })
      }
    } catch { }
  }
  return $entries.ToArray()
}

function Get-FolderInfo {
  param([string[]]$Paths, [int]$MinAgeHours = 0, [int]$MaxAgeHours = 0)
  $bytes = [int64]0
  $files = 0
  $hasMinAge = $MinAgeHours -gt 0
  $hasMaxAge = $MaxAgeHours -gt 0
  $minCutoff = if ($hasMinAge) { (Get-Date).AddHours(-1 * $MinAgeHours) } else { $null }
  $maxCutoff = if ($hasMaxAge) { (Get-Date).AddHours(-1 * $MaxAgeHours) } else { $null }
  foreach ($path in $Paths) {
    try {
      if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path)) { continue }
      $children = @(Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue)
      foreach ($child in $children) {
        try {
          if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
          if ($child.PSIsContainer) {
            $items = @(Get-ChildItem -LiteralPath $child.FullName -Recurse -Force -File -ErrorAction SilentlyContinue)
          } else {
            $items = @($child)
          }
          foreach ($file in $items) {
            if ($hasMinAge -and $file.LastWriteTime -ge $minCutoff) { continue }
            if ($hasMaxAge -and $file.LastWriteTime -lt $maxCutoff) { continue }
            $bytes += [int64]$file.Length
            $files++
          }
        } catch { }
      }
    } catch { }
  }
  return [ordered]@{ bytes = $bytes; files = $files }
}

function Get-CleanupDefinitions {
  $local = $env:LOCALAPPDATA
  $localLow = Join-Path $env:USERPROFILE 'AppData\LocalLow'
  $roaming = $env:APPDATA
  $windir = $env:WINDIR
  $programData = $env:ProgramData
  $browserPaths = New-Object System.Collections.Generic.List[string]
  $browserRoots = @(
    (Join-Path $local 'Google\Chrome\User Data'),
    (Join-Path $local 'Microsoft\Edge\User Data'),
    (Join-Path $local 'BraveSoftware\Brave-Browser\User Data'),
    (Join-Path $local 'Vivaldi\User Data')
  )
  foreach ($root in $browserRoots) {
    try {
      if (-not (Test-Path -LiteralPath $root)) { continue }
      foreach ($profile in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
        if ($profile.Name -notmatch '^(Default|Profile \d+|Guest Profile)$') { continue }
        foreach ($cacheName in @('Cache', 'Code Cache', 'GPUCache')) {
          $candidate = Join-Path $profile.FullName $cacheName
          if (Test-Path -LiteralPath $candidate) { $browserPaths.Add($candidate) }
        }
      }
    } catch { }
  }
  $firefoxRoot = Join-Path $local 'Mozilla\Firefox\Profiles'
  try {
    if (Test-Path -LiteralPath $firefoxRoot) {
      foreach ($profile in @(Get-ChildItem -LiteralPath $firefoxRoot -Directory -ErrorAction SilentlyContinue)) {
        foreach ($cacheName in @('cache2', 'startupCache', 'jumpListCache')) {
          $candidate = Join-Path $profile.FullName $cacheName
          if (Test-Path -LiteralPath $candidate) { $browserPaths.Add($candidate) }
        }
      }
    }
  } catch { }

  return [ordered]@{
    'user-temp' = [ordered]@{
      label = 'User temp files'; description = 'Temporary files left by apps and installers.'; risk = 'safe'
      paths = @($env:TEMP); minAgeHours = 1; requiresAdmin = $false
    }
    'windows-temp' = [ordered]@{
      label = 'Windows temp files'; description = 'System-level temporary files. Open files are skipped.'; risk = 'safe'
      paths = @((Join-Path $windir 'Temp')); minAgeHours = 1; requiresAdmin = $true
    }
    'crash-dumps' = [ordered]@{
      label = 'Crash dumps'; description = 'Memory dumps from apps that crashed.'; risk = 'safe'
      paths = @((Join-Path $local 'CrashDumps')); minAgeHours = 1; requiresAdmin = $false
    }
    'error-reports' = [ordered]@{
      label = 'Windows error reports'; description = 'Queued and archived Windows Error Reporting data.'; risk = 'safe'
      paths = @(
        (Join-Path $programData 'Microsoft\Windows\WER\ReportQueue'),
        (Join-Path $programData 'Microsoft\Windows\WER\ReportArchive')
      ); minAgeHours = 24; requiresAdmin = $true
    }
    'stale-shader-cache' = [ordered]@{
      label = 'Stale GPU shader caches (>30 days)'
      description = 'DirectX, NVIDIA, and AMD compiled shaders untouched for over 30 days. Safe to clear: reclaims space from old games and updates without causing stutters in your current games.'
      risk = 'safe'
      paths = @(
        (Join-Path $local 'D3DSCache'),
        (Join-Path $local 'NVIDIA\DXCache'),
        (Join-Path $local 'NVIDIA\GLCache'),
        (Join-Path $local 'NVIDIA\ComputeCache'),
        (Join-Path $local 'NVIDIA\NV_Cache'),
        (Join-Path $localLow 'NVIDIA\PerDriverVersion\DXCache'),
        (Join-Path $localLow 'NVIDIA\PerDriverVersion\GLCache'),
        (Join-Path $local 'AMD\DxCache'),
        (Join-Path $local 'AMD\GLCache'),
        (Join-Path $local 'AMD\ComputeCache')
      )
      minAgeHours = 720
      maxAgeHours = 0
      requiresAdmin = $false
    }
    'active-shader-cache' = [ordered]@{
      label = 'Active GPU shader caches (last 30 days)'
      description = 'Compiled shaders for games you played in the last 30 days. Only clear if experiencing corrupted textures or graphics bugs; recently played games will briefly stutter while recompiling.'
      risk = 'caution'
      paths = @(
        (Join-Path $local 'D3DSCache'),
        (Join-Path $local 'NVIDIA\DXCache'),
        (Join-Path $local 'NVIDIA\GLCache'),
        (Join-Path $local 'NVIDIA\ComputeCache'),
        (Join-Path $local 'NVIDIA\NV_Cache'),
        (Join-Path $localLow 'NVIDIA\PerDriverVersion\DXCache'),
        (Join-Path $localLow 'NVIDIA\PerDriverVersion\GLCache'),
        (Join-Path $local 'AMD\DxCache'),
        (Join-Path $local 'AMD\GLCache'),
        (Join-Path $local 'AMD\ComputeCache')
      )
      minAgeHours = 0
      maxAgeHours = 720
      requiresAdmin = $false
    }
    'browser-cache' = [ordered]@{
      label = 'Browser caches'; description = 'Chrome, Edge, Brave, Vivaldi and Firefox cache data. Close browsers first.'; risk = 'caution'
      paths = @($browserPaths); minAgeHours = 1; requiresAdmin = $false; needsBrowserClosed = $true
    }
    'recycle-bin' = [ordered]@{
      label = 'Recycle Bin'; description = 'Files you have already deleted. Emptying is permanent and cannot be undone.'; risk = 'caution'
      paths = @(); minAgeHours = 0; requiresAdmin = $false; recycleBin = $true
    }
  }
}

function Get-RecycleBinInfo {
  try {
    $shell = New-Object -ComObject Shell.Application
    $namespace = $shell.Namespace(10)
    if ($null -eq $namespace) { return [ordered]@{ bytes = 0; files = 0 } }
    $bytes = [int64]0
    $files = 0
    foreach ($item in @($namespace.Items())) {
      try { $bytes += [int64]$item.Size; $files++ } catch { }
    }
    return [ordered]@{ bytes = $bytes; files = $files }
  } catch {
    return [ordered]@{ bytes = 0; files = 0 }
  }
}

function Get-CleanupScan {
  $definitions = Get-CleanupDefinitions
  $result = New-Object System.Collections.Generic.List[object]
  foreach ($id in $definitions.Keys) {
    $definition = $definitions[$id]
    if ($definition.recycleBin) {
      $info = Get-RecycleBinInfo
    } else {
      $info = Get-FolderInfo -Paths @($definition.paths) -MinAgeHours ([int]$definition.minAgeHours) -MaxAgeHours ([int]$definition.maxAgeHours)
    }
    $result.Add([ordered]@{
      id = $id
      label = $definition.label
      description = $definition.description
      risk = $definition.risk
      bytes = $info.bytes
      files = $info.files
      requiresAdmin = [bool]$definition.requiresAdmin
      needsBrowserClosed = [bool]($definition.needsBrowserClosed -eq $true)
      recycleBin = [bool]($definition.recycleBin -eq $true)
    })
  }
  return @($result | Sort-Object -Property @{ Expression = { $_.bytes }; Descending = $true })
}

function Remove-CleanupCategory {
  param([string]$Id)
  $definitions = Get-CleanupDefinitions
  if (-not $definitions.Contains($Id)) { throw "Unknown cleanup category." }
  $definition = $definitions[$Id]
  if ($definition.needsBrowserClosed) {
    $running = @(Get-Process -Name chrome, msedge, brave, vivaldi, firefox -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
      return [ordered]@{ id = $Id; skipped = $true; reason = 'Close your browser before cleaning its cache.'; bytes = 0; files = 0; errors = @() }
    }
  }
  if ($definition.recycleBin) {
    $before = Get-RecycleBinInfo
    try { Clear-RecycleBin -Force -ErrorAction Stop } catch { }
    $after = Get-RecycleBinInfo
    return [ordered]@{
      id = $Id; skipped = $false; bytes = [Math]::Max(0, $before.bytes - $after.bytes)
      files = [Math]::Max(0, $before.files - $after.files); errors = @()
    }
  }

  $hasMinAge = [int]$definition.minAgeHours -gt 0
  $hasMaxAge = [int]$definition.maxAgeHours -gt 0
  $minCutoff = if ($hasMinAge) { (Get-Date).AddHours(-1 * [int]$definition.minAgeHours) } else { $null }
  $maxCutoff = if ($hasMaxAge) { (Get-Date).AddHours(-1 * [int]$definition.maxAgeHours) } else { $null }

  $before = Get-FolderInfo -Paths @($definition.paths) -MinAgeHours ([int]$definition.minAgeHours) -MaxAgeHours ([int]$definition.maxAgeHours)
  $errors = New-Object System.Collections.Generic.List[string]
  foreach ($path in @($definition.paths)) {
    try {
      if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path)) { continue }
      foreach ($child in @(Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue)) {
        try {
          if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
          if ($child.PSIsContainer) {
            if ($hasMinAge -or $hasMaxAge) {
              $subFiles = @(Get-ChildItem -LiteralPath $child.FullName -Recurse -Force -File -ErrorAction SilentlyContinue)
              foreach ($subFile in $subFiles) {
                try {
                  if ($hasMinAge -and $subFile.LastWriteTime -ge $minCutoff) { continue }
                  if ($hasMaxAge -and $subFile.LastWriteTime -lt $maxCutoff) { continue }
                  Remove-Item -LiteralPath $subFile.FullName -Force -ErrorAction SilentlyContinue
                } catch { }
              }
              if (@(Get-ChildItem -LiteralPath $child.FullName -Force -ErrorAction SilentlyContinue).Count -eq 0) {
                try { Remove-Item -LiteralPath $child.FullName -Force -Recurse -ErrorAction SilentlyContinue } catch { }
              }
            } else {
              Remove-Item -LiteralPath $child.FullName -Recurse -Force -ErrorAction Stop
            }
          } else {
            if ($hasMinAge -and $child.LastWriteTime -ge $minCutoff) { continue }
            if ($hasMaxAge -and $child.LastWriteTime -lt $maxCutoff) { continue }
            Remove-Item -LiteralPath $child.FullName -Force -ErrorAction Stop
          }
        } catch {
          if ($errors.Count -lt 12) { $errors.Add($_.Exception.Message) }
        }
      }
    } catch {
      if ($errors.Count -lt 12) { $errors.Add($_.Exception.Message) }
    }
  }
  $after = Get-FolderInfo -Paths @($definition.paths) -MinAgeHours ([int]$definition.minAgeHours) -MaxAgeHours ([int]$definition.maxAgeHours)
  return [ordered]@{
    id = $Id
    skipped = $false
    bytes = [Math]::Max(0, $before.bytes - $after.bytes)
    files = [Math]::Max(0, $before.files - $after.files)
    errors = $errors.ToArray()
  }
}

function Get-DnsInfo {
  $adapters = New-Object System.Collections.Generic.List[object]
  $items = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' })
  foreach ($adapter in $items) {
    try {
      $dns4 = @(Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object { $_.ServerAddresses })
      $dns6 = @(Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv6 -ErrorAction SilentlyContinue | ForEach-Object { $_.ServerAddresses })
      $ip4 = @(Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254.*' } | ForEach-Object { $_.IPAddress })
      $ip6 = @(Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv6 -ErrorAction SilentlyContinue | ForEach-Object { $_.IPAddress })
      $mode = 'dhcp'
      try {
        $spec = @{ hive = 'HKLM'; path = "SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\$($adapter.InterfaceGuid)"; name = 'NameServer' }
        $static = Read-RegValue $spec
        if ($static.exists -and -not [string]::IsNullOrWhiteSpace([string]$static.value)) { $mode = 'static' }
      } catch { }
      $adapters.Add([ordered]@{
        ifIndex = $adapter.ifIndex
        name = $adapter.Name
        description = $adapter.InterfaceDescription
        mediaType = [string]$adapter.MediaType
        linkSpeed = [string]$adapter.LinkSpeed
        macAddress = [string]$adapter.MacAddress
        guid = [string]$adapter.InterfaceGuid
        dns4 = @($dns4 | Where-Object { $_ })
        dns6 = @($dns6 | Where-Object { $_ })
        ipv4 = @($ip4)
        ipv6 = @($ip6)
        mode = $mode
      })
    } catch { }
  }
  return $adapters.ToArray()
}

function Set-DnsServers {
  param([int[]]$IfIndexes, [string[]]$Servers)
  $results = New-Object System.Collections.Generic.List[object]
  foreach ($index in $IfIndexes) {
    try {
      Set-DnsClientServerAddress -InterfaceIndex $index -ServerAddresses $Servers -ErrorAction Stop
      $results.Add([ordered]@{ ifIndex = $index; ok = $true })
    } catch {
      $results.Add([ordered]@{ ifIndex = $index; ok = $false; error = $_.Exception.Message })
    }
  }
  return $results.ToArray()
}

function Reset-DnsServers {
  param($Backups)
  $results = New-Object System.Collections.Generic.List[object]
  foreach ($backup in @($Backups)) {
    try {
      if ([string]$backup.mode -eq 'static' -and @($backup.servers).Count -gt 0) {
        Set-DnsClientServerAddress -InterfaceIndex ([int]$backup.ifIndex) -ServerAddresses ([string[]]$backup.servers) -ErrorAction Stop
      } else {
        Set-DnsClientServerAddress -InterfaceIndex ([int]$backup.ifIndex) -ResetServerAddresses -ErrorAction Stop
      }
      $results.Add([ordered]@{ ifIndex = [int]$backup.ifIndex; ok = $true })
    } catch {
      $results.Add([ordered]@{ ifIndex = [int]$backup.ifIndex; ok = $false; error = $_.Exception.Message })
    }
  }
  return $results.ToArray()
}

function Invoke-Ping {
  param([string]$HostName, [int]$Count)
  $count = [Math]::Min(20, [Math]::Max(1, $Count))
  $ping = New-Object System.Net.NetworkInformation.Ping
  $times = New-Object System.Collections.Generic.List[object]
  $address = $null
  try {
    $addresses = [System.Net.Dns]::GetHostAddresses($HostName)
    $first = @($addresses | Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } | Select-Object -First 1)
    if ($first.Count -gt 0) { $address = $first[0].ToString() } elseif ($addresses.Count -gt 0) { $address = $addresses[0].ToString() }
  } catch { }
  for ($i = 0; $i -lt $count; $i++) {
    try {
      $reply = $ping.Send($HostName, 1200)
      if ($reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success) {
        $times.Add([int]$reply.RoundtripTime)
      } else {
        $times.Add($null)
      }
    } catch {
      $times.Add($null)
    }
    if ($i -lt ($count - 1)) { Start-Sleep -Milliseconds 120 }
  }
  $okTimes = @($times | Where-Object { $null -ne $_ })
  $received = $okTimes.Count
  $sent = $count
  $loss = if ($sent -gt 0) { [Math]::Round((($sent - $received) / $sent) * 100, 1) } else { 100 }
  if ($received -eq 0) {
    return [ordered]@{ host = $HostName; address = $address; count = $sent; received = 0; loss = 100; min = $null; avg = $null; max = $null; jitter = $null; times = $times.ToArray() }
  }
  $min = ($okTimes | Measure-Object -Minimum).Minimum
  $max = ($okTimes | Measure-Object -Maximum).Maximum
  $avg = [Math]::Round(($okTimes | Measure-Object -Average).Average, 1)
  $diffs = @()
  for ($i = 1; $i -lt $okTimes.Count; $i++) { $diffs += [Math]::Abs([double]$okTimes[$i] - [double]$okTimes[$i - 1]) }
  $jitter = if ($diffs.Count -gt 0) { [Math]::Round(($diffs | Measure-Object -Average).Average, 1) } else { 0 }
  return [ordered]@{
    host = $HostName; address = $address; count = $sent; received = $received; loss = $loss
    min = $min; avg = $avg; max = $max; jitter = $jitter; times = $times.ToArray()
  }
}

function Get-ProcessSnapshot {
  $cores = [Math]::Max(1, [Environment]::ProcessorCount)
  $first = @{}
  foreach ($process in @(Get-Process -ErrorAction SilentlyContinue)) {
    try { $first[[int]$process.Id] = [double]$process.CPU } catch { }
  }
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Start-Sleep -Milliseconds 300
  $sw.Stop()
  $elapsed = [Math]::Max(0.001, $sw.Elapsed.TotalSeconds)

  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($process in @(Get-Process -ErrorAction SilentlyContinue)) {
    try {
      $id = [int]$process.Id
      $totalCpu = [double]$process.CPU
      $delta = if ($first.ContainsKey($id)) { [Math]::Max(0, $totalCpu - $first[$id]) } else { 0 }
      $activeCpu = [Math]::Round(($delta / $elapsed / $cores) * 100, 1)
      $rows.Add([pscustomobject]@{
        pid = $id
        name = $process.ProcessName
        cpu = $activeCpu
        totalCpu = [Math]::Round($totalCpu, 1)
        memory = [int64]$process.WorkingSet64
        path = ''
      })
    } catch { }
  }
  $byCpu = @($rows | Sort-Object @{ Expression = 'cpu'; Descending = $true }, @{ Expression = 'totalCpu'; Descending = $true }, @{ Expression = 'memory'; Descending = $true } | Select-Object -First 12)
  $byMemory = @($rows | Sort-Object -Property memory -Descending | Select-Object -First 12)
  return [ordered]@{ byCpu = $byCpu; byMemory = $byMemory; processCount = $rows.Count }
}

function Get-Snapshot {
  $os = Get-CimInstance Win32_OperatingSystem -Property Caption,Version,BuildNumber,OSArchitecture,InstallDate,LastBootUpTime,FreePhysicalMemory -ErrorAction Stop
  $cs = Get-CimInstance Win32_ComputerSystem -Property Manufacturer,Model,TotalPhysicalMemory -ErrorAction Stop
  $cpu = @(Get-CimInstance Win32_Processor -Property Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed -ErrorAction SilentlyContinue | Select-Object -First 1)
  $gpus = @(Get-CimInstance Win32_VideoController -Property Name,AdapterRAM,DriverVersion,DriverDate,VideoProcessor,CurrentRefreshRate,CurrentHorizontalResolution,CurrentVerticalResolution,Status,PNPDeviceID -ErrorAction SilentlyContinue)
  $memoryModules = @(Get-CimInstance Win32_PhysicalMemory -Property Capacity,ConfiguredClockSpeed,Speed,Manufacturer,PartNumber,DeviceLocator -ErrorAction SilentlyContinue)
  $logicalDisks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -Property DeviceID,VolumeName,Size,FreeSpace,FileSystem -ErrorAction SilentlyContinue)
  $physicalDisks = @()
  try {
    $rawDisks = @(Get-CimInstance -Namespace 'root\Microsoft\Windows\Storage' -ClassName MSFT_PhysicalDisk -Property FriendlyName,MediaType,Size,HealthStatus,BusType -ErrorAction SilentlyContinue)
    $physicalDisks = @($rawDisks | ForEach-Object {
      $mt = switch ([int]$_.MediaType) { 3 { 'HDD' } 4 { 'SSD' } 5 { 'SCM' } default { 'Unspecified' } }
      $hs = switch ([int]$_.HealthStatus) { 0 { 'Healthy' } 1 { 'Warning' } 2 { 'Unhealthy' } default { 'Unknown' } }
      $bt = switch ([int]$_.BusType) { 17 { 'NVMe' } 11 { 'SATA' } 7 { 'USB' } 8 { 'RAID' } 3 { 'ATA' } default { [string]$_.BusType } }
      [pscustomobject]@{ FriendlyName = $_.FriendlyName; MediaType = $mt; Size = $_.Size; HealthStatus = $hs; BusType = $bt }
    })
  } catch { }
  $battery = @(Get-CimInstance Win32_Battery -Property BatteryStatus,EstimatedChargeRemaining -ErrorAction SilentlyContinue)

  $pnpMap = @{}
  $driverKeyMap = @{}
  try {
    $classKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}', $false)
    if ($null -ne $classKey) {
      foreach ($sub in $classKey.GetSubKeyNames()) {
        if ($sub -notmatch '^\d{4}$') { continue }
        $k = $classKey.OpenSubKey($sub, $false)
        if ($null -ne $k) {
          $cfgGuid = [string]$k.GetValue('NetCfgInstanceId', '')
          $pnpVal = $k.GetValue('PnPCapabilities', $null)
          if ($cfgGuid) {
            $guidLower = $cfgGuid.ToLowerInvariant()
            $driverKeyMap[$guidLower] = "SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}\$sub"
            if ($null -ne $pnpVal) {
              $pnpMap[$guidLower] = (([int]$pnpVal -band 0x10) -eq 0)
            } else {
              $pnpMap[$guidLower] = $true
            }
          }
          $k.Close()
        }
      }
      $classKey.Close()
    }
  } catch { }

  $ipMap = @{}
  $statusMap = @{}
  try {
    foreach ($ni in @([System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces())) {
      $idKey = [string]$ni.Id
      if (-not $idKey) { continue }
      $idLower = $idKey.ToLowerInvariant()
      $statusMap[$idLower] = if ($ni.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up) { 'Up' } else { [string]$ni.OperationalStatus }
      $ips = @()
      try {
        foreach ($ua in $ni.GetIPProperties().UnicastAddresses) {
          if ($ua.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
            $ipStr = $ua.Address.ToString()
            if ($ipStr -notlike '169.254.*' -and $ipStr -ne '127.0.0.1') { $ips += $ipStr }
          }
        }
      } catch { }
      $ipMap[$idLower] = $ips
    }
  } catch { }

  $adapters = @()
  try {
    $wmiAdapters = @(Get-CimInstance -Namespace 'root\StandardCimv2' -ClassName MSFT_NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.ConnectorPresent -eq $true -or $_.HardwareInterface -eq $true })
    $adapters = @($wmiAdapters | ForEach-Object {
      $adapter = $_
      $guidStr = [string]$adapter.InterfaceGuid
      $guidLower = $guidStr.ToLowerInvariant()
      $ipv4 = if ($ipMap.ContainsKey($guidLower)) { @($ipMap[$guidLower]) } else { @() }
      $statusStr = if ($statusMap.ContainsKey($guidLower)) { $statusMap[$guidLower] } elseif ($adapter.State -eq 2) { 'Up' } else { 'Disconnected' }
      $speedBits = if ($adapter.Speed) { [int64]$adapter.Speed } else { 0 }
      $linkSpeed = if ($speedBits -ge 1000000000) {
        "$([Math]::Round($speedBits / 1000000000.0, 1)) Gbps"
      } elseif ($speedBits -ge 1000000) {
        "$([Math]::Round($speedBits / 1000000.0, 0)) Mbps"
      } else {
        '0 bps'
      }
      $mediaType = if ($adapter.NdisPhysicalMedium -eq 9 -or $adapter.InterfaceDescription -match 'wi-?fi|wireless|802\.11') { 'Native 802.11' } else { '802.3' }
      $allowPowerOff = if ($pnpMap.ContainsKey($guidLower)) { [bool]$pnpMap[$guidLower] } else { $null }
      $drvKey = if ($driverKeyMap.ContainsKey($guidLower)) { $driverKeyMap[$guidLower] } else { '' }
      [ordered]@{
        name = [string]$adapter.Name
        description = [string]$adapter.InterfaceDescription
        status = $statusStr
        mediaType = $mediaType
        linkSpeed = $linkSpeed
        macAddress = [string]$adapter.PermanentAddress
        ifIndex = [int]$adapter.InterfaceIndex
        guid = $guidStr
        driverKey = $drvKey
        ipv4 = @($ipv4)
        allowComputerToTurnOffDevice = $allowPowerOff
      }
    })
  } catch { }

  $nagle = @()
  foreach ($adapter in @($adapters | Where-Object { $_.status -eq 'Up' -and @($_.ipv4).Count -gt 0 })) {
    try {
      $base = "SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\$($adapter.guid)"
      $ack = Read-RegValue @{ hive = 'HKLM'; path = $base; name = 'TcpAckFrequency' }
      $delay = Read-RegValue @{ hive = 'HKLM'; path = $base; name = 'TCPNoDelay' }
      $nagle += [ordered]@{
        name = $adapter.name; ifIndex = $adapter.ifIndex; guid = $adapter.guid
        tcpAckFrequency = if ($ack.exists) { $ack.value } else { $null }
        tcpNoDelay = if ($delay.exists) { $delay.value } else { $null }
      }
    } catch { }
  }

  $security = [ordered]@{
    secureBoot = $null
    tpm = $null
    defender = $null
    firewall = @()
  }
  try {
    $sbReg = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Control\SecureBoot\State'; name = 'UEFISecureBootEnabled' }
    if ($sbReg.exists) { $security.secureBoot = ([int]$sbReg.value -eq 1) }
  } catch { }
  try {
    $tpmKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Services\TPM\WMI', $false)
    if ($null -ne $tpmKey) {
      $security.tpm = $true
      $tpmKey.Close()
    } else {
      $security.tpm = $false
    }
  } catch { }
  try {
    $defender = Get-CimInstance -Namespace 'root\Microsoft\Windows\Defender' -ClassName MSFT_MpComputerStatus -Property AntivirusEnabled,RealTimeProtectionEnabled,AntispywareEnabled,AMServiceEnabled,AntivirusSignatureVersion -ErrorAction Stop
    if ($null -ne $defender) {
      $security.defender = [ordered]@{
        antivirusEnabled = [bool]$defender.AntivirusEnabled
        realTimeProtectionEnabled = [bool]$defender.RealTimeProtectionEnabled
        antispywareEnabled = [bool]$defender.AntispywareEnabled
        amServiceEnabled = [bool]$defender.AMServiceEnabled
        signatureVersion = [string]$defender.AntivirusSignatureVersion
      }
    }
  } catch { }
  try {
    $fwProfiles = @(
      @{ name = 'Domain'; key = 'DomainProfile' },
      @{ name = 'Private'; key = 'StandardProfile' },
      @{ name = 'Public'; key = 'PublicProfile' }
    )
    $fwList = @()
    foreach ($fp in $fwProfiles) {
      $reg = Read-RegValue @{ hive = 'HKLM'; path = "SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\$($fp.key)"; name = 'EnableFirewall' }
      if ($reg.exists) {
        $fwList += [ordered]@{ name = $fp.name; enabled = ([int]$reg.value -ne 0) }
      }
    }
    $security.firewall = $fwList
  } catch { }

  $power = Get-PowerPlan
  $state = [ordered]@{
    gameMode = [ordered]@{
      autoGameMode = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\GameBar'; name = 'AutoGameModeEnabled' }
      allowAutoGameMode = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\GameBar'; name = 'AllowAutoGameMode' }
    }
    gameDvr = [ordered]@{
      gameDvrEnabled = Read-RegValue @{ hive = 'HKCU'; path = 'System\GameConfigStore'; name = 'GameDVR_Enabled' }
      appCaptureEnabled = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\Windows\CurrentVersion\GameDVR'; name = 'AppCaptureEnabled' }
    }
    hags = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; name = 'HwSchMode' }
    windowed = $(
      $dxUserGlobal = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\DirectX\UserGpuPreferences'; name = 'DirectXUserGlobalSettings' }
      $winLegacy = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\DirectX\GraphicsSettings'; name = 'SwapEffectUpgradeEnable' }
      $wVal = $null
      $wExists = $false
      if ($dxUserGlobal.exists -and $dxUserGlobal.value) {
        $s = [string]$dxUserGlobal.value
        if ($s -match '(?i)SwapEffectUpgradeEnable\s*=\s*1') {
          $wVal = 1
          $wExists = $true
        } elseif ($s -match '(?i)SwapEffectUpgradeEnable\s*=\s*0') {
          $wVal = 0
          $wExists = $true
        }
      }
      if (-not $wExists -and $winLegacy.exists) {
        $wVal = $winLegacy.value
        $wExists = $true
      }
      [ordered]@{
        exists = [bool]$wExists
        value = if ($null -ne $wVal) { [int32]$wVal } else { $null }
        kind = 'DWord'
      }
    )
    directXGlobal = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\DirectX\UserGpuPreferences'; name = 'DirectXUserGlobalSettings' }
    transparency = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'; name = 'EnableTransparency' }
    backgroundApps = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications'; name = 'GlobalUserDisabled' }
    networkThrottling = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'; name = 'NetworkThrottlingIndex' }
    systemResponsiveness = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'; name = 'SystemResponsiveness' }
    gamesTask = [ordered]@{
      gpuPriority = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; name = 'GPU Priority' }
      priority = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; name = 'Priority' }
      schedulingCategory = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; name = 'Scheduling Category' }
      sfioPriority = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; name = 'SFIO Priority' }
    }
    mouse = [ordered]@{
      mouseSpeed = Read-RegValue @{ hive = 'HKCU'; path = 'Control Panel\Mouse'; name = 'MouseSpeed' }
      threshold1 = Read-RegValue @{ hive = 'HKCU'; path = 'Control Panel\Mouse'; name = 'MouseThreshold1' }
      threshold2 = Read-RegValue @{ hive = 'HKCU'; path = 'Control Panel\Mouse'; name = 'MouseThreshold2' }
    }
    deliveryOptimization = Read-RegValue @{ hive = 'HKCU'; path = 'Software\Microsoft\Windows\CurrentVersion\DeliveryOptimization\Config'; name = 'DODownloadMode' }
    win32PrioritySeparation = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Control\PriorityControl'; name = 'Win32PrioritySeparation' }
    powerThrottlingOff = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Control\Power\PowerThrottling'; name = 'PowerThrottlingOff' }
    tcpAutotuning = Get-TcpGlobalState
    fseBehavior = Read-RegValue @{ hive = 'HKCU'; path = 'System\GameConfigStore'; name = 'GameDVR_FSEBehaviorMode' }
    pagingExecutive = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'; name = 'DisablePagingExecutive' }
    fastStartup = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Control\Session Manager\Power'; name = 'HiberbootEnabled' }
    usbSelectiveSuspend = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Services\USB'; name = 'DisableSelectiveSuspend' }
    tdrDelay = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; name = 'TdrDelay' }
    allowTelemetry = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Policies\Microsoft\Windows\DataCollection'; name = 'AllowTelemetry' }
    minAnimate = Read-RegValue @{ hive = 'HKCU'; path = 'Control Panel\Desktop\WindowMetrics'; name = 'MinAnimate' }
    fastUdp = [ordered]@{
      fastSend = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Services\AFD\Parameters'; name = 'FastSendDatagramThreshold' }
      doNotUse = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Services\AFD\Parameters'; name = 'DoNotUseFastDatagram' }
    }
    disableUserTos = Read-RegValue @{ hive = 'HKLM'; path = 'SYSTEM\CurrentControlSet\Services\Tcpip\Parameters'; name = 'DisableUserTOSSetting' }
    nonBestEffortLimit = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Policies\Microsoft\Windows\Psched'; name = 'NonBestEffortLimit' }
    audioTask = [ordered]@{
      gpuPriority = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Audio'; name = 'GPU Priority' }
      priority = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Audio'; name = 'Priority' }
      schedulingCategory = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Audio'; name = 'Scheduling Category' }
      sfioPriority = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Audio'; name = 'SFIO Priority' }
    }
    menuShowDelay = Read-RegValue @{ hive = 'HKCU'; path = 'Control Panel\Desktop'; name = 'MenuShowDelay' }
    mpo = Read-RegValue @{ hive = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows\Dwm'; name = 'OverlayTestMode' }
    gamePriority = $(
      $gameExeList = @('cs2.exe', 'FortniteClient-Win64-Shipping.exe', 'RobloxPlayerBeta.exe', 'javaw.exe', 'VALORANT-Win64-Shipping.exe', 'r5apex.exe', 'cod.exe')
      $allGamePriority = $true
      foreach ($exe in $gameExeList) {
        $p = "SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\$exe\PerfOptions"
        $cpuPrio = Read-RegValue @{ hive = 'HKLM'; path = $p; name = 'CpuPriorityClass' }
        $ioPrio = Read-RegValue @{ hive = 'HKLM'; path = $p; name = 'IoPriority' }
        if (-not ($cpuPrio.exists -and [int]$cpuPrio.value -eq 3 -and $ioPrio.exists -and [int]$ioPrio.value -eq 3)) {
          $allGamePriority = $false
          break
        }
      }
      $allGamePriority
    )
    dscpPolicies = $(
      $qosExes = @('NovaQoS_CS2', 'NovaQoS_Fortnite', 'NovaQoS_Roblox', 'NovaQoS_Minecraft', 'NovaQoS_Valorant', 'NovaQoS_Apex')
      $allQosPolicies = $true
      foreach ($qName in $qosExes) {
        $p = "SOFTWARE\Policies\Microsoft\Windows\QoS\$qName"
        $dVal = Read-RegValue @{ hive = 'HKLM'; path = $p; name = 'DSCP Value' }
        $tVal = Read-RegValue @{ hive = 'HKLM'; path = $p; name = 'Throttle Rate' }
        if (-not ($dVal.exists -and [string]$dVal.value -eq '46' -and $tVal.exists -and [string]$tVal.value -eq '-1')) {
          $allQosPolicies = $false
          break
        }
      }
      $allQosPolicies
    )
    nicDejitter = $(
      $nicDejitterOptimized = $false
      $primaryEth = @($adapters | Where-Object { $_.status -eq 'Up' -and $_.mediaType -eq '802.3' } | Select-Object -First 1)
      if ($primaryEth.Count -gt 0 -and $primaryEth[0].driverKey) {
        $drvKey = [string]$primaryEth[0].driverKey
        $eee = Read-RegValue @{ hive = 'HKLM'; path = $drvKey; name = '*EEE' }
        $flow = Read-RegValue @{ hive = 'HKLM'; path = $drvKey; name = '*FlowControl' }
        $eeeOk = ($eee.exists -and [string]$eee.value -eq '0')
        $flowOk = ($flow.exists -and [string]$flow.value -eq '0')
        $nicDejitterOptimized = ($eeeOk -and $flowOk)
      }
      [ordered]@{ optimized = $nicDejitterOptimized }
    )
    msiMode = $(
      $gpuMsiVal = $null
      $gpuMsiOk = $false
      if ($gpus.Count -gt 0 -and $gpus[0].PNPDeviceID) {
        $gpuMsiReg = Read-RegValue @{ hive = 'HKLM'; path = "SYSTEM\CurrentControlSet\Enum\$($gpus[0].PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"; name = 'MSISupported' }
        if ($gpuMsiReg.exists) {
          $gpuMsiVal = [int]$gpuMsiReg.value
          $gpuMsiOk = ($gpuMsiVal -eq 1)
        }
      }
      $nicMsiVal = $null
      $nicMsiOk = $false
      $pciNic = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' -and $_.PnPDeviceID -like 'PCI\*' } | Select-Object -First 1)
      if ($pciNic.Count -gt 0 -and $pciNic[0].PnPDeviceID) {
        $nicMsiReg = Read-RegValue @{ hive = 'HKLM'; path = "SYSTEM\CurrentControlSet\Enum\$($pciNic[0].PnPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"; name = 'MSISupported' }
        if ($nicMsiReg.exists) {
          $nicMsiVal = [int]$nicMsiReg.value
          $nicMsiOk = ($nicMsiVal -eq 1)
        }
      }
      [ordered]@{
        optimized = ($gpuMsiOk -and $nicMsiOk)
        gpu = $gpuMsiVal
        nic = $nicMsiVal
        gpuSupported = ($gpuMsiVal -ne $null)
        nicSupported = ($nicMsiVal -ne $null)
      }
    )
  }

  $startup = @(Get-StartupEntries)
  $admin = $false
  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $admin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { }

  $uptime = 0
  try { $uptime = [int64]((Get-Date) - $os.LastBootUpTime).TotalSeconds } catch { }
  $totalRam = [int64]$cs.TotalPhysicalMemory
  $freeRam = [int64]$os.FreePhysicalMemory * 1024
  $bootDisk = $null
  try { $bootDisk = @($logicalDisks | Where-Object { $_.DeviceID -eq $env:SystemDrive } | Select-Object -First 1)[0] } catch { }

  return [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    admin = $admin
    hostname = $env:COMPUTERNAME
    username = $env:USERNAME
    os = [ordered]@{
      caption = [string]$os.Caption
      version = [string]$os.Version
      build = [int]$os.BuildNumber
      architecture = [string]$os.OSArchitecture
      installDate = if ($os.InstallDate) { $os.InstallDate.ToString('yyyy-MM-dd') } else { $null }
      lastBoot = if ($os.LastBootUpTime) { $os.LastBootUpTime.ToString('o') } else { $null }
      uptimeSeconds = $uptime
    }
    computer = [ordered]@{
      manufacturer = [string]$cs.Manufacturer
      model = [string]$cs.Model
      isLaptop = ($battery.Count -gt 0)
      totalRam = $totalRam
      freeRam = $freeRam
      memoryUsagePercent = if ($totalRam -gt 0) { [Math]::Round((($totalRam - $freeRam) / $totalRam) * 100, 1) } else { 0 }
    }
    cpu = if ($cpu.Count -gt 0) { [ordered]@{
      name = [string]$cpu[0].Name
      manufacturer = [string]$cpu[0].Manufacturer
      cores = [int]$cpu[0].NumberOfCores
      threads = [int]$cpu[0].NumberOfLogicalProcessors
      maxClockMhz = [int]$cpu[0].MaxClockSpeed
    } } else { $null }
    gpus = @($gpus | ForEach-Object {
      [ordered]@{
        name = [string]$_.Name
        vram = if ($_.AdapterRAM) { [int64]$_.AdapterRAM } else { 0 }
        driverVersion = [string]$_.DriverVersion
        driverDate = if ($_.DriverDate) { $_.DriverDate.ToString('yyyy-MM-dd') } else { $null }
        processor = [string]$_.VideoProcessor
        refreshRate = if ($_.CurrentRefreshRate) { [int]$_.CurrentRefreshRate } else { $null }
        resolution = if ($_.CurrentHorizontalResolution -and $_.CurrentVerticalResolution) { "$($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution)" } else { $null }
        status = [string]$_.Status
        pnpDeviceId = [string]$_.PNPDeviceID
      }
    })
    memoryModules = @($memoryModules | ForEach-Object {
      [ordered]@{
        capacity = [int64]$_.Capacity
        speed = if ($_.ConfiguredClockSpeed) { [int]$_.ConfiguredClockSpeed } elseif ($_.Speed) { [int]$_.Speed } else { $null }
        manufacturer = [string]$_.Manufacturer
        partNumber = [string]$_.PartNumber
        slot = [string]$_.DeviceLocator
      }
    })
    disks = @($logicalDisks | ForEach-Object {
      [ordered]@{
        id = [string]$_.DeviceID
        label = [string]$_.VolumeName
        size = [int64]$_.Size
        free = [int64]$_.FreeSpace
        fileSystem = [string]$_.FileSystem
        usedPercent = if ($_.Size -gt 0) { [Math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1) } else { 0 }
      }
    })
    physicalDisks = @($physicalDisks | ForEach-Object {
      [ordered]@{
        name = [string]$_.FriendlyName
        mediaType = [string]$_.MediaType
        size = [int64]$_.Size
        health = [string]$_.HealthStatus
        busType = [string]$_.BusType
      }
    })
    adapters = @($adapters)
    battery = if ($battery.Count -gt 0) { [ordered]@{ present = $true; status = [string]$battery[0].BatteryStatus; charge = [int]$battery[0].EstimatedChargeRemaining } } else { [ordered]@{ present = $false } }
    power = $power
    security = $security
    pendingReboot = Test-PendingReboot
    state = $state
    nagle = @($nagle)
    startup = @($startup)
    startupCount = @($startup).Count
    bootDisk = if ($bootDisk) { [ordered]@{ id = [string]$bootDisk.DeviceID; size = [int64]$bootDisk.Size; free = [int64]$bootDisk.FreeSpace } } else { $null }
  }
}

function Activate-NovaPowerPlan {
  $original = Get-PowerPlan
  $list = (& powercfg /list 2>$null | Out-String)
  $novaGuid = $null
  $lines = @($list -split "`r?`n")
  foreach ($line in $lines) {
    if ($line -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+\(Nova Gaming\)') {
      $novaGuid = $Matches[1].ToLowerInvariant()
      break
    }
  }
  $created = $false
  if (-not $novaGuid) {
    $highPerformance = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
    $output = (& powercfg -duplicatescheme $highPerformance 2>$null | Out-String)
    if ($output -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') {
      $novaGuid = $Matches[1].ToLowerInvariant()
      $created = $true
      & powercfg -changename $novaGuid 'Nova Gaming' 'High performance plan created by Nova Optimize' 2>$null | Out-Null
    }
  }
  if (-not $novaGuid) { throw 'Could not create the Nova Gaming power plan.' }
  # Check for dual-CCD AMD 3D V-Cache CPUs (7900X3D, 7950X3D, 9900X3D, 9950X3D).
  # On dual-CCD X3D chips, the AMD PPM driver and Windows Game Mode require core parking
  # to park the standard frequency CCD and keep game threads scheduled on the 3D V-Cache CCD.
  $isDualCcdX3D = $false
  try {
    $procName = (Get-CimInstance Win32_Processor -Property Name -ErrorAction SilentlyContinue | Select-Object -First 1).Name
    if ($procName -match '(7900X3D|7950X3D|9900X3D|9950X3D)') {
      $isDualCcdX3D = $true
    }
  } catch { }

  if (-not $isDualCcdX3D) {
    # 1. Unpark 100% of CPU cores (min and max unparked cores on AC and DC)
    & powercfg -setacvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 2>$null | Out-Null
    & powercfg -setdcvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 2>$null | Out-Null
    & powercfg -setacvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 ea062031-0e34-4ff1-9b6d-eb10593ac08f 100 2>$null | Out-Null
    & powercfg -setdcvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 ea062031-0e34-4ff1-9b6d-eb10593ac08f 100 2>$null | Out-Null
  }
  # 2. Set min processor state to 5% to preserve idle C-states and thermal boost headroom, max to 100%
  & powercfg -setacvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 5 2>$null | Out-Null
  & powercfg -setdcvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 5 2>$null | Out-Null
  & powercfg -setacvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 100 2>$null | Out-Null
  & powercfg -setdcvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 100 2>$null | Out-Null
  # 3. Disable PCI Express Active State Power Management (ASPM) - stops GPU bus sleep latency
  & powercfg -setacvalueindex $novaGuid 501a4d13-42af-4429-9e56-424f202b8e20 ee12f906-d277-404b-b6da-e5fa1a576df5 0 2>$null | Out-Null
  & powercfg -setdcvalueindex $novaGuid 501a4d13-42af-4429-9e56-424f202b8e20 ee12f906-d277-404b-b6da-e5fa1a576df5 0 2>$null | Out-Null
  # 4. Disable storage disk spin-down idle timeout (stops asset loading hitches)
  & powercfg -setacvalueindex $novaGuid 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4142-f12e-a0e487c195e7 0 2>$null | Out-Null
  & powercfg -setdcvalueindex $novaGuid 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4142-f12e-a0e487c195e7 0 2>$null | Out-Null
  # 5. Aggressive processor performance increase threshold (10% load triggers instant max clocks)
  & powercfg -setacvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 060244e2-f31e-4e64-a494-b1a11f3739d4 10 2>$null | Out-Null
  & powercfg -setdcvalueindex $novaGuid 54533251-82be-4824-96c1-47b60b740d00 060244e2-f31e-4e64-a494-b1a11f3739d4 10 2>$null | Out-Null
  & powercfg /setactive $novaGuid 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Windows refused to activate the Nova Gaming power plan. Run Nova as administrator.' }
  $active = Get-PowerPlan
  return [ordered]@{
    original = $original
    active = $active
    novaGuid = $novaGuid
    created = $created
  }
}

function Get-TcpGlobalState {
  $autoTuning = 'Normal'
  $scalingHeuristics = 'Disabled'
  $rss = 'Enabled'
  try {
    $tcp = @(Get-CimInstance -Namespace 'root\StandardCimv2' -ClassName MSFT_NetTCPSetting -Filter "SettingName='Internet'" -Property AutoTuningLevelLocal,ScalingHeuristics -ErrorAction Stop | Select-Object -First 1)
    if ($tcp.Count -gt 0 -and $null -ne $tcp[0]) {
      $autoTuning = switch ([int]$tcp[0].AutoTuningLevelLocal) {
        0 { 'Disabled' }
        1 { 'HighlyRestricted' }
        2 { 'Restricted' }
        3 { 'Normal' }
        4 { 'Experimental' }
        default { 'Normal' }
      }
      $scalingHeuristics = if ([int]$tcp[0].ScalingHeuristics -eq 1) { 'Enabled' } else { 'Disabled' }
    }
  } catch { }
  try {
    $offload = Get-CimInstance -Namespace 'root\StandardCimv2' -ClassName MSFT_NetOffloadGlobalSetting -Property ReceiveSideScaling -ErrorAction Stop
    if ($null -ne $offload) {
      $rss = if ([int]$offload.ReceiveSideScaling -eq 0) { 'Disabled' } else { 'Enabled' }
    }
  } catch { }
  return [ordered]@{
    autoTuning = $autoTuning
    scalingHeuristics = $scalingHeuristics
    rss = $rss
  }
}

function Invoke-MemoryTrim {
  $cs = @"
using System;
using System.Runtime.InteropServices;
public static class NovaMem {
  [DllImport("psapi.dll")]
  public static extern bool EmptyWorkingSet(IntPtr hProcess);
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  public static uint GetForegroundProcessId() {
    IntPtr hwnd = GetForegroundWindow();
    if (hwnd == IntPtr.Zero) return 0;
    uint pid = 0;
    GetWindowThreadProcessId(hwnd, out pid);
    return pid;
  }
}
"@
  try { Add-Type -TypeDefinition $cs -ErrorAction SilentlyContinue } catch { }
  $osBefore = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
  $beforeFree = if ($osBefore) { [int64]$osBefore.FreePhysicalMemory * 1024 } else { 0 }
  $fgPid = 0
  try { $fgPid = [NovaMem]::GetForegroundProcessId() } catch { }
  $skip = @(
    'Idle','System','Registry','smss','csrss','wininit','services','lsass','svchost','dwm','explorer',
    'Memory Compression','audiodg','MsMpEng','NisSrv','SecurityHealthService','vgc','vgtray',
    'FortniteClient-Win64-Shipping','FortniteLauncher','cs2','javaw','Valorant','VALORANT-Win64-Shipping',
    'Overwatch','r5apex','ModernWarfare','RobloxPlayerBeta','RobloxPlayerLauncher','RocketLeague',
    'League of Legends','GTA5','RainbowSix'
  )
  $trimmed = 0
  foreach ($proc in @(Get-Process -ErrorAction SilentlyContinue)) {
    try {
      if ($fgPid -gt 0 -and $proc.Id -eq $fgPid) { continue }
      if ($skip -contains $proc.ProcessName) { continue }
      if ($proc.WorkingSet64 -lt 15MB) { continue }
      if ($proc.Handle -and [NovaMem]::EmptyWorkingSet($proc.Handle)) {
        $trimmed++
      }
    } catch { }
  }
  try { [System.GC]::Collect() } catch { }
  Start-Sleep -Milliseconds 180
  $osAfter = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
  $afterFree = if ($osAfter) { [int64]$osAfter.FreePhysicalMemory * 1024 } else { $beforeFree }
  $freed = [Math]::Max([int64]0, $afterFree - $beforeFree)
  return [ordered]@{
    ok = $true
    trimmedProcesses = $trimmed
    beforeFreeBytes = $beforeFree
    afterFreeBytes = $afterFree
    freedBytes = $freed
  }
}

function Get-RunningApps {
  param([string[]]$Names)
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($name in @($Names)) {
    if ([string]$name -notmatch '^[A-Za-z0-9._-]{1,40}$') { continue }
    $procs = @(Get-Process -Name ([string]$name) -ErrorAction SilentlyContinue)
    if ($procs.Count -eq 0) { continue }
    $memory = [int64]0
    foreach ($proc in $procs) { try { $memory += [int64]$proc.WorkingSet64 } catch { } }
    $rows.Add([ordered]@{ name = [string]$name; count = $procs.Count; memory = $memory })
  }
  return @($rows)
}

function Close-AppsGracefully {
  param([string[]]$Names)
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($name in @($Names)) {
    if ([string]$name -notmatch '^[A-Za-z0-9._-]{1,40}$') { continue }
    $procs = @(Get-Process -Name ([string]$name) -ErrorAction SilentlyContinue)
    if ($procs.Count -eq 0) { continue }
    foreach ($proc in $procs) { try { [void]$proc.CloseMainWindow() } catch { } }
    $deadline = (Get-Date).AddSeconds(3)
    do {
      Start-Sleep -Milliseconds 250
      $left = @(Get-Process -Name ([string]$name) -ErrorAction SilentlyContinue)
    } while ($left.Count -gt 0 -and (Get-Date) -lt $deadline)
    $rows.Add([ordered]@{ name = [string]$name; closed = [Math]::Max(0, $procs.Count - $left.Count); stillRunning = $left.Count })
  }
  return @($rows)
}

function Set-NicLowJitter {
  $classKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}', $false)
  $driverKeyMap = @{}
  if ($null -ne $classKey) {
    foreach ($sub in $classKey.GetSubKeyNames()) {
      if ($sub -notmatch '^\d{4}$') { continue }
      $k = $classKey.OpenSubKey($sub, $false)
      if ($null -ne $k) {
        $cfgGuid = [string]$k.GetValue('NetCfgInstanceId', '')
        if ($cfgGuid) {
          $driverKeyMap[$cfgGuid.ToLowerInvariant()] = "SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}\$sub"
        }
        $k.Close()
      }
    }
    $classKey.Close()
  }

  $targetAdapters = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' -and $_.NdisPhysicalMedium -ne 9 -and $_.InterfaceDescription -notmatch 'wi-?fi|wireless' })
  if ($targetAdapters.Count -eq 0) {
    $targetAdapters = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' })
  }
  if ($targetAdapters.Count -eq 0) {
    throw "No active physical network adapter found."
  }

  $propNames = @('*EEE', 'EEELinkAdvertisement', 'GreenEthernet', 'AdvancedEEE', '*FlowControl', '*InterruptModeration')
  $backups = New-Object System.Collections.Generic.List[object]

  foreach ($adapter in $targetAdapters) {
    $guidLower = [string]$adapter.InterfaceGuid.ToLowerInvariant()
    $drvPath = if ($driverKeyMap.ContainsKey($guidLower)) { $driverKeyMap[$guidLower] } else { $null }
    if (-not $drvPath) { continue }

    $prevProps = New-Object System.Collections.Generic.List[object]
    foreach ($prop in $propNames) {
      $current = Read-RegValue @{ hive = 'HKLM'; path = $drvPath; name = $prop }
      $prevProps.Add([ordered]@{
        name = $prop
        exists = $current.exists
        value = $current.value
        kind = $current.kind
      })
      Set-RegValue @{ hive = 'HKLM'; path = $drvPath; name = $prop; kind = 'String'; value = '0' }
      try {
        Set-NetAdapterAdvancedProperty -Name $adapter.Name -RegistryKeyword $prop -RegistryValue '0' -ErrorAction SilentlyContinue
      } catch { }
    }

    $backups.Add([ordered]@{
      name = $adapter.Name
      driverPath = $drvPath
      previous = $prevProps.ToArray()
    })
  }

  return [ordered]@{ adapters = $backups.ToArray() }
}

function Restore-NicLowJitter {
  param($Backup)
  if ($null -eq $Backup -or $null -eq $Backup.adapters) { throw "Missing adapter backup." }
  foreach ($ad in @($Backup.adapters)) {
    $drvPath = [string]$ad.driverPath
    if (-not $drvPath) { continue }
    foreach ($prop in @($ad.previous)) {
      $name = [string]$prop.name
      if ([bool]$prop.exists) {
        Set-RegValue @{ hive = 'HKLM'; path = $drvPath; name = $name; kind = [string]$prop.kind; value = [string]$prop.value }
        try {
          Set-NetAdapterAdvancedProperty -Name ([string]$ad.name) -RegistryKeyword $name -RegistryValue ([string]$prop.value) -ErrorAction SilentlyContinue
        } catch { }
      } else {
        Delete-RegValue @{ hive = 'HKLM'; path = $drvPath; name = $name } | Out-Null
      }
    }
  }
  return [ordered]@{ ok = $true }
}

function Set-PcieMsiMode {
  $gpu = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.PNPDeviceID -like 'PCI\*' } | Sort-Object -Property AdapterRAM -Descending | Select-Object -First 1)
  $nic = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' -and $_.PnPDeviceID -like 'PCI\*' } | Select-Object -First 1)

  $devices = New-Object System.Collections.Generic.List[object]

  if ($gpu.Count -gt 0 -and $gpu[0].PNPDeviceID) {
    $gpuPnp = [string]$gpu[0].PNPDeviceID
    $path = "SYSTEM\CurrentControlSet\Enum\$gpuPnp\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    $cur = Read-RegValue @{ hive = 'HKLM'; path = $path; name = 'MSISupported' }
    Set-RegValue @{ hive = 'HKLM'; path = $path; name = 'MSISupported'; kind = 'DWord'; value = 1 }
    $devices.Add([ordered]@{
      device = 'gpu'
      name = [string]$gpu[0].Name
      pnp = $gpuPnp
      path = $path
      previous = [ordered]@{ exists = $cur.exists; value = $cur.value; kind = $cur.kind }
    })
  }

  if ($nic.Count -gt 0 -and $nic[0].PnPDeviceID) {
    $nicPnp = [string]$nic[0].PnPDeviceID
    $path = "SYSTEM\CurrentControlSet\Enum\$nicPnp\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    $cur = Read-RegValue @{ hive = 'HKLM'; path = $path; name = 'MSISupported' }
    Set-RegValue @{ hive = 'HKLM'; path = $path; name = 'MSISupported'; kind = 'DWord'; value = 1 }
    $devices.Add([ordered]@{
      device = 'nic'
      name = [string]$nic[0].Name
      pnp = $nicPnp
      path = $path
      previous = [ordered]@{ exists = $cur.exists; value = $cur.value; kind = $cur.kind }
    })
  }

  if ($devices.Count -eq 0) {
    throw "No compatible PCIe GPU or Network Adapter found."
  }

  return [ordered]@{ devices = $devices.ToArray() }
}

function Restore-PcieMsiMode {
  param($Backup)
  if ($null -eq $Backup -or $null -eq $Backup.devices) { throw "Missing PCIe MSI backup." }
  foreach ($dev in @($Backup.devices)) {
    $path = [string]$dev.path
    $prev = $dev.previous
    if ($null -ne $prev -and [bool]$prev.exists) {
      Set-RegValue @{ hive = 'HKLM'; path = $path; name = 'MSISupported'; kind = 'DWord'; value = [int]$prev.value }
    } else {
      Delete-RegValue @{ hive = 'HKLM'; path = $path; name = 'MSISupported' } | Out-Null
    }
  }
  return [ordered]@{ ok = $true }
}

function Reload-QoSPolicies {
  try {
    $proc = Start-Process -FilePath 'gpupdate.exe' -ArgumentList '/target:computer /force' -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue
    if ($null -ne $proc) {
      $finished = $proc.WaitForExit(10000)
      if (-not $finished) {
        try { $proc.Kill() } catch { }
      }
    }
  } catch { }
  return [ordered]@{ ok = $true }
}

try {
  switch ($op) {
    'snapshot' { Send-Result (Get-Snapshot) }
    'registry.read' {
      $result = New-Object System.Collections.Generic.List[object]
      foreach ($spec in @($p.entries)) { $result.Add((Read-RegValue $spec)) }
      Send-Result $result.ToArray()
    }
    'registry.apply' {
      $result = New-Object System.Collections.Generic.List[object]
      $hasQoSPolicies = $false
      foreach ($item in @($p.operations)) {
        try {
          $path = [string]$item.path
          if ($path -match '(?i)SOFTWARE\\Policies\\Microsoft\\Windows\\QoS') {
            $hasQoSPolicies = $true
          }
          if ([string]$item.op -eq 'delete') {
            $changed = Delete-RegValue $item
            $result.Add([ordered]@{ ok = $true; op = 'delete'; changed = [bool]$changed; name = $item.name })
          } else {
            Set-RegValue $item
            $result.Add([ordered]@{ ok = $true; op = 'set'; name = $item.name })
          }
        } catch {
          $result.Add([ordered]@{ ok = $false; op = [string]$item.op; name = $item.name; error = $_.Exception.Message })
        }
      }
      if ($hasQoSPolicies) {
        Reload-QoSPolicies | Out-Null
      }
      Send-Result $result.ToArray()
    }
    'qos.reload' { Send-Result (Reload-QoSPolicies) }
    'power.get' { Send-Result (Get-PowerPlan) }
    'power.activateNova' { Send-Result (Activate-NovaPowerPlan) }
    'power.setActive' {
      if ([string]$p.guid -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Invalid power plan.' }
      & powercfg /setactive ([string]$p.guid) 2>$null | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Could not activate the power plan.' }
      if ($p.deleteGuid -and ([string]$p.deleteGuid -match '^[0-9a-fA-F-]{36}$') -and ([string]$p.deleteGuid -ne [string]$p.guid)) {
        & powercfg /delete ([string]$p.deleteGuid) 2>$null | Out-Null
      }
      Send-Result (Get-PowerPlan)
    }
    'startup.disable' {
      if ([string]$p.entry.type -eq 'file') {
        $source = [string]$p.entry.filePath
        if (-not (Test-Path -LiteralPath $source)) { throw 'Startup file no longer exists.' }
        $backupDir = [string]$p.backupDir
        if ([string]::IsNullOrWhiteSpace($backupDir)) { throw 'Missing backup directory.' }
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        $target = Join-Path $backupDir ((Get-Date).ToString('yyyyMMddHHmmss') + '_' + [IO.Path]::GetFileName($source))
        Move-Item -LiteralPath $source -Destination $target -Force -ErrorAction Stop
        Send-Result ([ordered]@{ type = 'file'; originalPath = $source; backupPath = $target })
      } else {
        $spec = @{ hive = [string]$p.entry.hive; path = [string]$p.entry.path; name = [string]$p.entry.name }
        $current = Read-RegValue $spec
        if (-not $current.exists) { throw 'Startup entry no longer exists.' }
        Delete-RegValue $spec | Out-Null
        Send-Result ([ordered]@{ type = 'registry'; entry = $current })
      }
    }
    'startup.enable' {
      $entry = $p.entry
      if ([string]$entry.type -eq 'file') {
        if (-not (Test-Path -LiteralPath ([string]$entry.backupPath))) { throw 'Backup file is missing.' }
        $destination = [string]$entry.originalPath
        $parent = Split-Path -Parent $destination
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Move-Item -LiteralPath ([string]$entry.backupPath) -Destination $destination -Force -ErrorAction Stop
      } else {
        Set-RegValue @{ hive = $entry.entry.hive; path = $entry.entry.path; name = $entry.entry.name; kind = $entry.entry.kind; value = $entry.entry.value }
      }
      Send-Result ([ordered]@{ ok = $true })
    }
    'cleanup.scan' { Send-Result (Get-CleanupScan) }
    'cleanup.run' {
      $results = New-Object System.Collections.Generic.List[object]
      foreach ($id in @($p.ids)) { $results.Add((Remove-CleanupCategory -Id ([string]$id))) }
      Send-Result $results.ToArray()
    }
    'dns.get' { Send-Result (Get-DnsInfo) }
    'dns.apply' { Send-Result (Set-DnsServers -IfIndexes @($p.ifIndexes) -Servers @($p.servers)) }
    'dns.reset' { Send-Result (Reset-DnsServers -Backups $p.backups) }
    'dns.flush' { Clear-DnsClientCache -ErrorAction SilentlyContinue; Send-Result ([ordered]@{ ok = $true }) }
    'net.adapterPowerDisable' {
      $classKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}', $false)
      $driverMap = @{}
      if ($null -ne $classKey) {
        foreach ($sub in $classKey.GetSubKeyNames()) {
          if ($sub -notmatch '^\d{4}$') { continue }
          $k = $classKey.OpenSubKey($sub, $false)
          if ($null -ne $k) {
            $cfgGuid = [string]$k.GetValue('NetCfgInstanceId', '')
            if ($cfgGuid) {
              $driverMap[$cfgGuid.ToLowerInvariant()] = "SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}\$sub"
            }
            $k.Close()
          }
        }
        $classKey.Close()
      }

      $results = New-Object System.Collections.Generic.List[object]
      foreach ($name in @($p.names)) {
        try {
          $adapter = @(Get-NetAdapter -Name ([string]$name) -ErrorAction SilentlyContinue | Select-Object -First 1)
          $drvPath = $null
          $prevPnp = $null
          if ($adapter.Count -gt 0 -and $adapter[0].InterfaceGuid) {
            $gLower = [string]$adapter[0].InterfaceGuid.ToLowerInvariant()
            if ($driverMap.ContainsKey($gLower)) {
              $drvPath = $driverMap[$gLower]
              $cur = Read-RegValue @{ hive = 'HKLM'; path = $drvPath; name = 'PnPCapabilities' }
              $prevPnp = [ordered]@{ exists = $cur.exists; value = $cur.value; kind = $cur.kind }
              Set-RegValue @{ hive = 'HKLM'; path = $drvPath; name = 'PnPCapabilities'; kind = 'DWord'; value = 24 }
            }
          }
          $before = $null
          try { $before = Get-NetAdapterPowerManagement -Name ([string]$name) -ErrorAction SilentlyContinue } catch { }
          try { Disable-NetAdapterPowerManagement -Name ([string]$name) -ErrorAction SilentlyContinue } catch { }

          $results.Add([ordered]@{
            name = [string]$name
            changed = $true
            driverPath = $drvPath
            previousPnp = $prevPnp
            previous = if ($null -ne $before) { $before.AllowComputerToTurnOffDevice } else { $null }
          })
        } catch {
          $results.Add([ordered]@{ name = [string]$name; changed = $false; error = $_.Exception.Message })
        }
      }
      $changed = @($results | Where-Object { $_.changed -eq $true })
      if ($changed.Count -eq 0) {
        $reason = ($results | Select-Object -First 1).error
        throw "Could not change adapter power settings. $reason"
      }
      Send-Result ([ordered]@{ adapters = @($results | Where-Object { $_.changed -eq $true }) })
    }
    'net.adapterPowerRestore' {
      $results = New-Object System.Collections.Generic.List[object]
      $targetItems = New-Object System.Collections.Generic.List[object]
      if ($null -ne $p.adapters) {
        foreach ($item in @($p.adapters)) { if ($null -ne $item) { $targetItems.Add($item) } }
      } elseif ($null -ne $p.names) {
        foreach ($item in @($p.names)) { if ($null -ne $item) { $targetItems.Add($item) } }
      }
      foreach ($ad in $targetItems) {
        $name = if ($ad.name) { [string]$ad.name } else { [string]$ad }
        if (-not $name) { continue }
        try {
          $drvPath = if ($ad.driverPath) { [string]$ad.driverPath } else { $null }
          $prevPnp = if ($ad.previousPnp) { $ad.previousPnp } else { $null }
          if ($drvPath) {
            if ($null -ne $prevPnp -and [bool]$prevPnp.exists) {
              Set-RegValue @{ hive = 'HKLM'; path = $drvPath; name = 'PnPCapabilities'; kind = 'DWord'; value = [int]$prevPnp.value }
            } else {
              Delete-RegValue @{ hive = 'HKLM'; path = $drvPath; name = 'PnPCapabilities' } | Out-Null
            }
          }
          try { Enable-NetAdapterPowerManagement -Name $name -ErrorAction SilentlyContinue } catch { }
          $results.Add([ordered]@{ name = $name; ok = $true })
        } catch {
          $results.Add([ordered]@{ name = $name; ok = $false; error = $_.Exception.Message })
        }
      }
      Send-Result $results.ToArray()
    }
    'ping' { Send-Result (Invoke-Ping -HostName ([string]$p.host) -Count ([int]$p.count)) }
    'processes' { Send-Result (Get-ProcessSnapshot) }
    'memory.trim' { Send-Result (Invoke-MemoryTrim) }
    'apps.running' { Send-Result (Get-RunningApps -Names @($p.names)) }
    'apps.close' { Send-Result (Close-AppsGracefully -Names @($p.names)) }
    'net.tcpAutotune' {
      $before = Get-TcpGlobalState
      $level = if ($p.autoTuning) { [string]$p.autoTuning } else { 'normal' }
      $heuristics = if ($p.scalingHeuristics) { [string]$p.scalingHeuristics } else { 'disabled' }
      $rss = if ($p.rss) { [string]$p.rss } else { 'enabled' }
      & netsh interface tcp set global autotuninglevel=$level 2>$null | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Could not update TCP Auto-Tuning level. Run Nova as administrator.' }
      & netsh interface tcp set heuristics $heuristics 2>$null | Out-Null
      & netsh interface tcp set global rss=$rss 2>$null | Out-Null
      Send-Result ([ordered]@{ before = $before; after = Get-TcpGlobalState })
    }
    'restorePoint' {
      Checkpoint-Computer -Description 'Nova Optimize' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
      Send-Result ([ordered]@{ ok = $true; time = (Get-Date).ToUniversalTime().ToString('o') })
    }
    'net.nicDejitterDisable' { Send-Result (Set-NicLowJitter) }
    'net.nicDejitterRestore' { Send-Result (Restore-NicLowJitter -Backup $p.backup) }
    'pcie.msiEnable' { Send-Result (Set-PcieMsiMode) }
    'pcie.msiRestore' { Send-Result (Restore-PcieMsiMode -Backup $p.backup) }
    default { throw "Unknown bridge operation: $op" }
  }
} catch {
  $detail = $_.Exception.Message
  try {
    if ($_.InvocationInfo -and $_.InvocationInfo.ScriptLineNumber) {
      $detail = "$detail (line $($_.InvocationInfo.ScriptLineNumber))"
    }
  } catch { }
  Send-Result $detail $false
}

