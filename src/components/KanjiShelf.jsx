import { Fragment, useRef, useState } from 'react';
import { LEVEL_LABEL_BY_VALUE, LEVELS, MAX_SELECTED_KANJI } from '../constants.js';
import { FREQ_BADGE_LIMIT, getKanjiMeanings, KANJI_SORT_MODES } from '../utils.js';
import { Icon } from './Icon.jsx';
import { SkeletonGrid } from './SkeletonTile.jsx';

const KANJI_PER_PAGE = 18;

const statusLabels = { mastered: 'statusMastered', weak: 'statusWeak', due: 'statusDue' };

function KanjiPagination({ t, page, pageCount, onPageChange }) {
  const firstMiddlePage = Math.max(2, Math.min(page - 1, pageCount - 3));
  const pageNumbers = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [1, firstMiddlePage, firstMiddlePage + 1, firstMiddlePage + 2, pageCount];

  return (
    <nav className="kanjiPagination" aria-label={t('kanjiPagination')}>
      <button
        type="button"
        className="kanjiPageButton"
        aria-label={t('previousPage')}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        <Icon name="chevronLeft" size={16} />
      </button>
      {pageNumbers.map((number, index) => (
        <Fragment key={number}>
          {number > (pageNumbers[index - 1] ?? 0) + 1 && (
            <span className="kanjiPageGap" aria-hidden="true">…</span>
          )}
          <button
            type="button"
            className="kanjiPageButton"
            aria-label={t('pageNumber', { page: number })}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onPageChange(number)}
          >
            {number}
          </button>
        </Fragment>
      ))}
      <button
        type="button"
        className="kanjiPageButton"
        aria-label={t('nextPage')}
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}

