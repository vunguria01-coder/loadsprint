@echo off
setlocal
title LoadSprint - Local Server

echo ============================================
echo    LoadSprint - Freight Brokerage Platform
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NONODE

for /f "delims=" %%v in ('node -v') do set NODEV=%%v
echo [1/3] Node.js detected: %NODEV%
echo.

if exist "node_modules" goto RUN
echo [2/3] Installing dependencies. First run only - this can take a few minutes...
call npm install
if errorlevel 1 goto INSTALLFAIL
goto RUN

:RUN
echo.
echo [3/3] Starting the dev server at http://localhost:3000
echo Opening your browser shortly. Press Ctrl+C in this window to stop the server.
echo.
start "" http://localhost:3000
call npm run dev
goto END

:NONODE
echo [ERROR] Node.js was not found.
echo Install Node.js 18.18 or newer from https://nodejs.org  then run this file again.
echo.
pause
goto END

:INSTALLFAIL
echo [ERROR] npm install failed. Check your internet connection and try again.
echo.
pause
goto END

:END
echo.
echo The server has stopped. Press any key to close this window.
pause >nul
