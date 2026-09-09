@echo off
REM Launch Crate in dev mode: the Vite renderer on :3000 and the Electron shell,
REM with the dev port freed first and stale shells and servers swept on exit.
REM
REM Thin wrapper over scripts\dev.ps1; pass its switches straight through:
REM   dev.bat            renderer + Electron shell, with Vite HMR
REM   dev.bat -WebOnly   renderer alone, for driving the UI in a browser
REM   dev.bat -Force     free port 3000 even from a holder outside this repo
REM
REM Ctrl+C in the window stops everything this started.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1" %*
exit /b %ERRORLEVEL%
