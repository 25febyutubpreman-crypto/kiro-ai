/**
 * YouTube Video Downloader - Anti Gagal (v2 - Proven & Tested)
 * Based on user-tested download-only.mjs that successfully downloaded 10/10 videos.
 *
 * Features:
 * - Cookies support (bypass IP block)
 * - 5 YouTube player client fallbacks (web_creator, ios, android, mweb, tv_embedded)
 * - Final fallback without format filter
 * - Rate limit detection (429) with 30s wait
 * - Login detection warning
 * - Custom User-Agent
 * - --socket-timeout, --retries 5, --fragment-retries 5, --retry-sleep 5
 * - --no-check-certificates for SSL bypass
 * - --ffmpeg-location pointing to tools dir
 * - Skip already downloaded videos (checks file size > 10KB)
 * - Configurable delay between downloads (delayBetweenDownloads)
 * - Auto-update yt-dlp before downloading
 * - Error recovery (skip failed, continue next)
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

const PLAYER_CLIENTS = [
  { name: "web_creator", client: "web_creator" },
  { name: "ios", client: "ios" },
  { name: "android", client: "android" },
  { name: "mweb", client: "mweb" },
  { name: "tv_embedded", client: "tv_embedded" },
];

function loadConfig() {
  const configPath = join(ROOT, "config.json");
  if (!existsSync(configPath)) {
    const examplePath = join(ROOT, "config.example.json");
    if (existsSync(examplePath)) {
      const example = readFileSync(examplePath, "utf-8");
      writeFileSync(configPath, example);
      console.log("[INFO] config.json dibuat dari config.example.json. Edit dulu sebelum jalankan.");
    }
    throw new Error("config.json tidak ditemukan. Copy config.example.json -> config.json dan edit.");
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

export function extractVideoId(url) {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
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

function getToolsDir() {
  return join(ROOT, "tools");
}

function sleepSync(seconds) {
  try {
    if (process.platform === "win32") {
      execSync("ping -n " + (seconds + 1) + " 127.0.0.1 > nul 2>&1", {
        stdio: "pipe", timeout: (seconds + 5) * 1000, windowsHide: true,
      });
    } else {
      execSync("sleep " + seconds, {
        stdio: "pipe", timeout: (seconds + 5) * 1000,
      });
    }
  } catch {
    // ignore
  }
}

function updateYtDlp() {
  const ytdlp = getYtDlpPath();
  if (ytdlp === "yt-dlp") return; // system yt-dlp, skip update
  if (!existsSync(ytdlp)) return;
  try {
    console.log("[DL] Updating yt-dlp...");
    execSync('"' + ytdlp + '" --update', { stdio: "pipe", timeout: 60000, windowsHide: true });
    console.log("[DL] yt-dlp up to date.");
  } catch {
    console.log("[DL] yt-dlp update skipped.");
  }
}

function getCookiesPath(config) {
  const cookiesFile = config.ytDlpCookies || config.ytDlpCookiesFile || "./cookies.txt";
  return resolve(ROOT, cookiesFile);
}

function downloadOne(url, outputDir, config) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("URL tidak valid: " + url);

  const outputPath = join(outputDir, videoId + ".mp4");

  // Skip if already exists and > 10KB
  if (existsSync(outputPath) && statSync(outputPath).size > 10000) {
    const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log("  [SKIP] Sudah ada: " + videoId + ".mp4 (" + sizeMB + " MB)");
    return { videoId, status: "skip", size: sizeMB + " MB", path: outputPath };
  }

  const ytdlp = getYtDlpPath();
  const ffmpegDir = getToolsDir();
  const outputTemplate = join(outputDir, videoId + ".%(ext)s");
  const cookiesPath = getCookiesPath(config);

  let lastError = null;

  for (const player of PLAYER_CLIENTS) {
    try {
      const args = [
        '"' + ytdlp + '"',
        "--no-playlist",
        "-f", '"bv*+ba/b"',
        "--merge-output-format", "mp4",
        "-o", '"' + outputTemplate + '"',
        "--no-progress",
        "--newline",
        "--ffmpeg-location", '"' + ffmpegDir + '"',
        "--socket-timeout", "30",
        "--retries", "5",
        "--fragment-retries", "5",
        "--retry-sleep", "5",
        "--no-check-certificates",
        "--extractor-args", '"youtube:player_client=' + player.client + '"',
      ];

      if (existsSync(cookiesPath)) {
        args.push("--cookies", '"' + cookiesPath + '"');
      }

      args.push(
        "--user-agent",
        '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
      );
      args.push('"' + url + '"');

      console.log("  [TRY] player: " + player.name);

      execSync(args.join(" "), {
        stdio: "inherit",
        timeout: 300000,
        windowsHide: true,
      });

      if (existsSync(outputPath) && statSync(outputPath).size > 1000) {
        const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(2);
        console.log("  [OK] " + videoId + ".mp4 (" + sizeMB + " MB) [" + player.name + "]");
        return { videoId, status: "ok", size: sizeMB + " MB", player: player.name, path: outputPath };
      }

      console.log("  [WARN] File tidak ditemukan, coba player lain...");
    } catch (err) {
      lastError = err;
      const msg = (err.message || "").substring(0, 200);

      if (msg.includes("429") || msg.includes("Too Many")) {
        console.log("  [WAIT] Rate limited! Tunggu 30 detik...");
        sleepSync(30);
      }
      if (msg.includes("Sign in") || msg.includes("login")) {
        console.log("  [WARN] YouTube minta login - cek cookies.txt!");
      }

      console.log("  [FAIL] " + player.name + ": " + msg.substring(0, 100));

      sleepSync(3);
    }
  }

  // Last resort: no format filter at all, let yt-dlp decide
  try {
    console.log("  [TRY] fallback: tanpa filter format");
    const fallbackArgs = [
      '"' + ytdlp + '"',
      "--no-playlist",
      "--merge-output-format", "mp4",
      "-o", '"' + outputTemplate + '"',
      "--no-progress",
      "--newline",
      "--ffmpeg-location", '"' + ffmpegDir + '"',
      "--no-check-certificates",
    ];
    const cookiesPath2 = getCookiesPath(config);
    if (existsSync(cookiesPath2)) {
      fallbackArgs.push("--cookies", '"' + cookiesPath2 + '"');
    }
    fallbackArgs.push('"' + url + '"');

    execSync(fallbackArgs.join(" "), {
      stdio: "inherit",
      timeout: 300000,
      windowsHide: true,
    });

    if (existsSync(outputPath) && statSync(outputPath).size > 1000) {
      const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(2);
      console.log("  [OK] " + videoId + ".mp4 (" + sizeMB + " MB) [fallback]");
      return { videoId, status: "ok", size: sizeMB + " MB", player: "fallback", path: outputPath };
    }
  } catch {
    // ignore
  }

  return {
    videoId,
    status: "fail",
    error: (lastError?.message || "unknown").substring(0, 200),
  };
}

export function downloadAll(urls, config) {
  const outputDir = resolve(config.videoDir || config.outputDir || "./downloads");
  mkdirSync(outputDir, { recursive: true });

  const cookiesPath = getCookiesPath(config);

  console.log("");
  console.log("=".repeat(60));
  console.log("  DOWNLOAD YOUTUBE - ANTI GAGAL");
  console.log("  Cookies + Retry + 5 Player Client Fallback");
  console.log("=".repeat(60));
  console.log("");
  console.log("[INFO] Output folder : " + outputDir);
  console.log("[INFO] Total URL     : " + urls.length);
  console.log("[INFO] Cookies       : " + (existsSync(cookiesPath) ? "YA" : "TIDAK"));
  console.log("");

  // Update yt-dlp first
  updateYtDlp();
  console.log("");

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const videoId = extractVideoId(url) || "???";
    console.log("--- [" + (i + 1) + "/" + urls.length + "] " + videoId + " ---");

    try {
      const result = downloadOne(url, outputDir, config);
      results.push({ url, ...result });
    } catch (err) {
      console.error("  [FAIL] " + videoId + ": " + err.message);
      results.push({ url, videoId, status: "fail", error: err.message });
    }

    // Delay between downloads (avoid rate limit)
    if (i < urls.length - 1) {
      const delaySec = config.delayBetweenDownloads || 3;
      console.log("[INFO] Tunggu " + delaySec + " detik...");
      sleepSync(delaySec);
    }
    console.log("");
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const ok = results.filter((r) => r.status === "ok").length;
  const skip = results.filter((r) => r.status === "skip").length;
  const fail = results.filter((r) => r.status === "fail").length;

  console.log("=".repeat(60));
  console.log("  SUMMARY");
  console.log("  Total     : " + urls.length);
  console.log("  Downloaded: " + ok);
  console.log("  Skipped   : " + skip + " (sudah ada)");
  console.log("  Gagal     : " + fail);
  console.log("  Waktu     : " + elapsed + " detik");
  console.log("=".repeat(60));

  if (fail > 0) {
    console.log("");
    console.log("  Video yang gagal:");
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log("  - " + r.videoId + ": " + (r.error || "unknown"));
    }
  }

  // Save log
  const logPath = join(ROOT, "download-log.json");
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        elapsed: elapsed + "s",
        total: urls.length,
        downloaded: ok,
        skipped: skip,
        failed: fail,
        results,
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log("");
  console.log("[INFO] Log: " + logPath);
  console.log("[OK] Selesai.");

  return results;
}

// Run standalone
if (process.argv[1] && process.argv[1].includes("download")) {
  try {
    const cfg = loadConfig();
    const urlsPath = join(ROOT, cfg.urlsFile || "urls.txt");
    if (!existsSync(urlsPath)) {
      throw new Error("urls.txt tidak ditemukan.");
    }
    const urls = readFileSync(urlsPath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    if (urls.length === 0) {
      console.log("[INFO] urls.txt kosong. Tambahkan URL YouTube.");
      process.exit(0);
    }
    const results = downloadAll(urls, cfg);
    const failed = results.filter((r) => r.status === "fail").length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("[FATAL] " + err.message);
    process.exit(1);
  }
}
