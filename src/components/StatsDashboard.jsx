import { useRef } from 'react';
import { LEVELS } from '../constants.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

export function StatsDashboard({
  t,
  stats,
  onReset,
  onClearQuizCache,
  onExport,
  onImport,
  onClose,
}) {
  const accuracy = stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;
  const hasData = stats.totalAnswered > 0 || stats.streak > 0;
  const fileInputRef = useRef(null);
  const modalRef = useFocusTrap();

  function handleReset() {
    if (window.confirm(t('statsResetConfirm'))) onReset();
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        window.alert(t('statsImportError'));
        return;
      }
      if (
        !parsed
        || typeof parsed !== 'object'
        || parsed.schemaVersion !== 1
        || typeof parsed.progress !== 'object'
        || typeof parsed.stats !== 'object'
      ) {
        window.alert(t('statsImportError'));
        return;
      }
      if (!window.confirm(t('statsImportConfirm'))) return;
      onImport(parsed);
    };
    reader.onerror = () => window.alert(t('statsImportError'));
    reader.readAsText(file);
  }

  return (
    <div className="modalBackdrop" role="presentation" onClick={onClose}>
      <section
        ref={modalRef}
        className="vocabModal statsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">{t('statsButton')}</p>
            <h2 id="stats-title">{t('statsTitle')}</h2>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t('close')}>
            x
          </button>
        </div>

        {!hasData ? (
          <div className="quietState modalEmpty">{t('statsNoData')}</div>
        ) : (
          <>
            <div className="statsGrid">
              <div className="statsCard statsCardStreak">
                <p className="statsLabel">{t('statsStreak')}</p>
                <p className="statsValue">
                  {t('statsStreakDays', { count: stats.streak })}
                </p>
                <p className="statsSub">
                  best {stats.longestStreak} · last {stats.lastStudyDate || '—'}
                </p>
              </div>

              <div className="statsCard statsCardAccuracy">
                <p className="statsLabel">{t('statsAccuracy')}</p>
                <p className="statsValue">{accuracy}%</p>
                <p className="statsSub">
                  {t('statsAccuracyAll', {
                    correct: stats.totalCorrect,
                    total: stats.totalAnswered,
                    percent: accuracy,
                  })}
                </p>
              </div>
            </div>

            <div className="statsByLevel">
              <p className="eyebrow">{t('statsByLevel')}</p>
              <div className="statsLevelGrid">
                {LEVELS.map((level) => {
                  const entry = stats.byLevel[level.value] || { correct: 0, answered: 0 };
                  const lvlAcc = entry.answered > 0
                    ? Math.round((entry.correct / entry.answered) * 100)
                    : 0;
                  return (
                    <div className="statsLevelCard" key={level.value}>
                      <strong>{level.label}</strong>
                      <span className="statsLevelValue">{lvlAcc}%</span>
                      <span className="statsLevelDetail">
                        {entry.correct}/{entry.answered}
                      </span>
                      <div className="statsLevelBar">
                        <div
                          className="statsLevelBarFill"
                          style={{ width: `${lvlAcc}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {stats.sessions.length > 0 && (
              <div className="statsSessions">
                <p className="eyebrow">{t('statsLastSession')}</p>
                <div className="statsSessionList">
                  {stats.sessions.slice(0, 7).map((session, i) => {
                    const acc = session.answered > 0
                      ? Math.round((session.correct / session.answered) * 100)
                      : 0;
                    return (
                      <div className="statsSessionItem" key={`${session.date}-${i}`}>
                        <span className="statsSessionDate">{session.date}</span>
                        <span className="statsSessionScore">
                          {session.correct}/{session.answered}
                        </span>
                        <span className="statsSessionAcc">{acc}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div className="modalFooter statsFooter">
          {onExport && (
            <button type="button" className="paperButton" onClick={onExport}>
              {t('statsExport')}
            </button>
          )}
          {onImport && (
            <button type="button" className="paperButton" onClick={handleImportClick}>
              {t('statsImport')}
            </button>
          )}
          {onClearQuizCache && (
            <button type="button" className="paperButton" onClick={onClearQuizCache}>
              {t('clearQuizCache')}
            </button>
          )}
          <button type="button" className="paperButton dangerButton" onClick={handleReset}>
            {t('statsReset')}
          </button>
          <button type="button" className="paperButton" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </section>
    </div>
  );
}
