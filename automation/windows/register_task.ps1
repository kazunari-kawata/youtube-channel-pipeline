# draft_review.ps1 を Windows のタスク スケジューラに登録する（既定は2時間ごと。ログオン中だけ動く）
#   登録：    powershell -ExecutionPolicy Bypass -File automation\windows\register_task.ps1
#   間隔を変える：powershell -ExecutionPolicy Bypass -File automation\windows\register_task.ps1 -Hours 4
#   やめる：  Unregister-ScheduledTask -TaskName "Syncage 仮編集" -Confirm:$false
#   いま動かす：Start-ScheduledTask -TaskName "Syncage 仮編集"
param([int]$Hours = 2)
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "draft_review.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours $Hours)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "Syncage 仮編集" -Action $action -Trigger $trigger -Settings $settings -Force `
  -Description "自動で進めた回が確認待ちになったら、声なしの仮編集を書き出す（automation/README.md）" | Out-Null
Write-Host "登録しました：Syncage 仮編集（$Hours 時間ごと。ログは build\draft_review.log）"
