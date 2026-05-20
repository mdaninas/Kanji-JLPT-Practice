import { FREQ_BADGE_LIMIT, KANJI_SORT_MODES } from '../utils.js';
import { SkeletonGrid } from './SkeletonTile.jsx';

export function KanjiShelf({
  t,
  activeLevelLabel,
  filteredKanji,
  selectedSet,
  canPickMore,
  isKanjiLoading,
  isVocabLoading,
  loadError,
  query,
  sortMode,
  onSortChange,
  onQueryChange,
  onToggleKanji,
  onPickRandom,
  onReset,
  getVocabForKanji,
  getKanjiStatus,
}) {
  return (
    <section className="kanjiShelf" aria-labelledby="shelf-title">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">COLLECTION · {activeLevelLabel.toUpperCase()}</p>
          <h2 id="shelf-title">{t('shelfTitle')}</h2>
        </div>
        <div className="deckActions">
          <button
            type="button"
            className="paperButton"
            onClick={onReset}
            disabled={selectedSet.size === 0}
          >
            {t('reset')}
          </button>
          <button
            type="button"
            className="primaryButton"
            onClick={onPickRandom}
            disabled={isKanjiLoading || filteredKanji.length === 0}
          >
            {t('random')}
          </button>
        </div>
      </div>

      <div className="toolRow">
        <label className="searchBox">
          <span>{t('searchLabel')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </label>
        <label className="sortBox">
          <span>{t('sortLabel')}</span>
          <select
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value)}
            disabled={isKanjiLoading}
          >
            <option value={KANJI_SORT_MODES.default}>{t('sortDefault')}</option>
            <option value={KANJI_SORT_MODES.freq}>{t('sortFreq')}</option>
            <option value={KANJI_SORT_MODES.grade}>{t('sortGrade')}</option>
          </select>
        </label>
      </div>

      <div className="statusLine">
        {isKanjiLoading
          ? t('loadingKanji', { level: activeLevelLabel })
          : t('available', { count: filteredKanji.length, level: activeLevelLabel })}
        {isVocabLoading ? ` ${t('loadingVocab')}` : ''}
      </div>

      {loadError && <div className="loadError">{loadError}</div>}

      {isKanjiLoading ? (
        <SkeletonGrid count={15} />
      ) : (
        <div className="kanjiGrid" aria-live="polite">
          {filteredKanji.map((kanji) => {
            const isSelected = selectedSet.has(kanji.character);
            const isDisabled = !isSelected && !canPickMore;
            const vocabCount = getVocabForKanji(kanji.character).length;
            const status = getKanjiStatus(kanji.character);
            const showFreqBadge = kanji.freq <= FREQ_BADGE_LIMIT;

            return (
              <button
                type="button"
                className={`kanjiTile ${isSelected ? 'selected' : ''} ${status !== 'new' ? `status-${status}` : ''}`}
                key={kanji.character}
                onClick={() => onToggleKanji(kanji.character)}
                disabled={isDisabled}
                aria-pressed={isSelected}
              >
                {status === 'mastered' && <span className="statusDot dot-mastered" aria-label="mastered" />}
                {status === 'weak' && <span className="statusDot dot-weak" aria-label="weak" />}
                {status === 'due' && <span className="statusDot dot-due" aria-label="review due" />}
                <span className="kanjiGlyph">{kanji.character}</span>
                <span className="kanjiMeaning">
                  {kanji.meanings[0] || t('fallbackMeaning')}
                </span>
                {(kanji.grade != null || showFreqBadge) && (
                  <span className="kanjiInfoBadges">
                    {kanji.grade != null && (
                      <span className="kanjiBadge gradeBadge">
                        {t('gradeBadge', { grade: kanji.grade })}
                      </span>
                    )}
                    {showFreqBadge && (
                      <span className="kanjiBadge freqBadge">
                        {t('freqBadge', { freq: kanji.freq })}
                      </span>
                    )}
                  </span>
                )}
                <span className="vocabBadge">
                  {t('vocabCount', { count: vocabCount })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