export function KanjiShelf({
  t,
  language,
  activeLevelLabel,
  selectedLevels,
  levelCounts,
  onToggleLevel,
  onClearLevels,
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
  randomCount,
  onPickRandom,
  dueCount,
  onLoadDueReview,
  onlyWithVocab,
  onToggleOnlyWithVocab,
  getVocabForKanji,
  getKanjiStatus,
}) {
  const resultsRef = useRef(null);
  const [pageSelection, setPageSelection] = useState(null);
  const resultCount = filteredKanji.length;
  const pageCount = Math.ceil(resultCount / KANJI_PER_PAGE);
  const page = pageSelection?.results === filteredKanji ? pageSelection.number : 1;
  const startIndex = (page - 1) * KANJI_PER_PAGE;
  const endIndex = Math.min(startIndex + KANJI_PER_PAGE, resultCount);
  const pageKanji = filteredKanji.slice(startIndex, endIndex);
  const isLoading = isKanjiLoading || (onlyWithVocab && isVocabLoading);
  const countLabel = pageCount > 1
    ? t('collectionRange', { first: startIndex + 1, last: endIndex, count: resultCount })
    : t('collectionCount', { count: resultCount });

  function changePage(number) {
    if (number === page) return;
    setPageSelection({ results: filteredKanji, number });
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: 'start' });
  }

  function renderTile(kanji) {
    const isSelected = selectedSet.has(kanji.character);
    const isDisabled = !isSelected && !canPickMore;
    const vocabCount = getVocabForKanji(kanji.character).length;
    const status = getKanjiStatus(kanji.character);
    const showFreqBadge = kanji.freq <= FREQ_BADGE_LIMIT;
    const meaning = getKanjiMeanings(kanji, language)[0] || t('fallbackMeaning');

    return (
      <button
        type="button"
        className={`kanjiTile${isSelected ? ' selected' : ''}`}
        key={kanji.character}
        onClick={() => onToggleKanji(kanji.character)}
        disabled={isDisabled}
        aria-pressed={isSelected}
      >
        <span className="tileTop">
          <span className={`tileLevel level-${kanji.jlpt}`}>
            {LEVEL_LABEL_BY_VALUE[kanji.jlpt]}
          </span>
          <span className="tileState">
            {statusLabels[status] && (
              <span className={`statusDot dot-${status}`} title={t(statusLabels[status])}>
                <span className="visuallyHidden">{t(statusLabels[status])}</span>
              </span>
            )}
            <span className="tilePick" aria-hidden="true">
              <Icon name={isSelected ? 'check' : 'plus'} size={13} />
            </span>
          </span>
        </span>
        <span className="kanjiGlyph" lang="ja">{kanji.character}</span>
        <span className="kanjiMeaning" title={meaning}>{meaning}</span>
        <span className="vocabBadge">
          {t('vocabCount', { count: vocabCount })}
        </span>
        {(kanji.grade != null || showFreqBadge) && (
          <span className="kanjiInfoBadges">
            {kanji.grade != null && (
              <span className="kanjiBadge" title={t('gradeBadge', { grade: kanji.grade })}>
                {t('gradeBadge', { grade: kanji.grade })}
              </span>
            )}
            {showFreqBadge && (
              <span className="kanjiBadge" title={t('freqBadge', { freq: kanji.freq })}>
                {t('freqBadge', { freq: kanji.freq })}
              </span>
            )}
          </span>
        )}
      </button>
    );
  }

  return (
    <section className="kanjiShelf" id="kanjiShelfSection" aria-labelledby="shelf-title">
      <div className="shelfHeading">
        <h2 id="shelf-title">{t('shelfTitle')}</h2>
        <div className="shelfActions">
          {dueCount > 0 && (
            <button type="button" className="paperButton" onClick={onLoadDueReview}>
              <Icon name="clock" size={16} />
              {t('reviewQueue')} ({dueCount})
            </button>
          )}
          <button
            type="button"
            className="paperButton shuffleButton"
            onClick={onPickRandom}
            disabled={isKanjiLoading || isVocabLoading || randomCount === 0}
          >
            <Icon name="shuffle" size={16} />
            {t('randomCount', { count: randomCount || MAX_SELECTED_KANJI })}
          </button>
        </div>
      </div>

      <div className="toolRow">
        <label className="searchBox">
          <Icon name="search" />
          <span className="visuallyHidden">{t('searchLabel')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </label>
        <label className="sortBox">
          <Icon name="sort" />
          <span className="visuallyHidden">{t('sortLabel')}</span>
          <select
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value)}
            disabled={isKanjiLoading}
          >
            <option value={KANJI_SORT_MODES.default}>{t('sortDefault')}</option>
            <option value={KANJI_SORT_MODES.freq}>{t('sortFreq')}</option>
            <option value={KANJI_SORT_MODES.grade}>{t('sortGrade')}</option>
          </select>
          <Icon name="chevronDown" size={14} />
        </label>
      </div>

      <div className="shelfLevels">
        <span id="level-filter-label">{t('levelTitle')}</span>
        <div className="levelButtons" role="group" aria-labelledby="level-filter-label">
          <button type="button" onClick={onClearLevels} aria-pressed={selectedLevels.length === 0}>
            {t('allLevelsFilter')}
          </button>
          {LEVELS.map((level) => (
            <button
              type="button"
              key={level.value}
              onClick={() => onToggleLevel(level.value)}
              aria-pressed={selectedLevels.includes(level.value)}
            >
              {level.label}
              {levelCounts[level.value] > 0 && <small>{levelCounts[level.value]}</small>}
            </button>
          ))}
        </div>
      </div>

      <div className="shelfMeta">
        <div className="statusLine" aria-live="polite">
          {isKanjiLoading
            ? t('loadingKanji', { level: activeLevelLabel })
            : countLabel}
          {isVocabLoading && !isKanjiLoading && ` · ${t('loadingVocab')}`}
        </div>
        <label className="vocabFilterToggle">
          <input type="checkbox" checked={onlyWithVocab} onChange={onToggleOnlyWithVocab} />
          <span className="toggleTrack" aria-hidden="true" />
          {t('onlyWithVocab')}
        </label>
      </div>
      <a className="mobileDeckLink" href="#studyDeck">
        <Icon name="cards" size={16} />
        {t('deckTitle')} ({selectedSet.size})
        <Icon name="arrowDown" size={14} />
      </a>

      {loadError && <div className="loadError" role="status">{loadError}</div>}

      <div
        className="kanjiResults"
        ref={resultsRef}
        aria-busy={isLoading}
        tabIndex={-1}
      >
        {isLoading ? (
          <SkeletonGrid count={KANJI_PER_PAGE} />
        ) : pageKanji.length > 0 ? (
          <div className="kanjiGrid">{pageKanji.map(renderTile)}</div>
        ) : !loadError && (
          <div className="quietState shelfEmpty">
            <Icon name="search" size={24} />
            <strong>{t('noMatchingKanji')}</strong>
            <p>{t('noMatchingKanjiHint')}</p>
          </div>
        )}
      </div>
      {!isLoading && pageCount > 1 && (
        <KanjiPagination t={t} page={page} pageCount={pageCount} onPageChange={changePage} />
      )}
    </section>
  );
}
