@echo off
title n8n Automation Service
color 0B
echo ===================================================
echo           STARTING N8N AUTOMATION SYSTEM
echo ===================================================
echo.

:: Switch to Node 20 (required for n8n v2.7.5)
set NVM_HOME=C:\Users\skinz\AppData\Local\nvm
set NVM_SYMLINK=C:\nvm4w\nodejs
call %NVM_HOME%\nvm.exe use 20.19.0

:: Change to n8n directory
cd /d F:\n8n_restored

:: Kill any existing n8n on port 5678
echo [1/3] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5678 2^>nul') do taskkill /f /pid %%a 2>nul

echo [2/3] Will open Chrome after 10 seconds...
start /b cmd /c "timeout /t 20 /nobreak >nul && start chrome http://localhost:5678"

echo [3/3] Launching n8n (keep this window open)...
echo.
echo ===================================================
echo    n8n will be ready at: http://localhost:5678
echo    Chrome will open automatically in 10 seconds
echo ===================================================
echo.

npx n8n
pause
