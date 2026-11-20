import { LEVEL_LABEL_BY_VALUE, MAX_SELECTED_KANJI } from '../constants.js';
import { Icon } from './Icon.jsx';
import { ReadingLines } from './ReadingLines.jsx';

export function DeckPanel({
  t,
  selectedStudySet,
  canOpenVocabPicker,
  onOpenVocabPicker,
  onOpenPreview,
  onClearDeck,
  onToggleKanji,
  onOpenFlashcard,
  onOpenStrokeOrder,
  onOpenBreakdown,
  getProgressStats,
  getKanjiStatus,
}) {
  const characters = selectedStudySet.map((k) => k.character);
  const hasCards = characters.length > 0;
  const stats = getProgressStats(characters);
  const hasProgress = stats.mastered > 0 || stats.weak > 0 || stats.due > 0;

  return (
    <aside className="deckPanel" id="studyDeck" aria-labelledby="deck-title">
      <div className="deckHeading">
        <div className="deckTitleGroup">
          <span className="deckSymbol"><Icon name="cards" size={19} /></span>
          <h2 id="deck-title">{t('deckTitle')}</h2>
        </div>
        <span className="deckCapacity" role="status">
          <span aria-hidden="true"><strong>{characters.length}</strong> / {MAX_SELECTED_KANJI}</span>
          <span className="visuallyHidden">
            {t('deckCounterLabel', { current: characters.length, max: MAX_SELECTED_KANJI })}
          </span>
        </span>
      </div>
      <div className="deckCapacityTrack" aria-hidden="true">
        {Array.from({ length: MAX_SELECTED_KANJI }, (_, index) => (
          <span key={index} className={index < characters.length ? 'filled' : undefined} />
        ))}
      </div>

      {hasCards && (
        <div className="deckTools">
          <button type="button" className="clearDeckButton" onClick={onClearDeck}>
            {t('reset')}
          </button>
        </div>
      )}

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
            {characters.map((char) => {
              const status = getKanjiStatus(char);
              return (
                <div
                  key={char}
                  className={`progressSegment seg-${status}`}
                  title={char}
                />
              );
            })}
          </div>
        </div>
      )}

      {!hasCards ? (
        <div className="deckEmpty">
          <div className="emptyCardStack" aria-hidden="true">
            <span lang="ja">字</span>
          </div>
          <p>{t('emptyDeck')}</p>
        </div>
      ) : (
        <div className="deckList">
          {selectedStudySet.map((kanji) => (
            <article className="deckCard" key={kanji.character}>
              <button
                type="button"
                className="removeDeckButton"
                onClick={() => onToggleKanji(kanji.character)}
                aria-label={t('removeKanjiLabel', { kanji: kanji.character })}
                title={t('removeKanjiLabel', { kanji: kanji.character })}
              >
                <Icon name="close" size={15} />
              </button>
              <div className="deckKanji">
                <span className="deckGlyph" lang="ja">{kanji.character}</span>
                <div>
                  <h3>{kanji.meanings.slice(0, 2).join(', ') || t('fallbackMeaning')}</h3>
                  <p>
                    {LEVEL_LABEL_BY_VALUE[kanji.jlpt]} · {kanji.strokeCount || '-'}{' '}
                    {t('strokes')}
                  </p>
                  <ReadingLines t={t} kanji={kanji} maxReadings={4} speakLabel={t('playAudio')} />
                  {kanji.heisig && (
                    <p className="heisigHint">
                      <span className="heisigTag">{t('heisigLabel')}</span>
                      <em>{kanji.heisig}</em>
                    </p>
                  )}
                </div>
              </div>
              <div className="deckCardFooter">
                <span className="deckVocabCount">{t('vocabCount', { count: kanji.vocab.length })}</span>
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
                  <Icon name="pen" size={16} />
                </button>
                <button
                  type="button"
                  className="breakdownBtn"
                  onClick={() => onOpenBreakdown(kanji.character)}
                  title={t('breakdown')}
                  aria-label={t('breakdown')}
                >
                  <Icon name="components" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="deckActions">
        <button
          type="button"
          className="paperButton"
          onClick={onOpenFlashcard}
          disabled={!hasCards}
        >
          <Icon name="cards" size={16} />
          {t('flashcards')}
        </button>
        <button
          type="button"
          className="primaryButton"
          onClick={onOpenVocabPicker}
          disabled={!canOpenVocabPicker}
        >
          {t('openVocabPicker')}
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </aside>
  );
}
