/**
 * DeepSeek API - Format Whisper transcription into bilingual subtitle JSON
 * - Takes raw Arabic transcription from Whisper
 * - Sends to DeepSeek with detailed prompt
 * - Returns structured JSON with arabicSubtitles + indonesianSubtitles
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadPrompt() {
  const promptPath = join(ROOT, "prompt.txt");
  if (!existsSync(promptPath)) {
    throw new Error("prompt.txt tidak ditemukan di root folder.");
  }
  return readFileSync(promptPath, "utf-8");
}

function buildUserMessage(transcription, videoId, duration) {
  const segmentsText = transcription.segments
    .map((s) => `[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s] ${s.text}`)
    .join("\n");

  return [
    `Video file: ${videoId}.mp4`,
    `Duration: ${duration} detik`,
    ``,
    `Transkrip Arab dari audio (Whisper):`,
    `${transcription.text}`,
    ``,
    `Detail segments dengan timestamp:`,
    segmentsText,
    ``,
    `Berdasarkan transkrip di atas, buatkan JSON subtitle bilingual sesuai format yang diminta.`,
    `Gunakan timestamp dari segments sebagai panduan untuk startMs dan endMs.`,
  ].join("\n");
}

async function callDeepSeek(systemPrompt, userMessage, config) {
  const apiKey = config.deepseekApiKey;
  if (!apiKey || apiKey === "YOUR_DEEPSEEK_API_KEY_HERE") {
    throw new Error("DeepSeek API key belum diset di config.json");
  }

  const baseUrl = config.deepseekBaseUrl || "https://api.deepseek.com";
  const model = config.deepseekModel || "deepseek-chat";

  const maxRetries = config.maxRetries || 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DEEPSEEK] Sending request (attempt ${attempt}/${maxRetries})...`);

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 8192,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("DeepSeek returned empty response");
      }

      console.log(
        `[OK] DeepSeek response received (${content.length} chars, ${result.usage?.total_tokens || "?"} tokens)`
      );

      return content;
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

function parseJsonResponse(responseText) {
  let cleaned = responseText.trim();

  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (firstErr) {
    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (secondErr) {
        // Try fixing common issues
        let fixed = jsonMatch[0];
        fixed = fixed.replace(/,\s*([}\]])/g, "$1"); // trailing commas
        fixed = fixed.replace(/[\x00-\x1f]/g, " "); // control chars
        try {
          return JSON.parse(fixed);
        } catch (thirdErr) {
          throw new Error(`JSON parse gagal. Response:\n${responseText.substring(0, 500)}`);
        }
      }
    }
    throw new Error(`Tidak ada JSON valid dalam response:\n${responseText.substring(0, 500)}`);
  }
}

function validateSubtitleJson(json, videoId, config) {
  const required = [
    "video", "title", "speaker", "channel", "logo",
    "durationInSeconds", "arabicSubtitles", "indonesianSubtitles",
  ];

  for (const field of required) {
    if (!(field in json)) {
      throw new Error(`Field "${field}" tidak ada di JSON output`);
    }
  }

  if (!Array.isArray(json.arabicSubtitles) || !Array.isArray(json.indonesianSubtitles)) {
    throw new Error("arabicSubtitles dan indonesianSubtitles harus array");
  }

  if (json.arabicSubtitles.length !== json.indonesianSubtitles.length) {
    console.warn(
      `[WARN] Jumlah subtitle tidak sama: Arab=${json.arabicSubtitles.length}, Indo=${json.indonesianSubtitles.length}`
    );
  }

  // Fix fields
  json.video = `/videos/${videoId}.mp4`;
  json.channel = config.channel || "@GhulamFathulAmri";
  json.logo = config.logo || "/logo-islam-itu-rahmat.png";

  // Validate subtitle entries
  for (const arr of [json.arabicSubtitles, json.indonesianSubtitles]) {
    for (const item of arr) {
      if (typeof item.startMs !== "number" || typeof item.endMs !== "number") {
        throw new Error("Setiap subtitle harus punya startMs dan endMs (number)");
      }
      if (typeof item.text !== "string" || !item.text.trim()) {
        throw new Error("Setiap subtitle harus punya text (string tidak kosong)");
      }
    }
  }

  return json;
}

export async function formatSubtitles(transcription, videoId, duration, config) {
  const systemPrompt = loadPrompt();
  const userMessage = buildUserMessage(transcription, videoId, duration);

  const responseText = await callDeepSeek(systemPrompt, userMessage, config);
  const parsed = parseJsonResponse(responseText);
  const validated = validateSubtitleJson(parsed, videoId, config);

  return validated;
}

export async function formatAll(transcriptions, config) {
  console.log("=".repeat(60));
  console.log(" DEEPSEEK SUBTITLE FORMATTING");
  console.log("=".repeat(60));
  console.log(`[INFO] Total transkrip: ${transcriptions.length}`);
  console.log();

  const results = [];

  for (let i = 0; i < transcriptions.length; i++) {
    const t = transcriptions[i];
    if (t.status === "failed") {
      console.log(`[SKIP] ${t.videoId} - transkrip gagal`);
      results.push({ videoId: t.videoId, status: "skipped" });
      continue;
    }

    console.log(`\n--- [${i + 1}/${transcriptions.length}] ${t.videoId} ---`);

    try {
      const subtitleJson = await formatSubtitles(t, t.videoId, t.duration, config);
      subtitleJson.durationInSeconds = Math.ceil(t.duration);
      results.push({ videoId: t.videoId, status: "success", data: subtitleJson });
    } catch (err) {
      console.error(`[FAIL] ${t.videoId}: ${err.message}`);
      results.push({ videoId: t.videoId, status: "failed", error: err.message });
    }

    if (i < transcriptions.length - 1) {
      console.log("[WAIT] Tunggu 2 detik...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const success = results.filter((r) => r.status === "success").length;
  console.log(`\n[INFO] Hasil: ${success}/${transcriptions.length} berhasil`);

  return results;
}
