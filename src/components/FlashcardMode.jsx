import { useCallback, useEffect, useState } from 'react';
import { LEVEL_LABEL_BY_VALUE } from '../constants.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { SpeakerButton } from './ReadingLines.jsx';

export function FlashcardMode({ t, studySet, onClose, onRecordResult }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [scores, setScores] = useState({});
  const modalRef = useFocusTrap();

  const current = studySet[index];
  const total = studySet.length;

  const goNext = useCallback(() => {
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }, [index, total]);

  const handleAnswer = useCallback(
    (correct) => {
      if (!flipped) return;
      setScores((prev) => ({ ...prev, [current.character]: correct }));
      onRecordResult(current.character, correct);
      goNext();
    },
    [flipped, current, onRecordResult, goNext],
  );

  const handleRestart = useCallback(() => {
    setIndex(0);
    setFlipped(false);
    setDone(false);
    setScores({});
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === ' ' || e.key === 'Enter') {
        if (!flipped) { setFlipped(true); return; }
        if (done) { handleRestart(); return; }
      }
      if (flipped && e.key === 'ArrowRight') handleAnswer(true);
      if (flipped && e.key === 'ArrowLeft') handleAnswer(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, done, handleAnswer, handleRestart, onClose]);

  if (!current) return null;

  return (
    <div className="modalBackdrop" role="presentation" onClick={onClose}>
      <div
        ref={modalRef}
        className="flashcardOverlay"
        role="dialog"
        aria-modal="true"
        aria-label={t('flashcardMode')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flashcardHeader">
          <span className="flashcardCounter">
            {t('flashcardCount', { current: index + 1, total })}
          </span>
          <button type="button" className="paperButton" onClick={onClose}>
            {t('flashcardClose')}
          </button>
        </div>

        {done ? (
          <div className="flashcardDoneScreen">
            <p className="flashcardDoneTitle">{t('flashcardDone')}</p>
            <div className="flashcardDoneStats">
              <span className="flashcardStat stat-got">
                {t('flashcardGotIt')}: {Object.values(scores).filter(Boolean).length}
              </span>
              <span className="flashcardStat stat-practice">
                {t('flashcardPractice')}: {Object.values(scores).filter((v) => !v).length}
              </span>
            </div>
            <button type="button" className="primaryButton" onClick={handleRestart}>
              {t('flashcardRestart')}
            </button>
          </div>
        ) : (
          <div
            className={`flashcard ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setFlipped((f) => !f)}
            aria-label={flipped ? t('flashcardBack') : t('flashcardFront')}
          >
            <div className="flashcardInner">
              <div className="flashcardFace flashcardFront">
                <p className="flashcardHint">{t('flashcardFront')}</p>
                <span className="flashcardGlyph">{current.character}</span>
                <p className="flashcardFlipHint">{t('flashcardFlip')}</p>
              </div>

              <div className="flashcardFace flashcardBack">
                <p className="flashcardHint">{t('flashcardBack')}</p>
                <span className="flashcardGlyph">{current.character}</span>
                <div className="flashcardMeaning">
                  {current.meanings.slice(0, 4).join(', ') || t('fallbackMeaning')}
                </div>
                <div className="flashcardReadings">
                  {current.onReadings.length > 0 && (
                    <span>
                      <strong>{t('onReadings')}</strong>
                      {current.onReadings.slice(0, 4).join('、')}
                      <SpeakerButton
                        text={current.onReadings.slice(0, 4).join('、')}
                        label={t('playAudio')}
                      />
                    </span>
                  )}
                  {current.kunReadings.length > 0 && (
                    <span>
                      <strong>{t('kunReadings')}</strong>
                      {current.kunReadings.slice(0, 4).join('、')}
                      <SpeakerButton
                        text={current.kunReadings.slice(0, 4).join('、')}
                        label={t('playAudio')}
                      />
                    </span>
                  )}
                </div>
                {current.heisig && (
                  <p className="heisigHint">
                    <span className="heisigTag">{t('heisigLabel')}</span>
                    <em>{current.heisig}</em>
                  </p>
                )}
                <div className="flashcardMeta">
                  {LEVEL_LABEL_BY_VALUE[current.jlpt]} · {current.strokeCount || '-'} strokes
                </div>
              </div>
            </div>
          </div>
        )}

        {flipped && !done && (
          <div className="flashcardButtons">
            <button
              type="button"
              className="flashcardBtn btn-practice"
              onClick={() => handleAnswer(false)}
            >
              <span>{t('flashcardPractice')}</span>
              <span style={{ fontSize: 9, opacity: 0.7, letterSpacing: 2 }}>← AGAIN · 1</span>
            </button>
            <button
              type="button"
              className="flashcardBtn btn-got"
              onClick={() => handleAnswer(true)}
            >
              <span>{t('flashcardGotIt')}</span>
              <span style={{ fontSize: 9, opacity: 0.7, letterSpacing: 2 }}>GOOD · 2 →</span>
            </button>
          </div>
        )}

        {!flipped && !done && (
          <p className="flashcardKeyHint">Space / Enter {t('flashcardFlip')}</p>
        )}
        {flipped && !done && (
          <p className="flashcardKeyHint">← {t('flashcardPractice')} &nbsp;·&nbsp; {t('flashcardGotIt')} →</p>
        )}
      </div>
    </div>
  );
}
