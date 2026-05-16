@echo off
chcp 65001 >nul 2>&1
echo =============================================
echo  PIPELINE OTOMATIS - FULL AUTOMATION
echo  Download YT → Whisper → DeepSeek → Render
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

:: Check urls
if not exist urls.txt (
    echo [ERROR] urls.txt tidak ditemukan! Buat file dan paste URL YouTube.
    pause
    exit /b 1
)

:: Run pipeline
node scripts/pipeline.mjs

echo.
echo =============================================
echo  PIPELINE SELESAI
echo =============================================
pause
