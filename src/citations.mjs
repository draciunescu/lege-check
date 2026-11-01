import { fold, CODE_PATTERN, NUMBERED_PATTERN, resolveAct } from './acts.mjs';

const NUM = '\\d+(?:\\s*\\^\\s*\\d+)?';
const ART = `art(?:icolul|icolele|\\.)?\\s*(${NUM})`;
const ALIN = '(?:\\s*,?\\s*alin(?:\\.|eatul|eatele)?\\s*((?:\\(\\s*\\d+(?:\\^\\d+)?\\s*\\)(?:\\s*(?:,|si|și|\\-)\\s*)?)+))?';
const LIT = '(?:\\s*,?\\s*lit(?:\\.|era|erele)?\\s*([a-z](?:\\^\\d+)?)\\s*\\)?)?';
const ACT = `(${CODE_PATTERN}|${NUMBERED_PATTERN})`;

const FORWARD = new RegExp(`\\b${ART}${ALIN}${LIT}(?:\\s*,?\\s*(?:din|din cadrul|al)\\s+(?:cadrul\\s+)?${ACT}\\b)?`, 'gi');
const BACKWARD = new RegExp(`\\b${ACT}\\s*,\\s*${ART}${ALIN}${LIT}`, 'gi');

const articleId = (s) => s.replace(/\s+/g, '');
const paragraphs = (s) => (s ? [...s.matchAll(/\((\d+(?:\^\d+)?)\)/g)].map((m) => m[1]) : []);

const build = (source, line, index, raw, article, alin, lit, actRaw) => ({
  line,
  index,
  raw: source.slice(index, index + raw.length).trim(),
  article: articleId(article),
  paragraphs: paragraphs(alin),
  letter: lit || null,
  actRaw: actRaw || null,
  act: actRaw ? resolveAct(actRaw) : null,
});

export const findCitations = (markdown) => {
  const found = [];
  const lines = markdown.normalize('NFC').split('\n');
  let inFence = false;
  lines.forEach((original, i) => {
    if (/^\s*(```|~~~)/.test(original)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const line = fold(original);
    const taken = [];
    for (const m of line.matchAll(BACKWARD)) {
      taken.push([m.index, m.index + m[0].length]);
      found.push(build(original, i + 1, m.index, m[0], m[2], m[3], m[4], m[1]));
    }
    for (const m of line.matchAll(FORWARD)) {
      const end = m.index + m[0].length;
      if (taken.some(([a, b]) => m.index < b && end > a)) continue;
      found.push(build(original, i + 1, m.index, m[0], m[1], m[2], m[3], m[4]));
    }
  });
  return found.sort((a, b) => a.line - b.line || a.index - b.index);
};
