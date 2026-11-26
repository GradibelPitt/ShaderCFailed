@echo off
rem Shader Compilation Failed: start the game.
rem Only one game server ever runs: one left over from an earlier start (its window, or a node still holding the port) is stopped first.
rem Closing this window stops the game.
cd /d "%~dp0"
set PORT=8080
rem the window an earlier start opened (it carries this title), with everything it started
taskkill /F /T /FI "WINDOWTITLE eq SCF Game Server*" >nul 2>&1
rem and any node still listening on the port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  tasklist /FI "PID eq %%p" 2>nul | findstr /I "node.exe" >nul && taskkill /F /PID %%p >nul 2>&1
)
title SCF Game Server
echo Shader Compilation Failed: http://127.0.0.1:%PORT%
echo Close this window to stop the game.
echo.
start "" "http://127.0.0.1:%PORT%"
node server.js
pause
