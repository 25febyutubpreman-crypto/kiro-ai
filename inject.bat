@echo off
chcp 65001 >nul 2>&1
echo =============================================
echo  INJECT BATCH - Paste JSON dari Gemini
echo =============================================
echo.
echo PASTE JSON DARI GEMINI DI BAWAH INI:
echo Setelah paste, tekan Enter lalu Ctrl+Z lalu Enter
echo.

node scripts/inject-batch.mjs

echo.
pause
