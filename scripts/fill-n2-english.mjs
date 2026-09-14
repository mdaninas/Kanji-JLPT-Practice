import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { execSync } from 'node:child_process';
import { loadDictionary } from '@scriptin/jmdict-simplified-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'Data/Vocabulary/English/n2_vocab_cleaned.csv');
const CACHE_DIR = path.join(__dirname, '.cache');
const JMDICT_FILE = path.join(CACHE_DIR, 'jmdict-eng-common.json');
const JMDICT_ZIP = path.join(CACHE_DIR, 'jmdict-eng-common.zip');
const JMDICT_URLS = [
  'https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20260511143416/jmdict-eng-common-3.6.2%2B20260511143416.json.zip',
  'https://github.com/scriptin/jmdict-simplified/releases/latest/download/jmdict-eng-common.json.zip',
];

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { cells.push(cell); cell = ''; continue; }
    cell += char;
  }
  cells.push(cell);
  return cells.map((v) => v.trim());
}

function serializeRow(word, reading, translation) {
  const safe = translation.includes(',') ? `"${translation.replace(/"/g, '""')}"` : translation;
  return `${word},${reading},${safe}`;
}

function normalizeReading(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function pickGloss(entry) {
  const sense = entry.sense?.[0];
  const glosses = sense?.gloss?.map((g) => g.text).filter(Boolean) || [];
  return glosses.join('; ').slice(0, 120);
}

async function downloadFirstAvailable() {
  for (const url of JMDICT_URLS) {
    const response = await fetch(url);
    if (response.ok) {
      await pipeline(response.body, createWriteStream(JMDICT_ZIP));
      return;
    }
  }
  throw new Error('Failed to download JMdict from all known release URLs.');
}

function extractZip() {
  const psZip = JMDICT_ZIP.replace(/'/g, "''");
  const psDir = CACHE_DIR.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${psZip}' -DestinationPath '${psDir}' -Force"`,
    { stdio: 'inherit' },
  );
  const extracted = fs.readdirSync(CACHE_DIR).find(
    (name) => name.startsWith('jmdict-eng-common') && name.endsWith('.json'),
  );
  if (!extracted) {
    throw new Error('JMdict JSON not found after extracting archive.');
  }
  fs.copyFileSync(path.join(CACHE_DIR, extracted), JMDICT_FILE);
}

async function ensureJmdict() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(JMDICT_FILE) && fs.statSync(JMDICT_FILE).size > 1_000_000) return;
  if (!fs.existsSync(JMDICT_ZIP)) await downloadFirstAvailable();
  if (!fs.existsSync(JMDICT_FILE)) extractZip();
}

async function buildLookup() {
  const byWordReading = new Map();
  const byReading = new Map();
  const byWord = new Map();

  await new Promise((resolve, reject) => {
    const loader = loadDictionary('jmdict', JMDICT_FILE)
      .onMetadata(() => {})
      .onEntry((entry) => {
        const gloss = pickGloss(entry);
        if (!gloss) return;
        entry.kana?.forEach((kana) => {
          const reading = normalizeReading(kana.text || kana);
          if (reading) byReading.set(reading, gloss);
        });
        entry.kanji?.forEach((kanji) => {
          const word = kanji.text || kanji;
          if (!word) return;
          byWord.set(word, gloss);
          entry.kana?.forEach((kana) => {
            const reading = normalizeReading(kana.text || kana);
            if (reading) byWordReading.set(`${word}\u0000${reading}`, gloss);
          });
        });
      })
      .onEnd(resolve);
    loader.parser.on('error', reject);
  });

  return { byWordReading, byReading, byWord };
}

function lookupGloss(lookup, word, reading) {
  return lookup.byWordReading.get(`${word}\u0000${normalizeReading(reading)}`)
    || lookup.byWord.get(word)
    || lookup.byReading.get(normalizeReading(reading))
    || '';
}

async function main() {
  await ensureJmdict();
  const lookup = await buildLookup();
  const raw = fs.readFileSync(TARGET, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.trim().split(/\r?\n/);
  const header = lines[0];
  let filled = 0;
  let stillEmpty = 0;

  const out = [header, ...lines.slice(1).map((line) => {
    const [word, reading, ...rest] = parseCsvLine(line);
    const translation = rest.join(', ').trim();
    if (translation) return serializeRow(word, reading, translation);
    const gloss = lookupGloss(lookup, word, reading);
    if (gloss) { filled += 1; return serializeRow(word, reading, gloss); }
    stillEmpty += 1;
    return `${word},${reading},`;
  })];

  fs.writeFileSync(TARGET, `${out.join('\n')}\n`, 'utf8');
  console.log(`Filled ${filled} rows. Still empty: ${stillEmpty}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
