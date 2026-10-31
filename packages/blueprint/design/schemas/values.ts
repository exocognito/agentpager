import { Schema } from "effect";

// Every identifier and credential is 32 URL-safe characters: 192 random bits.
export const TOKEN_LENGTH = 32;
export const Token = Schema.String.pipe(Schema.pattern(new RegExp(`^[A-Za-z0-9_-]{${TOKEN_LENGTH}}$`)));
export type Token = typeof Token.Type;

// Limits count visible characters (grapheme clusters), so a combined emoji counts as one (SI6).
export const TEXT_MAX_CHARACTERS = 280;
const HTML_OPENER = /<[A-Za-z/!?]/;
export const codePoints = (text: string) => Array.from(text).length;
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
export const BODY_MAX_CHARACTERS = 1000;
export const Body = ValidProse.pipe(Schema.filter(text => characters(text) <= BODY_MAX_CHARACTERS || `text may not exceed ${BODY_MAX_CHARACTERS} characters`));
export type Body = typeof Body.Type;

export const EMOJI_MAX_CODE_POINTS = 8;
const RGI_EMOJI = new RegExp("^(?:\\p{RGI_Emoji})$", "v");
const TEXT_DEFAULT_EMOJI = new RegExp("[\\p{Emoji}--\\p{Emoji_Presentation}](?!\\p{Emoji_Modifier})", "gv");
// Normalize presentation selectors only for validation, accepting qualification variants without changing stored bytes.
const emojiPresentation = (text: string) => text.replaceAll("️", "").replace(TEXT_DEFAULT_EMOJI, "$&️");

// One Unicode RGI emoji, including qualification variants, within the original code-point bound.
export const Emoji = Schema.String.pipe(
  Schema.filter(text => text.isWellFormed() || "emoji must be well-formed Unicode"),
  Schema.filter(text => !/\s/.test(text) && codePoints(text) >= 1 && codePoints(text) <= EMOJI_MAX_CODE_POINTS || `emoji must be one to ${EMOJI_MAX_CODE_POINTS} code points without whitespace`),
  Schema.filter(text => RGI_EMOJI.test(emojiPresentation(text)) || "emoji must be one Unicode RGI emoji"),
);
export type Emoji = typeof Emoji.Type;

export const Timestamp = Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/), Schema.filter(text => Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0, 19) === text.slice(0, 19) || "timestamp must be a real UTC date"));
export type Timestamp = typeof Timestamp.Type;

export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 5;
export const OptionNumber = Schema.Number.pipe(Schema.int(), Schema.between(1, OPTIONS_MAX));
export type OptionNumber = typeof OptionNumber.Type;
export const Option = Schema.Struct({ number: OptionNumber, emoji: Emoji, title: Text, detail: Schema.optional(Text) });
export type Option = typeof Option.Type;
const numberedInOrder = (options: ReadonlyArray<Option>) => options.every((option, index) => option.number === index + 1) || "options are numbered 1..n in order";
export const Options = Schema.Array(Option).pipe(
  Schema.minItems(OPTIONS_MIN), Schema.maxItems(OPTIONS_MAX), Schema.filter(numberedInOrder),
  Schema.filter(options => new Set(options.map(option => emojiPresentation(option.emoji))).size === options.length || "each option needs a distinct emoji so the owner can refer to it"),
);

