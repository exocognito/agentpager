import { Schema } from "effect";

// Every identifier and credential is 32 URL-safe characters: 192 random bits.
export const TOKEN_LENGTH = 32;
export const Token = Schema.String.pipe(Schema.pattern(new RegExp(`^[A-Za-z0-9_-]{${TOKEN_LENGTH}}$`)));
export type Token = typeof Token.Type;

// Limits count visible characters (grapheme clusters), so a combined emoji counts as one (SI6).
export const TEXT_MAX_CHARACTERS = 280;
const HTML_OPENER = /<[A-Za-z/!?]/;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const characters = (text: string) => [...graphemes.segment(text)].length;

// Both text shapes share validation without changing their stored bytes.
export const ValidProse = Schema.String.pipe(
  Schema.filter(text => text.isWellFormed() || "text must be well-formed Unicode"),
  Schema.filter(text => !HTML_OPENER.test(text) || "text may not contain HTML"),
  Schema.filter(text => text.trim().length > 0 || "text may not be blank"),
);
export const Text = ValidProse.pipe(Schema.filter(text => characters(text) <= TEXT_MAX_CHARACTERS || `text may not exceed ${TEXT_MAX_CHARACTERS} characters`));
export type Text = typeof Text.Type;
// A decision's title: the question as the inbox and the alert show it.
export const TITLE_MAX_CHARACTERS = 100;
export const Title = ValidProse.pipe(Schema.filter(text => characters(text) <= TITLE_MAX_CHARACTERS || `a title may not exceed ${TITLE_MAX_CHARACTERS} characters`));
export type Title = typeof Title.Type;
export const BODY_MAX_CHARACTERS = 1000;
export const Body = ValidProse.pipe(Schema.filter(text => characters(text) <= BODY_MAX_CHARACTERS || `text may not exceed ${BODY_MAX_CHARACTERS} characters`));
export type Body = typeof Body.Type;

export const Timestamp = Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/), Schema.filter(text => Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0, 19) === text.slice(0, 19) || "timestamp must be a real UTC date"));
export type Timestamp = typeof Timestamp.Type;

// A decision offers 2 to 4 options, numbered from 1.
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 4;
export const OptionNumber = Schema.Number.pipe(Schema.int(), Schema.between(1, OPTIONS_MAX));
export type OptionNumber = typeof OptionNumber.Type;
