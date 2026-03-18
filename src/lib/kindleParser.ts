import initSqlJs from 'sql.js';
import type { KindleWord } from '../types';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSql() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });
  }
  return SQL;
}

export async function parseKindleVocabDb(file: File): Promise<KindleWord[]> {
  const sql = await getSql();
  const arrayBuffer = await file.arrayBuffer();
  const db = new sql.Database(new Uint8Array(arrayBuffer));

  const words: KindleWord[] = [];

  try {
    const result = db.exec(`
      SELECT
        w.word,
        w.stem,
        l.usage,
        b.title as book_title
      FROM WORDS w
      LEFT JOIN LOOKUPS l ON w.id = l.word_key
      LEFT JOIN BOOK_INFO b ON l.book_key = b.id
      WHERE w.word IS NOT NULL
    `);

    if (result.length > 0) {
      const columns = result[0].columns;
      const values = result[0].values;

      const wordIndex = columns.indexOf('word');
      const stemIndex = columns.indexOf('stem');
      const usageIndex = columns.indexOf('usage');
      const bookIndex = columns.indexOf('book_title');

      for (const row of values) {
        words.push({
          word: String(row[wordIndex] || '').toLowerCase().trim(),
          stem: String(row[stemIndex] || '').toLowerCase().trim(),
          usage: String(row[usageIndex] || ''),
          book_title: String(row[bookIndex] || 'Unknown'),
        });
      }
    }
  } catch (error) {
    console.error('Error parsing Kindle database:', error);
    throw new Error('Failed to parse vocabulary file. Please ensure this is a valid Kindle vocab.db file.');
  } finally {
    db.close();
  }

  return words;
}

export function removeDuplicates(words: KindleWord[]): {
  unique: KindleWord[];
  duplicatesCount: number;
} {
  const seen = new Map<string, KindleWord>();

  for (const word of words) {
    const key = word.word.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, word);
    }
  }

  return {
    unique: Array.from(seen.values()),
    duplicatesCount: words.length - seen.size,
  };
}
