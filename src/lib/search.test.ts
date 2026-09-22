import { describe, expect, it } from 'vitest';
import { highlightRanges, matchesAll, normalize, searchTerms } from './search';

const marked = (text: string, query: string) =>
  highlightRanges(text, searchTerms(query)).map(([s, e]) => text.slice(s, e));

describe('search', () => {
  it('ignores case and accents', () => {
    expect(normalize('Règlement Général')).toBe('reglement general');
    expect(matchesAll(normalize('Règlement Général sur la Protection'), searchTerms('REGLEMENT protection'))).toBe(true);
    expect(matchesAll(normalize('Règlement'), searchTerms('reglement gdpr'))).toBe(false);
  });

  it('highlights the original text, accents included', () => {
    expect(marked('Le Règlement général', 'reglement')).toEqual(['Règlement']);
    // Decomposed accents (e + combining grave) map back correctly too.
    expect(marked('Règle', 'regle')).toEqual(['Règle']);
  });

  it('merges overlapping matches and finds repeats', () => {
    expect(marked('data database', 'data base')).toEqual(['data', 'database']);
    expect(marked('audit, audit', 'audit')).toEqual(['audit', 'audit']);
  });

  it('returns nothing for an empty query', () => {
    expect(highlightRanges('text', [])).toEqual([]);
  });
});
