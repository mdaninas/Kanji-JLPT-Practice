import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { sanitizeDeckWithServerData } from './vocabLookup.js';

const anthropicClient = new Anthropic({
  timeout: 60_000,
  maxRetries: 1,
});

export const SUPPORTED_MODELS = Object.freeze([
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
]);

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

function getAllowedModels() {
  const envList = process.env.ALLOWED_MODELS?.split(',').map((item) => item.trim()).filter(Boolean);
  if (envList?.length) {
    return SUPPORTED_MODELS.filter((model) => envList.includes(model));
  }
  return SUPPORTED_MODELS;
}

export function resolveModel(requestedModel) {
  const pool = getAllowedModels();
  if (pool.length === 0) return DEFAULT_MODEL;
  if (pool.includes(requestedModel)) return requestedModel;
  const envModel = process.env.ANTHROPIC_MODEL;
  if (pool.includes(envModel)) return envModel;
  return pool[0] || DEFAULT_MODEL;
}

const MAX_KANJI_ITEMS = 10;
const MAX_VOCAB_PER_KANJI = 10;
const MAX_QUESTIONS = 10;
const MIN_SENTENCE_VOCAB = 3;
const MIN_VALID_RATIO = 0.6;
const HIRAGANA_RE = /^[ぁ-ゖー]+$/;
const FIELD_LIMITS = {
  word: 16,
  reading: 32,
  translation: 80,
  meaning: 40,
};
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const FALLBACK_DISTRACTOR_READINGS = [
  'あい',
  'いち',
  'うえ',
  'えき',
  'おお',
  'か',
  'がく',
  'き',
  'こう',
  'さん',
  'し',
  'じん',
  'すい',
  'せい',
  'だい',
  'ちゅう',
  'にち',
  'ひと',
  'ほん',
  'みず',
  'やま',
];
const QUIZ_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    quiz_title: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target_vocab: { type: 'string' },
          sentence_before: { type: 'string' },
          sentence_after: { type: 'string' },
          sentence_translation: { type: 'string' },
          distractors: {
            type: 'array',
            items: { type: 'string' },
          },
          short_explanation: { type: 'string' },
        },
        required: ['target_vocab', 'distractors'],
        additionalProperties: false,
      },
    },
  },
  required: ['quiz_title', 'questions'],
  additionalProperties: false,
};

const EXPLANATION_LANGUAGES = {
  id: {
    name: 'Indonesian',
    instruction: 'Use Indonesian words and grammar. Only the quoted vocabulary and reading may stay Japanese.',
  },
  en: {
    name: 'English',
    instruction: 'Use English words and grammar. Only the quoted vocabulary and reading may stay Japanese.',
  },
};

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateField(value, max) {
  const text = asString(value);
  return text.length > max ? text.slice(0, max) : text;
}

