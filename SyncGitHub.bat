@echo off
setlocal
echo =======================================
echo    Healy Academy - GitHub Sync Pro
echo =======================================
echo.

:: Change drive and directory
f:
cd "f:\MyRestoredProjects\healy-system"

echo [1/3] Adding all changes...
git add .

echo [2/3] Committing with timestamp...
:: Get current date and time for the commit message
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (set mytime=%%a:%%b)
git commit -m "Auto-sync from Desktop: %mydate% %mytime%"

echo [3/3] Pushing to GitHub (origin main)...
git push origin main

echo.
echo =======================================
echo    Done! Deployment started on Vercel.
echo =======================================
echo.
pause
