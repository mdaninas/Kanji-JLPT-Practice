import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VOCAB_ROOT = path.join(ROOT, 'Data', 'Vocabulary');
const KANJI_DIR = path.join(ROOT, 'Data', 'Kanji');

const KANJI_FILES = ['kanji_n1.json', 'kanji_n2.json', 'kanji_n3.json', 'kanji_n4.json', 'kanji_n5.json'];
const KANJI_KEEP_FIELDS = new Set([
  'kanji',
  'freq_mainichi_shinbun',
  'grade',
  'heisig_en',
  'kun_readings',
  'meanings',
  'on_readings',
  'stroke_count',
]);
const KANJI_DROP_FIELDS = ['name_readings', 'notes', 'unicode', 'jlpt'];

/** RFC 4180-style CSV parser (handles quoted fields with embedded newlines). */
export function parseCsvRecords(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  const records = [];
  let index = 0;
  const length = text.length;

  const readField = () => {
    let field = '';
    if (text[index] === '"') {
      index += 1;
      while (index < length) {
        if (text[index] === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        field += text[index];
        index += 1;
      }
      return field;
    }

    while (index < length && text[index] !== ',' && text[index] !== '\n' && text[index] !== '\r') {
      field += text[index];
      index += 1;
    }
    return field;
  };

  const readRow = () => {
    const row = [];
    while (index < length) {
      row.push(readField());
      if (text[index] === ',') {
        index += 1;
        continue;
      }
      if (text[index] === '\r') index += 1;
      if (text[index] === '\n') index += 1;
      break;
    }
    return row;
  };

  const header = readRow().map((cell) => cell.trim());
  if (header.length === 0 || header.every((cell) => !cell)) return { header: [], records: [] };

  while (index < length) {
    const row = readRow();
    if (row.length === 1 && row[0] === '') continue;
    if (!row.some((cell) => cell.trim())) continue;
    records.push(Object.fromEntries(header.map((name, cellIndex) => [name, (row[cellIndex] ?? '').trim()])));
  }

  return { header, records };
}

const KANA_READING_RE = /^[\u3041-\u3096\u30A1-\u30FA\u30FC\u30FB\uFF65-\uFF9F\s.\-・()（）]+$/u;
const KANA_ONLY_WORD_RE = /^[\u3041-\u3096\u30A1-\u30FA\u30FC\u30FB\uFF65-\uFF9F\sー・]+$/u;
const JP_SCRIPT_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
const LLM_JUNK_PREFIX_RE = /^(Teks:|Translation:|Terjemahan:|Output:|Text:)/i;
const LLM_JUNK_SUFFIX_RE = /Terjemahan:\s*$/;

function isKanaOnlyWord(word) {
  return Boolean(word) && KANA_ONLY_WORD_RE.test(word) && !/[\u4E00-\u9FFF]/.test(word);
}

function isJapaneseTranslation(text) {
  if (!text) return false;
  const compact = text.replace(/\s/g, '');
  if (!compact) return false;
  const jpCount = (compact.match(JP_SCRIPT_RE) || []).length;
  return jpCount / compact.length >= 0.5;
}

function isLlmJunkTranslation(text) {
  if (!text) return false;
  if (text.includes('\n') || text.includes('\r')) return true;
  if (LLM_JUNK_PREFIX_RE.test(text)) return true;
  if (LLM_JUNK_SUFFIX_RE.test(text)) return true;
  return false;
}

function translationColumn(header) {
  return header.find((name) => name === 'English' || name === 'Indonesian') ?? header[2] ?? '';
}

function validateVocabFile(filePath) {
  const errors = [];
  const warnings = [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const { header, records } = parseCsvRecords(raw);
  const translationKey = translationColumn(header);
  const seen = new Map();
  let kanaOnlyCount = 0;

  records.forEach((record, index) => {
    const row = index + 2;
    const word = record.Kanji ?? '';
    const reading = record.Reading ?? '';
    const translation = translationKey ? (record[translationKey] ?? '') : '';

    if (!word || !reading) {
      errors.push(`${filePath}:${row} missing word/reading`);
      return;
    }

    if (reading && !KANA_READING_RE.test(reading)) {
      errors.push(`${filePath}:${row} reading is not kana: ${word} (${reading})`);
    }

    if (filePath.includes(`${path.sep}English${path.sep}`) && !translation) {
      errors.push(`${filePath}:${row} missing English translation for ${word}`);
    }

    if (isLlmJunkTranslation(translation)) {
      errors.push(`${filePath}:${row} leftover LLM junk in translation for ${word}: ${JSON.stringify(translation.slice(0, 80))}`);
    }

    if (isKanaOnlyWord(word)) kanaOnlyCount += 1;

    const dedupeKey = `${word}\0${reading}`;
    if (seen.has(dedupeKey)) {
      warnings.push(`${filePath}:${row} duplicate word/reading (${word}, ${reading}) — first at row ${seen.get(dedupeKey)}`);
    } else {
      seen.set(dedupeKey, row);
    }

    if (translation && isJapaneseTranslation(translation)) {
      warnings.push(`${filePath}:${row} translation still contains Japanese: ${word} -> ${translation}`);
    }
  });

  return { errors, warnings, rowCount: records.length, kanaOnlyCount };
}

function trimKanjiFiles() {
  const summary = [];

  for (const fileName of KANJI_FILES) {
    const filePath = path.join(KANJI_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      summary.push({ fileName, status: 'missing' });
      continue;
    }

    const beforeBytes = fs.statSync(filePath).size;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let droppedFieldCount = 0;
    let entryCount = 0;

    for (const detail of Object.values(raw)) {
      entryCount += 1;
      for (const field of KANJI_DROP_FIELDS) {
        if (field in detail) {
          delete detail[field];
          droppedFieldCount += 1;
        }
      }
      for (const field of Object.keys(detail)) {
        if (!KANJI_KEEP_FIELDS.has(field)) {
          delete detail[field];
          droppedFieldCount += 1;
        }
      }
    }

    fs.writeFileSync(filePath, `${JSON.stringify(raw)}\n`, 'utf8');
    const afterBytes = fs.statSync(filePath).size;
    summary.push({
      fileName,
      status: 'trimmed',
      entries: entryCount,
      droppedFields: droppedFieldCount,
      beforeBytes,
      afterBytes,
    });
  }

  return summary;
}

const vocabFiles = [];
for (const lang of ['English', 'Indonesian']) {
  for (const level of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    vocabFiles.push(path.join(VOCAB_ROOT, lang, `${level}_vocab_cleaned.csv`));
  }
}

const allErrors = [];
const allWarnings = [];
let totalRows = 0;
let totalKanaOnly = 0;

for (const file of vocabFiles) {
  if (!fs.existsSync(file)) {
    allErrors.push(`Missing ${file}`);
    continue;
  }
  const result = validateVocabFile(file);
  allErrors.push(...result.errors);
  allWarnings.push(...result.warnings);
  totalRows += result.rowCount;
  totalKanaOnly += result.kanaOnlyCount;
}

if (allErrors.length > 0) {
  console.error('Validation errors:');
  console.error(allErrors.join('\n'));
  process.exit(1);
}

const kanjiSummary = trimKanjiFiles();

console.log(`Validated ${vocabFiles.length} vocab files (${totalRows.toLocaleString()} rows).`);
console.log(`Warnings: ${allWarnings.length} (kana-only words in files: ${totalKanaOnly.toLocaleString()}).`);
if (allWarnings.length > 0 && allWarnings.length <= 30) {
  console.warn(allWarnings.join('\n'));
} else if (allWarnings.length > 30) {
  console.warn(`${allWarnings.slice(0, 15).join('\n')}\n... and ${allWarnings.length - 15} more warnings`);
}

const trimmed = kanjiSummary.filter((item) => item.status === 'trimmed');
const bytesBefore = trimmed.reduce((sum, item) => sum + item.beforeBytes, 0);
const bytesAfter = trimmed.reduce((sum, item) => sum + item.afterBytes, 0);
const droppedFields = trimmed.reduce((sum, item) => sum + item.droppedFields, 0);

console.log(
  `Trimmed ${trimmed.length} kanji JSON files (${trimmed.reduce((sum, item) => sum + item.entries, 0).toLocaleString()} entries, dropped ${droppedFields.toLocaleString()} unused fields, ${bytesBefore.toLocaleString()} -> ${bytesAfter.toLocaleString()} bytes).`,
);
console.log(`Dropped fields: ${KANJI_DROP_FIELDS.join(', ')}.`);
