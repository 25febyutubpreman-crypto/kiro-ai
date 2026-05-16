# Dakwah Pipeline - DeepSeek AI API

Pipeline otomatis untuk membuat video dakwah pendek dengan subtitle bilingual Arab + Indonesia.

## Alur Pipeline

```
Download YouTube → Whisper Transkrip Arab → DeepSeek Format JSON Subtitle → Render Batch (Remotion)
```

### Teknologi yang Dipakai

| Komponen | Teknologi | Biaya |
|----------|-----------|-------|
| Download Video | yt-dlp + cookies | Gratis |
| Extract Audio | FFmpeg | Gratis |
| Transkrip Arab | Groq Whisper API | Gratis (~4 jam audio/hari) |
| Format Subtitle | DeepSeek API | ~Rp 50-100/video |
| Render | Remotion | Gratis (lokal) |

## Persyaratan

- **Node.js** >= 18.0.0 ([download](https://nodejs.org/))
- **Groq API Key** (GRATIS) - [daftar di sini](https://console.groq.com)
- **DeepSeek API Key** (~$0.14/1M tokens) - [daftar di sini](https://platform.deepseek.com)

## Cara Pakai

### 1. Setup (sekali saja)

```bash
# Windows: double-click setup.bat
# Atau manual:
# Download yt-dlp dan ffmpeg ke folder tools/
```

### 2. Konfigurasi

Edit `config.json`:

```json
{
  "groqApiKey": "gsk_YOUR_KEY_HERE",
  "deepseekApiKey": "sk-YOUR_KEY_HERE",
  "remotionProjectPath": "D:\\Capcut",
  "outputDir": "D:\\Capcut\\src\\data",
  "videoDir": "D:\\Capcut\\public\\videos"
}
```

### 3. Tambah URL YouTube

Edit `urls.txt` - paste URL YouTube (1 per baris):

```
https://youtu.be/VIDEO_ID_1
https://youtu.be/VIDEO_ID_2
https://www.youtube.com/watch?v=VIDEO_ID_3
```

### 4. Jalankan Pipeline

```bash
# Windows: double-click run.bat
# Atau:
node scripts/pipeline.mjs
```

Pipeline otomatis:
1. Download semua video dari `urls.txt`
2. Extract audio + transkrip Arab via Groq Whisper
3. Format subtitle bilingual via DeepSeek API
4. Simpan JSON ke folder output
5. Render batch via Remotion (jika tersedia)

## Script Individual

| Script | Fungsi | Cara Pakai |
|--------|--------|------------|
| `run.bat` | Pipeline penuh (download → render) | Double-click |
| `download.bat` | Download video saja | Double-click |
| `inject.bat` | Paste JSON dari Gemini (stdin) | Double-click, paste, Ctrl+Z, Enter |
| `inject-from-file.bat` | Baca JSON dari file | Simpan ke `gemini-output.json`, double-click |

## Cookies YouTube (Opsional)

Jika download gagal karena blokir IP:

1. Install extension [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) di Chrome
2. Buka YouTube, pastikan sudah login
3. Export cookies → simpan sebagai `cookies.txt` di folder project
4. Pipeline otomatis pakai cookies saat download

## Fitur Anti-Gagal Download

- **Cookies** - download pakai session login Anda
- **Auto-retry** 3x per attempt
- **5 format fallback** - best → mp4 → 720p → 480p → worst
- **5 YouTube player client** - web_creator → iOS → Android → mweb → tv_embedded
- **Skip otomatis** - video yang sudah ada tidak download ulang
- **Error recovery** - gagal 1 video, lanjut ke video berikutnya

## Mode Manual (Gemini Browser)

Jika tidak mau pakai API:

1. Upload video ke [Gemini Pro](https://gemini.google.com) manual
2. Paste prompt dari `prompt.txt`
3. Copy JSON output dari Gemini
4. Simpan ke `gemini-output.json`
5. Double-click `inject-from-file.bat`

## Struktur Output JSON

```json
{
  "video": "/videos/VIDEO_ID.mp4",
  "title": "JUDUL VIDEO",
  "speaker": "NAMA PEMBICARA",
  "channel": "@GhulamFathulAmri",
  "logo": "/logo-islam-itu-rahmat.png",
  "durationInSeconds": 60,
  "startFromSeconds": 0,
  "videoFit": "cover",
  "authenticityConfidencePercent": 85,
  "authenticityConfidenceNote": "Audio jelas, transkrip akurat.",
  "arabicSubtitles": [
    { "startMs": 0, "endMs": 1500, "text": "النَّصُّ الْعَرَبِيُّ" }
  ],
  "indonesianSubtitles": [
    { "startMs": 0, "endMs": 1500, "text": "Teks Indonesia." }
  ]
}
```

## Struktur Folder

```
kiro-ai/
├── config.example.json    # Template konfigurasi
├── config.json            # Konfigurasi (buat dari template)
├── urls.txt               # URL YouTube
├── prompt.txt             # Prompt untuk DeepSeek/Gemini
├── cookies.txt            # Cookies YouTube (opsional)
├── setup.bat              # Setup tools (Windows)
├── run.bat                # Pipeline penuh (Windows)
├── download.bat           # Download saja (Windows)
├── inject.bat             # Inject JSON stdin (Windows)
├── inject-from-file.bat   # Inject JSON file (Windows)
├── scripts/
│   ├── download.mjs       # YouTube downloader
│   ├── transcribe.mjs     # Groq Whisper transcription
│   ├── format-subtitles.mjs # DeepSeek subtitle formatting
│   ├── pipeline.mjs       # Main orchestrator
│   └── inject-batch.mjs   # Manual JSON injection
├── tools/                 # yt-dlp, ffmpeg (auto-download)
├── downloads/             # Downloaded videos + audio
└── output/                # JSON output files
```

## Estimasi Biaya

| Item | Biaya per Video |
|------|----------------|
| Download (yt-dlp) | Gratis |
| Transkrip (Groq Whisper) | Gratis |
| Format (DeepSeek) | ~Rp 50-100 |
| **Total** | **~Rp 50-100** |

## Troubleshooting

### Download gagal semua
- Pastikan `cookies.txt` ada dan belum expired
- Export ulang cookies dari Chrome
- Pastikan yt-dlp versi terbaru (jalankan `setup.bat` lagi)

### Transkrip gagal
- Cek Groq API key valid
- Pastikan ffmpeg terinstall
- File audio max 25MB (video pendek biasanya OK)

### DeepSeek gagal
- Cek API key dan saldo
- Cek koneksi internet
- Lihat error message di terminal

### JSON tidak valid
- DeepSeek kadang output tidak sempurna
- Script otomatis coba fix (trailing comma, code blocks)
- Jika tetap gagal, coba ulang atau pakai mode manual (Gemini)
