import { useEffect, useMemo, useState } from 'react';
import { LEVELS } from '../constants.js';
import { formatText, getUniqueKanjiCharacters, parseVocabCsv } from '../utils.js';

export function useVocabData(language, activeLevelValues) {
  const [vocabByLevel, setVocabByLevel] = useState({});
  const [isVocabLoading, setIsVocabLoading] = useState(true);
  const [vocabError, setVocabError] = useState('');

  const levelsToLoad = useMemo(
    () => (activeLevelValues?.length ? activeLevelValues : LEVELS.map((level) => level.value)),
    [activeLevelValues],
  );

  useEffect(() => {
    let cancelled = false;
    setIsVocabLoading(true);
    setVocabError('');

    const missingLevels = levelsToLoad.filter((level) => !vocabByLevel[level]);
    if (missingLevels.length === 0) {
      setIsVocabLoading(false);
      return undefined;
    }

    Promise.all(
      missingLevels.map((levelValue) => {
        const level = LEVELS.find((item) => item.value === levelValue);
        if (!level) return Promise.resolve(null);
        return level.loadVocab(language).then((module) => [
          level.value,
          parseVocabCsv(module.default, level.value, language),
        ]);
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        const valid = entries.filter(Boolean);
        if (valid.length > 0) {
          setVocabByLevel((current) => ({
            ...current,
            ...Object.fromEntries(valid),
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setVocabError(formatText(language, 'vocabError'));
      })
      .finally(() => {
        if (!cancelled) setIsVocabLoading(false);
      });

    return () => { cancelled = true; };
  }, [language, levelsToLoad, vocabByLevel]);

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
