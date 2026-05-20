export function QuizResult({ t, questions, quizAnswers, onStartReview }) {
  const wrongCount = questions.filter((q) => quizAnswers[q.id] !== q.answer).length;

  return (
    <div className="reviewActions">
      {wrongCount === 0 ? (
        <p className="reviewAllCorrect">🎉 {t('reviewAllCorrect')}</p>
      ) : (
        <button
          type="button"
          className="primaryButton"
          onClick={onStartReview}
        >
          ↻ {t('reviewWrongOnly', { count: wrongCount })}
        </button>
      )}
    </div>
  );
}
