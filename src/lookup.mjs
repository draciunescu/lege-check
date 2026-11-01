import { NOTE_START, NOTE_END } from './html.mjs';

const PARAGRAPH = /^\((\d+(?:\^\d+)?)\)\s/;
const LETTER = /^([a-z](?:\^\d+)?)\)\s/;
const NOTE_OPEN = /^\(la (\d{2}-\d{2}-\d{4}),/;
const ACT_TAIL = /^NOTĂ:?$/;
const REPEALED = /^(?:\(\d+(?:\^\d+)?\)\s*|[a-z](?:\^\d+)?\)\s*)?\(?abrogat/i;

export const indexArticles = (text) => {
  const articles = new Map();
  for (const chunk of text.split(/^=====$/m)) {
    const lines = chunk.split('\n').filter((l) => l !== '');
    const head = (lines[0] || '').match(/^Articolul (\d{1,3}(?:\.\d{3})+|\d+)(\^\d+)?\.?$/);
    if (!head) continue;
    const id = head[1].replace(/\./g, '') + (head[2] || '');
    const entry = articles.get(id);
    if (entry) entry.duplicates += 1;
    else {
      const tail = lines.findIndex((l) => ACT_TAIL.test(l));
      articles.set(id, { lines: lines.slice(1, tail < 0 ? undefined : tail), duplicates: 0 });
    }
  }
  return articles;
};

const stripNotes = (lines) => {
  const body = [];
  const modified = [];
  let depth = 0;
  let amendment = false;
  for (const line of lines) {
    if (line === NOTE_START) depth++;
    else if (line === NOTE_END) depth = Math.max(0, depth - 1);
    else if (depth) continue;
    else if (amendment && line === ')') amendment = false;
    else if (amendment && !PARAGRAPH.test(line)) continue;
    else {
      amendment = false;
      const open = line.match(NOTE_OPEN);
      if (open) {
        modified.push(open[1]);
        amendment = !line.endsWith(')');
      } else body.push(line);
    }
  }
  return { body, modified };
};

const iso = (dmy) => dmy.split('-').reverse().join('-');

const newest = (dates) => (dates.length ? dates.reduce((a, b) => (iso(b) > iso(a) ? b : a)) : null);

const sliceBlock = (lines, start, stop) => {
  const end = lines.findIndex((l, i) => i > start && stop(l));
  return lines.slice(start, end < 0 ? undefined : end);
};

const unit = (body, paragraph, letter) => {
  let block = body;
  if (paragraph) {
    const start = body.findIndex((l) => (l.match(PARAGRAPH) || [])[1] === paragraph);
    if (start < 0) return { status: 'alineat-negasit', missing: `alin. (${paragraph})`, block: body };
    block = sliceBlock(body, start, (l) => PARAGRAPH.test(l));
  }
  if (!letter) return { block, first: block[0] };
  const at = block.findIndex((l) => (l.match(LETTER) || [])[1] === letter);
  if (at < 0) return { status: 'litera-negasita', missing: `lit. ${letter})`, block };
  const letterBlock = sliceBlock(block, at, (l) => LETTER.test(l) || PARAGRAPH.test(l));
  return { block: paragraph ? [block[0], ...letterBlock] : letterBlock, first: letterBlock[0] };
};

export const lookup = (articles, citation) => {
  const entry = articles.get(citation.article);
  if (!entry) return { status: 'articol-negasit' };
  const { body, modified } = stripNotes(entry.lines);
  const base = { duplicates: entry.duplicates, lastModified: newest(modified) };
  const parts = [];
  let repealed = false;
  for (const paragraph of citation.paragraphs.length ? citation.paragraphs : [null]) {
    const u = unit(body, paragraph, citation.letter);
    if (u.status) return { ...base, status: u.status, missing: u.missing, text: u.block.join('\n') };
    repealed ||= REPEALED.test(u.first || '');
    parts.push(u.block.join('\n'));
  }
  return { ...base, status: repealed ? 'abrogat' : 'ok', text: parts.join('\n') };
};
