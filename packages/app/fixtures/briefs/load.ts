import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The canvas's four example decisions (D1–D4) as an agent sends them: question.json, the card's Markdown from
// brief.md, and every other file in the folder as an attachment.
export const briefsDir = path.dirname(fileURLToPath(import.meta.url));
export const briefNames = () => readdirSync(briefsDir).filter(name => /^D\d/.test(name)).sort();
const TYPES: Record<string, 'text/markdown' | 'image/png' | 'image/jpeg'> = { '.md': 'text/markdown', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export function loadBrief(name: string): Record<string, unknown> {
  const dir = path.join(briefsDir, name);
  const question: { card: Record<string, unknown> } & Record<string, unknown> = JSON.parse(readFileSync(path.join(dir, 'question.json'), 'utf8'));
  const card = { ...question.card, markdown: readFileSync(path.join(dir, 'brief.md'), 'utf8') };
  const attachments = readdirSync(dir).filter(file => file !== 'question.json' && file !== 'brief.md').sort().map(file => {
    const type = TYPES[path.extname(file)];
    if (!type) throw new Error(`${name}/${file}: not an attachment type`);
    const bytes = readFileSync(path.join(dir, file));
    return type === 'text/markdown' ? { name: file, type, text: bytes.toString('utf8') } : { name: file, type, base64: bytes.toString('base64') };
  });
  return { ...question, card, ...(attachments.length ? { attachments } : {}) };
}
