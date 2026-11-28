# 人の確認待ち（review）の回の仮編集（声なし・BGM と効果音あり）を、Windows（GPU）で書き出す
#   いま1回：        powershell -ExecutionPolicy Bypass -File automation\windows\draft_review.ps1
#   回を指定：        powershell -ExecutionPolicy Bypass -File automation\windows\draft_review.ps1 -Episode 009-gardner
#   Studio で見るだけ：powershell -ExecutionPolicy Bypass -File automation\windows\draft_review.ps1 -Episode 009-gardner -NoRender
#   2時間ごとに自動： powershell -ExecutionPolicy Bypass -File automation\windows\register_task.ps1
# Claude の使用量は使わない（git、Python、Remotion だけ）。出力：episodes\<回>\build\draft.mp4（1280x720）
# Remotion（Studio か書き出し）が動いている間は何もしない（bgm.wav と current.json を上書きすると、開いている回の音と画面が変わる：F-033）
# 書き出したあとは、Studio で見ていた回（current.json・timeline.json・meta.json・bgm.wav）を元に戻す。-NoRender のときは戻さない（その回を Studio で見るため）
param([string]$Episode = "", [switch]$NoRender, [switch]$Force)
# Stop にしない：Windows PowerShell 5.1 では、2>&1 で受けたコマンドの標準エラー（Python の警告など）が止める例外になる。終了コードで判断する
$ErrorActionPreference = "Continue"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$logDir = Join-Path $root "build"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir "draft_review.log"
function Log([string]$m) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m"
  Write-Host $line
  Add-Content -Path $log -Value $line -Encoding UTF8
}
function Notify([string]$title, [string]$text) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Information
    $n.Visible = $true
    $n.ShowBalloonTip(10000, $title, $text, [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Sleep -Seconds 10
    $n.Dispose()
  } catch { }
}
function Py([string[]]$a) {
  & python @a 2>&1 | ForEach-Object { Log "  $_" }
  if ($LASTEXITCODE -ne 0) { throw "python $($a -join ' ') が失敗しました（終了コード $LASTEXITCODE）" }
}

$busy = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "remotion" }
if ($busy -and -not $Force) { Log "Remotion が動いている（Studio か書き出し）ので今回は飛ばす"; exit 0 }

& git -c safe.directory=* pull --ff-only -q 2>&1 | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) { Log "git pull ができませんでした（この PC で変えたファイルがある）。git status で確かめてください"; exit 1 }

$eps = if ($Episode) { @($Episode) } else { @(& python pipeline/auto.py waiting) | Where-Object { $_ } }
if (-not $eps) { Log "確認待ちの回はありません"; exit 0 }

foreach ($ep in $eps) {
  $build = Join-Path $root "episodes\$ep\build"
  $out = Join-Path $build "draft.mp4"
  $sigFile = Join-Path $build "draft_commit.txt"
  $sig = (& git -c safe.directory=* log -1 --format=%H -- "episodes/$ep" remotion/src pipeline config).Trim()
  if (-not $Force -and -not $NoRender -and (Test-Path $out) -and (Test-Path $sigFile) -and ((Get-Content $sigFile -Raw).Trim() -eq $sig)) {
    Log "$ep：仮編集は最新（$sig）"
    continue
  }
  $dataDir = Join-Path $root "remotion\src\data"
  $pubDir = Join-Path $root "remotion\public"
  $keep = Join-Path $logDir "studio_backup"
  $saved = @()
  if (-not $NoRender) {
    New-Item -ItemType Directory -Force $keep | Out-Null
    foreach ($f in @((Join-Path $dataDir "current.json"), (Join-Path $dataDir "timeline.json"), (Join-Path $dataDir "meta.json"), (Join-Path $pubDir "bgm.wav"))) {
      if (Test-Path $f) { Copy-Item $f $keep -Force; $saved += $f }
    }
  }
  try {
    Log "$ep：準備を始めます"
    Py @("pipeline/fetch_data.py", "--light")
    if (-not (Test-Path (Join-Path $root "remotion\node_modules"))) {
      Push-Location remotion; npm ci --no-audit --no-fund; Pop-Location
    }
    Py @("pipeline/build_assets.py", $ep)
    Py @("pipeline/draft_preview.py", $ep)
    # 香盤表は作り直すと書き換わることがあり、次の pull が止まる（作り直したものはクラウドの版と同じ中身）
    & git -c safe.directory=* checkout -- "episodes/$ep/shotlist.md" 2>$null
    if ($NoRender) {
      Log "$ep：Studio で見る準備ができました（cd remotion; npx remotion studio → Main）"
      continue
    }
    New-Item -ItemType Directory -Force $build | Out-Null
    Set-Location (Join-Path $root "remotion")
    $start = Get-Date
    Log "$ep：書き出しを始めます（1280x720、声なし）"
    npx remotion render src/index.ts Main "$out" --gl=angle --scale=1 --jpeg-quality=80 --crf=23 2>&1 | Select-Object -Last 3 | ForEach-Object { Log "  $_" }
    if ($LASTEXITCODE -ne 0) { throw "書き出しに失敗しました（終了コード $LASTEXITCODE）" }
    Set-Location $root
    $min = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
    Set-Content -Path $sigFile -Value $sig -Encoding ASCII
    [ordered]@{ episode = $ep; commit = $sig; minutes = $min; at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") } |
      ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $build "draft_render_time.json")
    Log "$ep：仮編集ができました：$out（$min 分）"
    Notify "仮編集ができました" "$ep の仮編集（声なし）を見てください。episodes\$ep\build\draft.mp4"
  } catch {
    Set-Location $root
    Log "$ep：止まりました：$($_.Exception.Message)"
    Notify "仮編集を作れませんでした" "$ep：build\draft_review.log を見てください"
  } finally {
    Set-Location $root
    foreach ($f in $saved) { Copy-Item (Join-Path $keep (Split-Path $f -Leaf)) $f -Force }
    if ($saved) { Log "$ep：Studio で見ていた回の準備を元に戻しました" }
  }
}
