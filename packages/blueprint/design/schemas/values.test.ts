import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';
import { Timestamp, Text, Title, characters } from './values.ts';

const text = Schema.decodeUnknownEither(Text);
describe('Text', () => {
  it('accepts exactly 280 visible characters, counting a combined emoji as one', () => {
    const family = '👨‍👩‍👧'; // five code points, one character
    expect(Array.from(family)).toHaveLength(5);
    expect(characters(family)).toBe(1);
    expect(text('x'.repeat(280))._tag).toBe('Right');
    expect(text('x'.repeat(279) + family)._tag).toBe('Right');
    expect(text('x'.repeat(280) + family)._tag).toBe('Left');
    expect(text('x'.repeat(281))._tag).toBe('Left');
  });
  it('refuses HTML, lone surrogates and blank text, and keeps Markdown', () => {
    expect(text('Do **1**, then `2` > quote')._tag).toBe('Right');
    expect(text('a < b and b > a')._tag).toBe('Right');
    expect(text('<b>bold</b>')._tag).toBe('Left');
    expect(text('<!-- hidden -->')._tag).toBe('Left');
    expect(text('bad \uD83D surrogate')._tag).toBe('Left');
    expect(text('   ')._tag).toBe('Left');
  });
});
it('holds a title to 100 visible characters', () => {
  expect(Schema.is(Title)('x'.repeat(100))).toBe(true);
  expect(Schema.is(Title)('x'.repeat(99) + '👨‍👩‍👧')).toBe(true);
  expect(Schema.is(Title)('x'.repeat(101))).toBe(false);
  expect(Schema.is(Title)('<b>Ship?</b>')).toBe(false);
});
it('refuses invalid timestamp dates rather than giving them a session deadline', () => {
  expect(Schema.is(Timestamp)('2026-02-30T12:00:00Z')).toBe(false);
});
