/**
 * generate-thumbnails.mjs
 *
 * Scans the /media folder for all .jpg and .mp4 files,
 * generates low-res thumbnails into /public/thumbnails,
 * and writes a manifest.json to /public/manifest.json
 * that the React app uses to build the gallery.
 *
 * Each folder's first media item is marked with `pinned: true` and a
 * global `pinIndex` so the navigation bar can jump directly to it in
 * the flat carousel array.
 *
 * Run: npm run thumbnails
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "child_process";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";

// ─── Locate ffmpeg binary ────────────────────────────────────────────────────
function findFfmpeg() {
  const isWin = process.platform === "win32";

  const candidates = [
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/ffmpeg/bin/ffmpeg",
    ...(isWin
      ? [
          "C:\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
          path.join(process.env.USERPROFILE ?? "C:\\Users\\User", "scoop\\shims\\ffmpeg.exe"),
          "C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files\\Gyan\\FFmpeg\\bin\\ffmpeg.exe",
        ]
      : []),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  const whereCmd = isWin ? "where.exe" : "which";
  const result = spawnSync(whereCmd, ["ffmpeg"], { encoding: "utf8" });
  if (result.status === 0 && result.stdout) {
    const found = result.stdout.trim().split(/\r?\n/)[0].trim();
    if (found && fs.existsSync(found)) return found;
  }

  if (isWin && process.env.PATH) {
    for (const dir of process.env.PATH.split(";")) {
      const candidate = path.join(dir.trim(), "ffmpeg.exe");
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

const ffmpegPath = findFfmpeg();
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log(`  ✔  ffmpeg found at: ${ffmpegPath}`);
} else {
  console.error(
    "\n❌  ffmpeg binary not found. Video thumbnails will be skipped.\n" +
      "   Install ffmpeg and re-run this script:\n" +
      "     macOS:   brew install ffmpeg\n" +
      "     Windows: winget install Gyan.FFmpeg  (then restart your terminal)\n" +
      "     Linux:   sudo apt install ffmpeg\n",
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MEDIA_DIR = path.join(ROOT, "public", "media");
const THUMBS_DIR = path.join(ROOT, "public", "thumbnails");
const MANIFEST_PATH = path.join(ROOT, "public", "manifest.json");

const THUMB_WIDTH = 216;
const THUMB_HEIGHT = 216;
const THUMB_QUALITY = 72;

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parsePixelFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  // Look for the YYYYMMDD_HHMMSS pattern anywhere in the filename
  const match = base.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!match) return { date: null, time: null };

  const [, year, month, day, hh, mm, ss] = match;

  const utcDate = new Date(
    Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hh, 10),
      parseInt(mm, 10),
      parseInt(ss, 10),
    ),
  );

  const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);

  const jstHour24 = jstDate.getUTCHours();
  const jstMin = jstDate.getUTCMinutes();
  const jstDay = jstDate.getUTCDate();
  const jstMonth = jstDate.getUTCMonth() + 1;
  const jstYear = jstDate.getUTCFullYear();

  const hour12 = jstHour24 % 12 === 0 ? 12 : jstHour24 % 12;
  const ampm = jstHour24 < 12 ? "AM" : "PM";
  const shortYear = String(jstYear).slice(2);
  const paddedMin = String(jstMin).padStart(2, "0");

  return {
    date: `${jstMonth}/${jstDay}/${shortYear}`,
    time: `${hour12}:${paddedMin} ${ampm}`,
  };
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// ─── Image thumbnail ─────────────────────────────────────────────────────────

async function generateImageThumb(srcPath, destPath) {
  if (fs.existsSync(destPath)) return;
  await sharp(srcPath)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: "cover", position: "center" })
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
    .toFile(destPath);
}

// ─── Video thumbnail (first frame via ffmpeg) ────────────────────────────────

function generateVideoThumb(srcPath, destDir, filename) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      return reject(new Error("ffmpeg not found — install it and re-run npm run thumbnails"));
    }
    const destPath = path.join(destDir, filename);
    if (fs.existsSync(destPath)) return resolve();

    ffmpeg(srcPath)
      .inputOptions("-ss 00:00:00.000")
      .videoFilters([
        `scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=increase`,
        `crop=${THUMB_WIDTH}:${THUMB_HEIGHT}`,
      ])
      .outputOptions("-vframes 1")
      .output(destPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(MEDIA_DIR)) {
    console.error(
      "\n❌  Media folder not found at: " +
        MEDIA_DIR +
        "\n   Create a /media folder next to /src and place your numbered trip folders inside it.\n",
    );
    process.exit(1);
  }

  ensureDir(THUMBS_DIR);

  const folders = fs
    .readdirSync(MEDIA_DIR)
    .filter((name) => fs.statSync(path.join(MEDIA_DIR, name)).isDirectory())
    .sort(naturalSort);

  const manifest = [];

  // ── Track the running index across all items (flat carousel position) ──────
  let globalIndex = 0;

  for (const folder of folders) {
    const folderPath = path.join(MEDIA_DIR, folder);
    const thumbFolderPath = path.join(THUMBS_DIR, folder);
    ensureDir(thumbFolderPath);

    const label = folder.replace(/^\d+\s*-\s*/, "");

    const files = fs
      .readdirSync(folderPath)
      .filter((f) => /\.(jpg|jpeg|png|webp|mp4|mov|m4v|webm)$/i.test(f))
      .sort(naturalSort);

    const items = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const srcFile = path.join(folderPath, file);
      const isVideo = [".mp4", ".mov", ".m4v", ".webm"].includes(ext);

      const thumbName = path.basename(file, ext) + ".jpg";
      const thumbDest = path.join(thumbFolderPath, thumbName);

      try {
        if (isVideo) {
          process.stdout.write(`  🎞  ${folder}/${file} → thumb\n`);
          await generateVideoThumb(srcFile, thumbFolderPath, thumbName);
        } else {
          process.stdout.write(`  🖼  ${folder}/${file} → thumb\n`);
          await generateImageThumb(srcFile, thumbDest);
        }
      } catch (err) {
        console.warn(`  ⚠️  Skipped ${file}: ${err.message}`);
      }

      const { date, time } = parsePixelFilename(file);

      // ── Pin the first successfully processed item in each folder ────────────
      const isFirstInFolder = items.length === 0;

      items.push({
        src: `media/${folder}/${file}`,
        thumb: `thumbnails/${folder}/${thumbName}`,
        type: isVideo ? "video" : "image",
        filename: file,
        folder: label,
        date,
        time,
        // Bookmark fields — only set on the first item of each folder
        ...(isFirstInFolder && {
          pinned: true, // flag for nav to identify jump targets
          pinIndex: globalIndex, // flat position in the carousel array
          pinLabel: label, // region label (e.g. "Tokyo (Asakusa)")
        }),
      });

      globalIndex++;
    }

    if (items.length > 0) {
      manifest.push({ folder, label, items });
    }
  }

  // ── Write a convenience pins array at the top level of the manifest ─────────
  // This lets your nav component do a single `manifest.pins` lookup instead of
  // iterating every folder to find pinned items.
  const pins = manifest.flatMap((f) =>
    f.items
      .filter((item) => item.pinned)
      .map((item) => ({
        folder: item.folder, // "Tokyo (Asakusa)"
        pinIndex: item.pinIndex, // flat carousel index
        thumb: item.thumb, // thumbnail src for the nav button
        date: item.date, // date of the first photo in the region
      })),
  );

  const output = { pins, folders: manifest };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(output, null, 2));

  const total = manifest.reduce((acc, f) => acc + f.items.length, 0);
  console.log(
    `\n✅  Manifest written → ${MANIFEST_PATH}\n` +
      `   ${manifest.length} folders, ${total} media items, ${pins.length} pins\n`,
  );

  // ── Print a summary of all pins for quick verification ──────────────────────
  console.log("📍  Pins:");
  for (const pin of pins) {
    console.log(
      `     [${String(pin.pinIndex).padStart(4, "0")}] ${pin.folder}  (${pin.date ?? "no date"})`,
    );
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
