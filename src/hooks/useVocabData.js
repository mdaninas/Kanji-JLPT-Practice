import { useEffect, useMemo, useState } from 'react';
import { LEVELS } from '../constants.js';
import { formatText, getUniqueKanjiCharacters, parseVocabCsv } from '../utils.js';

export function useVocabData(language) {
  const [vocabByLevel, setVocabByLevel] = useState({});
  const [isVocabLoading, setIsVocabLoading] = useState(true);
  const [vocabError, setVocabError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsVocabLoading(true);
    setVocabByLevel({});
    setVocabError('');

    Promise.all(
      LEVELS.map((level) =>
        level.loadVocab(language).then((module) => [
          level.value,
          parseVocabCsv(module.default, level.value, language),
        ]),
      ),
    )
      .then((entries) => {
        if (!cancelled) setVocabByLevel(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setVocabError(formatText(language, 'vocabError'));
      })
      .finally(() => {
        if (!cancelled) setIsVocabLoading(false);
      });

    return () => { cancelled = true; };
  }, [language]);

  const allVocab = useMemo(
    () => Object.values(vocabByLevel).flat(),
    [vocabByLevel],
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
