/**
 * Audio Transcription via Groq Whisper API (FREE)
 * - Extract audio from video using ffmpeg
 * - Transcribe Arabic audio using whisper-large-v3
 * - Returns raw transcription text with timestamps
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

function getFfmpegPath() {
  const toolsPath = join(ROOT, "tools", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (existsSync(toolsPath)) return toolsPath;
  return "ffmpeg";
}

async function extractAudio(videoPath, audioPath) {
  const ffmpeg = getFfmpegPath();

  if (existsSync(audioPath)) {
    console.log(`[SKIP] Audio sudah ada: ${basename(audioPath)}`);
    return audioPath;
  }

  console.log(`[AUDIO] Extracting audio dari ${basename(videoPath)}...`);

  try {
    await execFileAsync(ffmpeg, [
      "-i", videoPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-ab", "64k",
      "-ar", "16000",
      "-ac", "1",
      "-y",
      audioPath,
    ], { timeout: 120000 });

    console.log(`[OK] Audio: ${basename(audioPath)}`);
    return audioPath;
  } catch (err) {
    throw new Error(`FFmpeg gagal: ${err.message}`);
  }
}

async function transcribeWithGroq(audioPath, config) {
  const apiKey = config.groqApiKey;
  if (!apiKey || apiKey === "YOUR_GROQ_API_KEY_HERE") {
    throw new Error("Groq API key belum diset di config.json");
  }

  const fileSize = statSync(audioPath).size;
  const maxSize = 25 * 1024 * 1024; // 25MB limit
  if (fileSize > maxSize) {
    console.warn(`[WARN] File audio terlalu besar (${(fileSize / 1024 / 1024).toFixed(1)}MB). Max 25MB.`);
  }

  console.log(`[WHISPER] Transcribing ${basename(audioPath)} (${(fileSize / 1024 / 1024).toFixed(1)}MB)...`);

  const formData = new FormData();
  const audioBuffer = readFileSync(audioPath);
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
  formData.append("file", audioBlob, basename(audioPath));
  formData.append("model", config.whisperModel || "whisper-large-v3");
  formData.append("language", "ar");
  formData.append("response_format", "verbose_json");
  formData.append("temperature", "0");

  const maxRetries = config.maxRetries || 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errBody}`);
      }

      const result = await response.json();
      console.log(`[OK] Transcription selesai (${result.segments?.length || 0} segments)`);
      return result;
    } catch (err) {
      console.error(`[ERR] Attempt ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = attempt * 5000;
        console.log(`[WAIT] Retry dalam ${delay / 1000} detik...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

export async function transcribeVideo(videoPath, config) {
  const audioDir = join(ROOT, "downloads", "audio");
  mkdirSync(audioDir, { recursive: true });

  const videoName = basename(videoPath, ".mp4");
  const audioPath = join(audioDir, `${videoName}.mp3`);

  await extractAudio(videoPath, audioPath);
  const transcription = await transcribeWithGroq(audioPath, config);

  return {
    videoId: videoName,
    text: transcription.text || "",
    language: transcription.language || "ar",
    duration: transcription.duration || 0,
    segments: (transcription.segments || []).map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })),
  };
}

export async function transcribeAll(videoPaths, config) {
  console.log("=".repeat(60));
  console.log(" WHISPER TRANSCRIPTION (Groq API - GRATIS)");
  console.log("=".repeat(60));
  console.log(`[INFO] Total video: ${videoPaths.length}`);
  console.log();

  const results = [];

  for (let i = 0; i < videoPaths.length; i++) {
    const videoPath = videoPaths[i];
    console.log(`\n--- [${i + 1}/${videoPaths.length}] ${basename(videoPath)} ---`);

    try {
      const result = await transcribeVideo(videoPath, config);
      results.push({ ...result, status: "success" });
    } catch (err) {
      console.error(`[FAIL] ${basename(videoPath)}: ${err.message}`);
      results.push({
        videoId: basename(videoPath, ".mp4"),
        status: "failed",
        error: err.message,
      });
    }

    if (i < videoPaths.length - 1) {
      console.log("[WAIT] Tunggu 2 detik...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const success = results.filter((r) => r.status === "success").length;
  console.log(`\n[INFO] Hasil: ${success}/${videoPaths.length} berhasil`);

  return results;
}
