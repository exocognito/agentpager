import { expect, it } from "vitest";
import { Schema } from "effect";
import { QuestionInput } from "../../../../schemas/exchange.ts";
import { briefProblem, missingAttachment, proseLines, withoutCodeSpans, Payload } from "./schema.ts";

const options = [{ number: 1, title: "Delete them", label: "Delete", prioritizes: "a clean branch list" }, { number: 2, title: "Keep them", prioritizes: "old links" }];
const brief = (markdown: string, extra: Record<string, unknown> = {}) => ({ title: "Delete 14 branches?", card: { type: "brief", options, recommended: 1, markdown }, ...extra });
const ok = "## Context: old branches\n14 are merged.\n\n## Options\n\n## Tradeoffs\n| | A Delete | B✶ Keep |\n|-|-|-|\n| Sites | :orange[Down] | :green[Up] |\n\n## Recommendation: A✶\n**Why:** Nothing uses them.";

it("accepts a brief whose letters all name options", () => {
  expect(Schema.is(QuestionInput)(brief(ok))).toBe(true);
});
it("refuses a recommendation heading for another option, or without card.recommended", () => {
  expect(briefProblem("## Recommendation: B", 2, 1)).toMatch(/does not match/);
  expect(briefProblem("## Recommendation: A", 2, undefined)).toMatch(/set card\.recommended/);
  expect(briefProblem("## Recommendation", 2, 1)).toMatch(/Recommendation: <letter>/);
});
it("refuses option blocks and table columns for letters that are not options", () => {
  expect(briefProblem(":::option C\nx\n:::", 2, undefined)).toMatch(/names no option/);
  expect(briefProblem(":::option A\nx\n:::\n:::option A\ny\n:::", 2, undefined)).toMatch(/two/);
  expect(briefProblem("## Tradeoffs\n| | A | Cost |", 2, undefined)).toMatch(/Tradeoffs column/);
});
it("matches nested containers by fence length and refuses one left open", () => {
  expect(briefProblem("## Options\n::::option A\n:::chat\nme: hi\n:::\n::::", 2, undefined)).toBeUndefined();
  expect(briefProblem("## Options\n:::option A\n:::chat\nme: hi\n:::\n:::", 2, undefined)).toBeUndefined();
  expect(briefProblem(":::smallprint\n- one", 2, undefined)).toMatch(/never closed/);
  expect(briefProblem(":::", 2, undefined)).toMatch(/closes no/);
});
it("treats fenced code as code: HTML and headings inside it are text", () => {
  const code = "```diff app.tsx\n- <div>old</div>\n+ <section>new</section>\n## Recommendation: B\n```";
  expect(proseLines(code)).toEqual([]);
  expect(Schema.is(QuestionInput)(brief(ok + "\n\n" + code))).toBe(true);
  expect(Schema.is(QuestionInput)(brief(ok + "\n\n<b>bold</b>"))).toBe(false);
  expect(Schema.is(QuestionInput)(brief(ok + "\n\nUse `<div>` here."))).toBe(true);
});
it("needs an Options section, where the phone draws the option rows", () => {
  expect(briefProblem("## Context: x\nWhy.", 2, undefined)).toMatch(/needs an "## Options" section/);
  expect(Schema.is(QuestionInput)(brief(ok.replace("## Options\n\n", "")))).toBe(false);
});
it("needs every image and relative link to be an attachment of its kind; https links may point elsewhere", () => {
  const names = new Map([["background.md", "text/markdown"], ["a.png", "image/png"]] as const);
  expect(missingAttachment("![A](background.md)", names)).toMatch(/names a page, not an image/);
  expect(missingAttachment("[A](a.png)", names)).toMatch(/names an image/);
  expect(missingAttachment("[More](background.md) ![A](a.png) [Docs](https://example.com)", names)).toBeUndefined();
  expect(missingAttachment("[More](notes.md)", names)).toMatch(/neither/);
  expect(missingAttachment("![A](https://example.com/a.png)", names)).toMatch(/not an attachment/);
  expect(missingAttachment("[Site](http://example.com)", names)).toMatch(/neither/);
  expect(missingAttachment("```\n[More](notes.md)\n```", names)).toBeUndefined();
});
it("refuses an image whose structure is not whole", () => {
  const ask = (type: string, name: string, base64: string) => brief(ok + `\n![x](${name})`, { attachments: [{ name, type, base64 }] });
  const png = (bytes: number[]) => ask("image/png", "a.png", btoa(String.fromCharCode(...bytes)));
  const jpeg = (bytes: number[]) => ask("image/jpeg", "a.jpg", btoa(String.fromCharCode(...bytes)));
  // A real 1×1 PNG.
  const dot = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  expect(Schema.is(QuestionInput)(ask("image/png", "a.png", dot))).toBe(true);
  const bytes = Array.from(atob(dot), c => c.charCodeAt(0));
  const ihdr = bytes.slice(0, 33), iend = bytes.slice(-12);
  expect(Schema.is(QuestionInput)(png([...ihdr, ...iend]))).toBe(false); // no image data
  expect(Schema.is(QuestionInput)(png([...ihdr, 0, 0, 0, 0, 0x49, 0x44, 0x41, 0x54, 0x35, 0xaf, 0x06, 0x1e, ...iend]))).toBe(false); // empty IDAT
  expect(Schema.is(QuestionInput)(png([...ihdr, 0, 0, 0, 2, 0x49, 0x44, 0x41, 0x54, 0x12, 0x34, 0, 0, 0, 0, ...iend]))).toBe(false); // not zlib data
  expect(Schema.is(QuestionInput)(png(bytes.slice(0, -12)))).toBe(false); // no IEND
  expect(Schema.is(QuestionInput)(png([...bytes, 0]))).toBe(false); // bytes after IEND
  const sof = [0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0], sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0];
  expect(Schema.is(QuestionInput)(jpeg([0xff, 0xd8, ...sof, ...sos, 0x12, 0x34, 0xff, 0xd9]))).toBe(true);
  expect(Schema.is(QuestionInput)(jpeg([0xff, 0xd8, 0xff, 0xe0, 0, 0xff, 0xd9]))).toBe(false); // markers only
  expect(Schema.is(QuestionInput)(jpeg([0xff, 0xd8, ...sos, 0xff, 0xd9]))).toBe(false); // no frame header
  // A small file that declares a bitmap too big to decode on a phone.
  const huge = [...bytes.slice(0, 16), 0, 0, 0x75, 0x30, 0, 0, 0x75, 0x30, ...bytes.slice(24)];
  expect(Schema.is(QuestionInput)(png(huge))).toBe(false);
  const bigFrame = [0xff, 0xc0, 0, 11, 8, 0x75, 0x30, 0x75, 0x30, 1, 1, 0x11, 0];
  expect(Schema.is(QuestionInput)(jpeg([0xff, 0xd8, ...bigFrame, ...sos, 0x12, 0x34, 0xff, 0xd9]))).toBe(false);
});
it("pairs code spans by equal backtick runs, so an unpaired run hides no link", () => {
  expect(withoutCodeSpans("a `b` c")).toBe("a  c");
  expect(withoutCodeSpans("Call ``[me](tel:+15551234)` now")).toBe("Call ``[me](tel:+15551234)` now");
  expect(withoutCodeSpans("``a ` b`` c")).toBe(" c");
  expect(missingAttachment("Call ``[me](tel:+15551234)` now", new Map())).toMatch(/neither an attachment nor an https link/);
});
it("reads a backslash-escaped bracket as text, so an escape hides no link", () => {
  expect(missingAttachment("See [me\\]](tel:+15551234) now", new Map())).toMatch(/neither an attachment nor an https link/);
  expect(missingAttachment("See ![m\\]](missing.png)", new Map())).toMatch(/is not an attachment/);
  expect(missingAttachment("A \\[not a link\\](x) here", new Map())).toBeUndefined();
  // An escaped backtick opens no code span.
  expect(missingAttachment("See \\`[me](notes.md)` now", new Map())).toMatch(/neither an attachment nor an https link/);
  expect(Schema.is(QuestionInput)(brief(ok + "\n\nSee \\`<img src=x>` now"))).toBe(false);
});
it("reads every line of a chat as chat, fence markers included", () => {
  const chat = ":::chat\nFrom: hi\n~~~\nFrom: [secret](notes.md)\n~~~\n:::";
  expect(missingAttachment(chat, new Map())).toMatch(/neither an attachment nor an https link/);
  expect(proseLines("```\n[a](b)\n```\n" + chat)).toContain("From: [secret](notes.md)");
  expect(proseLines("```\n[a](b)\n```")).toEqual([]);
});
it("marks options by letter alone: an option with an emoji is refused", () => {
  const card = (second: object) => Schema.decodeUnknownEither(Payload, { onExcessProperty: "error" })({ type: "brief", options: [options[0], second], recommended: 1, markdown: ok });
  expect(card(options[1])._tag).toBe("Right");
  expect(card({ ...options[1], emoji: "🗂️" })._tag).toBe("Left");
});
it("keeps attachments to briefs and pages to their own rules", () => {
  const page = { name: "background.md", type: "text/markdown", text: "# Why\nSee ![A](a.png)" };
  expect(Schema.is(QuestionInput)(brief(ok + "\n[More](background.md)", { attachments: [page] }))).toBe(false);
  expect(Schema.is(QuestionInput)(brief(ok + "\n[More](background.md)", { attachments: [{ ...page, text: "# Why" }] }))).toBe(true);
  expect(Schema.is(QuestionInput)(brief(ok, { attachments: [{ ...page, text: "# Why" }, { ...page, text: "# Again" }] }))).toBe(false);
});
