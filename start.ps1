# =========================================================================
# TalkTrading - Unified Startup Script (PowerShell)
# Starts all microservices and frontend in one command
# =========================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$PythonExe = Join-Path $ScriptDir "venv\Scripts\python.exe"
if (-Not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

$StartScript = Join-Path $ScriptDir "start_all.py"
& $PythonExe $StartScript $args
