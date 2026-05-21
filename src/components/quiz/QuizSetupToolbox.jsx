import { LEVELS, QUIZ_MODELS } from '../../constants.js';

export function QuizSetupToolbox({
  t,
  preferredVocabLevelsLocal,
  preferredVocabLevelLabel,
  randomVocabDeck,
  selectedStudySet,
  isVocabLoading,
  quizModel,
  onQuizModelChange,
  onToggleLevel,
  onGenerate,
}) {
  return (
    <div className="modalToolbox">
      <div>
        <p className="eyebrow">{t('preferredVocabLevel')}</p>
        <div className="levelButtons modalLevels" aria-label={t('preferredVocabLevel')}>
          {LEVELS.map((level) => (
            <button
              type="button"
              key={level.value}
              className={preferredVocabLevelsLocal.includes(level.value) ? 'active' : ''}
              onClick={() => onToggleLevel(level.value)}
              aria-pressed={preferredVocabLevelsLocal.includes(level.value)}
            >
              {level.label}
            </button>
          ))}
        </div>
        <p className="modalHint">
          {preferredVocabLevelsLocal.length === 0
            ? t('allVocabLevels')
            : t('preferredHint', { levels: preferredVocabLevelLabel })}
        </p>
      </div>
      {onQuizModelChange && (
        <label className="modelPicker">
          <span className="eyebrow">{t('modelLabel')}</span>
          <select
            value={quizModel}
            onChange={(e) => onQuizModelChange(e.target.value)}
          >
            {QUIZ_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {t(model.labelKey)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="primaryButton modalGenerateButton"
        onClick={onGenerate}
        disabled={selectedStudySet.length === 0 || isVocabLoading}
      >
        {randomVocabDeck.length > 0 ? t('regenerateVocab') : t('generateVocab')}
      </button>
    </div>
  );
}
