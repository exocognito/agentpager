import { Schema } from "effect";
import { characters, OptionNumber, OPTIONS_MAX, OPTIONS_MIN, Text, ValidProse } from "./values.ts";

// A decision brief: the agent writes the sections in Markdown (the Kit) and AgentPager draws the question, the
// option rows, the answer bar and the ✶ on the recommended option. Options are lettered: number 1 is A.
export const BRIEF_MAX_CHARACTERS = 20_000;
// The answer tile's word or two, under the letter.
export const BRIEF_LABEL_MAX_CHARACTERS = 20;
export const letter = (number: number) => String.fromCharCode(64 + number);

const HTML_OPENER = /<[A-Za-z/!?]/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const CONTAINER_OPEN = /^(:{3,})([a-z]+)(?:[ \t]+(.*?))?\s*$/;
const CONTAINER_CLOSE = /^(:{3,})\s*$/;
const LINK = /(!?)\[[^\]]*\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;
// One left-to-right pass, as CommonMark reads a line: a backslash before ASCII punctuation makes that character text
// (an escaped backtick opens nothing); a code span opens with a run of backticks and closes at the next run of the
// same length, and an unpaired run is literal. What a code span holds is code, never a link or HTML, so it is
// dropped; an escaped pair is dropped too, so "[a\\]b](tel:1)" still reads as a link to tel:1.
export function withoutCodeSpans(line: string) {
  let out = "", at = 0;
  while (at < line.length) {
    if (line[at] === "\\" && /[!-/:-@[-`{-~]/.test(line[at + 1] ?? "")) { at += 2; continue; }
    if (line[at] !== "`") { out += line[at]; at++; continue; }
    const run = line.slice(at).match(/^`+/)?.[0] ?? "`";
    let close = -1;
    for (let i = at + run.length; i < line.length;) {
      const next = line.indexOf("`", i);
      if (next < 0) break;
      const r = line.slice(next).match(/^`+/)?.[0] ?? "`";
      if (r.length === run.length) { close = next; break; }
      i = next + r.length;
    }
    if (close < 0) { out += run; at += run.length; continue; }
    at = close + run.length;
  }
  return out;
}

// The lines of Markdown that are prose, not fenced code. A fence closes on the same character, at least as long.
// Inside a :::chat block every line is a chat line, fence markers included, as the phone reads it.
export function proseLines(markdown: string): string[] {
  const out: string[] = [];
  let fence: string | null = null, chat = 0;
  for (const line of markdown.split("\n")) {
    if (chat) { const close = line.match(CONTAINER_CLOSE)?.[1]; if (close) chat = 0; out.push(line); continue; }
    const f = line.match(FENCE)?.[1];
    if (fence) { if (f && f[0] === fence[0] && f.length >= fence.length && line.trim() === f) fence = null; continue; }
    if (f) { fence = f; continue; }
    const open = line.match(CONTAINER_OPEN);
    if (open && open[2] === "chat") chat = open[1].length;
    out.push(line);
  }
  return out;
}

const prose = withoutCodeSpans;

// Every link and image target outside code, with whether it is an image.
export function targets(markdown: string): { image: boolean; target: string }[] {
  return proseLines(markdown).flatMap(line => [...prose(line).matchAll(LINK)].map(m => ({ image: m[1] === "!", target: m[2] })));
}

// HTML is refused outside code; inside a fence it is code, shown as text and never rendered.
export const BriefMarkdown = Schema.String.pipe(
  Schema.filter(text => text.isWellFormed() || "text must be well-formed Unicode"),
  Schema.filter(text => text.trim().length > 0 || "text may not be blank"),
  Schema.filter(text => characters(text) <= BRIEF_MAX_CHARACTERS || `a brief or page may not exceed ${BRIEF_MAX_CHARACTERS} characters`),
  Schema.filter(text => !proseLines(text).some(line => HTML_OPENER.test(prose(line))) || "HTML is not allowed outside fenced code blocks"),
);

// The Frame's refusals that need only the card: a recommendation or option block or table column for a letter
// that is not an option, and containers left open.
export function briefProblem(markdown: string, optionCount: number, recommended: number | undefined): string | undefined {
  const letters = new Set(Array.from({ length: optionCount }, (_, i) => letter(i + 1)));
  const blocks = new Set<string>();
  const open: number[] = [];
  let section = "", tradeoffsHeader = false, options = false;
  for (const line of proseLines(markdown)) {
    const heading = line.match(/^##\s+(.*?)\s*$/);
    if (heading) { section = heading[1]; tradeoffsHeader = false; options ||= /^Options\b/.test(section); }
    const rec = line.match(/^##\s+Recommendation\b:?\s*(.*?)\s*$/);
    if (rec) {
      const said = rec[1].replace(/[✶*]/g, "").trim();
      if (!/^[A-Z]$/.test(said)) return "write the recommendation heading as \"## Recommendation: <letter>\", such as \"## Recommendation: B\"";
      if (recommended === undefined) return `the brief recommends ${said}: set card.recommended to its number`;
      if (said !== letter(recommended)) return `"## Recommendation: ${said}" does not match card.recommended (${letter(recommended)})`;
    }
    const opener = line.match(CONTAINER_OPEN);
    if (opener) {
      open.push(opener[1].length);
      if (opener[2] === "option") {
        const arg = (opener[3] ?? "").trim();
        if (!letters.has(arg)) return `":::option ${arg}" names no option: this card has ${[...letters].join(", ")}`;
        if (blocks.has(arg)) return `option ${arg} has two ":::option" blocks`;
        blocks.add(arg);
      }
      continue;
    }
    const closer = line.match(CONTAINER_CLOSE);
    if (closer) {
      if (!open.length || closer[1].length < open[open.length - 1]) return `a "${closer[1]}" line closes no ":::" block`;
      open.pop();
      continue;
    }
    if (/^Tradeoffs\b/.test(section) && !tradeoffsHeader && line.trim().startsWith("|")) {
      tradeoffsHeader = true;
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").slice(1).map(c => c.trim());
      for (const cell of cells) {
        const named = cell.replace(/[✶*]/g, "").match(/^([A-Z])(?![A-Za-z])/)?.[1];
        if (!named || !letters.has(named)) return `every Tradeoffs column starts with an option letter (${[...letters].join(", ")}); "${cell}" does not`;
      }
    }
  }
  if (open.length) return "a \":::\" block is never closed";
  // The phone draws the option rows, and each option's block, under this heading.
  if (!options) return "a brief needs an \"## Options\" section";
  return undefined;
}

// An image or page this brief refers to must come with it, as that kind of attachment: an image names a PNG or
// JPEG, a link names a Markdown page. Only an https link may point elsewhere; images are always attachments.
export function missingAttachment(markdown: string, attachments: ReadonlyMap<string, AttachmentType>): string | undefined {
  for (const { image, target } of targets(markdown)) {
    const type = attachments.get(target);
    if (type) {
      if (image === (type === "text/markdown")) return image ? `the image "${target}" names a page, not an image` : `the link "${target}" names an image; show it with ![…](${target})`;
      continue;
    }
    if (!image && target.startsWith("https://")) continue;
    return image ? `the image "${target}" is not an attachment` : `the link "${target}" is neither an attachment nor an https link`;
  }
  return undefined;
}

const Label = ValidProse.pipe(Schema.filter(text => characters(text) <= BRIEF_LABEL_MAX_CHARACTERS || `a label may not exceed ${BRIEF_LABEL_MAX_CHARACTERS} characters`));
// title is the option's row ("Today's page + a limits link"); label its answer tile ("Limits link"), the title
// when absent; the row reads "Prioritizes <prioritizes>".
export const BriefOption = Schema.Struct({ number: OptionNumber, title: Text, label: Schema.optional(Label), prioritizes: Text });
export type BriefOption = typeof BriefOption.Type;
export const BriefOptions = Schema.Array(BriefOption).pipe(
  Schema.minItems(OPTIONS_MIN), Schema.maxItems(OPTIONS_MAX),
  Schema.filter(options => options.every((option, index) => option.number === index + 1) || "options are numbered 1..n in order"),
);

export const Payload = Schema.Struct({
  type: Schema.Literal("brief"),
  options: BriefOptions,
  recommended: Schema.optional(OptionNumber),
  markdown: BriefMarkdown,
}).pipe(
  Schema.filter(card => card.recommended === undefined || card.options.some(option => option.number === card.recommended) || "recommended must name an offered option"),
  Schema.filter(card => briefProblem(card.markdown, card.options.length, card.recommended) ?? true),
);
export type Payload = typeof Payload.Type;

// Attachments travel with the question and are stored apart from it; the decision keeps their names, types and
// sizes. A Markdown page opens as its own page; an image shows where the brief or a page names it.
export const ATTACHMENTS_MAX = 8;
export const IMAGE_MAX_BYTES = 1_000_000;
export const ATTACHMENTS_MAX_BYTES = 3_000_000;
const EXTENSIONS = { "text/markdown": [".md"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] } as const;
export const AttachmentType = Schema.Literal("text/markdown", "image/png", "image/jpeg");
export type AttachmentType = typeof AttachmentType.Type;
export const AttachmentName = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, { message: () => "an attachment name is 1 to 64 letters, digits, dots, dashes or underscores, such as background.md" }));
export const named = (a: { name: string; type: AttachmentType }) => EXTENSIONS[a.type].some(ext => a.name.toLowerCase().endsWith(ext)) || `"${a.name}" must end in ${EXTENSIONS[a.type].join(" or ")} for ${a.type}`;

export function base64Bytes(text: string): Uint8Array | null {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  try { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); } catch { return null; }
}
// The file's structure, walked end to end: a PNG's chunks from IHDR (with a size) through image data to IEND at
// the very end; a JPEG's segments from its start marker through a frame header to the scan, and its end marker.
// The Worker has no image decoder, so pixel data itself is not decoded; the phone shows a placeholder if it fails.
// The size the header declares is bounded too: a small file can declare a bitmap too big for a phone to decode.
export const IMAGE_MAX_SIDE = 8192;
export const IMAGE_MAX_PIXELS = 16_777_216;
const sized = (width: number, height: number) => width > 0 && height > 0 && width <= IMAGE_MAX_SIDE && height <= IMAGE_MAX_SIDE && width * height <= IMAGE_MAX_PIXELS;
const has = (bytes: Uint8Array, at: number, want: number[]) => at >= 0 && want.every((b, i) => bytes[at + i] === b);
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function wholePng(b: Uint8Array) {
  if (!has(b, 0, PNG_SIGNATURE)) return false;
  let at = 8, data = false;
  while (at + 12 <= b.length) {
    const length = u32(b, at), type = String.fromCharCode(...b.subarray(at + 4, at + 8)), end = at + 12 + length;
    if (end > b.length) return false;
    if (at === 8 && (type !== "IHDR" || length !== 13 || !sized(u32(b, at + 8), u32(b, at + 12)))) return false;
    // Image data that starts as zlib data does (deflate, header checksum); an empty IDAT holds no image.
    if (type === "IDAT" && length >= 2 && !data) { const cmf = b[at + 8], flg = b[at + 9]; if ((cmf & 0x0f) !== 8 || (cmf * 256 + flg) % 31 !== 0) return false; }
    if (type === "IDAT" && length >= 2) data = true;
    if (type === "IEND") return data && end === b.length;
    at = end;
  }
  return false;
}
function wholeJpeg(b: Uint8Array) {
  if (!has(b, 0, [0xff, 0xd8]) || !has(b, b.length - 2, [0xff, 0xd9])) return false;
  let at = 2, frame = false;
  while (at + 4 <= b.length - 2) {
    if (b[at] !== 0xff) return false;
    const marker = b[at + 1];
    if (marker === 0xff) { at++; continue; }
    const length = (b[at + 2] << 8) + b[at + 3];
    if (length < 2 || at + 2 + length > b.length - 2) return false;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (length < 8 || !sized((b[at + 7] << 8) + b[at + 8], (b[at + 5] << 8) + b[at + 6])) return false;
      frame = true;
    }
    if (marker === 0xda) return frame;
    at += 2 + length;
  }
  return false;
}
const shaped: Record<"image/png" | "image/jpeg", (b: Uint8Array) => boolean> = { "image/png": wholePng, "image/jpeg": wholeJpeg };
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

// A page is held to a size in bytes too, as an image is: its characters alone don't bound it, since one visible
// character can be many bytes, and each attachment travels as one encrypted part that must fit one stored row.
export const PAGE_MAX_BYTES = 1_000_000;
export const PageInput = Schema.Struct({ name: AttachmentName, type: Schema.Literal("text/markdown"), text: BriefMarkdown }).pipe(
  Schema.filter(named),
  Schema.filter(a => utf8Bytes(a.text) <= PAGE_MAX_BYTES || `"${a.name}" is ${utf8Bytes(a.text)} bytes; a page may not exceed ${PAGE_MAX_BYTES}`),
);
export const ImageInput = Schema.Struct({ name: AttachmentName, type: Schema.Literal("image/png", "image/jpeg"), base64: Schema.String }).pipe(
  Schema.filter(named),
  Schema.filter(a => {
    const bytes = base64Bytes(a.base64);
    if (!bytes || bytes.length === 0) return `"${a.name}": base64 must be standard, padded base64`;
    if (bytes.length > IMAGE_MAX_BYTES) return `"${a.name}" is ${bytes.length} bytes; an image may not exceed ${IMAGE_MAX_BYTES}`;
    return shaped[a.type](bytes) || `"${a.name}" is not a whole ${a.type === "image/png" ? "PNG" : "JPEG"} file of at most ${IMAGE_MAX_SIDE} pixels a side and ${IMAGE_MAX_PIXELS} in all`;
  }),
);
export const AttachmentInput = Schema.Union(PageInput, ImageInput);
export type AttachmentInput = typeof AttachmentInput.Type;
export const attachmentBytes = (a: AttachmentInput) => "text" in a ? utf8Bytes(a.text) : (base64Bytes(a.base64)?.length ?? 0);
export const Attachments = Schema.Array(AttachmentInput).pipe(
  Schema.maxItems(ATTACHMENTS_MAX),
  Schema.filter(list => new Set(list.map(a => a.name)).size === list.length || "attachment names must be unique"),
  Schema.filter(list => list.reduce((sum, a) => sum + attachmentBytes(a), 0) <= ATTACHMENTS_MAX_BYTES || `attachments may not exceed ${ATTACHMENTS_MAX_BYTES} bytes in all`),
  Schema.filter(list => {
    const types = attachmentTypes(list);
    for (const a of list) if ("text" in a) { const missing = missingAttachment(a.text, types); if (missing) return `${a.name}: ${missing}`; }
    return true;
  }),
);

export const attachmentTypes = (list: ReadonlyArray<{ name: string; type: AttachmentType }> = []) => new Map(list.map(a => [a.name, a.type]));
export const AttachmentInfo = Schema.Struct({ name: AttachmentName, type: AttachmentType, bytes: Schema.Number.pipe(Schema.int(), Schema.between(1, IMAGE_MAX_BYTES * 4)) });
export type AttachmentInfo = typeof AttachmentInfo.Type;
export const attachmentInfo = (a: AttachmentInput): AttachmentInfo => ({ name: a.name, type: a.type, bytes: attachmentBytes(a) });
