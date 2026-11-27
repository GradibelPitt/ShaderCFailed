@echo off
rem Shader Compilation Failed: start the game.
rem Only one game server ever runs: one left over from an earlier start (its window, or a node still holding the port) is stopped first.
rem Closing this window stops the game.
cd /d "%~dp0"
set PORT=8080
rem the window an earlier start opened (it carries this title), with everything it started
taskkill /F /T /FI "WINDOWTITLE eq SCF Game Server*" >nul 2>&1
rem and any node (or the PowerShell server) still listening on the port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  tasklist /FI "PID eq %%p" 2>nul | findstr /I "node.exe powershell.exe" >nul && taskkill /F /PID %%p >nul 2>&1
)
title SCF Game Server
echo Shader Compilation Failed: http://127.0.0.1:%PORT%
echo Close this window to stop the game.
echo.
rem ---- is Node.js on this computer? Not only on the PATH: also where its installers put it (official installer, per-user, nvm, Scoop, Chocolatey)
set "NODE="
for /f "delims=" %%n in ('where node 2^>nul') do if not defined NODE set "NODE=%%n"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "NODE=%NVM_SYMLINK%\node.exe"
if not defined NODE if exist "%APPDATA%\nvm" for /d %%d in ("%APPDATA%\nvm\v*") do if exist "%%d\node.exe" set "NODE=%%d\node.exe"
if not defined NODE if exist "%USERPROFILE%\scoop\apps\nodejs\current\node.exe" set "NODE=%USERPROFILE%\scoop\apps\nodejs\current\node.exe"
if not defined NODE if exist "%USERPROFILE%\scoop\apps\nodejs-lts\current\node.exe" set "NODE=%USERPROFILE%\scoop\apps\nodejs-lts\current\node.exe"
if not defined NODE if exist "%ProgramData%\chocolatey\bin\node.exe" set "NODE=%ProgramData%\chocolatey\bin\node.exe"
if not defined NODE goto nonode

:havenode
set "NODEV="
"%NODE%" -v > "%TEMP%\scf_nodev.txt" 2>nul
set /p NODEV=<"%TEMP%\scf_nodev.txt"
del "%TEMP%\scf_nodev.txt" >nul 2>&1
echo Node.js %NODEV% found: %NODE%
echo.
start "" "http://127.0.0.1:%PORT%"
"%NODE%" server.js
pause
goto :eof

:nonode
echo Node.js was not found on this computer.
rem offer to install it (winget comes with Windows 10/11); no answer in 15 seconds means no
where winget >nul 2>&1
if errorlevel 1 goto ps
choice /C YN /T 15 /D N /M "Install Node.js LTS now with winget"
if errorlevel 2 goto ps
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" if not defined NODE set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined NODE goto havenode
echo Node.js could not be installed.

:ps
rem without Node.js: server.ps1, with the Windows PowerShell every Windows 10/11 has (it opens the browser itself)
echo Serving the game with Windows PowerShell instead.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT%
pause
