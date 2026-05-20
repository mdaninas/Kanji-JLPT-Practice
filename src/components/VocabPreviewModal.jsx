import { LEVEL_LABEL_BY_VALUE } from '../constants.js';
import { ReadingLines } from './ReadingLines.jsx';

export function VocabPreviewModal({ t, previewKanji, onClose }) {
  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="vocabModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vocab-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">
              {LEVEL_LABEL_BY_VALUE[previewKanji.jlpt]} - {previewKanji.strokeCount || '-'}{' '}
              {t('strokes')}
            </p>
            <h2 id="vocab-preview-title">
              {t('vocabPreviewTitle', { kanji: previewKanji.character })}
            </h2>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t('close')}>
            x
          </button>
        </div>

        <div className="previewHero">
          <span className="previewGlyph">{previewKanji.character}</span>
          <div>
            <h3>{previewKanji.meanings.slice(0, 3).join(', ') || t('fallbackMeaning')}</h3>
            <ReadingLines kanji={previewKanji} maxReadings={6} />
            <p className="modalIntro">{t('vocabPreviewSubtitle')}</p>
          </div>
        </div>

        {previewKanji.vocab.length === 0 ? (
          <div className="quietState modalEmpty">{t('noVocab')}</div>
        ) : (
          <div className="vocabPreviewList">
            {previewKanji.vocab.map((vocab) => (
              <div className="vocabPreviewItem" key={vocab.id}>
                <strong>{vocab.word}</strong>
                <span><b>{t('soundLabel')}</b>{vocab.reading}</span>
                {vocab.translation && (
                  <span><b>{t('wordTranslation')}</b>{vocab.translation}</span>
                )}
                <em>{LEVEL_LABEL_BY_VALUE[vocab.level]}</em>
              </div>
            ))}
          </div>
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
