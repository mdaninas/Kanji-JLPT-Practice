import { useEffect, useRef, useState } from 'react';
import { MAX_RANDOM_VOCAB_PER_KANJI } from '../constants.js';
import {
  buildQuizPayload,
  classifyQuizError,
  countPayloadVocab,
  sampleItems,
} from '../utils.js';

export function useQuizState({
  t,
  language,
  selectedStudySet,
  selectedKanji,
  preferredVocabLevels,
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

  const questions = readingQuiz?.questions || [];
  const activeQuestion = questions[activeQuestionIndex] || null;
  const allAnswered = questions.length > 0 && questions.every((q) => quizAnswers[q.id]);

  function togglePreferredVocabLevel(level) {
    setPreferredVocabLevelsLocal((current) => {
      if (current.includes(level)) return current.filter((item) => item !== level);
      return [...current, level].sort((a, b) => b - a);
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

    if (quizCache) {
      const cached = quizCache.get(quizPayload, language);
      if (cached) {
        setReadingQuiz(cached);
        setAllQuestions(cached.questions || []);
        setIsFromCache(true);
        setIsQuizLoading(false);
        return;
      }
    }

    let data = null;
    try {
      const response = await fetch('/api/generate-reading-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck: quizPayload, explanationLanguage: language, questionCount }),
      });
      data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate quiz.');
      setReadingQuiz(data.quiz);
      setAllQuestions(data.quiz.questions || []);
      if (quizCache) quizCache.set(quizPayload, language, data.quiz);
    } catch (error) {
      setQuizError(t(classifyQuizError(error, data)));
    } finally {
      setIsQuizLoading(false);
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
    if (activeQuestionIndex < questions.length - 1) {
      setActiveQuestionIndex((i) => i + 1);
      setTimeout(() => {
        const el = document.getElementById(`q-${questions[activeQuestionIndex + 1]?.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } else if (allAnswered && questions.length > 0) {
      onRecordQuizResults(questions, quizAnswers);
    }
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
