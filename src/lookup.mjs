const PARAGRAPH = /^\((\d+(?:\^\d+)?)\)\s/;
const LETTER = /^([a-z](?:\^\d+)?)\)\s/;
const NOTE_OPEN = /^\(la (\d{2}-\d{2}-\d{4}),/;

export const indexArticles = (text) => {
  const articles = new Map();
  for (const chunk of text.split(/^=====$/m)) {
    const lines = chunk.split('\n').filter((l) => l !== '');
    const head = (lines[0] || '').match(/^Articolul (\d+(?:\^\d+)?)\s*$/);
    if (!head) continue;
    const id = head[1];
    const entry = articles.get(id);
    if (entry) entry.duplicates += 1;
    else articles.set(id, { id, lines: lines.slice(1), duplicates: 0 });
  }
  return articles;
};

const stripNotes = (lines) => {
  const body = [];
  const modified = [];
  let mode = null;
  for (const line of lines) {
    if (mode === 'amendment') {
      if (line === ')') mode = null;
      continue;
    }
    if (mode === 'note') {
      if (PARAGRAPH.test(line) || LETTER.test(line)) mode = null;
      else continue;
    }
    const open = line.match(NOTE_OPEN);
    if (open) {
      modified.push(open[1]);
      mode = 'amendment';
      continue;
    }
    if (line === 'Notă') {
      mode = 'note';
      continue;
    }
    body.push(line);
  }
  return { body, modified };
};

const newest = (dates) => dates.map((d) => d.split('-').reverse().join('-')).sort().pop()?.split('-').reverse().join('-') || null;

const sliceBlock = (lines, start, stop) => {
  const end = lines.findIndex((l, i) => i > start && stop(l));
  return lines.slice(start, end < 0 ? undefined : end);
};

export const lookup = (articles, citation) => {
  const entry = articles.get(citation.article);
  if (!entry) return { status: 'articol-negasit' };
  const { body, modified } = stripNotes(entry.lines);
  const base = { duplicates: entry.duplicates, lastModified: newest(modified) };
  if (body.length && /^\(?abrogat/i.test(body.join(' ').trim())) return { ...base, status: 'abrogat', text: body.join('\n') };
  if (!citation.paragraphs.length) return { ...base, status: 'ok', text: body.join('\n') };
  const parts = [];
  for (const p of citation.paragraphs) {
    const start = body.findIndex((l) => (l.match(PARAGRAPH) || [])[1] === p);
    if (start < 0) return { ...base, status: 'alineat-negasit', missing: p, text: body.join('\n') };
    let block = sliceBlock(body, start, (l) => PARAGRAPH.test(l));
    if (citation.letter) {
      const at = block.findIndex((l) => (l.match(LETTER) || [])[1] === citation.letter);
      if (at < 0) return { ...base, status: 'litera-negasita', missing: citation.letter, text: block.join('\n') };
      block = [block[0], ...sliceBlock(block, at, (l) => LETTER.test(l))];
    }
    parts.push(block.join('\n'));
  }
  return { ...base, status: 'ok', text: parts.join('\n') };
};
