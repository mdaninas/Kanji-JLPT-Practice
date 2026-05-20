import { useEffect, useMemo, useState } from 'react';
import { LEVEL_BY_VALUE, LEVELS } from '../constants.js';
import { formatText, normalizeKanji } from '../utils.js';

export function useKanjiData(activeLevelValues, activeLevelLabel, language) {
  const [kanjiByLevel, setKanjiByLevel] = useState({});
  const [isKanjiLoading, setIsKanjiLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const missingLevels = activeLevelValues.filter((level) => !kanjiByLevel[level]);

    if (missingLevels.length === 0) {
      setIsKanjiLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsKanjiLoading(true);
    setLoadError('');

    Promise.all(
      missingLevels.map((levelValue) => {
        const level = LEVEL_BY_VALUE[levelValue];
        return level.loadKanji().then((module) => [
          levelValue,
          normalizeKanji(module.default, levelValue),
        ]);
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setKanjiByLevel((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(formatText(language, 'kanjiError', { level: activeLevelLabel }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsKanjiLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeLevelValues, activeLevelLabel, kanjiByLevel, language]);

  const currentKanji = useMemo(
    () => activeLevelValues.flatMap((level) => kanjiByLevel[level] || []),
    [activeLevelValues, kanjiByLevel],
  );

  return { currentKanji, isKanjiLoading, loadError };
}
