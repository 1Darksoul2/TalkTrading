@echo off
REM =========================================================================
REM TalkTrading - Unified Stop Script
REM Stops any running microservices on ports 8000-8004 and 5173
REM =========================================================================

cd /d "%~dp0"

IF EXIST "%~dp0venv\Scripts\python.exe" (
    "%~dp0venv\Scripts\python.exe" "%~dp0stop_all.py" %*
) ELSE (
    python "%~dp0stop_all.py" %*
)
