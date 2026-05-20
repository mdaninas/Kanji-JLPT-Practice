import { useEffect, useMemo, useState } from 'react';

import {
  LEVEL_LABEL_BY_VALUE,
  LEVELS,
  MAX_SELECTED_KANJI,
  SUPPORTED_LANGUAGES,
} from './constants.js';
import { useKanjiData } from './hooks/useKanjiData.js';
import { usePersistedState } from './hooks/usePersistedState.js';
import { useProgress } from './hooks/useProgress.js';
import { useQuizCache } from './hooks/useQuizCache.js';
import { useStudyStats } from './hooks/useStudyStats.js';
import { useVocabData } from './hooks/useVocabData.js';
import {
  formatText,
  KANJI_SORT_MODES,
  sampleItems,
  sortKanjiList,
  vocabSortForLevels,
} from './utils.js';

import { DeckPanel } from './components/DeckPanel.jsx';
import { FlashcardMode } from './components/FlashcardMode.jsx';
import { KanjiBreakdown } from './components/KanjiBreakdown.jsx';
import { KanjiShelf } from './components/KanjiShelf.jsx';
import { QuizModal } from './components/QuizModal.jsx';
import { VocabPreviewModal } from './components/VocabPreviewModal.jsx';
import { StatsDashboard } from './components/StatsDashboard.jsx';
import { StrokeOrder } from './components/StrokeOrder.jsx';

