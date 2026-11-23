import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LANGUAGE, LANGUAGES, normalizeLanguage } from '../src/languages.js';
import { parseCsvLine } from '../src/utils/csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, '..', 'Data', 'Vocabulary');

const LEVEL_FILES = {
  5: 'n5_vocab_cleaned.csv',
  4: 'n4_vocab_cleaned.csv',
  3: 'n3_vocab_cleaned.csv',
  2: 'n2_vocab_cleaned.csv',
  1: 'n1_vocab_cleaned.csv',
};

function loadLanguageIndex(folder) {
  const byWord = new Map();
  const byWordReading = new Map();

  Object.entries(LEVEL_FILES).forEach(([levelValue, fileName]) => {
    const filePath = path.join(DATA_ROOT, folder, fileName);
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    raw.trim().split(/\r?\n/).slice(1).forEach((line) => {
      const [word, reading, ...translationCells] = parseCsvLine(line);
      const translation = translationCells.join(', ').trim();
      if (!word || !reading) return;
      const entry = {
        word,
        reading,
        translation,
        level: Number(levelValue),
      };
      byWordReading.set(`${word}\u0000${reading}`, entry);
      if (!byWord.has(word)) byWord.set(word, entry);
    });
  });

  return { byWord, byWordReading };
}

const languageIndexes = new Map(
  LANGUAGES.map(({ value, vocabFolder }) => [value, loadLanguageIndex(vocabFolder)]),
);

export function resolveVocabEntry(word, reading, language = DEFAULT_LANGUAGE) {
  const index = languageIndexes.get(normalizeLanguage(language));
  return index.byWordReading.get(`${word}\u0000${reading}`)
    || index.byWord.get(word)
    || null;
}

export function sanitizeDeckWithServerData(deck, language = 'id') {
  if (!Array.isArray(deck)) return [];

  return deck.map((kanjiItem) => {
    const kanji = String(kanjiItem.kanji || '').trim();
    const vocab = (Array.isArray(kanjiItem.vocab) ? kanjiItem.vocab : [])
      .map((vocabItem) => {
        const word = String(vocabItem.word || '').trim();
        const reading = String(vocabItem.reading || '').trim();
        if (!word || !word.includes(kanji)) return null;
        const serverEntry = resolveVocabEntry(word, reading, language)
          || resolveVocabEntry(word, '', language);
        if (!serverEntry) return null;
        return {
          jlpt: vocabItem.jlpt || `N${serverEntry.level}`,
          word: serverEntry.word,
          reading: serverEntry.reading,
          translation: serverEntry.translation || vocabItem.translation || '',
        };
      })
      .filter(Boolean);

    return {
      ...kanjiItem,
      kanji,
      vocab,
    };
  }).filter((item) => item.kanji && item.vocab.length > 0);
}

export function buildServerDeck(selections, language = 'id') {
  if (!Array.isArray(selections)) return [];

  return selections.map((item) => {
    const kanji = String(item.kanji || '').trim();
    const requestedVocab = Array.isArray(item.vocab) ? item.vocab : [];
    const words = requestedVocab.length > 0
      ? requestedVocab
      : (Array.isArray(item.words) ? item.words.map((word) => ({ word })) : []);

    const vocab = words
      .map((vocabItem) => {
        const word = String(vocabItem.word || vocabItem || '').trim();
        const reading = String(vocabItem.reading || '').trim();
        const serverEntry = resolveVocabEntry(word, reading, language);
        if (!serverEntry || !serverEntry.word.includes(kanji)) return null;
        return {
          jlpt: `N${serverEntry.level}`,
          word: serverEntry.word,
          reading: serverEntry.reading,
          translation: serverEntry.translation,
        };
      })
      .filter(Boolean);

    return {
      kanji,
      jlpt: item.jlpt || '',
      meanings: Array.isArray(item.meanings) ? item.meanings.slice(0, 4) : [],
      kun_readings: Array.isArray(item.kun_readings) ? item.kun_readings : [],
      on_readings: Array.isArray(item.on_readings) ? item.on_readings : [],
      vocab,
    };
  }).filter((item) => item.kanji && item.vocab.length > 0);
}
