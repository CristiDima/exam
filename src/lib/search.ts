// Accent- and case-insensitive search with highlight ranges in the original text.

const MARKS = /[̀-ͯ]/g;

export function normalize(text: string): string {
  return text.normalize('NFD').replace(MARKS, '').toLowerCase();
}

export function searchTerms(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/** Every term must appear somewhere in the (already normalized) haystack. */
export function matchesAll(haystack: string, terms: readonly string[]): boolean {
  return terms.every(t => haystack.includes(t));
}

export type Range = [start: number, end: number];

/** Ranges of `text` (original indices, end exclusive) matching any of the terms. */
export function highlightRanges(text: string, terms: readonly string[]): Range[] {
  if (terms.length === 0) return [];

  // Normalize char by char, remembering which original char each normalized char came from.
  let norm = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    for (const c of normalize(ch)) {
      norm += c;
      starts.push(i);
      ends.push(i + ch.length);
    }
    i += ch.length;
  }

  const ranges: Range[] = [];
  for (const t of terms) {
    for (let at = norm.indexOf(t); at !== -1; at = norm.indexOf(t, at + t.length)) {
      ranges.push([starts[at], ends[at + t.length - 1]]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: Range[] = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && r[0] <= prev[1]) prev[1] = Math.max(prev[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
