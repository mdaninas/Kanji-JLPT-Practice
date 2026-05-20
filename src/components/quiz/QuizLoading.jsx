export function QuizLoading({ t }) {
  return (
    <div className="loadingQuizPanel" role="status" aria-live="polite">
      <span className="loadingSpinner" />
      <strong>{t('generatingQuiz')}</strong>
    </div>
  );
}
