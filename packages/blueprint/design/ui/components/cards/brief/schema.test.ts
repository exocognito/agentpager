import { expect, it } from "vitest";
import { Schema } from "effect";
import { QuestionInput } from "../../../../schemas/exchange.ts";
import { briefProblem, missingAttachment, proseLines } from "./schema.ts";

const options = [{ number: 1, title: "Delete them", label: "Delete", prioritizes: "a clean branch list" }, { number: 2, title: "Keep them", prioritizes: "old links" }];
const brief = (markdown: string, extra: Record<string, unknown> = {}) => ({ title: "Delete 14 branches?", card: { type: "brief", options, recommended: 1, markdown }, ...extra });
const ok = "## Context: old branches\n14 are merged.\n\n## Tradeoffs\n| | A Delete | B✶ Keep |\n|-|-|-|\n| Sites | :orange[Down] | :green[Up] |\n\n## Recommendation: A✶\n**Why:** Nothing uses them.";

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
  expect(briefProblem("::::option A\n:::chat\nme: hi\n:::\n::::", 2, undefined)).toBeUndefined();
  expect(briefProblem(":::option A\n:::chat\nme: hi\n:::\n:::", 2, undefined)).toBeUndefined();
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
it("needs every image and relative link to be an attachment; https links may point elsewhere", () => {
  const names = new Set(["background.md", "a.png"]);
  expect(missingAttachment("[More](background.md) ![A](a.png) [Docs](https://example.com)", names)).toBeUndefined();
  expect(missingAttachment("[More](notes.md)", names)).toMatch(/neither/);
  expect(missingAttachment("![A](https://example.com/a.png)", names)).toMatch(/not an attachment/);
  expect(missingAttachment("[Site](http://example.com)", names)).toMatch(/neither/);
  expect(missingAttachment("```\n[More](notes.md)\n```", names)).toBeUndefined();
});
it("keeps attachments to briefs and pages to their own rules", () => {
  const page = { name: "background.md", type: "text/markdown", text: "# Why\nSee ![A](a.png)" };
  expect(Schema.is(QuestionInput)(brief(ok + "\n[More](background.md)", { attachments: [page] }))).toBe(false);
  expect(Schema.is(QuestionInput)(brief(ok + "\n[More](background.md)", { attachments: [{ ...page, text: "# Why" }] }))).toBe(true);
  expect(Schema.is(QuestionInput)(brief(ok, { attachments: [{ ...page, text: "# Why" }, { ...page, text: "# Again" }] }))).toBe(false);
});
