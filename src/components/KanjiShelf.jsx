import { useEffect, useRef, useState } from 'react';
import { LEVEL_LABEL_BY_VALUE, LEVELS, MAX_SELECTED_KANJI } from '../constants.js';
import { FREQ_BADGE_LIMIT, KANJI_SORT_MODES } from '../utils.js';
import { Icon } from './Icon.jsx';
import { SkeletonGrid } from './SkeletonTile.jsx';

const TILE_HEIGHT = 140;
const TILE_GAP = 10;
const ROW_HEIGHT = TILE_HEIGHT + TILE_GAP;
const MIN_TILE_WIDTH = 98;
const MAX_COLUMNS = 6;
const OVERSCAN_ROWS = 2;

const statusLabels = { mastered: 'statusMastered', weak: 'statusWeak', due: 'statusDue' };

export function KanjiShelf({
  t,
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
  const gridRef = useRef(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 450, width: 0 });

  useEffect(() => {
    const element = gridRef.current;
    if (!element) return undefined;

    function updateViewport() {
      setViewport({
        scrollTop: element.scrollTop,
        height: element.clientHeight,
        width: element.clientWidth,
      });
    }

    updateViewport();
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
  }, []);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [activeLevelLabel, onlyWithVocab, query, sortMode]);

  const fittingColumns = Math.floor((viewport.width + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP));
  const columns = Math.max(2, Math.min(MAX_COLUMNS, fittingColumns));
  const rowCount = Math.ceil(filteredKanji.length / columns);
  const maxScrollTop = Math.max(0, rowCount * ROW_HEIGHT - TILE_GAP - viewport.height);
  const scrollTop = Math.min(viewport.scrollTop, maxScrollTop);
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const endRow = Math.min(rowCount, Math.ceil((scrollTop + viewport.height) / ROW_HEIGHT) + OVERSCAN_ROWS);
  const visibleKanji = filteredKanji.slice(startRow * columns, endRow * columns);
  const isLoading = isKanjiLoading || (onlyWithVocab && isVocabLoading);

  function renderTile(kanji) {
    const isSelected = selectedSet.has(kanji.character);
    const isDisabled = !isSelected && !canPickMore;
    const vocabCount = getVocabForKanji(kanji.character).length;
    const status = getKanjiStatus(kanji.character);
    const showFreqBadge = kanji.freq <= FREQ_BADGE_LIMIT;
    const meaning = kanji.meanings[0] || t('fallbackMeaning');

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
            : t('collectionCount', { count: filteredKanji.length })}
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
        className="kanjiViewport"
        ref={gridRef}
        aria-busy={isLoading}
        style={{
          '--kanji-columns': columns,
          '--kanji-tile-height': `${TILE_HEIGHT}px`,
          '--kanji-tile-gap': `${TILE_GAP}px`,
        }}
      >
        {isLoading ? (
          <SkeletonGrid count={columns * 3} />
        ) : filteredKanji.length > 0 ? (
          <div
            className="kanjiGrid"
            style={{
              paddingBlockStart: `${startRow * ROW_HEIGHT}px`,
              paddingBlockEnd: `${(rowCount - endRow) * ROW_HEIGHT}px`,
            }}
          >
            {visibleKanji.map(renderTile)}
          </div>
        ) : !loadError && (
          <div className="quietState shelfEmpty">
            <Icon name="search" size={24} />
            <strong>{t('noMatchingKanji')}</strong>
            <p>{t('noMatchingKanjiHint')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
