import chineseKanjiMeanings from '../Data/Kanji/Chinese/meanings.json' with { type: 'json' };
import indonesianKanjiMeanings from '../Data/Kanji/Indonesian/meanings.json' with { type: 'json' };
import tagalogKanjiMeanings from '../Data/Kanji/Tagalog/meanings.json' with { type: 'json' };
import vietnameseKanjiMeanings from '../Data/Kanji/Vietnamese/meanings.json' with { type: 'json' };
import { TEXT, LEVEL_LABEL_BY_VALUE, LEVELS, QUIZ_QUESTION_COUNT } from './constants.js';

export { parseCsvLine } from './utils/csv.js';

export function formatText(language, key, params = {}) {
  const activeText = TEXT[language] || TEXT.en;
  const template = Object.prototype.hasOwnProperty.call(activeText, key)
    ? activeText[key]
    : TEXT.en[key] ?? key;

  return template.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

export function formatQuizExplanation(language, question) {
  const shortExplanation = String(question.short_explanation || '').trim();
  if (shortExplanation) return shortExplanation;

  const reading = question.answer_reading || question.target_vocab_reading;

  return formatText(language, 'answerExplanationNoTranslation', {
    reading,
    vocab: question.target_vocab,
  });
}

export function getQuizWordTranslation(question) {
  return String(question.target_vocab_translation || '').trim();
}

export function getQuizSentenceTranslation(question) {
  return String(question.sentence_translation || '').trim();
}

export function getQuizSentenceVocabWords(question) {
  if (!Array.isArray(question.sentence_vocab_words)) return [];
  return question.sentence_vocab_words
    .map((word) => String(word || '').trim())
    .filter(Boolean);
}

export function getQuizSentenceParts(question) {
  return {
    after: question.sentence_after || '',
    before: question.sentence_before || '',
    target: question.sentence_target || question.target_vocab,
  };
}

export function parseCsvRecords(raw) {
  const records = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const nextChar = raw[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (char === '\r') continue;
    if (char === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) records.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== '')) records.push(row);
  return records;
}

export function parseVocabCsv(raw, level, language) {
  const records = parseCsvRecords(raw.trim());
  return records
    .slice(1)
    .map(([word, reading, ...translationCells], index) => {
      const translation = translationCells.join(', ').trim();
      return { id: `${language}-${level}-${index}-${word}`, level, reading, translation, word };
    })
    .filter((entry) => entry.word && entry.reading)
    .filter((entry) => getUniqueKanjiCharacters(entry.word).length > 0);
}

export function normalizeKanji(rawKanji, level) {
  return Object.entries(rawKanji)
    .map(([key, detail]) => {
      const character = detail.kanji || key;
      return {
        character,
        freq: detail.freq_mainichi_shinbun ?? Number.MAX_SAFE_INTEGER,
        grade: detail.grade,
        heisig: detail.heisig_en || '',
        jlpt: level,
        kunReadings: detail.kun_readings || [],
        meanings: detail.meanings || [],
        localizedMeanings: {
          id: indonesianKanjiMeanings[character] ?? [],
          'zh-Hans': chineseKanjiMeanings[character] ?? [],
          tl: tagalogKanjiMeanings[character] ?? [],
          vi: vietnameseKanjiMeanings[character] ?? [],
        },
        onReadings: detail.on_readings || [],
        strokeCount: detail.stroke_count,
      };
    })
    .sort((first, second) => {
      if (first.freq !== second.freq) return first.freq - second.freq;
      return first.character.localeCompare(second.character, 'ja');
    });
}

export function getKanjiMeanings(kanji, language) {
  const meanings = kanji.localizedMeanings?.[language];
  return meanings?.length ? meanings : kanji.meanings;
}

export function vocabSortForLevels(levels) {
  const activeLevels = levels.length > 0 ? levels : LEVELS.map((level) => level.value);
  const activeLevelSet = new Set(activeLevels);

  return (first, second) => {
    const firstActive = activeLevelSet.has(first.level) ? 0 : 1;
    const secondActive = activeLevelSet.has(second.level) ? 0 : 1;
    if (firstActive !== secondActive) return firstActive - secondActive;

    const firstDistance = Math.min(...activeLevels.map((level) => Math.abs(first.level - level)));
    const secondDistance = Math.min(...activeLevels.map((level) => Math.abs(second.level - level)));
    if (firstDistance !== secondDistance) return firstDistance - secondDistance;
    if (first.level !== second.level) return second.level - first.level;
    if (first.word.length !== second.word.length) return first.word.length - second.word.length;
    return first.word.localeCompare(second.word, 'ja');
  };
}

export const KANJI_SORT_MODES = {
  default: 'default',
  freq: 'freq',
  grade: 'grade',
};

export const FREQ_BADGE_LIMIT = 500;

export function sortKanjiList(items, mode) {
  if (mode === KANJI_SORT_MODES.freq) {
    return [...items].sort((first, second) => {
      if (first.freq !== second.freq) return first.freq - second.freq;
      return first.character.localeCompare(second.character, 'ja');
    });
  }
  if (mode === KANJI_SORT_MODES.grade) {
    const gradeOrFallback = (grade) => (grade == null ? Number.MAX_SAFE_INTEGER : grade);
    return [...items].sort((first, second) => {
      const firstGrade = gradeOrFallback(first.grade);
      const secondGrade = gradeOrFallback(second.grade);
      if (firstGrade !== secondGrade) return firstGrade - secondGrade;
      if (first.freq !== second.freq) return first.freq - second.freq;
      return first.character.localeCompare(second.character, 'ja');
    });
  }
  return items;
}

