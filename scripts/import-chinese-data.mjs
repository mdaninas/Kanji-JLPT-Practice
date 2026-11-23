import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseCsvLine } from '../src/utils/csv.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEVELS = [5, 4, 3, 2, 1];
const DATA_LOCALE = 'zh-CN';
const HAN = /\p{Script=Han}/u;
const overridesPath = path.join(ROOT, 'scripts', 'chinese-data-overrides.json');
const overrides = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, 'utf8'))
  : {};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), 'utf8'));
}

function normalizeReading(reading) {
  return reading.normalize('NFKC').replace(/\s+/gu, '')
    .replace(/[ァ-ヶ]/gu, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

function normalizeEnglish(meaning) {
  return meaning.toLowerCase()
    .replace(/\([^)]*\)/gu, ' ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/^(?:to|the|an|a) /u, '');
}

function chineseGlosses(values) {
  return [...new Set(values.filter((value) => typeof value === 'string')
    .map((value) => value.replace(/\s+/gu, ' ').trim()).filter((value) => HAN.test(value)))];
}

function csvCell(value) {
  return /[,"]/u.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
}

function getVocabularyMeaning(rows, word, reading, english) {
  const expectedReading = normalizeReading(reading);
  const expectedGlosses = new Set(english.split(/[;,/]/u).map(normalizeEnglish).filter(Boolean));
  const candidates = [];

  for (const row of rows) {
    const entry = JSON.parse(row.entry);
    const matchesReading = entry.kana.some((form) => (
      normalizeReading(form.text) === expectedReading
      && (!form.restricted_to?.length || form.restricted_to.includes(word))
    ));
    if (!matchesReading) continue;

    const translation = JSON.parse(row.translation);
    const senses = entry.senses.flatMap((sense, index) => {
      const glosses = chineseGlosses(translation.senses?.[index]?.glosses?.map(({ text }) => text) ?? []);
      if (glosses.length === 0) return [];
      const matchesEnglish = sense.glosses.some(({ lang, text }) => (
        lang === 'eng' && expectedGlosses.has(normalizeEnglish(text))
      ));
      return [{ glosses, matchesEnglish }];
    });
    const matchingSenses = senses.filter((sense) => sense.matchesEnglish);
    const selectedSenses = matchingSenses.length ? matchingSenses : senses.slice(0, 1);
    if (selectedSenses.length > 0) {
      candidates.push({
        glosses: [...new Set(selectedSenses.flatMap((sense) => sense.glosses))],
        matchesEnglish: matchingSenses.length,
        common: row.is_common,
      });
    }
  }

  candidates.sort((first, second) => (
    second.matchesEnglish - first.matchesEnglish || second.common - first.common
  ));
  return candidates[0]?.glosses.join('；') ?? '';
}

function readVocabularyFiles() {
  return LEVELS.map((level) => {
    const file = 'n' + level + '_vocab_cleaned.csv';
    const csv = fs.readFileSync(path.join(ROOT, 'Data/Vocabulary/English', file), 'utf8').trim();
    const rows = csv.split(/\r?\n/u).slice(1).map(parseCsvLine);
    return { level, file, rows };
  });
}

function collectEntryIds(database, files) {
  const wanted = new Set(files.flatMap(({ rows }) => (
    rows.flatMap(([word]) => [word, word.normalize('NFKC')])
  )));
  const byWord = new Map();
  // The export's forms table has no index. Scan it once for this study set.
  for (const { text, entry_id: entryId } of database.prepare('SELECT text, entry_id FROM forms').iterate()) {
    if (!wanted.has(text)) continue;
    if (!byWord.has(text)) byWord.set(text, new Set());
    byWord.get(text).add(entryId);
  }
  return byWord;
}

function extractDictionary(database) {
  const lookupKanji = database.prepare(
    'SELECT zho FROM kanji_gloss WHERE literal = ? AND locale = ?',
  );
  const lookupEntry = database.prepare(
    'SELECT entries.data AS entry, zh_defs.data AS translation, entries.is_common '
    + 'FROM entries JOIN zh_defs ON zh_defs.entry_id = entries.id WHERE entries.id = ? AND zh_defs.locale = ?',
  );
  const files = readVocabularyFiles();
  const entryIdsByWord = collectEntryIds(database, files);
  const outputs = new Map();
  const missing = [];
  const kanjiLines = [];
  let vocabularyCount = 0;

  for (const { level, file, rows } of files) {
    const kanji = readJson('Data/Kanji/kanji_n' + level + '.json');
    for (const [literal, source] of Object.entries(kanji)) {
      const found = lookupKanji.get(literal, DATA_LOCALE);
      const meanings = chineseGlosses(overrides.kanji?.[literal] ?? (found ? JSON.parse(found.zho) : []));
      if (meanings.length === 0) missing.push(['kanji', 'N' + level, literal, '', source.meanings.join('; ')]);
      kanjiLines.push('  ' + JSON.stringify(literal) + ': [' + meanings.map((meaning) => JSON.stringify(meaning)).join(', ') + ']');
    }

    const translatedRows = rows.map(([word, reading, ...englishFields]) => {
      const english = englishFields.join(', ');
      const ids = entryIdsByWord.get(word) ?? entryIdsByWord.get(word.normalize('NFKC')) ?? [];
      const translation = overrides.vocabulary?.[word]?.[reading]
        ?? getVocabularyMeaning(
          [...ids].sort().map((id) => lookupEntry.get(id, DATA_LOCALE)).filter(Boolean),
          word,
          reading,
          english,
        );
      if (!HAN.test(translation)) missing.push(['vocab', 'N' + level, word, reading, english]);
      return [word, reading, translation].map(csvCell).join(',');
    });
    vocabularyCount += translatedRows.length;
    outputs.set('Data/Vocabulary/Chinese/' + file, ['Kanji,Reading,Chinese', ...translatedRows, ''].join('\n'));
  }

  outputs.set('Data/Kanji/Chinese/meanings.json', '{\n' + kanjiLines.join(',\n') + '\n}\n');
  return { outputs, missing, kanjiCount: kanjiLines.length, vocabularyCount };
}

const databasePath = process.argv[2];
if (!databasePath) {
  throw new Error('Usage: node scripts/import-chinese-data.mjs <tomoshi-dict-open.db>');
}

const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  const { outputs, missing, kanjiCount, vocabularyCount } = extractDictionary(database);
  if (missing.length > 0) {
    console.error('Missing Chinese meanings (kind, level, word, reading, English gloss):');
    for (const entry of missing) console.error(entry.join('\t'));
    throw new Error(missing.length + ' entries need Chinese meanings.');
  }
  for (const [file, content] of outputs) {
    const destination = path.join(ROOT, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, 'utf8');
  }
  console.log('Generated Chinese meanings for ' + kanjiCount + ' kanji and ' + vocabularyCount + ' vocabulary rows.');
} finally {
  database.close();
}
