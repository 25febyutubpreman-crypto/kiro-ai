@echo off
chcp 65001 >nul 2>&1
title Dakwah Pipeline - Setup
echo.
echo =============================================
echo   SETUP - Dakwah Pipeline
echo   Download tools + install dependencies
echo =============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Download dari: https://nodejs.org/
    echo Install dulu, lalu jalankan setup.bat lagi.
    pause
    exit /b 1
)
echo [OK] Node.js ditemukan: 
node --version

:: Create folders
if not exist tools mkdir tools
if not exist downloads mkdir downloads
if not exist output mkdir output

:: Download yt-dlp
if not exist "tools\yt-dlp.exe" (
    echo.
    echo [INFO] Mendownload yt-dlp.exe...
    powershell -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'tools\yt-dlp.exe'"
    if exist "tools\yt-dlp.exe" (
        echo [OK] yt-dlp.exe downloaded
    ) else (
        echo [ERROR] Gagal download yt-dlp.exe
        echo [ERROR] Download manual: https://github.com/yt-dlp/yt-dlp/releases
        echo [ERROR] Simpan ke folder tools\
    )
) else (
    echo [OK] yt-dlp.exe sudah ada
)

:: Update yt-dlp
echo.
echo [INFO] Updating yt-dlp...
tools\yt-dlp.exe --update 2>nul
echo [OK] yt-dlp up to date

:: Download ffmpeg
if not exist "tools\ffmpeg.exe" (
    echo.
    echo [INFO] Mendownload ffmpeg...
    powershell -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile 'tools\ffmpeg.zip'"
    if exist "tools\ffmpeg.zip" (
        echo [INFO] Extracting ffmpeg...
        powershell -Command "Expand-Archive -Path 'tools\ffmpeg.zip' -DestinationPath 'tools\ffmpeg-temp' -Force"
        for /d %%D in (tools\ffmpeg-temp\ffmpeg-*) do (
            copy "%%D\bin\ffmpeg.exe" "tools\ffmpeg.exe" >nul 2>&1
            copy "%%D\bin\ffprobe.exe" "tools\ffprobe.exe" >nul 2>&1
        )
        rmdir /s /q "tools\ffmpeg-temp" >nul 2>&1
        del "tools\ffmpeg.zip" >nul 2>&1
        if exist "tools\ffmpeg.exe" (
            echo [OK] ffmpeg.exe extracted
        ) else (
            echo [WARN] ffmpeg extract gagal - tapi tidak wajib untuk download
        )
    )
) else (
    echo [OK] ffmpeg.exe sudah ada
)

:: Check ffmpeg available
where ffmpeg >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] ffmpeg tersedia di system PATH
) else if exist tools\ffmpeg.exe (
    echo [OK] ffmpeg tersedia di tools\
) else (
    echo [WARN] ffmpeg tidak ditemukan. Transcription mungkin gagal.
    echo [WARN] Download manual: https://github.com/BtbN/FFmpeg-Builds/releases
)

:: Copy config if not exists
if not exist config.json (
    echo.
    echo [INFO] Membuat config.json dari template...
    copy config.example.json config.json >nul
    echo [OK] config.json dibuat. EDIT DULU sebelum jalankan pipeline!
    echo      - Masukkan Groq API key
    echo      - Masukkan DeepSeek API key
)

:: Check cookies
echo.
if exist "cookies.txt" (
    echo [OK] cookies.txt ditemukan
) else (
    echo [WARN] cookies.txt TIDAK DITEMUKAN!
    echo [WARN] Download PASTI gagal tanpa cookies.
    echo [WARN] Cara:
    echo   1. Install extension "Get cookies.txt LOCALLY" di Chrome
    echo   2. Buka YouTube ^(pastikan login^)
    echo   3. Klik extension, export cookies
    echo   4. Simpan sebagai cookies.txt di folder ini
)

echo.
echo [OK] Setup selesai!
echo.
echo =============================================
echo   LANGKAH SELANJUTNYA:
echo   1. Pastikan cookies.txt ada di folder ini
echo   2. Edit config.json - masukkan API keys
echo   3. Edit urls.txt - paste URL YouTube
echo   4. Jalankan run.bat untuk pipeline otomatis
echo   5. Atau jalankan download.bat untuk download saja
echo =============================================
echo.
pause
