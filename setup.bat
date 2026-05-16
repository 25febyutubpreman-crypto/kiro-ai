@echo off
chcp 65001 >nul 2>&1
echo =============================================
echo  SETUP - Dakwah Pipeline
echo  Download tools + install dependencies
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
echo.
echo [INFO] Download yt-dlp...
if exist tools\yt-dlp.exe (
    echo [SKIP] yt-dlp.exe sudah ada. Update...
    tools\yt-dlp.exe --update
) else (
    curl -L -o tools\yt-dlp.exe https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
    if %errorlevel% neq 0 (
        echo [ERROR] Gagal download yt-dlp
        pause
        exit /b 1
    )
    echo [OK] yt-dlp.exe downloaded
)

:: Download ffmpeg
echo.
echo [INFO] Download ffmpeg...
if exist tools\ffmpeg.exe (
    echo [SKIP] ffmpeg.exe sudah ada
) else (
    echo [INFO] Download ffmpeg (~80MB, bisa lama)...
    echo [INFO] Alternatif: download manual dari https://github.com/BtbN/FFmpeg-Builds/releases
    echo [INFO] dan simpan ffmpeg.exe ke folder tools\
    curl -L -o tools\ffmpeg.zip https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip
    if %errorlevel% neq 0 (
        echo [WARN] Gagal download ffmpeg. Coba download manual.
        echo [WARN] Pipeline tetap bisa jalan kalau ffmpeg sudah terinstall di system.
    ) else (
        echo [INFO] Extracting ffmpeg...
        powershell -command "Expand-Archive -Path 'tools\ffmpeg.zip' -DestinationPath 'tools\ffmpeg-temp' -Force"
        for /r tools\ffmpeg-temp %%f in (ffmpeg.exe) do copy "%%f" tools\ffmpeg.exe >nul 2>&1
        for /r tools\ffmpeg-temp %%f in (ffprobe.exe) do copy "%%f" tools\ffprobe.exe >nul 2>&1
        rd /s /q tools\ffmpeg-temp 2>nul
        del tools\ffmpeg.zip 2>nul
        echo [OK] ffmpeg extracted
    )
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

:: npm install (no dependencies needed for now, but future-proof)
echo.
echo [INFO] Setup selesai!
echo.
echo =============================================
echo  LANGKAH SELANJUTNYA:
echo  1. Edit config.json - masukkan API keys
echo  2. Edit urls.txt - paste URL YouTube
echo  3. Jalankan run.bat untuk pipeline otomatis
echo  4. Atau jalankan download.bat untuk download saja
echo =============================================
echo.
pause
