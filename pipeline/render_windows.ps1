# Windows（GPU）で本番の書き出しをして、かかった時間を記録する（今後の見積もりに使う）
#   リポジトリのフォルダで：  powershell -ExecutionPolicy Bypass -File pipeline\render_windows.ps1 002-dahmer
# 先に stage.py で準備しておく（current.json の回と同じ回を書き出す）。
# 出力：episodes\<回>\build\video_render.mp4（音の上限処理と QA はこのあと Claude がつなぐ）、render_time.json（開始・終了・分・GPU・CPU）
# 解像度・画質は config\channel.yaml の video.render_scale（1.5 → 1920x1080）、render.jpeg_quality（92）、render.crf（18）に合わせている
param([Parameter(Mandatory = $true)][string]$Episode)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root "episodes\$Episode\build"
$out = Join-Path $build "video_render.mp4"
$cur = Get-Content (Join-Path $root "remotion\src\data\current.json") -Raw -Encoding UTF8 | ConvertFrom-Json
if ($cur.episode -ne $Episode) { throw "Remotion に準備されているのは $($cur.episode) です。先に stage.py $Episode を実行してください。" }
Set-Location (Join-Path $root "remotion")
$start = Get-Date
Write-Host "書き出しを始めます：$start"
npx remotion render src/index.ts Main "$out" --gl=angle --scale=1.5 --jpeg-quality=92 --crf=18
if ($LASTEXITCODE -ne 0) { throw "書き出しに失敗しました（終了コード $LASTEXITCODE）" }
$end = Get-Date
$min = [math]::Round(($end - $start).TotalMinutes, 1)
$info = [ordered]@{
  episode = $Episode
  start   = $start.ToString("yyyy-MM-ddTHH:mm:ss")
  end     = $end.ToString("yyyy-MM-ddTHH:mm:ss")
  minutes = $min
  gpu     = ((Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ", ")
  cpu     = ((Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name) -join ", ")
}
$info | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $build "render_time.json")
Write-Host "書き出し完了：$out（$min 分）"
