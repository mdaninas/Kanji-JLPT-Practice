import Anthropic from '@anthropic-ai/sdk';

export const SUPPORTED_MODELS = Object.freeze([
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
]);

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function resolveModel(requestedModel) {
  if (SUPPORTED_MODELS.includes(requestedModel)) {
    return requestedModel;
  }
  const envModel = process.env.ANTHROPIC_MODEL;
  if (SUPPORTED_MODELS.includes(envModel)) {
    return envModel;
  }
  return DEFAULT_MODEL;
}

const MAX_KANJI_ITEMS = 10;
const MAX_VOCAB_PER_KANJI = 10;
const MAX_QUESTIONS = 30;
const MIN_SENTENCE_VOCAB = 3;
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

function normalizeDeck(deck) {
  return deck.slice(0, MAX_KANJI_ITEMS).map((kanjiItem) => {
    const kanji = asString(kanjiItem.kanji);

    return {
      kanji,
      jlpt: asString(kanjiItem.jlpt),
      meanings: Array.isArray(kanjiItem.meanings)
        ? kanjiItem.meanings.map(asString).filter(Boolean).slice(0, 4)
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
              word: asString(vocabItem.word),
              reading: asString(vocabItem.reading),
              translation: asString(vocabItem.translation),
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
      allowed.set(`${kanjiItem.kanji}\u0000${vocabItem.word}`, {
        kanji: kanjiItem.kanji,
        translation: vocabItem.translation,
        word: vocabItem.word,
        reading: vocabItem.reading,
      });
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
  const target = asString(question.sentence_target);
  const after = asString(question.sentence_after);
  const shouldFallback =
    target !== allowed.word ||
    !before && !after;

  if (shouldFallback) {
    Object.assign(question, fallbackSentenceParts(allowed.word));
    return true;
  }

  question.sentence_before = before;
  question.sentence_target = target;
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
  ];
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

function validateQuiz(quiz, deck) {
  const allowedReadings = buildAllowedReadingMap(deck);

  if (!quiz || quiz.question_type !== 'kanji_reading' || !Array.isArray(quiz.questions)) {
    throw new Error('Invalid quiz shape.');
  }

  quiz.questions.forEach((question, index) => {
    const allowed = allowedReadings.get(`${question.target_kanji}\u0000${question.target_vocab}`);

    if (!allowed) {
      throw new Error(`Question ${index + 1} uses vocabulary outside the selected deck.`);
    }

    if (question.target_kanji !== allowed.kanji) {
      throw new Error(`Question ${index + 1} uses the wrong target kanji.`);
    }

    const usedFallbackSentence = normalizeSentenceParts(question, allowed);
    const usedVocabFallback = normalizeSentenceVocabWords(question, allowed, deck);
    normalizeReadingChoices(question, allowed, deck);

    if (!CHOICE_LABELS.includes(question.answer)) {
      throw new Error(`Question ${index + 1} has an invalid answer label.`);
    }

    const choices = question.choices || {};

    if (choices[question.answer] !== allowed.reading) {
      throw new Error(`Question ${index + 1} answer does not match the source reading.`);
    }

    if (new Set(CHOICE_LABELS.map((label) => choices[label])).size !== 4) {
      throw new Error(`Question ${index + 1} choices must be unique.`);
    }

    if (allowed.translation) {
      question.target_vocab_translation = allowed.translation;
    } else if (typeof question.target_vocab_translation !== 'string') {
      question.target_vocab_translation = allowed.translation || '';
    }

    if (typeof question.short_explanation !== 'string') {
      question.short_explanation = '';
    }

    if (
      typeof question.sentence_translation !== 'string' ||
      usedFallbackSentence ||
      usedVocabFallback
    ) {
      question.sentence_translation = '';
    }

    if (
      typeof question.question !== 'string' ||
      !question.question.trim()
    ) {
      question.question = '\u304d\u3044\u308d\u306e\u3053\u3068\u3070\u306e\u3088\u307f\u304b\u305f\u306f\u3069\u308c\u3067\u3059\u304b\u3002';
    }
  });

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
- Return valid JSON only.
- Do not wrap the JSON in Markdown.
- Do not add commentary before or after the JSON.
- Do not include trailing commas.
- All quiz content values except target_vocab_translation, sentence_translation, and short_explanation must be Japanese.
- target_vocab_translation must be a concise natural translation in ${explanationLanguageName}, not English unless the selected language is English.
- sentence_translation must translate sentence_before + sentence_target + sentence_after into ${explanationLanguageName}.
- sentence_translation is required and must not be empty.
- short_explanation must be natural ${explanationLanguageName}, based on the provided target kanji and exact vocab reading.
- If the selected explanation language is not Japanese, do not write short_explanation as a Japanese sentence.

Required JSON schema:
{
  "quiz_title": "string in Japanese",
  "question_type": "kanji_reading",
  "questions": [
    {
      "id": "q1",
      "target_kanji": "string",
      "target_vocab": "string",
      "target_vocab_reading": "string",
      "target_vocab_translation": "string in ${explanationLanguageName}",
      "jlpt": "N5 | N4 | N3 | N2 | N1",
      "question": "Japanese string",
      "sentence_before": "Japanese string before the highlighted target",
      "sentence_target": "must exactly equal target_vocab",
      "sentence_after": "Japanese string after the highlighted target",
      "sentence_vocab_words": ["target_vocab and at least two other input vocab.word values when available"],
      "sentence_translation": "translation of the full sentence in ${explanationLanguageName}",
      "choices": {
        "A": "hiragana string",
        "B": "hiragana string",
        "C": "hiragana string",
        "D": "hiragana string"
      },
      "answer": "A | B | C | D",
      "answer_reading": "hiragana string",
      "short_explanation": "string in ${explanationLanguageName}"
    }
  ]
}

Input data:
${JSON.stringify(deck, null, 2)}
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

export async function generateKanjiReadingQuiz({
  deck,
  questionCount = 10,
  explanationLanguage = 'id',
  model,
}) {
  const safeDeck = normalizeDeck(deck);
  const resolvedModel = resolveModel(model);
  const safeQuestionCount = Math.min(
    clampQuestionCount(questionCount),
    safeDeck.reduce((total, item) => total + item.vocab.length, 0),
  );

  if (safeDeck.length === 0 || safeQuestionCount === 0) {
    throw new Error('No valid kanji vocabulary was provided.');
  }

  const client = new Anthropic();
  const prompt = buildKanjiReadingPrompt({
    deck: safeDeck,
    questionCount: safeQuestionCount,
    choiceCount: 4,
    explanationLanguage,
  });

  const message = await client.messages.create({
    model: resolvedModel,
    max_tokens: 4096,
    temperature: 0.3,
    system: `
You are a careful JLPT Japanese quiz generator.

Follow the user's prompt exactly.
Use only the provided input data.
Never invent target vocabulary.
Never invent target readings.
Return valid JSON only.
The quiz title, questions, target vocabulary, and answer choices must be in Japanese.
The short_explanation field must follow the requested explanation language.
`.trim(),
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const text = extractText(message);

  try {
    return validateQuiz(parseQuizJson(text), safeDeck);
  } catch (error) {
    throw new Error(`Claude returned an invalid quiz: ${error.message}`);
  }
}
