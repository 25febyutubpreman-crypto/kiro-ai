/**
 * Main Pipeline Orchestrator
 * Download YT → Whisper transkrip → DeepSeek format JSON → Save → Render batch
 *
 * Usage: node scripts/pipeline.mjs
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { downloadAll } from "./download.mjs";
import { transcribeAll } from "./transcribe.mjs";
import { formatAll } from "./format-subtitles.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadConfig() {
  const configPath = join(ROOT, "config.json");
  if (!existsSync(configPath)) {
    throw new Error("config.json tidak ditemukan. Copy config.example.json → config.json dan edit.");
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

function loadUrls() {
  const urlsPath = join(ROOT, "urls.txt");
  if (!existsSync(urlsPath)) {
    throw new Error("urls.txt tidak ditemukan.");
  }
  return readFileSync(urlsPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function sanitizeFilename(name) {
  return name.replace(/[*?"<>|:]/g, "_");
}

function saveSubtitleJson(subtitleData, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  const videoId = sanitizeFilename(subtitleData.video.replace("/videos/", "").replace(".mp4", ""));
  const filePath = join(outputDir, `${videoId}.json`);
  writeFileSync(filePath, JSON.stringify(subtitleData, null, 2), "utf-8");
  console.log(`[SAVE] ${filePath}`);
  return filePath;
}

function rebuildManifest(outputDir) {
  const jsonFiles = readdirSync(outputDir).filter((f) => f.endsWith(".json") && f !== "videos.json");

  const videos = jsonFiles.map((f) => {
    const data = JSON.parse(readFileSync(join(outputDir, f), "utf-8"));
    return {
      id: f.replace(".json", ""),
      title: data.title || f,
      video: data.video || `/videos/${f.replace(".json", ".mp4")}`,
      speaker: data.speaker || "",
      durationInSeconds: data.durationInSeconds || 0,
    };
  });

  const manifestPath = join(outputDir, "videos.json");
  writeFileSync(manifestPath, JSON.stringify(videos, null, 2), "utf-8");
  console.log(`[MANIFEST] ${manifestPath} (${videos.length} video)`);
  return videos.length;
}

async function runRender(config) {
  const remotionPath = config.remotionProjectPath;
  if (!remotionPath || !existsSync(remotionPath)) {
    console.log(`[SKIP] Remotion project tidak ditemukan di ${remotionPath}. Skip render.`);
    return false;
  }

  const packageJsonPath = join(remotionPath, "package.json");
  if (!existsSync(packageJsonPath)) {
    console.log("[SKIP] package.json tidak ditemukan di Remotion project. Skip render.");
    return false;
  }

  console.log("\n[RENDER] Memulai npm run render:batch...");
  try {
    execSync("npm run render:batch", {
      cwd: remotionPath,
      stdio: "inherit",
      timeout: 600000,
    });
    console.log("[OK] Render selesai!");
    return true;
  } catch (err) {
    console.error(`[ERR] Render gagal: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log(" DAKWAH VIDEO PIPELINE - FULL AUTOMATION");
  console.log(" Download → Whisper → DeepSeek → Save → Render");
  console.log("=".repeat(60));
  console.log();

  const config = loadConfig();
  const urls = loadUrls();

  if (urls.length === 0) {
    console.log("[INFO] urls.txt kosong. Tambahkan URL YouTube (1 per baris).");
    return;
  }

  console.log(`[INFO] ${urls.length} URL ditemukan di urls.txt\n`);

  // === PHASE 1: Download ===
  console.log("\n" + "=".repeat(60));
  console.log(" FASE 1: DOWNLOAD YOUTUBE");
  console.log("=".repeat(60));

  const downloadResults = await downloadAll(urls, config);
  const successfulDownloads = downloadResults.filter(
    (r) => r.status === "success" || r.status === "skipped"
  );

  if (successfulDownloads.length === 0) {
    console.error("[FATAL] Tidak ada video yang berhasil di-download.");
    process.exit(1);
  }

  // Collect video paths
  const videoPaths = successfulDownloads
    .map((r) => r.path)
    .filter((p) => p && existsSync(p));

  // === PHASE 2: Transcribe ===
  console.log("\n" + "=".repeat(60));
  console.log(" FASE 2: WHISPER TRANSCRIPTION");
  console.log("=".repeat(60));

  const transcriptions = await transcribeAll(videoPaths, config);
  const successfulTranscriptions = transcriptions.filter((t) => t.status === "success");

  if (successfulTranscriptions.length === 0) {
    console.error("[FATAL] Tidak ada transkrip yang berhasil.");
    process.exit(1);
  }

  // === PHASE 3: DeepSeek Format ===
  console.log("\n" + "=".repeat(60));
  console.log(" FASE 3: DEEPSEEK SUBTITLE FORMATTING");
  console.log("=".repeat(60));

  const formattedResults = await formatAll(transcriptions, config);
  const successfulFormats = formattedResults.filter((r) => r.status === "success");

  if (successfulFormats.length === 0) {
    console.error("[FATAL] Tidak ada subtitle yang berhasil di-format.");
    process.exit(1);
  }

  // === PHASE 4: Save JSON ===
  console.log("\n" + "=".repeat(60));
  console.log(" FASE 4: SAVE JSON FILES");
  console.log("=".repeat(60));

  const outputDir = resolve(config.outputDir || "./output");
  for (const result of successfulFormats) {
    saveSubtitleJson(result.data, outputDir);
  }

  // Rebuild manifest
  const totalVideos = rebuildManifest(outputDir);
  console.log(`\n[INFO] Total ${totalVideos} video di manifest`);

  // === PHASE 5: Render ===
  console.log("\n" + "=".repeat(60));
  console.log(" FASE 5: RENDER BATCH");
  console.log("=".repeat(60));

  await runRender(config);

  // === Summary ===
  console.log("\n" + "=".repeat(60));
  console.log(" RINGKASAN PIPELINE");
  console.log("=".repeat(60));
  console.log(`Download : ${successfulDownloads.length}/${urls.length} berhasil`);
  console.log(`Transkrip: ${successfulTranscriptions.length}/${videoPaths.length} berhasil`);
  console.log(`Format   : ${successfulFormats.length}/${transcriptions.length} berhasil`);
  console.log(`Manifest : ${totalVideos} video`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(`\n[FATAL] ${err.message}`);
  process.exit(1);
});
