# =========================================================================
# TalkTrading - Unified Stop Script (PowerShell)
# Stops any running microservices on ports 8000-8004 and 5173
# =========================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$PythonExe = Join-Path $ScriptDir "venv\Scripts\python.exe"
if (-Not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

$StopScript = Join-Path $ScriptDir "stop_all.py"
& $PythonExe $StopScript $args
