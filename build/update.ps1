<#
  新赛季一键刷新：抓官方市集 API -> 抓编年史词表 -> 生成映射 -> 构建 -> 自检。
  用法（仓库内任意位置）：
    powershell -ExecutionPolicy Bypass -File build/update.ps1
    powershell -ExecutionPolicy Bypass -File build/update.ps1 -SkipFetch -SkipTests
  抓取前先确认 build/fetch_poedb.py 的 POE1_CLASSES / POE2_CLASSES（赛季新增物品类别时要改）。
#>
param(
  [switch]$SkipFetch,   # 跳过官方 API（stats/items/static/filters）
  [switch]$SkipPoedb,   # 跳过流亡编年史抓取
  [switch]$SkipDict,    # 跳过 UI 词典重建（仅词典来源变更时需要）
  [switch]$SkipTests,   # 只构建，不跑 check_data / 单测
  [switch]$SkipE2E      # 跳过 Edge 端到端
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
Set-Location (Join-Path $PSScriptRoot '..')

$script:PyExe = $null
$script:PyPre = @()

function Resolve-Python {
  $cands = @()
  $c = Get-Command python -ErrorAction SilentlyContinue
  if ($c) { $cands += ,@($c.Source) }
  $c = Get-Command py -ErrorAction SilentlyContinue
  if ($c) { $cands += ,@($c.Source, '-3') }
  if ($env:DSH_PYTHON -and (Test-Path $env:DSH_PYTHON)) { $cands += ,@($env:DSH_PYTHON) }
  foreach ($root in @("$env:LOCALAPPDATA\Programs\Python\Python*", "$env:ProgramFiles\Python*")) {
    foreach ($d in (Get-ChildItem $root -ErrorAction SilentlyContinue | Sort-Object Name -Descending)) {
      $p = Join-Path $d.FullName 'python.exe'
      if (Test-Path $p) { $cands += ,@($p) }
    }
  }
  foreach ($cand in $cands) {
    $exe = $cand[0]
    $pre = @($cand | Select-Object -Skip 1)
    try { & $exe @pre '-c' 'print(1)' *> $null } catch { continue }
    if ($LASTEXITCODE -ne 0) { continue }
    & $exe @pre '-c' 'import PIL' *> $null
    if ($LASTEXITCODE -ne 0) { Write-Warning "$exe 缺 Pillow，构建图标会失败：$exe -m pip install pillow" }
    $script:PyExe = $exe
    $script:PyPre = $pre
    Write-Host "python: $exe $($pre -join ' ')"
    return
  }
  throw 'python 未找到：装 Python 3 并加入 PATH，或设置环境变量 DSH_PYTHON 指向解释器（Windows 商店的 python 别名不可用）。'
}

Resolve-Python
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node 未找到：构建与自检需要 Node.js 18+。' }

function Invoke-Py([string[]]$argv) {
  Write-Host "--- $($argv -join ' ')" -ForegroundColor Cyan
  & $script:PyExe @script:PyPre @argv
  if ($LASTEXITCODE -ne 0) { throw "python 步骤失败（exit $LASTEXITCODE）：$($argv -join ' ')" }
}

function Invoke-Node([string]$script) {
  Write-Host "--- $script" -ForegroundColor Cyan
  & $node $script
  if ($LASTEXITCODE -ne 0) { throw "$script 失败（exit $LASTEXITCODE）" }
}

function Start-E2EBrowser {
  $edge = @(
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $edge) { Write-Warning '未找到 msedge.exe，跳过 e2e'; return $null }
  if (-not (Test-Path 'dist/poe-trade-cn')) { throw 'dist/poe-trade-cn 不存在，先构建再跑 e2e。' }
  $profile = Join-Path (Get-Location) 'build\edge-ext-profile-e2e'
  # 目录必须存在且可写，否则 Edge 弹「无法创建数据目录」并直接退出。
  if (-not (Test-Path $profile)) { New-Item -ItemType Directory -Path $profile -Force | Out-Null }
  $ext = (Resolve-Path 'dist/poe-trade-cn').Path
  # 上一轮遗留的 Edge 会占住 9444 和这个用户目录：新进程附着到旧实例后命令行参数被忽略，
  # 扩展没加载、页面保持英文，而 e2e 只打印证据、当时不会报错。先杀掉监听者再启动。
  # 命令行里带这个 profile 的残留 Edge 也会锁住目录（哪怕没抢到 9444），先按命令行清掉。
  try {
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -and $_.CommandLine -match 'edge-ext-profile-e2e' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host "  killed orphan edge pid $($_.ProcessId)" }
  } catch { }
  $stale = @()
  try { $stale = Get-NetTCPConnection -LocalPort 9444 -State Listen -ErrorAction Stop } catch { }
  if (-not $stale) {
    $stale = netstat -ano | Select-String ':9444' | ForEach-Object {
      $f = $_.ToString().Trim() -split '\s+'
      if ($f[-1] -match '^\d+$') { [pscustomobject]@{ OwningProcess = [int]$f[-1] } }
    }
  }
  foreach ($s in $stale) {
    if (-not ($s.OwningProcess -gt 0)) { continue }
    Stop-Process -Id $s.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "  killed stale edge pid $($s.OwningProcess) on 9444"
  }
  if ($stale) { Start-Sleep -Milliseconds 800 }

  $proc = Start-Process $edge -PassThru -ArgumentList @(
    # Edge 157 起忽略 --load-extension（品牌版），这个开关把命令行加载恢复回来；
    # 没有它扩展不会加载，页面保持英文，e2e 曾经因此假通过。
    '--headless=new', '--remote-debugging-port=9444', "--user-data-dir=$profile",
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    "--load-extension=$ext", '--no-first-run', '--no-default-browser-check', 'about:blank')
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 9444); $c.Close(); break } catch { }
  }
  Start-Sleep -Seconds 2
  Write-Host "edge: pid $($proc.Id) on 9444"
  return $proc
}

if (-not $SkipFetch) { Invoke-Py @('build/fetch_data.py', '--force', '--sleep', '0.8') }
if (-not $SkipPoedb) {
  Invoke-Py @('build/fetch_poedb.py', '--force')
  Invoke-Py @('build/poedb_maps.py')
}
if (-not $SkipDict) {
  Invoke-Node 'build/make_ui_dict.js'
  Invoke-Node 'build/convert_ui.js'
}

Invoke-Py @('build/build_extension.py')

if (-not $SkipTests) {
  foreach ($t in @('build/check_data.js', 'build/test_core.js', 'build/test_lang.js')) { Invoke-Node $t }
}
if (-not $SkipE2E) {
  $edgeProc = $null
  try {
    $edgeProc = Start-E2EBrowser
    if ($edgeProc) {
      # Edge 157 品牌版会静默忽略 --load-extension（页面保持英文、marker=null），
      # 只能通过 CDP 把 dist 装进去；装不上直接失败，不要往下跑 e2e。
      Invoke-Node 'build/load_extension.js'
      foreach ($t in @('build/edge_e2e.js', 'build/edge_e2e_poe2.js')) {
        try { Invoke-Node $t }
        catch {
          # 冷启动时扩展脚本可能还没加载完，重跑一次
          Write-Warning "$t 首次失败，3 秒后重试一次"
          Start-Sleep -Seconds 3
          Invoke-Node $t
        }
      }
    }
  } finally {
    if ($edgeProc) { Stop-Process -Id $edgeProc.Id -Force -ErrorAction SilentlyContinue }
  }
}

Write-Host ''
Write-Host '完成：dist/poe-trade-cn + dist/poe-trade-cn.zip（版本见 src/manifest.json）' -ForegroundColor Green
