@echo off
chcp 65001 >nul 2>&1
echo =============================================
echo  DOWNLOAD ONLY - YouTube Anti Gagal
echo  Cookies + Retry + Format/Client Fallback
echo =============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan! Jalankan setup.bat dulu.
    pause
    exit /b 1
)

:: Check config
if not exist config.json (
    echo [ERROR] config.json tidak ditemukan! Jalankan setup.bat dulu.
    pause
    exit /b 1
)

:: Run download only
node scripts/download.mjs

echo.
echo =============================================
echo  DOWNLOAD SELESAI
echo =============================================
pause
