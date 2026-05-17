@echo off
chcp 65001 >nul 2>&1
title Dakwah Pipeline - FULL AUTOMATION
echo.
echo =============================================
echo   FULL PIPELINE - DAKWAH VIDEO AUTOMATION
echo   Download - Whisper - DeepSeek - Save - Render
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

:: Check urls
if not exist urls.txt (
    echo [ERROR] urls.txt tidak ditemukan! Buat file dan paste URL YouTube.
    pause
    exit /b 1
)

:: Check cookies
if not exist "cookies.txt" (
    echo [WARN] cookies.txt tidak ditemukan - download mungkin gagal!
)

echo [INFO] Menjalankan FULL PIPELINE...
echo [INFO] Fase: Download - Transcribe - Format - Save - Render
echo.

:: Run full pipeline
node scripts/pipeline.mjs

echo.
pause
