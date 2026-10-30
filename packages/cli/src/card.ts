import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { Either, ParseResult, Schema } from 'effect';
import { QuestionInput } from '../../blueprint/design/schemas/exchange.ts';
import { briefProblem, missingAttachment, attachmentTypes, IMAGE_MAX_BYTES, ATTACHMENTS_MAX, ATTACHMENTS_MAX_BYTES, BRIEF_MAX_CHARACTERS } from '../../blueprint/design/ui/components/cards/brief/schema.ts';

// card.yaml (docs/v2/02-writing-rules.md §2): the whole card as structure, each key landing in one place on the
// phone. `ask` refuses only what is mechanically certain (R1–R4 here; R5 and R6 come from the server), one line per
// problem, and compiles the rest to the brief the server and phone read today. The brief is then held to the server's
// own QuestionInput, so nothing the server would refuse leaves this machine: once cards are end-to-end encrypted the
// server can't read them to refuse them.

export const LIMITS = { title: 100, detail: 280, prioritizes: 280, label: 20, markdown: BRIEF_MAX_CHARACTERS, page: 20_000, image: IMAGE_MAX_BYTES, attachments: ATTACHMENTS_MAX, attachmentBytes: ATTACHMENTS_MAX_BYTES };
const RATINGS = ['green', 'yellow', 'orange', 'red'] as const;
const STORY = { changes: 'What {L} changes', why: 'Why choose {L}', why_not: 'Why pass on {L}', assumes: 'Assumptions {L} makes' } as const;
const KEYS = {
  card: ['title', 'detail', 'context', 'options', 'tradeoffs', 'recommendation', 'next_steps', 'attachments'],
  context: ['heading', 'summary', 'more'], more: ['title', 'body'],
  option: ['label', 'title', 'prioritizes', 'changes', 'why', 'why_not', 'assumes', 'looks_like'],
  recommendation: ['option', 'why', 'changes_my_mind'],
};
const PROSE = ['context.summary', 'context.more.body', 'recommendation.why', 'recommendation.changes_my_mind'];

export type Attachment = { name: string; type: 'text/markdown'; text: string } | { name: string; type: 'image/png' | 'image/jpeg'; base64: string };
export type Brief = {
  title: string; detail: string;
  card: { type: 'brief'; recommended: number; options: { number: number; title: string; label: string; prioritizes: string }[]; markdown: string };
  attachments?: Attachment[];
};
export type Compiled = { ok: true; brief: Brief } | { ok: false; problems: string[] };

type Fields = { [key: string]: unknown };
const isRecord = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
const letter = (i: number) => String.fromCharCode(65 + i);
const count = (s: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length;
const number = (n: number) => n.toLocaleString('en-US');
// Strict base64: the alphabet, whole quads and at most two "=", or nothing.
const base64 = (text: string) => /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text) && text.length > 0 ? Buffer.from(text, 'base64') : null;
const typeOf = (name: string) => name.endsWith('.md') ? 'text/markdown' : name.endsWith('.png') ? 'image/png' : /\.jpe?g$/.test(name) ? 'image/jpeg' : null;

