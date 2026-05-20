import { describe, expect, it } from 'vitest';
import { parseCsvLine, parseVocabCsv } from '../utils.js';

describe('parseCsvLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims surrounding whitespace from each cell', () => {
    expect(parseCsvLine('  a , b ,  c  ')).toEqual(['a', 'b', 'c']);
  });

  it('keeps commas inside double-quoted cells', () => {
    expect(parseCsvLine('"hello, world",ok')).toEqual(['hello, world', 'ok']);
  });

  it('unescapes doubled quotes into a single quote', () => {
    expect(parseCsvLine('"he said ""hi""",done')).toEqual(['he said "hi"', 'done']);
  });

  it('handles empty cells', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('returns a single empty cell for an empty line', () => {
    expect(parseCsvLine('')).toEqual(['']);
  });

  it('preserves Japanese characters and multi-byte content', () => {
    expect(parseCsvLine('日本,にほん,Japan')).toEqual(['日本', 'にほん', 'Japan']);
  });
});

describe('parseVocabCsv', () => {
  const header = 'word,reading,translation';

  it('skips the header row', () => {
    const csv = `${header}\n日本,にほん,Japan`;
    const result = parseVocabCsv(csv, 5, 'en');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ word: '日本', reading: 'にほん', translation: 'Japan', level: 5 });
  });

  it('builds a unique id that embeds language, level, index, and word', () => {
    const csv = `${header}\n日本,にほん,Japan\n本,ほん,book`;
    const [first, second] = parseVocabCsv(csv, 4, 'id');
    expect(first.id).toBe('id-4-0-日本');
    expect(second.id).toBe('id-4-1-本');
  });

  it('joins multiple translation cells with a comma', () => {
    const csv = `${header}\n本,ほん,"book","origin"`;
    const [entry] = parseVocabCsv(csv, 5, 'en');
    expect(entry.translation).toBe('book, origin');
  });

  it('drops entries that have no word or no reading', () => {
    const csv = `${header}\n,にほん,Japan\n日本,,Japan\n日本,にほん,Japan`;
    const result = parseVocabCsv(csv, 5, 'en');
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe('日本');
  });

  it('tolerates CRLF line endings', () => {
    const csv = `${header}\r\n日本,にほん,Japan\r\n本,ほん,book`;
    const result = parseVocabCsv(csv, 5, 'en');
    expect(result).toHaveLength(2);
  });

  it('handles trailing whitespace and quoted commas in translation', () => {
    const csv = `${header}\n  食べる , たべる , "to eat, to consume"  `;
    const [entry] = parseVocabCsv(csv, 5, 'en');
    expect(entry.word).toBe('食べる');
    expect(entry.reading).toBe('たべる');
    expect(entry.translation).toBe('to eat, to consume');
  });
});
