import { LEVEL_LABEL_BY_VALUE } from '../../constants.js';
import { ReadingLines } from '../ReadingLines.jsx';

export function QuizVocabDeck({ t, randomVocabDeck, isVocabLoading }) {
  return (
    <div className="modalDeckList">
      {randomVocabDeck.map((kanji, index) => (
        <article className="modalKanjiCard" key={kanji.character}>
          <div className="deckKanji">
            <span className="orderNumber">{index + 1}</span>
            <span className="deckGlyph">{kanji.character}</span>
            <div>
              <h3>{kanji.meanings.slice(0, 2).join(', ') || t('fallbackMeaning')}</h3>
              <p>
                {LEVEL_LABEL_BY_VALUE[kanji.jlpt]} - {kanji.strokeCount || '-'}{' '}
                {t('strokes')}
              </p>
              <ReadingLines kanji={kanji} maxReadings={4} />
            </div>
          </div>
          <div className="vocabList">
            {kanji.vocab.map((vocab) => (
              <div className="vocabItem" key={vocab.id}>
                <strong>{vocab.word}</strong>
                <span>{vocab.reading}</span>
                {vocab.translation && <small>{vocab.translation}</small>}
                <em>{LEVEL_LABEL_BY_VALUE[vocab.level]}</em>
              </div>
            ))}
            {kanji.vocab.length === 0 && (
              <div className="vocabWarning">
                {isVocabLoading ? t('vocabLoadingInline') : t('noVocab')}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
