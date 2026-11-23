import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_QUIZ_MODEL,
  isSupportedQuizModel,
  LEVEL_LABEL_BY_VALUE,
  LEVELS,
  MAX_SELECTED_KANJI,
  migrateQuizModelId,
  SUPPORTED_LANGUAGES,
} from './constants.js';
import { useKanjiData } from './hooks/useKanjiData.js';
import { usePersistedState } from './hooks/usePersistedState.js';
import { useProgress } from './hooks/useProgress.js';
import { useQuizCache } from './hooks/useQuizCache.js';
import { useStudyStats } from './hooks/useStudyStats.js';
import { useTheme } from './hooks/useTheme.js';
import { useVocabData } from './hooks/useVocabData.js';
import {
  formatText,
  getKanjiMeanings,
  KANJI_SORT_MODES,
  sampleItems,
  sortKanjiList,
  vocabSortForLevels,
} from './utils.js';

import { DeckPanel } from './components/DeckPanel.jsx';
import { FlashcardMode } from './components/FlashcardMode.jsx';
import { Icon } from './components/Icon.jsx';
import { KanjiBreakdown } from './components/KanjiBreakdown.jsx';
import { KanjiShelf } from './components/KanjiShelf.jsx';
import { QuizModal } from './components/QuizModal.jsx';
import { VocabPreviewModal } from './components/VocabPreviewModal.jsx';
import { StatsDashboard } from './components/StatsDashboard.jsx';
import { StrokeOrder } from './components/StrokeOrder.jsx';

const VALID_LEVEL_VALUES = new Set(LEVELS.map((level) => level.value));

function validateLanguage(value) {
  return SUPPORTED_LANGUAGES.some((item) => item.value === value) ? value : 'id';
}

function validateSelectedLevels(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((level) => VALID_LEVEL_VALUES.has(level));
}

function validateSelectedKanji(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((character) => typeof character === 'string').slice(0, MAX_SELECTED_KANJI);
}

function validateOnlyWithVocab(value) {
  return typeof value === 'boolean' ? value : true;
}

function validateSortMode(value) {
  return Object.values(KANJI_SORT_MODES).includes(value) ? value : KANJI_SORT_MODES.default;
}

function validateQuizModel(value) {
  const model = migrateQuizModelId(value);
  return isSupportedQuizModel(model) ? model : DEFAULT_QUIZ_MODEL;
}

