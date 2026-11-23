// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useVocabData } from '../../hooks/useVocabData.js';

it('loads translations for the selected language and reuses the matching cache', async () => {
  const levels = [5];
  const { result, rerender } = renderHook(
    ({ language }) => useVocabData(language, levels),
    { initialProps: { language: 'en' } },
  );
  const handLetter = () => result.current.vocabByCharacter.get('手')
    ?.find((entry) => entry.word === '手紙' && entry.reading === 'てがみ');

  await waitFor(() => expect(handLetter()?.translation).toBe('letter'));

  rerender({ language: 'zh-Hans' });
  expect(handLetter()?.translation).not.toBe('letter');
  await waitFor(() => expect(handLetter()?.translation).toMatch(/信/u));

  rerender({ language: 'id' });
  await waitFor(() => expect(handLetter()?.translation).toBe('Surat'));

  rerender({ language: 'en' });
  expect(handLetter()?.translation).toBe('letter');
  expect(result.current.isVocabLoading).toBe(false);
});
