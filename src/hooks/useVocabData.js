import { useEffect, useMemo, useState } from 'react';
import { LEVEL_BY_VALUE, LEVELS } from '../constants.js';
import { formatText, getUniqueKanjiCharacters, parseVocabCsv } from '../utils.js';

const EMPTY_VOCAB = {};

export function useVocabData(language, activeLevelValues) {
  const [vocabByLanguage, setVocabByLanguage] = useState({});
  const [failedLoad, setFailedLoad] = useState(null);
  const vocabByLevel = vocabByLanguage[language] ?? EMPTY_VOCAB;

  const levelsToLoad = useMemo(
    () => (activeLevelValues?.length ? activeLevelValues : LEVELS.map((level) => level.value)),
    [activeLevelValues],
  );
  const missingLevels = useMemo(
    () => levelsToLoad.filter((level) => Object.hasOwn(LEVEL_BY_VALUE, level) && !vocabByLevel[level]),
    [levelsToLoad, vocabByLevel],
  );

  useEffect(() => {
    if (missingLevels.length === 0) return undefined;

    let cancelled = false;
    setFailedLoad(null);

    Promise.all(
      missingLevels.map((levelValue) => {
        const level = LEVEL_BY_VALUE[levelValue];
        return level.loadVocab(language).then((module) => [
          level.value,
          parseVocabCsv(module.default, level.value, language),
        ]);
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setVocabByLanguage((current) => ({
          ...current,
          [language]: { ...current[language], ...Object.fromEntries(entries) },
        }));
      })
      .catch(() => {
        if (!cancelled) setFailedLoad({ language, missingLevels });
      });

    return () => { cancelled = true; };
  }, [language, missingLevels]);

  const loadFailed = failedLoad?.language === language && failedLoad?.missingLevels === missingLevels;
  const isVocabLoading = missingLevels.length > 0 && !loadFailed;
  const vocabError = loadFailed ? formatText(language, 'vocabError') : '';

  const allVocab = useMemo(
    () => levelsToLoad.flatMap((level) => vocabByLevel[level] || []),
    [levelsToLoad, vocabByLevel],
  );

  const vocabByCharacter = useMemo(() => {
    const index = new Map();
    allVocab.forEach((vocab) => {
      getUniqueKanjiCharacters(vocab.word).forEach((character) => {
        if (!index.has(character)) index.set(character, []);
        index.get(character).push(vocab);
      });
    });
    return index;
  }, [allVocab]);

  return { vocabByLevel, vocabByCharacter, isVocabLoading, vocabError };
}
