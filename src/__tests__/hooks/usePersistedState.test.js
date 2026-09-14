// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePersistedState } from '../../hooks/usePersistedState.js';

describe('usePersistedState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists value changes to localStorage', () => {
    const { result } = renderHook(() => usePersistedState('test:theme', 'light'));

    act(() => {
      result.current[1]('dark');
    });

    expect(result.current[0]).toBe('dark');
    expect(JSON.parse(localStorage.getItem('test:theme'))).toBe('dark');
  });

  it('updates state when a storage event arrives from another tab', () => {
    const { result } = renderHook(() => usePersistedState('test:lang', 'id'));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'test:lang',
        newValue: JSON.stringify('en'),
      }));
    });

    expect(result.current[0]).toBe('en');
  });

  it('resets to default when storage event clears the key', () => {
    const { result } = renderHook(() => usePersistedState('test:levels', [5], (value) => (
      Array.isArray(value) ? value : [5]
    )));

    act(() => {
      result.current[1]([4, 3]);
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'test:levels',
        newValue: null,
      }));
    });

    expect(result.current[0]).toEqual([5]);
  });
});