export function sampleItems(items, amount) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((first, second) => first.sort - second.sort)
    .slice(0, amount)
    .map(({ item }) => item);
}

export function getUniqueKanjiCharacters(word) {
  return Array.from(
    new Set(Array.from(word).filter((char) => /[㐀-鿿]/.test(char))),
  );
}

export function getVocabKey(vocab) {
  return `${vocab.word}\u0000${vocab.reading}`;
}

export function getQuizCandidateKey(kanji, vocab) {
  return `${kanji.character}\u0000${getVocabKey(vocab)}`;
}

export function isValidQuizCandidate(kanji, vocab) {
  return Boolean(
    kanji?.character && vocab?.word && vocab?.reading && vocab.word.includes(kanji.character),
  );
}

export function dedupeQuizCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(({ kanji, vocab }) => {
    if (!isValidQuizCandidate(kanji, vocab)) return false;
    const key = getQuizCandidateKey(kanji, vocab);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toLlmKanjiItem(kanji, vocabItems) {
  return {
    kanji: kanji.character,
    jlpt: LEVEL_LABEL_BY_VALUE[kanji.jlpt],
    meanings: kanji.meanings.slice(0, 4),
    kun_readings: kanji.kunReadings,
    on_readings: kanji.onReadings,
    vocab: vocabItems
      .filter((vocab) => isValidQuizCandidate(kanji, vocab))
      .map((vocab) => ({
        jlpt: LEVEL_LABEL_BY_VALUE[vocab.level],
        reading: vocab.reading,
        translation: vocab.translation,
        word: vocab.word,
      })),
  };
}

export function buildQuizPayload({ selectedStudySet, randomVocabDeck, selectedKanji }) {
  const selectedByCharacter = new Map(
    selectedStudySet.map((kanji) => [kanji.character, kanji]),
  );
  const chosen = [];
  const chosenKeys = new Set();

  const addChosen = ({ kanji, vocab }) => {
    const key = getQuizCandidateKey(kanji, vocab);
    if (!chosenKeys.has(key) && isValidQuizCandidate(kanji, vocab)) {
      chosenKeys.add(key);
      chosen.push({ kanji, vocab });
    }
  };

  const randomCandidates = dedupeQuizCandidates(
    randomVocabDeck.flatMap((kanji) => {
      const sourceKanji = selectedByCharacter.get(kanji.character);
      return (kanji.vocab || []).map((vocab) => ({ kanji: sourceKanji, vocab }));
    }),
  );

  sampleItems(randomCandidates, randomCandidates.length).forEach((candidate) =>
    addChosen(candidate),
  );

  const chosenByKanji = new Map();
  chosen.forEach(({ kanji, vocab }) => {
    if (!chosenByKanji.has(kanji.character)) chosenByKanji.set(kanji.character, []);
    chosenByKanji.get(kanji.character).push(vocab);
  });

  return selectedStudySet
    .map((kanji) => {
      const sortedVocab = [...(chosenByKanji.get(kanji.character) || [])].sort(
        (a, b) => a.word.localeCompare(b.word, 'ja') || a.reading.localeCompare(b.reading, 'ja'),
      );
      return toLlmKanjiItem(kanji, sortedVocab);
    })
    .filter((kanji) => kanji.vocab.length > 0);
}

export function countPayloadVocab(payload) {
  return payload.reduce((total, item) => total + item.vocab.length, 0);
}

export function formatReadings(readings, maxReadings) {
  const cleanReadings = readings.filter(Boolean);
  if (cleanReadings.length === 0) return '-';
  const visibleReadings = cleanReadings.slice(0, maxReadings).join(', ');
  const hiddenCount = cleanReadings.length - maxReadings;
  return hiddenCount > 0 ? `${visibleReadings} +${hiddenCount}` : visibleReadings;
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function speakJapanese(text) {
  if (!text || !isSpeechSynthesisSupported()) return;
  try {
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // browser refused (e.g., not yet user-gesture activated); fail silently
  }
}

const DEV_ONLY_QUIZ_ERROR_KEYS = new Set([
  'quizErrorNoServer',
  'quizErrorNoApiKey',
  'quizErrorAnthropicAuth',
  'quizErrorAnthropicPermission',
  'quizErrorAnthropicModel',
]);

export function resolveQuizErrorKey(errorKey) {
  if (import.meta.env.DEV || !DEV_ONLY_QUIZ_ERROR_KEYS.has(errorKey)) {
    return errorKey;
  }
  return 'quizError';
}

export function classifyQuizError(error, data, httpStatus = 0) {
  if (!data) {
    if (error?.name === 'AbortError') return 'quizErrorTimeout';
    if (httpStatus > 0) return 'quizError';
    return 'quizErrorNoServer';
  }
  if (data.code === 'missing_api_key') {
    return 'quizErrorNoApiKey';
  }
  if (data.code === 'anthropic_auth_error') {
    return 'quizErrorAnthropicAuth';
  }
  if (data.code === 'anthropic_permission_error') {
    return 'quizErrorAnthropicPermission';
  }
  if (data.code === 'anthropic_model_error') {
    return 'quizErrorAnthropicModel';
  }
  if (data.code === 'anthropic_overloaded') {
    return 'quizErrorOverloaded';
  }
  if (httpStatus === 429 || data.code === 'rate_limited' || (error?.message || '').includes('429')) {
    return 'quizErrorRateLimit';
  }
  if (data.code === 'body_too_large') {
    return 'quizError';
  }
  return 'quizError';
}