// Prose: paragraphs and "- " bullets, hard-wrapped lines joined, so the phone reflows them. A fenced block (a diff,
// a Mermaid flowchart) passes through line for line.
export function prose(text: string): string {
  const out: string[] = [];
  let items: string[] = [], fence: string[] | null = null;
  const flush = () => { if (items.length) out.push(items.join('\n')); items = []; };
  for (const raw of text.replace(/\s+$/, '').split('\n')) {
    const line = raw.trim();
    if (fence) { fence.push(raw); if (/^(```|~~~)\s*$/.test(line)) { out.push(fence.join('\n')); fence = null; } continue; }
    if (/^(```|~~~)/.test(line)) { flush(); fence = [raw]; continue; }
    if (!line) { flush(); continue; }
    if (/^[-*] /.test(line) || /^!\[[^\]]*\]\([^)]+\)$/.test(line) || items.length === 0) items.push(line);
    else items[items.length - 1] += ' ' + line;
  }
  flush();
  if (fence) out.push(fence.join('\n'));
  return out.join('\n\n');
}
// The text outside fenced blocks: a heading, table or HTML inside a fence is code, not structure.
const unfenced = (text: string) => {
  let inside = false;
  return text.split('\n').filter(l => { if (/^\s*(```|~~~)/.test(l)) { inside = !inside; return false; } return !inside; }).join('\n');
};
const images = (text: string) => [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(m => m[1]);

// Reads a card.yaml file (attachments are files next to it) or a card object from MCP (attachments inline).
// A card is a file, YAML text read from stdin (its attachments next to the working folder), or an MCP object.
export type Source = { file: string } | { yaml: string; dir: string } | { object: unknown };
export function load(source: Source): { card: unknown; files: Map<string, Attachment | null>; problems: string[] } {
  const files = new Map<string, Attachment | null>(), problems: string[] = [];
  let card: unknown;
  if ('file' in source) {
    let bytes: Buffer, text: string;
    try { bytes = readFileSync(source.file); } catch { return { card: null, files, problems: [`There is no card at ${source.file}.`] }; }
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return { card: null, files, problems: [`${source.file} isn't UTF-8 text.`] }; }
    return load({ yaml: text, dir: path.dirname(source.file) });
  }
  if ('yaml' in source) {
    try { card = parse(source.yaml); } catch (e) {
      const why = e instanceof Error ? e.message.split('\n')[0].replace(/:$/, '') : 'unknown error';
      const hint = /mappings? .*(not allowed|implicit keys)|Implicit map keys/i.test(why) ? ' Put a value that holds ": " in quotes, such as detail: "Two options: fast or safe".' : '';
      return { card: null, files, problems: [`card.yaml doesn't parse: ${why}.${hint}`] };
    }
    const listed = isRecord(card) && Array.isArray(card.attachments) ? card.attachments : [];
    for (const name of listed) {
      if (typeof name !== 'string') continue;
      const type = typeOf(name), file = path.join(source.dir, name);
      try {
        if (!statSync(file).isFile()) { files.set(name, null); continue; }
        if (type === 'text/markdown') {
          const bytes = readFileSync(file);
          try { files.set(name, { name, type, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }); }
          catch { problems.push(`Attachment ${name} isn't UTF-8 text.`); }
        }
        else if (type) files.set(name, { name, type, base64: readFileSync(file).toString('base64') });
      } catch { files.set(name, null); }
    }
  } else {
    card = source.object;
    const listed = isRecord(card) && Array.isArray(card.attachments) ? card.attachments : [];
    if (isRecord(card)) card = { ...card, attachments: listed.map(a => isRecord(a) && typeof a.name === 'string' ? a.name : a) };
    for (const a of listed) {
      if (!isRecord(a) || typeof a.name !== 'string') continue;
      const type = typeOf(a.name);
      if (!type) continue;
      if (a.type !== undefined && a.type !== type) { problems.push(`Attachment ${a.name} is declared ${String(a.type)} but its name says ${type}.`); continue; }
      const bytes = typeof a.base64 === 'string' ? base64(a.base64) : null;
      if (typeof a.base64 === 'string' && !bytes) { problems.push(`Attachment ${a.name} isn't valid base64.`); continue; }
      if (type === 'text/markdown' && typeof a.text === 'string') files.set(a.name, { name: a.name, type, text: a.text });
      else if (type === 'text/markdown' && bytes) {
        try { files.set(a.name, { name: a.name, type, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }); }
        catch { problems.push(`Attachment ${a.name} isn't UTF-8 text.`); }
      } else if (type !== 'text/markdown' && bytes && typeof a.base64 === 'string') files.set(a.name, { name: a.name, type, base64: a.base64 });
      // Named but with nothing in it: refused as missing, never sent without it.
      else files.set(a.name, null);
    }
  }
  return { card, files, problems };
}

export function compile(source: Source): Compiled {
  const loaded = load(source);
  if (loaded.problems.length) return { ok: false, problems: loaded.problems };
  const c = loaded.card, files = loaded.files, problems: string[] = [];
  if (!isRecord(c)) return { ok: false, problems: ['card.yaml must be a set of keys: title, detail, context, options, recommendation and the rest.'] };
  const text = (value: unknown, where: string, required: boolean): string | undefined => {
    if (value === undefined || value === null || value === '') { if (required) problems.push(`${where} is missing.`); return undefined; }
    if (typeof value !== 'string' && typeof value !== 'number') { problems.push(`${where} must be text.`); return undefined; }
    return String(value).trim();
  };
  const unknown = (value: Fields, allowed: readonly string[], where: string) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) problems.push(`${where}${key} is not a card key.`);
  };
  // Fields that become one line, a button or a table cell: no line breaks, and nothing that breaks the table.
  const line = (value: string | undefined, where: string, cell = false) => {
    if (value === undefined) return;
    if (/[\r\n\u2028\u2029]/.test(value)) problems.push(`${where} must be one line.`);
    else if (cell && /[|]/.test(value)) problems.push(`${where} has a "|", which would break the Options table; use "/" or words.`);
    else if (cell && /[[\]]/.test(value)) problems.push(`${where} has a square bracket; use parentheses.`);
  };
  const limit = (value: string | undefined, max: number, where: string) => {
    if (value !== undefined && count(value) > max) problems.push(`${where} is ${number(count(value))} characters; the limit is ${number(max)}.`);
  };
  // R1: no headings, tables or HTML inside a prose field.
  const plain = (whole: string | undefined, where: string) => {
    if (whole === undefined) return;
    const value = unfenced(whole);
    if (/^\s*#/m.test(value)) problems.push(`${where} has a heading; prose fields take paragraphs, bullets and images only.`);
    else if (/^\s*\|/m.test(value)) problems.push(`${where} has a table; put comparisons in tradeoffs.`);
    else if (/<[A-Za-z/!?]/.test(value)) problems.push(`${where} has HTML; write plain text.`);
  };

  unknown(c, KEYS.card, '');
  const title = text(c.title, 'title', true), detail = text(c.detail, 'detail', true);
  limit(title, LIMITS.title, 'title'); limit(detail, LIMITS.detail, 'detail');
  line(title, 'title'); line(detail, 'detail');
  plain(title, 'title'); plain(detail, 'detail');

  const context = isRecord(c.context) ? c.context : {};
  if (c.context !== undefined && !isRecord(c.context)) problems.push('context must be a set of keys: heading, summary, more.');
  if (isRecord(c.context)) unknown(c.context, KEYS.context, 'context.');
  const heading = text(context.heading, 'context.heading', false), summary = text(context.summary, 'context.summary', true);
  line(heading, 'context.heading'); limit(heading, LIMITS.title, 'context.heading');
  plain(summary, 'context.summary');
  const more = isRecord(context.more) ? context.more : undefined;
  if (context.more !== undefined && !more) problems.push('context.more must have a title and a body.');
  if (more) unknown(more, KEYS.more, 'context.more.');
  const moreTitle = more ? text(more.title, 'context.more.title', true) : undefined, moreBody = more ? text(more.body, 'context.more.body', true) : undefined;
  line(moreTitle, 'context.more.title', true); limit(moreTitle, LIMITS.title, 'context.more.title');
  plain(moreBody, 'context.more.body');

  const options = Array.isArray(c.options) ? c.options : [];
  if (!Array.isArray(c.options)) problems.push(c.options === undefined ? 'options is missing.' : 'options must be a list.');
  else if (options.length < 2) problems.push('A decision needs at least two options.');
  else if (options.length > 4) problems.push(`A decision takes at most four options; this one has ${options.length}.`);
  const letters = options.map((_, i) => letter(i));
  const parsed = options.map((o, i) => {
    const where = `options[${i}]`;
    if (!isRecord(o)) { problems.push(`${where} must be a set of keys: label, title, prioritizes and its story.`); return null; }
    unknown(o, KEYS.option, `${where}.`);
    const label = text(o.label, `${where}.label`, true), t = text(o.title, `${where}.title`, true), p = text(o.prioritizes, `${where}.prioritizes`, true);
    limit(label, LIMITS.label, `${where}.label`); limit(p, LIMITS.prioritizes, `${where}.prioritizes`);
    line(label, `${where}.label`, true); line(t, `${where}.title`, true); line(p, `${where}.prioritizes`);
    const story: { -readonly [k in keyof typeof STORY]?: string } = {};
    for (const key of Object.keys(STORY) as (keyof typeof STORY)[]) { story[key] = text(o[key], `${where}.${key}`, false); plain(story[key], `${where}.${key}`); }
    const looks = text(o.looks_like, `${where}.looks_like`, false);
    return { label: label ?? '', title: t ?? '', prioritizes: p ?? '', story, looks };
  });

  const tradeoffs = Array.isArray(c.tradeoffs) ? c.tradeoffs : [];
  if (c.tradeoffs !== undefined && !Array.isArray(c.tradeoffs)) problems.push('tradeoffs must be a list of rows.');
  const rows = tradeoffs.map((row, i) => {
    const where = `tradeoffs[${i}]`;
    if (!isRecord(row)) { problems.push(`${where} must have a concern and a cell per option.`); return null; }
    const concern = text(row.concern, `${where}.concern`, true);
    line(concern, `${where}.concern`, true);
    const cells: string[] = [];
    for (const key of Object.keys(row)) if (key !== 'concern' && !letters.includes(key)) problems.push(/^[A-Z]$/.test(key) ? `${where} has a cell for ${key}, which is not an option.` : `${where}.${key} is not a card key.`);
    for (const l of letters) {
      const cell = text(row[l], `${where}.${l}`, false);
      if (cell === undefined) { problems.push(`${where} has no cell for ${l}.`); continue; }
      const m = cell.match(/^(\w+):\s*(.+)$/s);
      if (!m || !RATINGS.some(r => r === m[1])) { problems.push(`${where}.${l} must start with green, yellow, orange or red and a colon.`); continue; }
      const before = problems.length;
      line(m[2], `${where}.${l}`, true);
      if (problems.length === before) cells.push(`:${m[1]}[${m[2]}]`);
    }
    return { concern: concern ?? '', cells };
  });

  const rec = isRecord(c.recommendation) ? c.recommendation : {};
  if (c.recommendation === undefined) problems.push('recommendation is missing.');
  else if (!isRecord(c.recommendation)) problems.push('recommendation must have an option and a why.');
  else unknown(c.recommendation, KEYS.recommendation, 'recommendation.');
  const recOption = text(rec.option, 'recommendation.option', isRecord(c.recommendation)), why = text(rec.why, 'recommendation.why', isRecord(c.recommendation));
  const changesMind = text(rec.changes_my_mind, 'recommendation.changes_my_mind', false);
  line(recOption, 'recommendation.option'); line(why, 'recommendation.why'); line(changesMind, 'recommendation.changes_my_mind');
  plain(why, 'recommendation.why'); plain(changesMind, 'recommendation.changes_my_mind');
  const recommended = recOption ? letters.indexOf(recOption) + 1 : 0;
  if (recOption && !recommended) problems.push(`recommendation.option is ${recOption} but there ${letters.length === 1 ? 'is one option' : `are ${['no', 'one', 'two', 'three', 'four'][letters.length] ?? letters.length} options`}.`);

  const next = isRecord(c.next_steps) ? c.next_steps : undefined;
  if (c.next_steps !== undefined && !next) problems.push('next_steps must have a line per option and if_no_answer.');
  const nextLines: string[] = [];
  if (next) {
    const nextHeading = text(next.heading, 'next_steps.heading', false);
    line(nextHeading, 'next_steps.heading'); limit(nextHeading, LIMITS.title, 'next_steps.heading');
    for (const key of Object.keys(next)) if (!['heading', 'if_no_answer', ...letters].includes(key)) problems.push(/^[A-Z]$/.test(key) ? `next_steps.${key} names no option.` : `next_steps.${key} is not a card key.`);
    for (const l of letters) { const step = text(next[l], `next_steps.${l}`, false); line(step, `next_steps.${l}`); if (step) nextLines.push(`**After ${l}:** ${step}`); }
    const none = text(next.if_no_answer, 'next_steps.if_no_answer', false);
    line(none, 'next_steps.if_no_answer');
    if (none) nextLines.push(`**If no decision:** ${none}`);
  }

  // R3: every image or page the card names is attached; every attachment listed is there.
  const listed = Array.isArray(c.attachments) ? c.attachments.filter((a): a is string => typeof a === 'string') : [];
  if (c.attachments !== undefined && !Array.isArray(c.attachments)) problems.push('attachments must be a list of file names.');
  for (const name of listed) {
    if (!typeOf(name)) problems.push(`Attachment ${name} must end in .md, .png or .jpg.`);
    else if (files.get(name) === null) problems.push('object' in source ? `Attachment ${name} has no content: give its base64 (or text for a .md page).` : `Attachment ${name} is listed but there is no such file next to card.yaml.`);
  }
  const named: [string, string][] = [];
  const scan = (value: string | undefined, where: string) => { for (const n of images(value ?? '')) named.push([n, where]); };
  scan(summary, 'context.summary'); scan(moreBody, 'context.more.body'); scan(why, 'recommendation.why');
  parsed.forEach((o, i) => { if (!o) return; for (const [k, v] of Object.entries(o.story)) scan(v, `options[${i}].${k}`); if (o.looks) named.push([o.looks, `options[${i}].looks_like`]); });
  for (const [n, where] of named) if (!listed.includes(n)) problems.push(`${where} names ${n} but no attachment has that name.`);

  // R4: sizes.
  const attached = listed.map(n => files.get(n)).filter((a): a is Attachment => !!a);
  let total = 0;
  for (const a of attached) {
    const bytes = 'text' in a ? Buffer.byteLength(a.text) : Buffer.from(a.base64, 'base64').length;
    total += bytes;
    if ('text' in a && count(a.text) > LIMITS.page) problems.push(`Attachment ${a.name} is ${number(count(a.text))} characters; the limit is ${number(LIMITS.page)}. Split it, or cut it.`);
    if (!('text' in a) && bytes > LIMITS.image) problems.push(`Attachment ${a.name} is ${number(bytes)} bytes; an image may be at most ${number(LIMITS.image)}.`);
  }
  const pages = attached.length + (more ? 1 : 0);
  if (pages > LIMITS.attachments) problems.push(`The card has ${pages} attachments; the limit is ${LIMITS.attachments}.`);
  if (total > LIMITS.attachmentBytes) problems.push(`The attachments are ${number(total)} bytes in all; the limit is ${number(LIMITS.attachmentBytes)}.`);
  if (problems.length) return { ok: false, problems };

  // The brief: today's Markdown sections, so the phone draws it unchanged.
  const ok = parsed.filter((o): o is NonNullable<typeof o> => !!o);
  const pageName = (() => { let n = 'background.md', i = 1; while (listed.includes(n)) n = `background-${i++}.md`; return n; })();
  const md: string[] = [];
  md.push(`## Context${heading ? ': ' + heading : ''}`, prose(summary ?? ''));
  if (more) md.push(`[${moreTitle}](${pageName})`);
  md.push('', '## Options');
  ok.forEach((o, i) => {
    const L = letter(i), parts: string[] = [];
    if (o.looks) parts.push(`![${o.label}](${o.looks})`);
    for (const key of Object.keys(STORY) as (keyof typeof STORY)[]) { const v = o.story[key]; if (v) parts.push(`### ${STORY[key].replace('{L}', L)}`, prose(v)); }
    if (parts.length) md.push(`:::option ${L}`, ...parts, ':::');
  });
  const live = rows.filter((r): r is NonNullable<typeof r> => !!r);
  if (live.length) {
    md.push('', '## Tradeoffs', `| | ${ok.map((o, i) => `${letter(i)} ${o.title}`).join(' | ')} |`, `|---|${ok.map(() => '---').join('|')}|`);
    for (const r of live) md.push(`| ${r.concern} | ${r.cells.join(' | ')} |`);
  }
  md.push('', `## Recommendation: ${letter(recommended - 1)}`, `**Why:** ${why ?? ''}`);
  if (changesMind) md.push(`**Assumes:** ${changesMind}`);
  if (nextLines.length) md.push('', `## Next steps${next && typeof next.heading === 'string' && next.heading.trim() ? ': ' + next.heading.trim() : ''}`, ...nextLines);
  const markdown = md.join('\n') + '\n';
  const all: Attachment[] = [...attached, ...(more ? [{ name: pageName, type: 'text/markdown' as const, text: `# ${moreTitle}\n\n${prose(moreBody ?? '')}\n` }] : [])];
  if (count(markdown) > LIMITS.markdown) return { ok: false, problems: [`The card is ${number(count(markdown))} characters as a brief; the limit is ${number(LIMITS.markdown)}. Move detail into an attached page.`] };
  const wrong = briefProblem(markdown, ok.length, recommended) ?? missingAttachment(markdown, attachmentTypes(all));
  if (wrong) return { ok: false, problems: [`The card doesn't compile: ${wrong}.`] };
  const brief: Brief = { title: title ?? '', detail: detail ?? '', card: { type: 'brief', recommended, options: ok.map((o, i) => ({ number: i + 1, title: o.title, label: o.label, prioritizes: o.prioritizes })), markdown }, ...(all.length ? { attachments: all } : {}) };
  const refused = serverProblems(brief, more ? pageName : null);
  return refused.length ? { ok: false, problems: refused } : { ok: true, brief };
}

// What QuestionInput refuses, one line each, at the card.yaml key it came from: card.options.0.title is
// options[0].title. The brief has the server's shape by construction, so its problems are refinements (a limit, an
// attachment's name or bytes); the type issues beside them come from trying an attachment as the other kind.
function serverProblems(brief: Brief, page: string | null): string[] {
  const decoded = Schema.decodeUnknownEither(QuestionInput)(brief);
  if (Either.isRight(decoded)) return [];
  const issues = ParseResult.ArrayFormatter.formatErrorSync(decoded.left), refinements = issues.filter(i => i._tag === 'Refinement');
  const where = ([first, second, third, fourth]: ReadonlyArray<PropertyKey>) => {
    if (first === 'title' || first === 'detail') return first;
    if (first === 'card' && second === 'options' && typeof third === 'number' && typeof fourth === 'string') return `options[${third}].${fourth}`;
    if (first === 'attachments' && typeof second === 'number') { const name = brief.attachments?.[second]?.name; return name === page ? 'context.more' : `Attachment ${name}`; }
    return first === 'attachments' ? 'attachments' : "The card doesn't compile";
  };
  return [...new Set((refinements.length ? refinements : issues).map(i => `${where(i.path)}: ${i.message}.`))];
}
