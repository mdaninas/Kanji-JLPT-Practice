import { useEffect } from 'react';
import { LEVEL_LABEL_BY_VALUE } from '../constants.js';
import { isValidQuizCandidate } from '../utils.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useQuizState } from '../hooks/useQuizState.js';
import { QuizQuestion } from './quiz/QuizQuestion.jsx';
import { QuizLoading } from './quiz/QuizLoading.jsx';
import { QuizProgressBar } from './quiz/QuizProgressBar.jsx';
import { QuizResult } from './quiz/QuizResult.jsx';
import { QuizSetupToolbox } from './quiz/QuizSetupToolbox.jsx';
import { QuizVocabDeck } from './quiz/QuizVocabDeck.jsx';

const KEY_MAP = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };

export function QuizModal({
  t,
  language,
  selectedStudySet,
  selectedKanji,
  isVocabLoading,
  preferredVocabLevels,
  quizModel,
  onQuizModelChange,
  onClose,
  onRecordQuizResults,
  onRecordSession,
  quizCache,
}) {
  const {
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
  } = useQuizState({
    t,
    language,
    selectedStudySet,
    selectedKanji,
    preferredVocabLevels,
    quizModel,
    onRecordQuizResults,
    onRecordSession,
    quizCache,
  });

  const modalRef = useFocusTrap();

  const llmPayloadVocabCount = randomVocabDeck.reduce(
    (total, kanji) =>
      total + kanji.vocab.filter((vocab) => isValidQuizCandidate(kanji, vocab)).length,
    0,
  );

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') { onClose(); return; }
      if (!activeQuestion || quizAnswers[activeQuestion.id]) {
        if (event.key === 'Enter') handleNext();
        return;
      }
      const label = KEY_MAP[event.key.toLowerCase()];
      if (label) handleAnswer(activeQuestion.id, label);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeQuestion, quizAnswers, onClose]);

  const preferredVocabLevelLabel =
    preferredVocabLevelsLocal.length > 0
      ? preferredVocabLevelsLocal.map((level) => LEVEL_LABEL_BY_VALUE[level]).join(', ')
      : t('allLevels');

  return (
    <div className="modalBackdrop" role="presentation" onClick={onClose}>
      <section
        ref={modalRef}
        className="vocabModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vocab-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">{t('selectedKanjiLabel')}</p>
            <h2 id="vocab-modal-title">{t('vocabPickerTitle')}</h2>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t('close')}>
            x
          </button>
        </div>

        <p className="modalIntro">{t('vocabPickerSubtitle')}</p>

        <QuizSetupToolbox
          t={t}
          preferredVocabLevelsLocal={preferredVocabLevelsLocal}
          preferredVocabLevelLabel={preferredVocabLevelLabel}
          randomVocabDeck={randomVocabDeck}
          selectedStudySet={selectedStudySet}
          isVocabLoading={isVocabLoading}
          quizModel={quizModel}
          onQuizModelChange={onQuizModelChange}
          onToggleLevel={togglePreferredVocabLevel}
          onGenerate={generateRandomVocabDeck}
        />

        {randomVocabDeck.length === 0 ? (
          <div className="quietState modalEmpty">{t('noRandomYet')}</div>
        ) : (
          <>
            <div className="quizActions">
              <button
                type="button"
                className="primaryButton modalGenerateButton"
                onClick={generateReadingQuiz}
                disabled={isQuizLoading || llmPayloadVocabCount === 0}
              >
                {isQuizLoading ? t('generatingQuiz') : t('generateQuiz')}
              </button>
            </div>

            {quizError && <div className="loadError">{quizError}</div>}
            {isQuizLoading && <QuizLoading t={t} />}

            <QuizVocabDeck t={t} randomVocabDeck={randomVocabDeck} isVocabLoading={isVocabLoading} />

            {readingQuiz && (
              <section className="quizPanel" aria-labelledby="quiz-title">
                <QuizProgressBar
                  t={t}
                  title={readingQuiz.quiz_title}
                  isFromCache={isFromCache}
                  isReviewMode={isReviewMode}
                />
                <div className="quizList">
                  {questions.map((question, qi) => (
                    <QuizQuestion
                      key={question.id}
                      t={t}
                      question={question}
                      language={language}
                      selectedAnswer={quizAnswers[question.id]}
                      onAnswer={(label) => {
                        handleAnswer(question.id, label);
                        setActiveQuestionIndex(qi);
                      }}
                      onNext={handleNext}
                      isActive={qi === activeQuestionIndex}
                    />
                  ))}
                </div>
                {allAnswered && !isReviewMode && (
                  <QuizResult
                    t={t}
                    questions={questions}
                    quizAnswers={quizAnswers}
                    onStartReview={startReviewMode}
                  />
                )}
              </section>
            )}
          </>
        )}

        <div className="modalFooter">
          <button type="button" className="paperButton" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </section>
    </div>
  );
}