export default function App() {
  const [language, setLanguage] = usePersistedState('kanjiApp:language', 'id', validateLanguage);
  const [selectedLevels, setSelectedLevels] = usePersistedState('kanjiApp:selectedLevels', [], validateSelectedLevels);
  const [selectedKanji, setSelectedKanji] = usePersistedState('kanjiApp:selectedKanji', [], validateSelectedKanji);
  const [onlyWithVocab, setOnlyWithVocab] = usePersistedState('kanjiApp:onlyWithVocab', true, validateOnlyWithVocab);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [preferredVocabLevels, setPreferredVocabLevels] = usePersistedState('kanjiApp:preferredVocabLevels', []);
  const [quizModel, setQuizModel] = usePersistedState('kanjiApp:quizModel', DEFAULT_QUIZ_MODEL, validateQuizModel);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [previewKanjiCharacter, setPreviewKanjiCharacter] = useState('');
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [strokeOrderKanji, setStrokeOrderKanji] = useState('');
  const [breakdownKanji, setBreakdownKanji] = useState('');
  const [sortMode, setSortMode] = usePersistedState('kanjiApp:sortMode', KANJI_SORT_MODES.default, validateSortMode);
  const [query, setQuery] = useState('');
  const { theme, toggleTheme } = useTheme();

  const t = useCallback((key, params) => formatText(language, key, params), [language]);

  const activeLevelValues = useMemo(
    () => (selectedLevels.length > 0 ? selectedLevels : LEVELS.map((l) => l.value)),
    [selectedLevels],
  );
  const activeLevelLabel =
    selectedLevels.length > 0
      ? selectedLevels.map((l) => LEVEL_LABEL_BY_VALUE[l]).join(', ')
      : t('allLevels');

  const { currentKanji, isKanjiLoading, loadError: kanjiError, levelCounts } = useKanjiData(
    activeLevelValues,
    activeLevelLabel,
    language,
  );
  const { vocabByCharacter, isVocabLoading, vocabError } = useVocabData(language, activeLevelValues);
  const {
    progress,
    recordResult,
    recordQuizResults,
    getProgressStats,
    getKanjiStatus,
    getDueKanji,
    replaceProgress,
  } = useProgress();
  const { stats, recordSession, reset: resetStats, replaceStats } = useStudyStats();
  const quizCache = useQuizCache();

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'id';
    document.title = t('documentTitle');
  }, [language, t]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 180);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const model = validateQuizModel(quizModel);
    if (model !== quizModel) {
      setQuizModel(model);
    }
  }, [quizModel, setQuizModel]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsVocabModalOpen(false);
        setPreviewKanjiCharacter('');
        setIsFlashcardOpen(false);
        setIsStatsOpen(false);
        setStrokeOrderKanji('');
        setBreakdownKanji('');
      }
    }
    if (isVocabModalOpen || previewKanjiCharacter || isFlashcardOpen || isStatsOpen || strokeOrderKanji || breakdownKanji) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isVocabModalOpen, previewKanjiCharacter, isFlashcardOpen, isStatsOpen, strokeOrderKanji, breakdownKanji]);

  // Drop selected kanji that are no longer in the current level set
  useEffect(() => {
    if (isKanjiLoading) return;
    const currentKanjiSet = new Set(currentKanji.map((k) => k.character));
    setSelectedKanji((current) => {
      const available = current.filter((character) => currentKanjiSet.has(character));
      return available.length === current.length ? current : available;
    });
  }, [currentKanji, isKanjiLoading, setSelectedKanji]);

  useEffect(() => {
    if (selectedKanji.length === 0) {
      setIsVocabModalOpen(false);
      setPreviewKanjiCharacter('');
    }
  }, [selectedKanji]);

  useEffect(() => {
    if (previewKanjiCharacter && !selectedKanji.includes(previewKanjiCharacter)) {
      setPreviewKanjiCharacter('');
    }
  }, [previewKanjiCharacter, selectedKanji]);

  const vocabOptionsByKanji = useMemo(() => {
    const sorter = vocabSortForLevels(selectedLevels);
    return new Map(
      currentKanji.map((kanji) => [
        kanji.character,
        [...(vocabByCharacter.get(kanji.character) || [])].sort(sorter),
      ]),
    );
  }, [currentKanji, selectedLevels, vocabByCharacter]);

  const getVocabForKanji = (character) => vocabOptionsByKanji.get(character) || [];

  const selectedStudySet = selectedKanji
    .map((character) => currentKanji.find((k) => k.character === character))
    .filter(Boolean)
    .map((kanji) => ({
      ...kanji,
      meanings: getKanjiMeanings(kanji, language),
      vocab: getVocabForKanji(kanji.character),
    }));

  const searchableKanji = useMemo(
    () => currentKanji.map((item) => ({
      item,
      searchText: [item.character, ...item.meanings, ...item.meaningsId, ...item.kunReadings, ...item.onReadings]
        .join(' ')
        .toLowerCase(),
    })),
    [currentKanji],
  );

  const filteredKanji = useMemo(() => {
    const matched = searchableKanji
      .filter(({ item, searchText }) => {
        if (onlyWithVocab && !vocabOptionsByKanji.get(item.character)?.length) return false;
        return !debouncedQuery || searchText.includes(debouncedQuery);
      })
      .map(({ item }) => item);
    return sortKanjiList(matched, sortMode);
  }, [searchableKanji, debouncedQuery, sortMode, onlyWithVocab, vocabOptionsByKanji]);

  const selectedSet = new Set(selectedKanji);
  const canPickMore = selectedKanji.length < MAX_SELECTED_KANJI;
  const canOpenVocabPicker = selectedStudySet.length > 0 && !isVocabLoading;
  const previewKanji = selectedStudySet.find((k) => k.character === previewKanjiCharacter);
  const randomPool = filteredKanji.filter((kanji) => getVocabForKanji(kanji.character).length > 0);
  const dueKanji = getDueKanji(currentKanji.map((kanji) => kanji.character));
  const themeLabel = theme === 'dark' ? t('themeToLight') : t('themeToDark');

  function handleLevelToggle(level) {
    setSelectedLevels((current) =>
      current.includes(level)
        ? current.filter((item) => item !== level)
        : [...current, level].sort((a, b) => b - a),
    );
  }

  function toggleKanji(character) {
    setSelectedKanji((current) => {
      if (current.includes(character)) return current.filter((item) => item !== character);
      if (current.length >= MAX_SELECTED_KANJI) return current;
      return [...current, character];
    });
  }

  function pickRandomKanji() {
    if (randomPool.length === 0) return;
    setSelectedKanji(sampleItems(randomPool, MAX_SELECTED_KANJI).map((kanji) => kanji.character));
  }

  function loadDueReviewQueue() {
    if (dueKanji.length === 0) return;
    setSelectedKanji(dueKanji.slice(0, MAX_SELECTED_KANJI));
  }

  function openQuizSetup() {
    setPreviewKanjiCharacter('');
    setIsVocabModalOpen(true);
  }

  const loadError = kanjiError || vocabError;

  return (
    <>
      <header className="siteHeader">
        <div className="topBar appShell">
          <a className="brandBlock" href="#study-home">
            <img className="brandMark" src="/kanji-study-logo.png" width="40" height="40" alt="" />
            {t('appName')}
          </a>
          <nav className="topNav" aria-label={t('primaryNav')}>
            <a className="topNavItem collectionNav" href="#kanjiShelfSection">
              <Icon name="grid" size={16} />
              {t('collectionNav')}
            </a>
            <button
              type="button"
              className="topNavItem"
              onClick={() => setIsFlashcardOpen(true)}
              disabled={selectedStudySet.length === 0}
              title={selectedStudySet.length === 0 ? t('flashcardNeedsSet') : undefined}
            >
              <Icon name="cards" size={16} />
              {t('flashcards')}
            </button>
            <button
              type="button"
              className="topNavItem"
              onClick={openQuizSetup}
              disabled={!canOpenVocabPicker}
              title={selectedStudySet.length === 0 ? t('quizNeedsSet') : undefined}
            >
              <Icon name="quiz" size={16} />
              {t('quizNav')}
            </button>
            <button type="button" className="topNavItem" onClick={() => setIsStatsOpen(true)}>
              <Icon name="chart" size={16} />
              {t('statsButton')}
            </button>
          </nav>
          <div className="topActions">
            <label className="languagePicker">
              <Icon name="globe" size={16} />
              <span className="visuallyHidden">{t('language')}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                {SUPPORTED_LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={13} />
            </label>
            <button
              type="button"
              className="iconButton themeToggle"
              onClick={toggleTheme}
              aria-label={themeLabel}
              aria-pressed={theme === 'dark'}
              title={themeLabel}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>
      </header>

      <main className="appShell studyPage" id="study-home">
        <section className="studyHero" aria-labelledby="study-title">
          <div className="heroContent">
            <h1 id="study-title">{t('heroTitle')} <span>{t('heroSubject')}</span></h1>
            <p>{t('subtitle')}</p>
            <a className="primaryButton heroLink" href="#kanjiShelfSection">
              {t('browseKanji')}
              <Icon name="arrowDown" size={17} />
            </a>
          </div>
        </section>

        <div className="questBoard">
          <KanjiShelf
            t={t}
            language={language}
            activeLevelLabel={activeLevelLabel}
            selectedLevels={selectedLevels}
            levelCounts={levelCounts}
            onToggleLevel={handleLevelToggle}
            onClearLevels={() => setSelectedLevels([])}
            filteredKanji={filteredKanji}
            selectedSet={selectedSet}
            canPickMore={canPickMore}
            isKanjiLoading={isKanjiLoading}
            isVocabLoading={isVocabLoading}
            loadError={loadError}
            query={query}
            sortMode={sortMode}
            onSortChange={setSortMode}
            onQueryChange={setQuery}
            onToggleKanji={toggleKanji}
            randomCount={Math.min(randomPool.length, MAX_SELECTED_KANJI)}
            onPickRandom={pickRandomKanji}
            dueCount={dueKanji.length}
            onLoadDueReview={loadDueReviewQueue}
            onlyWithVocab={onlyWithVocab}
            onToggleOnlyWithVocab={() => setOnlyWithVocab((current) => !current)}
            getVocabForKanji={getVocabForKanji}
            getKanjiStatus={getKanjiStatus}
          />

          <DeckPanel
            t={t}
            selectedStudySet={selectedStudySet}
            canOpenVocabPicker={canOpenVocabPicker}
            onOpenVocabPicker={openQuizSetup}
            onOpenPreview={(character) => {
              setIsVocabModalOpen(false);
              setPreviewKanjiCharacter(character);
            }}
            onClearDeck={() => setSelectedKanji([])}
            onToggleKanji={toggleKanji}
            onOpenFlashcard={() => setIsFlashcardOpen(true)}
            onOpenStrokeOrder={(character) => setStrokeOrderKanji(character)}
            onOpenBreakdown={(character) => setBreakdownKanji(character)}
            getProgressStats={getProgressStats}
            getKanjiStatus={getKanjiStatus}
          />
        </div>
      </main>

      <footer className="appFooter appShell">
        <small>{t('dataAttribution')}</small>
      </footer>

      {isVocabModalOpen && (
        <QuizModal
          t={t}
          language={language}
          selectedStudySet={selectedStudySet}
          selectedKanji={selectedKanji}
          isVocabLoading={isVocabLoading}
          preferredVocabLevels={preferredVocabLevels}
          onPreferredVocabLevelsChange={setPreferredVocabLevels}
          quizModel={quizModel}
          onQuizModelChange={setQuizModel}
          onClose={() => setIsVocabModalOpen(false)}
          onRecordQuizResults={recordQuizResults}
          onRecordSession={recordSession}
          quizCache={quizCache}
        />
      )}

      {isStatsOpen && (
        <StatsDashboard
          t={t}
          stats={stats}
          onReset={() => {
            resetStats();
            replaceProgress({});
            quizCache.clear();
            setIsStatsOpen(false);
          }}
          onClearQuizCache={() => quizCache.clear()}
          onExport={() => {
            const payload = {
              schemaVersion: 1,
              exportedAt: new Date().toISOString(),
              progress,
              stats,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const pad = (n) => String(n).padStart(2, '0');
            const now = new Date();
            const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = `kanji-progress-${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }}
          onImport={(parsed) => {
            replaceProgress(parsed.progress || {});
            replaceStats(parsed.stats || {});
          }}
          onClose={() => setIsStatsOpen(false)}
        />
      )}

      {strokeOrderKanji && (
        <StrokeOrder
          t={t}
          character={strokeOrderKanji}
          onClose={() => setStrokeOrderKanji('')}
        />
      )}

      {breakdownKanji && (
        <KanjiBreakdown
          t={t}
          character={breakdownKanji}
          onClose={() => setBreakdownKanji('')}
        />
      )}

      {previewKanji && (
        <VocabPreviewModal
          t={t}
          previewKanji={previewKanji}
          onClose={() => setPreviewKanjiCharacter('')}
        />
      )}

      {isFlashcardOpen && selectedStudySet.length > 0 && (
        <FlashcardMode
          t={t}
          studySet={selectedStudySet}
          onClose={() => setIsFlashcardOpen(false)}
          onRecordResult={recordResult}
        />
      )}
    </>
  );
}