export default function App() {
  const [language, setLanguage] = usePersistedState('kanjiApp:language', 'id');
  const [selectedLevels, setSelectedLevels] = usePersistedState('kanjiApp:selectedLevels', []);
  const [selectedKanji, setSelectedKanji] = useState([]);
  const [preferredVocabLevels, setPreferredVocabLevels] = usePersistedState('kanjiApp:preferredVocabLevels', []);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [previewKanjiCharacter, setPreviewKanjiCharacter] = useState('');
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [strokeOrderKanji, setStrokeOrderKanji] = useState('');
  const [breakdownKanji, setBreakdownKanji] = useState('');
  const [sortMode, setSortMode] = usePersistedState('kanjiApp:sortMode', KANJI_SORT_MODES.default);
  const [query, setQuery] = useState('');

  const t = (key, params) => formatText(language, key, params);

  const activeLevelValues = useMemo(
    () => (selectedLevels.length > 0 ? selectedLevels : LEVELS.map((l) => l.value)),
    [selectedLevels],
  );
  const activeLevelLabel =
    selectedLevels.length > 0
      ? selectedLevels.map((l) => LEVEL_LABEL_BY_VALUE[l]).join(', ')
      : t('allLevels');

  const { currentKanji, isKanjiLoading, loadError: kanjiError } = useKanjiData(
    activeLevelValues,
    activeLevelLabel,
    language,
  );
  const { vocabByCharacter, isVocabLoading, vocabError } = useVocabData(language);
  const {
    progress,
    recordResult,
    recordQuizResults,
    getProgressStats,
    getKanjiStatus,
    replaceProgress,
  } = useProgress();
  const { stats, recordSession, reset: resetStats, replaceStats } = useStudyStats();
  const quizCache = useQuizCache();

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('documentTitle');
  }, [language]);

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
    if (isKanjiLoading || selectedKanji.length === 0) return;
    const currentKanjiSet = new Set(currentKanji.map((k) => k.character));
    setSelectedKanji((current) => current.filter((c) => currentKanjiSet.has(c)));
  }, [currentKanji, isKanjiLoading]);

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
    .map((kanji) => ({ ...kanji, vocab: getVocabForKanji(kanji.character) }));

  const filteredKanji = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matched = !normalizedQuery
      ? currentKanji
      : currentKanji.filter((item) =>
          [item.character, ...item.meanings, ...item.kunReadings, ...item.onReadings]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        );
    return sortKanjiList(matched, sortMode);
  }, [currentKanji, query, sortMode]);

  const selectedSet = new Set(selectedKanji);
  const canPickMore = selectedKanji.length < MAX_SELECTED_KANJI;
  const canOpenVocabPicker = selectedStudySet.length > 0 && !isVocabLoading;
  const previewKanji = selectedStudySet.find((k) => k.character === previewKanjiCharacter);

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
    const eligibleKanji = currentKanji.filter((k) => getVocabForKanji(k.character).length > 0);
    const basePool = eligibleKanji.length >= MAX_SELECTED_KANJI ? eligibleKanji : currentKanji;
    setSelectedKanji(sampleItems(basePool, MAX_SELECTED_KANJI).map((k) => k.character));
  }

  const loadError = kanjiError || vocabError;

  const levelCounts = useMemo(() => {
    const counts = {};
    LEVELS.forEach((lv) => { counts[lv.value] = 0; });
    currentKanji.forEach((k) => {
      if (counts[k.jlpt] != null) counts[k.jlpt] += 1;
    });
    return counts;
  }, [currentKanji]);

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brandBlock">
          <span className="brandMark">漢字</span>
          <p className="eyebrow">KANJI · JLPT STUDY</p>
          <h1>{t('title')}</h1>
        </div>
        <nav className="topNav" aria-label="primary">
          <span className="active">{t('shelfTitle')}</span>
          <span>{t('flashcardMode')}</span>
          <span>{t('quizSectionTitle')}</span>
          <span>{t('statsButton')}</span>
        </nav>
        <div className="topActions">
          <label className="languagePicker">
            <span>{t('language')}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {SUPPORTED_LANGUAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="statsTrigger"
            onClick={() => setIsStatsOpen(true)}
          >
            {t('statsButton')}
          </button>
          <div className="scoreBadge">
            <strong>{selectedKanji.length}</strong>
            <span>/ {MAX_SELECTED_KANJI} {t('picked')}</span>
          </div>
        </div>
      </header>

      <section className="levelRow" aria-label={t('levelTitle')}>
        <p className="levelRowLabel">LEVEL ↓</p>
        <div className="levelButtons">
          {LEVELS.map((level) => (
            <button
              type="button"
              key={level.value}
              className={selectedLevels.includes(level.value) ? 'active' : ''}
              onClick={() => handleLevelToggle(level.value)}
              aria-pressed={selectedLevels.includes(level.value)}
            >
              <span>{level.label}</span>
              {levelCounts[level.value] > 0 && (
                <span style={{ opacity: 0.6, fontSize: 10 }}>{levelCounts[level.value]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="levelMeta">
          <span>
            Sort <b>
              {sortMode === KANJI_SORT_MODES.freq ? t('sortFreq')
                : sortMode === KANJI_SORT_MODES.grade ? t('sortGrade')
                : t('sortDefault')}
            </b>
          </span>
          <span className="dividerDot" />
          <span className="deckCounter">
            <b>{selectedKanji.length} / {MAX_SELECTED_KANJI}</b> in deck
          </span>
        </div>
      </section>

      <section className="questBoard">
        <KanjiShelf
          t={t}
          activeLevelLabel={activeLevelLabel}
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
          onPickRandom={pickRandomKanji}
          onReset={() => setSelectedKanji([])}
          getVocabForKanji={getVocabForKanji}
          getKanjiStatus={getKanjiStatus}
        />

        <DeckPanel
          t={t}
          selectedStudySet={selectedStudySet}
          isVocabLoading={isVocabLoading}
          canOpenVocabPicker={canOpenVocabPicker}
          onOpenVocabPicker={() => {
            setPreviewKanjiCharacter('');
            setIsVocabModalOpen(true);
          }}
          onOpenPreview={(character) => {
            setIsVocabModalOpen(false);
            setPreviewKanjiCharacter(character);
          }}
          onToggleKanji={toggleKanji}
          onOpenFlashcard={() => setIsFlashcardOpen(true)}
          onOpenStrokeOrder={(character) => setStrokeOrderKanji(character)}
          onOpenBreakdown={(character) => setBreakdownKanji(character)}
          getProgressStats={getProgressStats}
        />
      </section>

      {isVocabModalOpen && (
        <QuizModal
          t={t}
          language={language}
          selectedStudySet={selectedStudySet}
          selectedKanji={selectedKanji}
          isVocabLoading={isVocabLoading}
          preferredVocabLevels={preferredVocabLevels}
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
            const date = new Date().toISOString().slice(0, 10);
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
    </main>
  );
}
