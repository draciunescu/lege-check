const LABEL = {
  ok: 'găsit',
  abrogat: 'abrogat',
  'articol-negasit': 'articolul nu există în forma de azi',
  'alineat-negasit': 'alineatul nu există în forma de azi',
  'litera-negasita': 'litera nu există în forma de azi',
  'act-necunoscut': 'act nerecunoscut',
  'fara-act': 'citare fără act',
};

export const PROBLEMS = new Set(['abrogat', 'articol-negasit', 'alineat-negasit', 'litera-negasita', 'act-necunoscut', 'fara-act']);

export const formLabel = (s) => (s.consolidation ? `consolidarea din ${s.consolidation}` : 'fără consolidări listate pe portal (forma publicată)');

const clip = (text, max) => (text.length > max ? `${text.slice(0, max).trimEnd()} […]` : text);

const quote = (text, max) =>
  clip(text, max)
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');

export const renderMarkdown = (file, results, sources, { maxChars = 700 } = {}) => {
  const out = [`# Verificare citări: ${file}`, ''];
  const problems = results.filter((r) => PROBLEMS.has(r.status)).length;
  out.push(`${results.length} citări, ${problems} de verificat.`, '');
  out.push('Textul de mai jos e forma consolidată de pe legislatie.just.ro, neoficială și fără forță juridică. Singurul text oficial este cel din Monitorul Oficial.', '');
  for (const [label, s] of sources) out.push(`- ${label}: ${s.source}, ${formLabel(s)}`);
  out.push('');
  for (const r of results) {
    const mark = r.status === 'ok' ? 'OK' : 'DE VERIFICAT';
    out.push(`## Linia ${r.citation.line}: ${r.citation.raw}`, '', `${mark}: ${LABEL[r.status]}${r.missing ? ` (${r.missing})` : ''}`);
    if (r.duplicates) out.push('', `Atenție: titlul „Articolul ${r.citation.article}” apare de ${r.duplicates + 1} ori în pagină; am luat prima apariție.`);
    if (r.lastModified) out.push('', `Ultima modificare notată pe articol: ${r.lastModified}`);
    if (r.text) out.push('', quote(r.text, maxChars));
    out.push('');
  }
  return out.join('\n');
};

export const renderJson = (file, results, sources) =>
  JSON.stringify(
    {
      file,
      sources: Object.fromEntries([...sources].map(([label, s]) => [label, { source: s.source, consolidation: s.consolidation }])),
      citations: results.map((r) => ({
        line: r.citation.line,
        citation: r.citation.raw,
        act: r.citation.act?.label || r.citation.actRaw,
        article: r.citation.article,
        paragraphs: r.citation.paragraphs,
        letter: r.citation.letter,
        status: r.status,
        missing: r.missing || null,
        duplicates: r.duplicates || 0,
        lastModified: r.lastModified || null,
        text: r.text || null,
      })),
    },
    null,
    2,
  );
