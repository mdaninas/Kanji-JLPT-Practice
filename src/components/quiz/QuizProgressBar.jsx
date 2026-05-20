export function QuizProgressBar({ t, title, isFromCache, isReviewMode }) {
  return (
    <>
      <div className="quizPanelHeader">
        <div>
          <p className="eyebrow">{t('quizSectionTitle')}</p>
          <h3 id="quiz-title">{title}</h3>
        </div>
        <div className="quizBadges">
          {isFromCache && (
            <span className="quizCacheBadge">{t('quizFromCache')}</span>
          )}
          {isReviewMode && (
            <span className="quizReviewBadge">↻ Review</span>
          )}
        </div>
      </div>
      <p className="keyboardHint">{t('keyboardHint')}</p>
    </>
  );
}