function isHiraganaReading(value) {
  return HIRAGANA_RE.test(asString(value));
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeDeck(deck) {
  return deck.slice(0, MAX_KANJI_ITEMS).map((kanjiItem) => {
    const kanji = asString(kanjiItem.kanji);

    return {
      kanji,
      jlpt: asString(kanjiItem.jlpt),
      meanings: Array.isArray(kanjiItem.meanings)
        ? kanjiItem.meanings.map((item) => truncateField(item, FIELD_LIMITS.meaning)).filter(Boolean).slice(0, 4)
        : [],
      kun_readings: Array.isArray(kanjiItem.kun_readings)
        ? kanjiItem.kun_readings.map(asString).filter(Boolean).slice(0, 8)
        : [],
      on_readings: Array.isArray(kanjiItem.on_readings)
        ? kanjiItem.on_readings.map(asString).filter(Boolean).slice(0, 8)
        : [],
      vocab: Array.isArray(kanjiItem.vocab)
        ? kanjiItem.vocab
            .map((vocabItem) => ({
              jlpt: asString(vocabItem.jlpt),
              word: truncateField(vocabItem.word, FIELD_LIMITS.word),
              reading: truncateField(vocabItem.reading, FIELD_LIMITS.reading),
              translation: truncateField(vocabItem.translation, FIELD_LIMITS.translation),
            }))
            .filter((vocabItem) =>
              vocabItem.word &&
              vocabItem.reading &&
              vocabItem.word.includes(kanji)
            )
            .slice(0, MAX_VOCAB_PER_KANJI)
        : [],
    };
  }).filter((kanjiItem) => kanjiItem.kanji && kanjiItem.vocab.length > 0);
}

function clampQuestionCount(questionCount) {
  const count = Number(questionCount);

  if (!Number.isFinite(count)) {
    return 10;
  }

  return Math.max(1, Math.min(Math.floor(count), MAX_QUESTIONS));
}

function buildAllowedReadingMap(deck) {
  const allowed = new Map();

  deck.forEach((kanjiItem) => {
    kanjiItem.vocab.forEach((vocabItem) => {
      if (!allowed.has(vocabItem.word)) {
        allowed.set(vocabItem.word, {
          kanji: kanjiItem.kanji,
          jlpt: kanjiItem.jlpt,
          translation: vocabItem.translation,
          word: vocabItem.word,
          reading: vocabItem.reading,
        });
      }
    });
  });

  return allowed;
}

function fallbackSentenceParts(word) {
  return {
    sentence_before: '',
    sentence_target: word,
    sentence_after: '\u3067\u3059\u3002',
  };
}

function normalizeSentenceParts(question, allowed) {
  const before = asString(question.sentence_before);
  const target = asString(question.sentence_target) || allowed.word;
  const after = asString(question.sentence_after);
  const sentenceText = `${before}${target}${after}`;

  if (!sentenceText.includes(allowed.word)) {
    Object.assign(question, fallbackSentenceParts(allowed.word));
    return true;
  }

  question.sentence_before = before;
  question.sentence_target = allowed.word;
  question.sentence_after = after;
  return false;
}

function collectAllowedVocabWords(deck) {
  return [
    ...new Set(
      deck.flatMap((kanjiItem) => kanjiItem.vocab.map((vocabItem) => vocabItem.word)),
    ),
  ].filter(Boolean);
}

function buildVocabRichSentenceParts(targetWord, vocabWords) {
  const uniqueWords = [
    targetWord,
    ...vocabWords.filter((word) => word && word !== targetWord),
  ];
  const requiredWords = uniqueWords.slice(0, Math.min(MIN_SENTENCE_VOCAB, uniqueWords.length));
  const restWords = requiredWords.slice(1);

  return {
    sentence_before: '',
    sentence_target: targetWord,
    sentence_after: restWords.length > 0 ? `と${restWords.join('と')}です。` : 'です。',
    sentence_vocab_words: requiredWords,
  };
}

function normalizeSentenceVocabWords(question, allowed, deck) {
  const allowedWords = collectAllowedVocabWords(deck);
  const requiredCount = Math.min(MIN_SENTENCE_VOCAB, allowedWords.length);
  const sentenceText = `${question.sentence_before}${question.sentence_target}${question.sentence_after}`;
  const wordsInSentence = allowedWords.filter((word) => sentenceText.includes(word));

  if (requiredCount === 0) {
    question.sentence_vocab_words = [];
    return false;
  }

  if (wordsInSentence.length < requiredCount) {
    const fallbackWords = [
      allowed.word,
      ...allowedWords.filter((word) => word !== allowed.word),
    ];

    Object.assign(question, buildVocabRichSentenceParts(allowed.word, fallbackWords));
    return true;
  }

  question.sentence_vocab_words = [
    allowed.word,
    ...wordsInSentence.filter((word) => word !== allowed.word),
  ];
  return false;
}

function collectReadingCandidates(deck, correctReading) {
  const readings = deck.flatMap((kanjiItem) =>
    kanjiItem.vocab.map((vocabItem) => vocabItem.reading),
  );

  return [...new Set([...readings, ...FALLBACK_DISTRACTOR_READINGS])]
    .map(asString)
    .filter((reading) => reading && reading !== correctReading);
}

function normalizeReadingChoices(question, allowed, deck) {
  const incomingChoices =
    question.choices && typeof question.choices === 'object' ? question.choices : {};
  const originalAnswer = CHOICE_LABELS.includes(question.answer) ? question.answer : 'A';
  const existingCorrectLabel = CHOICE_LABELS.find(
    (label) => asString(incomingChoices[label]) === allowed.reading,
  );
  const correctLabel = existingCorrectLabel || originalAnswer;
  const candidateReadings = [
    ...CHOICE_LABELS.map((label) => asString(incomingChoices[label])),
    ...collectReadingCandidates(deck, allowed.reading),
  ].filter((reading) => isHiraganaReading(reading));
  const usedReadings = new Set([allowed.reading]);
  const normalizedChoices = {
    [correctLabel]: allowed.reading,
  };

  CHOICE_LABELS.forEach((label) => {
    if (label === correctLabel) {
      return;
    }

    const nextReading = candidateReadings.find(
      (reading) => reading && !usedReadings.has(reading),
    );

    if (nextReading) {
      usedReadings.add(nextReading);
      normalizedChoices[label] = nextReading;
    }
  });

  question.target_vocab_reading = allowed.reading;
  question.answer = correctLabel;
  question.answer_reading = allowed.reading;
  question.choices = normalizedChoices;
}

function shuffleAnswerPositions(question) {
  const entries = CHOICE_LABELS.map((label) => ({
    label,
    reading: question.choices[label],
  }));
  const shuffled = shuffleArray(entries);
  const newChoices = {};
  let correctLabel = 'A';

  shuffled.forEach(({ reading }, index) => {
    const newLabel = CHOICE_LABELS[index];
    newChoices[newLabel] = reading;
    if (reading === question.answer_reading) correctLabel = newLabel;
  });

  question.choices = newChoices;
  question.answer = correctLabel;
}

function finalizeQuestion(question, allowed, deck) {
  const usedFallbackSentence = normalizeSentenceParts(question, allowed);
  const usedVocabFallback = normalizeSentenceVocabWords(question, allowed, deck);
  normalizeReadingChoices(question, allowed, deck);

  const choices = question.choices || {};
  if (choices[question.answer] !== allowed.reading) return null;
  if (new Set(CHOICE_LABELS.map((label) => choices[label])).size !== 4) return null;
  if (!CHOICE_LABELS.every((label) => isHiraganaReading(choices[label]))) return null;

  question.target_kanji = allowed.kanji;
  question.target_vocab = allowed.word;
  question.jlpt = allowed.jlpt || question.jlpt || '';
  question.target_vocab_reading = allowed.reading;
  question.answer_reading = allowed.reading;

  if (allowed.translation) {
    question.target_vocab_translation = allowed.translation;
  } else if (typeof question.target_vocab_translation !== 'string') {
    question.target_vocab_translation = allowed.translation || '';
  }

  if (typeof question.short_explanation !== 'string') {
    question.short_explanation = '';
  }

  if (
    typeof question.sentence_translation !== 'string'
    || usedFallbackSentence
    || usedVocabFallback
  ) {
    question.sentence_translation = '';
  }

  if (typeof question.question !== 'string' || !question.question.trim()) {
    question.question = '\u304d\u3044\u308d\u306e\u3053\u3068\u3070\u306e\u3088\u307f\u304b\u305f\u306f\u3069\u308c\u3067\u3059\u304b\u3002';
  }

  shuffleAnswerPositions(question);
  return question;
}

function validateQuiz(quiz, deck, requestedCount) {
  const allowedByWord = buildAllowedReadingMap(deck);

  if (!quiz || quiz.question_type !== 'kanji_reading' || !Array.isArray(quiz.questions)) {
    throw new Error('Invalid quiz shape.');
  }

  const seenVocab = new Set();
  const validQuestions = [];

  quiz.questions.forEach((rawQuestion) => {
    const targetVocab = asString(rawQuestion.target_vocab);
    if (!targetVocab || seenVocab.has(targetVocab)) return;

    const allowed = allowedByWord.get(targetVocab);
    if (!allowed) return;

    const processed = finalizeQuestion({ ...rawQuestion }, allowed, deck);
    if (!processed) return;

    seenVocab.add(targetVocab);
    validQuestions.push(processed);
  });

  const minRequired = Math.max(1, Math.ceil(requestedCount * MIN_VALID_RATIO));
  if (validQuestions.length === 0) {
    throw new Error('No valid questions could be built from the model output.');
  }
  if (validQuestions.length < minRequired) {
    throw new Error(`Only ${validQuestions.length} of ${requestedCount} questions passed validation.`);
  }

  quiz.questions = validQuestions.slice(0, requestedCount).map((question, index) => ({
    ...question,
    id: `q${index + 1}`,
  }));

  return quiz;
}

export function buildKanjiReadingPrompt({
  deck,
  questionCount = 10,
  choiceCount = 4,
  explanationLanguage = 'id',
}) {
  const explanationLanguageConfig =
    EXPLANATION_LANGUAGES[explanationLanguage] || EXPLANATION_LANGUAGES.id;
  const explanationLanguageName = explanationLanguageConfig.name;

  return `
You are a JLPT Japanese teacher and quiz generator.

Task:
Generate Japanese sentence-based multiple-choice quiz questions that test the learner's ability to read highlighted kanji vocabulary in context.

Important language rule:
- The instructions in this prompt are in English.
- The generated quiz title, question text, target vocabulary, and choices must be in Japanese.
- The question text must be Japanese.
- The short_explanation must be in ${explanationLanguageName}.
- The target_vocab_translation must be in ${explanationLanguageName}.
- The sentence_translation must be in ${explanationLanguageName}.
- ${explanationLanguageConfig.instruction}
- Do not output Indonesian or English inside the Japanese question text or choices, except JSON field names, target_vocab_translation, sentence_translation, and short_explanation.

Core quiz rules:
- Generate exactly ${questionCount} questions when at least ${questionCount} valid input vocabulary items are available.
- Generate fewer questions only when fewer valid input vocabulary items are available.
- Each question must have exactly ${choiceCount} choices.
- Choices must be labeled A, B, C, D.
- Each question must have exactly one correct answer.
- The quiz type is kanji vocabulary reading.
- The question should ask for the reading of the highlighted vocabulary word inside a sentence.
- Use this Japanese question style:
  \u304d\u3044\u308d\u306e\u3053\u3068\u3070\u306e\u3088\u307f\u304b\u305f\u306f\u3069\u308c\u3067\u3059\u304b\u3002
- Keep the question text in hiragana so it does not introduce extra kanji.

Strict data rules:
- Use ONLY vocab.word values from the input data as target vocabulary.
- Do NOT invent new vocabulary words.
- Vocab items may contain kanji beyond the selected kanji, as long as the vocab.word is present in the input data.
- Do NOT create questions from words outside the input data.
- The target vocabulary must contain the selected target kanji.
- The highlighted target must be the full target vocabulary word, not a single kanji extracted from it.
- Do not split a vocabulary word into component kanji for sentence_target.
- The correct answer must exactly match the input vocab.reading.
- Copy target_vocab_reading, answer_reading, and the correct choice exactly from input vocab.reading.
- Do not infer another possible reading if it differs from input vocab.reading.
- If a vocabulary item has no reading, skip it.
- Do not modify the target vocab reading.
- Each vocab item may include vocab.translation from the selected app language.
- When vocab.translation is provided, copy or lightly normalize it for target_vocab_translation instead of translating from scratch.
- Translate the target vocabulary meaning into ${explanationLanguageName} for target_vocab_translation when vocab.translation is missing.
- Translate the full Japanese sentence into ${explanationLanguageName} for sentence_translation.

Sentence context rules:
- Create a simple natural Japanese sentence for each question.
- Split the sentence into sentence_before, sentence_target, and sentence_after.
- sentence_target must exactly equal target_vocab.
- sentence_before + sentence_target + sentence_after must form one complete Japanese sentence.
- Each sentence must include at least ${MIN_SENTENCE_VOCAB} different vocab.word values from the input data when at least ${MIN_SENTENCE_VOCAB} input vocabulary items are available.
- If fewer than ${MIN_SENTENCE_VOCAB} input vocabulary items are available, include all available input vocabulary items in the sentence.
- The included vocab words must come from the random selected input deck only.
- sentence_vocab_words must list every input vocab.word used in the sentence.
- sentence_vocab_words must include target_vocab.
- Highlight only sentence_target in the UI. Other vocab words should remain inside sentence_before or sentence_after.
- You may use natural Japanese kanji in the sentence context when it helps the sentence sound natural.
- Prefer simple JLPT-style Japanese around the target vocabulary.
- Example shape: sentence_before "", sentence_target "{vocab_word}", sentence_after "\u3068{other_vocab_word}\u3068{third_vocab_word}\u3067\u3059\u3002"

Distractor rules:
- Wrong choices must be plausible Japanese readings written in hiragana.
- Wrong choices must not equal the correct reading.
- Wrong choices should be based on:
  1. Mixing kunyomi and onyomi from the provided kanji data.
  2. Slight variations of the correct reading.
  3. Readings from other input vocabulary items.
- Do not use random non-Japanese strings.
- Do not use romaji.

Question selection rules:
- Create at most 1 question per vocab item.
- Prefer vocabulary from the selected vocab list.
- Try to distribute questions across different target kanji when possible.
- If there are fewer valid vocab items than ${questionCount}, generate fewer questions.

Output rules:
- Return structured JSON matching the schema.
- sentence_translation must translate sentence_before + target_vocab + sentence_after into ${explanationLanguageName}.
- short_explanation must be natural ${explanationLanguageName}, based on the provided target kanji and exact vocab reading.
- distractors must be exactly three plausible hiragana wrong readings.

Input data:
${JSON.stringify(deck)}
`.trim();
}

function extractText(message) {
  return message.content
    .filter((content) => content.type === 'text')
    .map((content) => content.text)
    .join('\n')
    .trim();
}

function extractJsonObjectText(text) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  let depth = 0;
  let inString = false;
  let escaped = false;

  if (firstBrace === -1) {
    return candidate;
  }

  for (let index = firstBrace; index < candidate.length; index += 1) {
    const char = candidate[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return candidate.slice(firstBrace, index + 1);
      }
    }
  }

  return candidate.slice(firstBrace);
}

