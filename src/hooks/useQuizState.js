import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_QUIZ_MODEL,
  MAX_RANDOM_VOCAB_PER_KANJI,
  isSupportedQuizModel,
} from '../constants.js';
import {
  buildQuizPayload,
  classifyQuizError,
  countPayloadVocab,
  resolveQuizErrorKey,
  sampleItems,
} from '../utils.js';

export function useQuizState({
  t,
  language,
  selectedStudySet,
  selectedKanji,
  preferredVocabLevels,
  onPreferredVocabLevelsChange,
  quizModel,
  onRecordQuizResults,
  onRecordSession,
  quizCache,
}) {
  const [randomVocabDeck, setRandomVocabDeck] = useState([]);
  const [readingQuiz, setReadingQuiz] = useState(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [preferredVocabLevelsLocal, setPreferredVocabLevelsLocal] = useState(preferredVocabLevels);
  const [isFromCache, setIsFromCache] = useState(false);
  const [allQuestions, setAllQuestions] = useState([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const recordedRef = useRef(false);
  const abortRef = useRef(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  const questions = readingQuiz?.questions || [];
  const activeQuestion = questions[activeQuestionIndex] || null;
  const allAnswered = questions.length > 0 && questions.every((q) => quizAnswers[q.id]);

  function togglePreferredVocabLevel(level) {
    setPreferredVocabLevelsLocal((current) => {
      const next = current.includes(level)
        ? current.filter((item) => item !== level)
        : [...current, level].sort((a, b) => b - a);
      onPreferredVocabLevelsChange?.(next);
      return next;
    });
    setRandomVocabDeck([]);
  }

  function pickRandomVocabForKanji(vocabOptions) {
    if (preferredVocabLevelsLocal.length === 0) {
      return sampleItems(vocabOptions, MAX_RANDOM_VOCAB_PER_KANJI);
    }
    const preferredSet = new Set(preferredVocabLevelsLocal);
    const preferred = vocabOptions.filter((v) => preferredSet.has(v.level));
    const fallback = vocabOptions.filter((v) => !preferredSet.has(v.level));
    const picked = sampleItems(preferred, MAX_RANDOM_VOCAB_PER_KANJI);
    if (picked.length >= MAX_RANDOM_VOCAB_PER_KANJI) return picked;
    return [...picked, ...sampleItems(fallback, MAX_RANDOM_VOCAB_PER_KANJI - picked.length)];
  }

  function generateRandomVocabDeck() {
    setReadingQuiz(null);
    setQuizAnswers({});
    setQuizError('');
    setActiveQuestionIndex(0);
    setRandomVocabDeck(
      selectedStudySet.map((kanji) => ({
        ...kanji,
        vocab: pickRandomVocabForKanji(kanji.vocab),
      })),
    );
  }

  async function generateReadingQuiz() {
    const quizPayload = buildQuizPayload({ selectedStudySet, randomVocabDeck, selectedKanji });
    const questionCount = Math.min(10, countPayloadVocab(quizPayload));

    setIsQuizLoading(true);
    setQuizError('');
    setReadingQuiz(null);
    setQuizAnswers({});
    setActiveQuestionIndex(0);
    setIsReviewMode(false);
    setIsFromCache(false);
    recordedRef.current = false;

    const safeQuizModel = isSupportedQuizModel(quizModel) ? quizModel : DEFAULT_QUIZ_MODEL;

    if (quizCache) {
      const cached = quizCache.get(quizPayload, language, safeQuizModel);
      if (cached) {
        setReadingQuiz(cached);
        setAllQuestions(cached.questions || []);
        setIsFromCache(true);
        setIsQuizLoading(false);
        return;
      }
    }

    abortRef.current?.abort();
    let data = null;
    let httpStatus = 0;
    let timedOut = false;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60_000);
    try {
      const requestBody = {
        deck: quizPayload,
        explanationLanguage: language,
        questionCount,
        model: safeQuizModel,
      };
      const response = await fetch('/api/generate-reading-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      httpStatus = response.status;
      const responseText = await response.text();
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = null;
        }
      }
      if (!response.ok) throw new Error(data?.error || 'Failed to generate quiz.');
      setReadingQuiz(data.quiz);
      setAllQuestions(data.quiz.questions || []);
      if (quizCache) quizCache.set(quizPayload, language, safeQuizModel, data.quiz);
    } catch (error) {
      if (error.name === 'AbortError') {
        if (timedOut && !unmountedRef.current) {
          setQuizError(t(resolveQuizErrorKey('quizErrorTimeout')));
        }
        return;
      }
      const errorKey = classifyQuizError(error, data, httpStatus);
      const retryAfter = data?.retryAfter;
      const resolvedKey = resolveQuizErrorKey(errorKey);
      setQuizError(
        errorKey === 'quizErrorRateLimit' && retryAfter
          ? t('quizErrorRateLimitRetry', { seconds: retryAfter })
          : t(resolvedKey),
      );
    } finally {
      clearTimeout(timeoutId);
      if (!unmountedRef.current) setIsQuizLoading(false);
    }
  }

  function startReviewMode() {
    const wrong = allQuestions.filter((q) => quizAnswers[q.id] && quizAnswers[q.id] !== q.answer);
    if (wrong.length === 0) return;
    setReadingQuiz({ ...readingQuiz, questions: wrong });
    setQuizAnswers({});
    setActiveQuestionIndex(0);
    setIsReviewMode(true);
    recordedRef.current = false;
  }

  function handleAnswer(questionId, label) {
    setQuizAnswers((current) => {
      if (current[questionId]) return current;
      return { ...current, [questionId]: label };
    });
  }

  function handleNext() {
    if (activeQuestionIndex >= questions.length - 1) return;
    const nextId = questions[activeQuestionIndex + 1]?.id;
    setActiveQuestionIndex((index) => index + 1);
    requestAnimationFrame(() => {
      document.getElementById(`q-${nextId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  useEffect(() => {
    if (allAnswered && questions.length > 0 && !recordedRef.current) {
      recordedRef.current = true;
      onRecordQuizResults(questions, quizAnswers);
      if (!isReviewMode && onRecordSession) onRecordSession(questions, quizAnswers);
    }
  }, [allAnswered, isReviewMode]);

  return {
    randomVocabDeck,
    readingQuiz,
    isQuizLoading,
    quizError,
    quizAnswers,
    activeQuestionIndex,
    setActiveQuestionIndex,
    preferredVocabLevelsLocal,
    isFromCache,
    isReviewMode,
    questions,
    activeQuestion,
    allAnswered,
    togglePreferredVocabLevel,
    generateRandomVocabDeck,
    generateReadingQuiz,
    startReviewMode,
    handleAnswer,
    handleNext,
  };
}
