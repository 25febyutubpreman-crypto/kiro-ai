@echo off
chcp 65001 >nul 2>&1
echo =============================================
echo  INJECT FROM FILE - Baca gemini-output.json
echo =============================================
echo.

if not exist gemini-output.json (
    echo [ERROR] gemini-output.json tidak ditemukan!
    echo Buat file gemini-output.json dan paste JSON dari Gemini ke dalamnya.
    pause
    exit /b 1
)

node scripts/inject-batch.mjs gemini-output.json

echo.
pause
