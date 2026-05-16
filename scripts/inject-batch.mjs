/**
 * Manual JSON Injection Script
 * For when you copy-paste JSON from Gemini Pro browser
 *
 * Supports:
 * - Single JSON object (1 video)
 * - JSON array of objects (multiple videos)
 * - Read from file (gemini-output.json)
 * - Read from stdin (paste to terminal)
 *
 * Usage:
 *   node scripts/inject-batch.mjs                    # read from stdin
 *   node scripts/inject-batch.mjs gemini-output.json  # read from file
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadConfig() {
  const configPath = join(ROOT, "config.json");
  if (!existsSync(configPath)) {
    throw new Error("config.json tidak ditemukan.");
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

function sanitizeFilename(name) {
  return name.replace(/[*?"<>|:/\\]/g, "_");
}

function extractVideoId(videoPath) {
  return sanitizeFilename(
    videoPath
      .replace("/videos/", "")
      .replace(".mp4", "")
      .replace(/^\/+/, "")
  );
}

function parseInput(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  if (Array.isArray(parsed)) {
    return parsed;
  }
  return [parsed];
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

async function readStdin() {
  return new Promise((resolvePromise) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolvePromise(data);
    });
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log(" INJECT BATCH - Manual JSON dari Gemini");
  console.log("=".repeat(60));

  const config = loadConfig();
  const outputDir = resolve(config.outputDir || "./output");
  mkdirSync(outputDir, { recursive: true });

  let rawJson;
  const fileArg = process.argv[2];

  if (fileArg) {
    const filePath = resolve(fileArg);
    if (!existsSync(filePath)) {
      console.error(`[ERR] File tidak ditemukan: ${filePath}`);
      process.exit(1);
    }
    console.log(`[INFO] Membaca dari file: ${filePath}`);
    rawJson = readFileSync(filePath, "utf-8");
  } else {
    console.log("[INFO] PASTE JSON DARI GEMINI DI BAWAH INI:");
    console.log("[INFO] Setelah paste, tekan Enter lalu Ctrl+Z (Windows) atau Ctrl+D (Mac/Linux)");
    console.log();
    rawJson = await readStdin();
  }

  if (!rawJson || !rawJson.trim()) {
    console.error("[ERR] Input kosong.");
    process.exit(1);
  }

  let videos;
  try {
    videos = parseInput(rawJson);
  } catch (err) {
    console.error(`[ERR] JSON tidak valid: ${err.message}`);
    process.exit(1);
  }

  console.log(`\n[INFO] ${videos.length} video ditemukan di JSON input\n`);

  let saved = 0;
  let failed = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    try {
      if (!video.video) {
        throw new Error("Field 'video' tidak ada");
      }

      const videoId = extractVideoId(video.video);
      if (!videoId) {
        throw new Error(`Video ID tidak bisa di-extract dari: ${video.video}`);
      }

      // Enforce channel and logo
      video.channel = config.channel || "@GhulamFathulAmri";
      video.logo = config.logo || "/logo-islam-itu-rahmat.png";

      const filePath = join(outputDir, `${videoId}.json`);
      writeFileSync(filePath, JSON.stringify(video, null, 2), "utf-8");
      console.log(`[OK] [${i + 1}/${videos.length}] ${videoId}.json tersimpan`);
      saved++;
    } catch (err) {
      console.error(`[FAIL] [${i + 1}/${videos.length}] ${err.message}`);
      failed++;
    }
  }

  // Rebuild manifest
  const totalVideos = rebuildManifest(outputDir);

  console.log(`\n[INFO] Hasil: ${saved} tersimpan, ${failed} gagal`);
  console.log(`[INFO] Total di manifest: ${totalVideos} video`);

  // Auto render
  const remotionPath = config.remotionProjectPath;
  if (remotionPath && existsSync(remotionPath) && existsSync(join(remotionPath, "package.json"))) {
    console.log("\n[RENDER] Memulai npm run render:batch...");
    try {
      execSync("npm run render:batch", {
        cwd: remotionPath,
        stdio: "inherit",
        timeout: 600000,
      });
      console.log("[OK] Render selesai!");
    } catch (err) {
      console.error(`[ERR] Render gagal: ${err.message}`);
    }
  } else {
    console.log(`\n[INFO] Remotion project tidak ditemukan di ${remotionPath}. Skip render.`);
    console.log("[INFO] JSON sudah tersimpan. Anda bisa render manual nanti.");
  }
}

main().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
