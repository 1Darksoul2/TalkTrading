@echo off
REM =========================================================================
REM TalkTrading - Unified Startup Script
REM Starts all microservices and frontend in one command
REM =========================================================================

cd /d "%~dp0"

IF EXIST "%~dp0venv\Scripts\python.exe" (
    "%~dp0venv\Scripts\python.exe" "%~dp0start_all.py" %*
) ELSE (
    python "%~dp0start_all.py" %*
)
