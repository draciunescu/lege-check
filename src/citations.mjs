import { fold, CODE_PATTERN, NUMBERED_PATTERN, resolveAct } from './acts.mjs';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const NUM = `(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:\\s*\\^\\s*\\d+|[${SUP}]+|\\s*<sup>\\s*\\d+\\s*<\\/sup>|\\s+ind(?:\\.|ice)\\s*\\d+)?`;
const PAREN = '\\(\\s*\\d+(?:\\^\\d+)?\\s*\\)';
const ART = `art(?:icolul|icolele|\\.)?\\s*(${NUM})`;
const ALIN = `(?:\\s*,?\\s*alin(?:\\.|eatul|eatele)?\\s*(${PAREN}(?:\\s*(?:,|si|-)\\s*${PAREN})*))?`;
const LIT = '(?:\\s*,?\\s*lit(?:\\.|era|erele)?\\s*([a-z](?:\\^\\d+)?)(?![a-z])\\s*\\)?)?';
const ACT = `(${CODE_PATTERN}|${NUMBERED_PATTERN})(?![a-z0-9])`;
const CONNECT = '(?:,?\\s*(?:din|al|a|ale)\\s+(?:cadrul\\s+)?)?';

const FORWARD = new RegExp(`\\b${ART}${ALIN}${LIT}(?:\\s*${CONNECT}${ACT})?`, 'g');
const BEFORE = new RegExp(`(?<![a-z0-9.])${ACT}\\s*,\\s*(?=art)`, 'g');
const OWNED = /(?:din|al|a|ale)\s+(?:cadrul\s+)?$/;
const OTHER_ACT = /^\s*,?\s*(?:din|al|ale)\s+(?:cadrul\s+)?([^\s,.;:()]+(?:\s+[^\s,.;:()]+){0,3})/;
const STRUCTURE = /^(capitol|sectiun|subsectiun|titl|parte|carte|anex|paragraf|art|alin|lit|pct|punct)/i;
const OTHER_ACT_A = /^\s*,?\s*a\s+([A-ZĂÂÎȘȚ][^\s,.;:()]*(?:\s+[^\s,.;:()]+){0,3})/;

const SUP_CHAR = new RegExp(`[${SUP}]`, 'g');

const articleId = (s) => {
  const [, base, rest] = s.match(/^(\d{1,3}(?:\.\d{3})+|\d+)([\s\S]*)$/);
  const sup = rest.replace(SUP_CHAR, (c) => String(SUP.indexOf(c))).replace(/\D+/g, '');
  const number = base.replace(/\./g, '');
  return sup ? `${number}^${sup}` : number;
};

const paragraphs = (s) => (s ? [...s.matchAll(/\(\s*(\d+(?:\^\d+)?)\s*\)/g)].map((m) => m[1]) : []);

const unknownAct = (original, end) => {
  const rest = original.slice(end);
  const m = fold(rest).match(OTHER_ACT) || rest.match(OTHER_ACT_A);
  if (!m || STRUCTURE.test(fold(m[1]))) return null;
  const at = m.index + m[0].length - m[1].length;
  return rest.slice(at, at + m[1].length);
};

const citationsInLine = (original, lineNo) => {
  const line = fold(original);
  const byStart = new Map();
  for (const m of line.matchAll(FORWARD)) {
    const end = m.index + m[0].length;
    const actRaw = m[4] ? original.slice(m.index + m[0].length - m[4].length, end) : unknownAct(original, end);
    byStart.set(m.index, {
      line: lineNo,
      index: m.index,
      raw: original.slice(m.index, end).trim(),
      article: articleId(m[1]),
      paragraphs: paragraphs(m[2]),
      letter: m[3] || null,
      actRaw,
      act: m[4] ? resolveAct(m[4]) : null,
    });
  }
  for (const m of line.matchAll(BEFORE)) {
    if (OWNED.test(line.slice(0, m.index))) continue;
    const citation = byStart.get(m.index + m[0].length);
    if (!citation || citation.actRaw) continue;
    citation.actRaw = original.slice(m.index, m.index + m[1].length);
    citation.act = resolveAct(m[1]);
    citation.raw = original.slice(m.index, citation.index + citation.raw.length).trim();
  }
  return [...byStart.values()];
};

export const findCitations = (markdown) => {
  const found = [];
  let inFence = false;
  markdown
    .normalize('NFC')
    .split('\n')
    .forEach((original, i) => {
      if (/^\s*(```|~~~)/.test(original)) {
        inFence = !inFence;
        return;
      }
      if (!inFence) found.push(...citationsInLine(original, i + 1));
    });
  return found;
};
