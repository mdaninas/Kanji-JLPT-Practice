import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FREQ_BADGE_LIMIT, KANJI_SORT_MODES } from '../utils.js';
import { SkeletonGrid } from './SkeletonTile.jsx';

const TILE_HEIGHT = 120;
const OVERSCAN_ROWS = 2;
const MOBILE_COLUMNS = 4;
const DESKTOP_COLUMNS = 5;
const MOBILE_BREAKPOINT = 640;

function getColumnCount(width) {
  return width <= MOBILE_BREAKPOINT ? MOBILE_COLUMNS : DESKTOP_COLUMNS;
}

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
  onLoadDueReview,
  onReset,
  onlyWithVocab,
  onToggleOnlyWithVocab,
  getVocabForKanji,
  getKanjiStatus,
  getDueKanji,
  allKanjiCharacters,
}) {
  const dueCount = getDueKanji(allKanjiCharacters).length;
  const gridRef = useRef(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 360, width: 800 });

  const updateViewport = useCallback(() => {
    const element = gridRef.current;
    if (!element) return;
    setViewport({
      scrollTop: element.scrollTop,
      height: element.clientHeight,
      width: element.clientWidth,
    });
  }, []);

  useEffect(() => {
    updateViewport();
    const element = gridRef.current;
    if (!element) return undefined;

    element.addEventListener('scroll', updateViewport, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateViewport)
      : null;
    resizeObserver?.observe(element);
    window.addEventListener('resize', updateViewport);

    return () => {
      element.removeEventListener('scroll', updateViewport);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateViewport);
    };
  }, [updateViewport, isKanjiLoading, filteredKanji.length]);

  const columns = getColumnCount(viewport.width);
  const rowCount = Math.ceil(filteredKanji.length / columns) || 0;
  const totalHeight = rowCount * TILE_HEIGHT;

  const { startIndex, endIndex, topSpacer, bottomSpacer } = useMemo(() => {
    if (rowCount === 0) {
      return { startIndex: 0, endIndex: 0, topSpacer: 0, bottomSpacer: 0 };
    }

    const startRow = Math.max(0, Math.floor(viewport.scrollTop / TILE_HEIGHT) - OVERSCAN_ROWS);
    const endRow = Math.min(
      rowCount,
      Math.ceil((viewport.scrollTop + viewport.height) / TILE_HEIGHT) + OVERSCAN_ROWS,
    );

    return {
      startIndex: startRow * columns,
      endIndex: Math.min(filteredKanji.length, endRow * columns),
      topSpacer: startRow * TILE_HEIGHT,
      bottomSpacer: Math.max(0, (rowCount - endRow) * TILE_HEIGHT),
    };
  }, [columns, filteredKanji.length, rowCount, viewport.height, viewport.scrollTop]);

  const visibleKanji = filteredKanji.slice(startIndex, endIndex);

  function renderTile(kanji) {
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
        {status === 'mastered' && (
          <span className="statusDot dot-mastered">
            <span className="visuallyHidden">{t('statusMastered')}</span>
          </span>
        )}
        {status === 'weak' && (
          <span className="statusDot dot-weak">
            <span className="visuallyHidden">{t('statusWeak')}</span>
          </span>
        )}
        {status === 'due' && (
          <span className="statusDot dot-due">
            <span className="visuallyHidden">{t('statusDue')}</span>
          </span>
        )}
        <span className="kanjiGlyph" lang="ja">{kanji.character}</span>
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
  }

  return (
    <section className="kanjiShelf" aria-labelledby="shelf-title">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">{t('collectionEyebrow', { level: activeLevelLabel.toUpperCase() })}</p>
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
          {dueCount > 0 && (
            <button type="button" className="paperButton" onClick={onLoadDueReview}>
              {t('reviewQueue')} ({dueCount})
            </button>
          )}
          <button
            type="button"
            className="primaryButton"
            onClick={onPickRandom}
            disabled={isKanjiLoading || filteredKanji.length === 0}
          >
            {t('randomCount', { count: 10 })}
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
        <label className="vocabFilterToggle">
          <input
            type="checkbox"
            checked={onlyWithVocab}
            onChange={onToggleOnlyWithVocab}
          />
          <span>{t('onlyWithVocab')}</span>
        </label>
      </div>

      <div className="statusLine" aria-live="polite">
        {isKanjiLoading
          ? t('loadingKanji', { level: activeLevelLabel })
          : t('available', { count: filteredKanji.length, level: activeLevelLabel })}
        {isVocabLoading ? ` ${t('loadingVocab')}` : ''}
      </div>

      {loadError && <div className="loadError">{loadError}</div>}

      {isKanjiLoading ? (
        <SkeletonGrid count={15} />
      ) : (
        <div
          className="kanjiGrid"
          ref={gridRef}
          style={{ '--kanji-grid-height': `${totalHeight}px` }}
        >
          {topSpacer > 0 && (
            <div className="kanjiGridSpacer" style={{ height: topSpacer }} aria-hidden="true" />
          )}
          {visibleKanji.map((kanji) => renderTile(kanji))}
          {bottomSpacer > 0 && (
            <div className="kanjiGridSpacer" style={{ height: bottomSpacer }} aria-hidden="true" />
          )}
        </div>
      )}
    </section>
  );
}
