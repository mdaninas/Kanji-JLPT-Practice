import { LEVELS } from '../../constants.js';

export function QuizSetupToolbox({
  t,
  preferredVocabLevelsLocal,
  preferredVocabLevelLabel,
  randomVocabDeck,
  selectedStudySet,
  isVocabLoading,
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
