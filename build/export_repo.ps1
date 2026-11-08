<#
  把发布所需的文件从开发工作区（本目录的上级）导出成一个干净的仓库目录。
  开发工作区里混着别的项目和 5 GB 浏览器测试残留，绝不能整目录 git init。
  用法：
    powershell -ExecutionPolicy Bypass -File build/export_repo.ps1
    powershell -ExecutionPolicy Bypass -File build/export_repo.ps1 -Target D:\src\poe-trade-cn
  行为：对 src/ extension/data/ tools/openccjs/ 做镜像同步（会删除目标里的多余文件），
       根目录文档与 build/ 下的脚本按清单复制；目标里的 .git 不受影响。
#>
param(
  [string]$Target
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Target) { $Target = Join-Path (Split-Path $root -Parent) 'poe-trade-cn' }
if (-not (Test-Path $Target)) { New-Item -ItemType Directory -Path $Target | Out-Null }
$dst = (Resolve-Path $Target).Path
if ($dst -eq $root) { throw '目标不能是开发工作区本身。' }

$files = @(
  '.gitignore', 'README.md', 'NOTICE.md', 'MAINTAINING.md',
  'build/build_extension.py', 'build/check_data.js', 'build/convert.js', 'build/convert_ui.js',
  'build/make_ui_dict.js', 'build/fetch_data.py', 'build/fetch_poedb.py', 'build/poedb_maps.py',
  'build/build_dict.py', 'build/build_dict_p2.py',
  'build/test_core.js', 'build/test_lang.js',
  'build/edge_e2e.js', 'build/edge_e2e_poe2.js', 'build/edge_e2e_timing.js',
  'build/update.ps1', 'build/export_repo.ps1',
  'ref/poe-trade-zh/js/translate.zh_TW.js'
)
$trees = @('src', 'extension/data', 'tools/openccjs')

foreach ($rel in $files) {
  $from = Join-Path $root $rel
  if (-not (Test-Path $from)) { Write-Warning "跳过缺失文件：$rel"; continue }
  $to = Join-Path $dst $rel
  New-Item -ItemType Directory -Path (Split-Path $to -Parent) -Force | Out-Null
  Copy-Item $from $to -Force
}

foreach ($rel in $trees) {
  $from = Join-Path $root $rel
  $to = Join-Path $dst $rel
  & robocopy $from $to /MIR /NFL /NDL /NJH /NJS /NP /XF *.tmp | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy 失败：$rel（exit $LASTEXITCODE）" }
}

# build/ 下只保留清单内的脚本（清单删掉的旧脚本要在目标里一并消失）
$buildDir = Join-Path $dst 'build'
if (Test-Path $buildDir) {
  Get-ChildItem $buildDir -File | Where-Object { $_.Extension -in '.py', '.js', '.ps1' } | ForEach-Object {
    if ($files -notcontains ('build/' + $_.Name)) { Remove-Item $_.FullName -Force }
  }
}

$all = Get-ChildItem $dst -Recurse -File -Force | Where-Object { $_.FullName -notmatch '\\\.git\\' }
$mb = [math]::Round((($all | Measure-Object Length -Sum).Sum / 1MB), 2)
Write-Host "导出完成：$dst"
Write-Host "文件 $($all.Count) 个，$mb MB"
Write-Host '下一步：'
Write-Host "  cd $dst"
Write-Host '  git init -b main; git add .; git status --short | wc -l'
