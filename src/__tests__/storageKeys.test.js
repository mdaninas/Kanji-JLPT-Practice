// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_APP_STORAGE_KEYS,
  LEGACY_KEYS,
  STORAGE_KEYS,
  clearKanjiAppStorage,
  migrateStorageKey,
} from '../storageKeys.js';

describe('storageKeys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('includes kanji breakdown cache keys in ALL_APP_STORAGE_KEYS', () => {
    expect(ALL_APP_STORAGE_KEYS).toContain(STORAGE_KEYS.kanjiBreakdownCache);
    expect(ALL_APP_STORAGE_KEYS).toContain(LEGACY_KEYS.kanjiBreakdownCache);
  });

  it('migrates legacy values to the prefixed key', () => {
    localStorage.setItem('oldKey', 'payload');
    expect(migrateStorageKey('newKey', 'oldKey')).toBe('payload');
    expect(localStorage.getItem('newKey')).toBe('payload');
    expect(localStorage.getItem('oldKey')).toBeNull();
  });

  it('returns existing new-key value without touching legacy', () => {
    localStorage.setItem('newKey', 'current');
    localStorage.setItem('oldKey', 'legacy');
    expect(migrateStorageKey('newKey', 'oldKey')).toBe('current');
    expect(localStorage.getItem('oldKey')).toBe('legacy');
  });

  it('clearKanjiAppStorage removes breakdown cache and other app keys', () => {
    ALL_APP_STORAGE_KEYS.forEach((key, index) => {
      localStorage.setItem(key, `value-${index}`);
    });

    clearKanjiAppStorage();

    ALL_APP_STORAGE_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
    });
  });
});
