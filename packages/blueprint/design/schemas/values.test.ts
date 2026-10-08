import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';
import { Timestamp, Emoji, Options, Text, characters, codePoints } from './values.ts';

const text = Schema.decodeUnknownEither(Text);
describe('Text', () => {
  it('accepts exactly 280 visible characters, counting a combined emoji as one', () => {
    const family = '👨‍👩‍👧'; // five code points, one character
    expect(codePoints(family)).toBe(5);
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
describe('Emoji', () => {
  it('accepts one emoji, including sequences, and refuses words', () => {
    expect(Schema.is(Emoji)('🍋')).toBe(true);
    expect(Schema.is(Emoji)('⏸️')).toBe(true);
    expect(Schema.is(Emoji)('🇳🇿')).toBe(true);
    expect(Schema.is(Emoji)('a lemon')).toBe(false);
    expect(Schema.is(Emoji)('')).toBe(false);
    for (const value of ['abc', '🍋🦊', '🇳🇿🇺🇸', '1', '#', '\uD83D']) expect(Schema.is(Emoji)(value), value).toBe(false);
    for (const value of ['1️⃣', '👍🏽', '👩🏽‍💻', '👨‍👩‍👧‍👦', '🏳️‍🌈', '👩‍❤️‍💋‍👨']) expect(Schema.is(Emoji)(value), value).toBe(true);
  });
  it('accepts qualification variants without changing bytes and bounds combined sequences', () => {
    for (const value of ['☀', '☀️', '©', '©️', '⏸', '⏸️', '🏳‍🌈', '👁‍🗨', '1⃣', '☝🏽', '☝️🏽', '🍋️']) {
      expect(Schema.decodeUnknownSync(Emoji)(value)).toBe(value);
    }
    for (const value of ['☀︎', '👩🏽‍❤️‍💋‍👨🏽']) expect(Schema.is(Emoji)(value), value).toBe(false);
  });
});
it('requires two to five options numbered in order', () => {
  const option = { number: 1, emoji: '🍋', title: 'Lemon' };
  expect(Schema.is(Options)([option, { ...option, number: 2, emoji: '🦊' }])).toBe(true);
  expect(Schema.is(Options)([option, { ...option, number: 2 }])).toBe(false);
  expect(Schema.is(Options)([option, { ...option, number: 2, emoji: '🍋️' }])).toBe(false);
  expect(Schema.is(Options)([option])).toBe(false);
  expect(Schema.is(Options)([option, { ...option, number: 3 }])).toBe(false);
  expect(Schema.is(Options)([1, 2, 3, 4, 5, 6].map(number => ({ ...option, number })))).toBe(false);
});
it('refuses invalid timestamp dates rather than giving them a session deadline', () => {
  expect(Schema.is(Timestamp)('2026-02-30T12:00:00Z')).toBe(false);
});
