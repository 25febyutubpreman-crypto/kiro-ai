/**
 * YouTube Video Downloader - Anti Gagal
 * Features:
 * - Cookies support (bypass IP block)
 * - Auto-retry 3x per attempt
 * - 5 YouTube player client fallbacks (web_creator, ios, android, mweb, tv_embedded)
 * - 5 format fallbacks (best, mp4, 720p, 480p, worst)
 * - Skip already downloaded videos
 * - Error recovery (skip failed, continue next)
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

const FORMAT_STRATEGIES = [
  { name: "best merged", fmt: "bv+ba/b", merge: "mp4" },
  { name: "best mp4", fmt: "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]", merge: "mp4" },
  { name: "720p", fmt: "bv[height<=720]+ba/b[height<=720]", merge: "mp4" },
  { name: "480p", fmt: "bv[height<=480]+ba/b[height<=480]", merge: "mp4" },
  { name: "worst (fallback)", fmt: "worst", merge: "mp4" },
];

const PLAYER_CLIENTS = ["web_creator", "ios", "android", "mweb", "tv_embedded"];

function loadConfig() {
  const configPath = join(ROOT, "config.json");
  if (!existsSync(configPath)) {
    const examplePath = join(ROOT, "config.example.json");
    if (existsSync(examplePath)) {
      const example = readFileSync(examplePath, "utf-8");
      writeFileSync(configPath, example);
      console.log("[INFO] config.json dibuat dari config.example.json. Edit dulu sebelum jalankan.");
    }
    throw new Error("config.json tidak ditemukan. Copy config.example.json → config.json dan edit.");
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

function loadUrls() {
  const urlsPath = join(ROOT, "urls.txt");
  if (!existsSync(urlsPath)) {
    throw new Error("urls.txt tidak ditemukan. Buat file urls.txt dan paste URL YouTube (1 per baris).");
  }
  return readFileSync(urlsPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getYtDlpPath() {
  const toolsPath = join(ROOT, "tools", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  if (existsSync(toolsPath)) return toolsPath;
  return "yt-dlp";
}

async function runYtDlp(args, timeout = 120000) {
  const ytdlp = getYtDlpPath();
  try {
    const { stdout, stderr } = await execFileAsync(ytdlp, args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, stdout, stderr };
  } catch (err) {
    return { success: false, error: err.message, stderr: err.stderr || "" };
  }
}

async function downloadVideo(url, videoId, outputDir, config) {
  const outputPath = join(outputDir, `${videoId}.mp4`);

  if (existsSync(outputPath)) {
    console.log(`[SKIP] Sudah ada: ${videoId}.mp4`);
    return { videoId, status: "skipped", path: outputPath };
  }

  const cookiesPath = join(ROOT, config.ytDlpCookies || "./cookies.txt");
  const hasCookies = existsSync(cookiesPath);

  for (const client of PLAYER_CLIENTS) {
    for (const strategy of FORMAT_STRATEGIES) {
      const maxRetries = config.maxRetries || 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(
          `[DL] ${videoId} | client=${client} | format=${strategy.name} | attempt ${attempt}/${maxRetries}`
        );

        const args = [
          "--no-playlist",
          "-f", strategy.fmt,
          "--merge-output-format", strategy.merge,
          "--extractor-args", `youtube:player_client=${client}`,
          "-o", outputPath,
          "--no-overwrites",
        ];

        if (hasCookies) {
          args.push("--cookies", cookiesPath);
        }

        args.push(url);

        const result = await runYtDlp(args);

        if (result.success && existsSync(outputPath)) {
          console.log(`[OK] ${videoId}.mp4 berhasil di-download`);
          return { videoId, status: "success", path: outputPath, client, format: strategy.name };
        }

        const errMsg = result.error || result.stderr || "";
        if (errMsg.includes("already been downloaded")) {
          console.log(`[OK] ${videoId}.mp4 sudah ada (yt-dlp)`);
          return { videoId, status: "success", path: outputPath, client, format: strategy.name };
        }

        if (attempt < maxRetries) {
          const delay = attempt * 5000;
          console.log(`[WAIT] Tunggu ${delay / 1000} detik...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  }

  // Final fallback: no format filter at all
  console.log(`[DL] ${videoId} | FINAL FALLBACK (no format filter)`);
  const fallbackArgs = ["--no-playlist", "-o", outputPath, "--no-overwrites"];
  const cookiesPath2 = join(ROOT, config.ytDlpCookies || "./cookies.txt");
  if (existsSync(cookiesPath2)) {
    fallbackArgs.push("--cookies", cookiesPath2);
  }
  fallbackArgs.push(url);

  const fallbackResult = await runYtDlp(fallbackArgs, 180000);
  if (fallbackResult.success && existsSync(outputPath)) {
    console.log(`[OK] ${videoId}.mp4 berhasil (fallback)`);
    return { videoId, status: "success", path: outputPath, client: "default", format: "fallback" };
  }

  console.error(`[FAIL] ${videoId} - gagal semua format & client`);
  return { videoId, status: "failed", error: "All formats and clients failed" };
}

export async function downloadAll(urls, config) {
  const outputDir = resolve(config.videoDir || config.downloadDir || "./downloads");
  mkdirSync(outputDir, { recursive: true });

  console.log("=".repeat(60));
  console.log(" DOWNLOAD YOUTUBE - ANTI GAGAL");
  console.log(" Cookies + Retry + Format Fallback + Client Fallback");
  console.log("=".repeat(60));
  console.log(`[INFO] Output folder : ${outputDir}`);
  console.log(`[INFO] Total URL     : ${urls.length}`);
  console.log(`[INFO] Cookies       : ${existsSync(join(ROOT, config.ytDlpCookies || "./cookies.txt")) ? "YA" : "TIDAK"}`);
  console.log();

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.error(`[ERR] URL tidak valid: ${url}`);
      results.push({ url, status: "invalid_url" });
      continue;
    }

    console.log(`\n--- [${i + 1}/${urls.length}] ${videoId} ---`);
    const result = await downloadVideo(url, videoId, outputDir, config);
    results.push({ url, ...result });
  }

  // Save log
  const logPath = join(ROOT, "download-log.json");
  writeFileSync(logPath, JSON.stringify(results, null, 2));
  console.log(`\n[INFO] Log tersimpan: ${logPath}`);

  const success = results.filter((r) => r.status === "success" || r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`[INFO] Hasil: ${success} berhasil, ${failed} gagal dari ${urls.length} total`);

  return results;
}

// Run standalone
if (process.argv[1] && process.argv[1].includes("download")) {
  try {
    const config = loadConfig();
    const urls = loadUrls();
    if (urls.length === 0) {
      console.log("[INFO] urls.txt kosong. Tambahkan URL YouTube.");
      process.exit(0);
    }
    const results = await downloadAll(urls, config);
    const failed = results.filter((r) => r.status === "failed").length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
  }
}
