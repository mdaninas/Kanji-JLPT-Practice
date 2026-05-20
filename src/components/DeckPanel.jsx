import { LEVEL_LABEL_BY_VALUE } from '../constants.js';
import { ReadingLines } from './ReadingLines.jsx';

export function DeckPanel({
  t,
  selectedStudySet,
  isVocabLoading,
  canOpenVocabPicker,
  onOpenVocabPicker,
  onOpenPreview,
  onToggleKanji,
  onOpenFlashcard,
  onOpenStrokeOrder,
  onOpenBreakdown,
  getProgressStats,
}) {
  const characters = selectedStudySet.map((k) => k.character);
  const stats = getProgressStats(characters);
  const hasProgress = stats.mastered > 0 || stats.weak > 0 || stats.due > 0;

  return (
    <aside className="deckPanel" aria-labelledby="deck-title">
      <div className="sectionHeading deckHeading">
        <div>
          <p className="eyebrow">DECK · 手控</p>
          <h2 id="deck-title">{t('deckTitle')}</h2>
        </div>
        <div className="deckActions">
          <button
            type="button"
            className="paperButton compactButton"
            onClick={onOpenFlashcard}
            disabled={selectedStudySet.length === 0}
          >
            {t('flashcardMode')}
          </button>
          <button
            type="button"
            className="primaryButton compactButton"
            onClick={onOpenVocabPicker}
            disabled={!canOpenVocabPicker}
          >
            {t('openVocabPicker')}
          </button>
        </div>
      </div>

      {hasProgress && (
        <div className="progressBar">
          <span className="progressLabel">
            {t('progressStats', {
              mastered: stats.mastered,
              weak: stats.weak,
              due: stats.due,
            })}
          </span>
          <div className="progressSegments">
            {characters.map((char) => (
              <div
                key={char}
                className={`progressSegment seg-${selectedStudySet.find((k) => k.character === char) ? 'active' : 'inactive'}`}
              />
            ))}
          </div>
        </div>
      )}

      {selectedStudySet.length === 0 ? (
        <div className="quietState">{t('emptyDeck')}</div>
      ) : (
        <div className="deckList">
          {selectedStudySet.map((kanji, index) => (
            <article className="deckCard" key={kanji.character}>
              <button
                type="button"
                className="removeDeckButton"
                onClick={() => onToggleKanji(kanji.character)}
                aria-label={`Remove ${kanji.character}`}
              >
                ×
              </button>
              <div className="deckKanji">
                <span className="orderNumber">{String(index + 1).padStart(2, '0')}</span>
                <span className="deckGlyph">{kanji.character}</span>
                <div>
                  <h3>{kanji.meanings.slice(0, 2).join(', ') || t('fallbackMeaning')}</h3>
                  <p>
                    {LEVEL_LABEL_BY_VALUE[kanji.jlpt]} · {kanji.strokeCount || '-'}{' '}
                    {t('strokes')}
                  </p>
                  <ReadingLines kanji={kanji} maxReadings={4} speakLabel={t('playAudio')} />
                  {kanji.heisig && (
                    <p className="heisigHint">
                      <span className="heisigTag">{t('heisigLabel')}</span>
                      <em>{kanji.heisig}</em>
                    </p>
                  )}
                </div>
              </div>
              <div className="deckCardFooter">
                <span>{t('vocabCount', { count: kanji.vocab.length })}</span>
                <button type="button" onClick={() => onOpenPreview(kanji.character)}>
                  {t('viewVocab')}
                </button>
                <button
                  type="button"
                  className="strokeBtn"
                  onClick={() => onOpenStrokeOrder(kanji.character)}
                  title={t('strokeOrder')}
                  aria-label={t('strokeOrder')}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="breakdownBtn"
                  onClick={() => onOpenBreakdown(kanji.character)}
                  title={t('breakdown')}
                  aria-label={t('breakdown')}
                >
                  部
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