function parseQuizJson(text) {
  return JSON.parse(extractJsonObjectText(text));
}

function mapParsedQuiz(parsed) {
  return {
    quiz_title: asString(parsed?.quiz_title) || '\u8aad\u307f\u65b9\u30af\u30a4\u30ba',
    question_type: 'kanji_reading',
    questions: (parsed?.questions || []).map((question) => {
      const distractors = Array.isArray(question.distractors)
        ? question.distractors.map(asString).filter(Boolean)
        : [];
      const choices = {};
      CHOICE_LABELS.forEach((label, index) => {
        if (distractors[index]) choices[label] = distractors[index];
      });
      return {
        target_vocab: asString(question.target_vocab),
        sentence_before: asString(question.sentence_before),
        sentence_target: asString(question.target_vocab),
        sentence_after: asString(question.sentence_after),
        sentence_translation: asString(question.sentence_translation),
        short_explanation: asString(question.short_explanation),
        choices,
        answer: 'A',
      };
    }),
  };
}

export async function generateKanjiReadingQuiz({
  deck,
  questionCount = 10,
  explanationLanguage = 'id',
  model,
}) {
  const trustedDeck = sanitizeDeckWithServerData(deck, explanationLanguage);
  const safeDeck = normalizeDeck(trustedDeck);
  const resolvedModel = resolveModel(model);
  const safeQuestionCount = Math.min(
    clampQuestionCount(questionCount),
    safeDeck.reduce((total, item) => total + item.vocab.length, 0),
  );

  if (safeDeck.length === 0 || safeQuestionCount === 0) {
    throw new Error('No valid kanji vocabulary was provided.');
  }

  const prompt = buildKanjiReadingPrompt({
    deck: safeDeck,
    questionCount: safeQuestionCount,
    choiceCount: 4,
    explanationLanguage,
  });

  const requestParams = {
    model: resolvedModel,
    max_tokens: 16_000,
    system: [
      {
        type: 'text',
        text: `
You are a careful JLPT Japanese quiz generator.

Follow the user's prompt exactly.
Use only the provided input data.
Never invent target vocabulary.
Never invent target readings.
The quiz title and sentence parts must be in Japanese.
The short_explanation and sentence_translation fields must follow the requested explanation language.
`.trim(),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    output_config: {
      format: jsonSchemaOutputFormat(QUIZ_OUTPUT_SCHEMA),
    },
  };

  const message = await anthropicClient.messages.parse(requestParams);

  if (message.usage) {
    console.log('[quiz] token usage', JSON.stringify(message.usage));
  }

  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude response was truncated (max_tokens). Try fewer questions.');
  }
  if (message.stop_reason === 'refusal') {
    throw new Error('Claude refused to generate the quiz.');
  }
  if (message.stop_reason && message.stop_reason !== 'end_turn') {
    throw new Error(`Quiz generation stopped: ${message.stop_reason}`);
  }

  if (!message.parsed_output) {
    try {
      const fallback = mapParsedQuiz(parseQuizJson(extractText(message)));
      return validateQuiz(fallback, safeDeck, safeQuestionCount);
    } catch (error) {
      throw new Error(`Claude returned an invalid quiz: ${error.message}`);
    }
  }

  try {
    return validateQuiz(mapParsedQuiz(message.parsed_output), safeDeck, safeQuestionCount);
  } catch (error) {
    throw new Error(`Claude returned an invalid quiz: ${error.message}`);
  }
}
