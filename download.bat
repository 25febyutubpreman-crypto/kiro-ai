@echo off
chcp 65001 >nul 2>&1
title Download YouTube - Anti Gagal
echo.
echo =============================================
echo   DOWNLOAD YOUTUBE - ANTI GAGAL
echo   Cookies + Retry + 5 Player Client Fallback
echo =============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js tidak ditemukan! Jalankan setup.bat dulu.
    pause
    exit /b 1
)

:: Check yt-dlp
if not exist "tools\yt-dlp.exe" (
    echo [ERROR] yt-dlp.exe tidak ditemukan! Jalankan setup.bat dulu.
    pause
    exit /b 1
)

:: Check config
if not exist config.json (
    echo [ERROR] config.json tidak ditemukan! Jalankan setup.bat dulu.
    pause
    exit /b 1
)

:: Check cookies
if exist "cookies.txt" (
    echo [OK] cookies.txt ditemukan
) else (
    echo [WARN] cookies.txt tidak ditemukan!
    echo [WARN] Download kemungkinan besar GAGAL tanpa cookies.
    echo.
    set /p "LANJUT=Lanjut tanpa cookies? (y/n): "
    if /i not "%LANJUT%"=="y" (
        echo [INFO] Dibatalkan. Siapkan cookies.txt dulu.
        pause
        exit /b 0
    )
)

echo.
echo [INFO] Memulai download...
echo.
node scripts/download.mjs

echo.
pause
