export const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

export const consolidatedBlock = (html) => {
  const start = html.indexOf('id="div_Formaconsolidata"');
  if (start < 0) throw new Error('Pagina nu are div_Formaconsolidata');
  const marker = html.indexOf('id="div_Formerepublicate"', start);
  const end = marker < 0 ? -1 : html.lastIndexOf('<', marker);
  return html.slice(html.indexOf('>', start) + 1, end < 0 ? undefined : end);
};

export const dmy = (s) => s.split('.').reverse().join('-');

export const history = (html) => {
  const box = (html.match(/id="istoric_fa"[\s\S]*?<\/div>/) || [''])[0];
  return [...box.matchAll(/<a\b([^>]*)>\s*(\d{2}\.\d{2}\.\d{4})\s*<\/a>/g)].map(([, attrs, date]) => ({
    date,
    id: (attrs.match(/DetaliiDocument(?:Afis)?\/(\d+)/) || [])[1] || null,
  }));
};

const BLOCK_CLASS = /^S_(ART|ALN|LIT|PAR|NTA|NTA_PAR|CAP|SEC|TTL|TIT|PRT|CRT|PCT|SMN_PAR|DEN|HDR|PUB|ANX|ANX_TTL)$/;
const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'col', 'wbr']);
export const ARTICLE_BREAK = '\n=====\n';
export const NOTE_START = '⟦notă⟧';
export const NOTE_END = '⟦/notă⟧';

export const toText = (html) => {
  const out = [];
  const stack = [];
  let skip = 0;
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g)) {
    if (m[4] !== undefined) {
      if (!skip) out.push(decode(m[4]));
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (VOID.has(tag)) {
      if (tag === 'br' && !skip) out.push('\n');
      continue;
    }
    if (m[1]) {
      const at = stack.map((e) => e.tag).lastIndexOf(tag);
      if (at < 0) continue;
      for (const e of stack.splice(at)) {
        if (e.skip) skip--;
        if (e.note) out.push(`\n${NOTE_END}\n`);
      }
      continue;
    }
    const cls = (m[3].match(/class="([^"]*)"/) || [])[1] || '';
    const isSkip = cls === 'TAG_COLLAPSED' || cls.endsWith('_SHORT') || tag === 'script' || tag === 'style';
    const isNote = cls === 'S_NTA' && !skip;
    stack.push({ tag, skip: isSkip, note: isNote });
    if (isSkip) skip++;
    else if (!skip && cls === 'S_ART') out.push(ARTICLE_BREAK);
    else if (isNote) out.push(`\n${NOTE_START}\n`);
    else if (!skip && (BLOCK_CLASS.test(cls) || /display:\s*block/.test(m[3]) || ['div', 'p', 'li', 'tr', 'table'].includes(tag))) out.push('\n');
  }
  return out
    .join('')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((l) => l && l !== '+')
    .join('\n');
};
