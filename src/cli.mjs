#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { findCitations } from './citations.mjs';
import { resolveAct, actKey } from './acts.mjs';
import { loadAct, PortalRefused } from './portal.mjs';
import { indexArticles, lookup } from './lookup.mjs';
import { renderMarkdown, renderJson, PROBLEMS } from './report.mjs';

const USAGE = `lege-check: verifică citările de lege dintr-un fișier Markdown contra formei consolidate de azi

  lege-check check <fișier.md|-> [--act "Codul muncii"] [--json] [--fresh] [--max-chars 700]
  lege-check art "<act>" <articol> [alineat]      ex: lege-check art "Codul muncii" 41 1

--act      actul pentru citările fără act ("art. 41 alin. (1)" singur)
--json     rezultat JSON în loc de Markdown
--fresh    ignoră cache-ul zilei și cere din nou portalul
Cod de ieșire: 0 totul găsit, 1 există citări de verificat, 2 eroare.`;

const options = {
  act: { type: 'string' },
  json: { type: 'boolean', default: false },
  fresh: { type: 'boolean', default: false },
  'max-chars': { type: 'string', default: '700' },
  help: { type: 'boolean', short: 'h', default: false },
};

const readInput = (file) => readFileSync(file === '-' ? 0 : file, 'utf8');

const check = async (file, values) => {
  const defaultAct = values.act ? resolveAct(values.act) : null;
  if (values.act && !defaultAct) throw new Error(`Act nerecunoscut: ${values.act}`);
  const citations = findCitations(readInput(file));
  const sources = new Map();
  const indexes = new Map();
  const results = [];
  for (const citation of citations) {
    const act = citation.act || (citation.actRaw ? null : defaultAct);
    if (!act) {
      results.push({ citation, status: citation.actRaw ? 'act-necunoscut' : 'fara-act' });
      continue;
    }
    const key = actKey(act);
    if (!indexes.has(key)) {
      const loaded = await loadAct(act, { fresh: values.fresh });
      sources.set(act.label, loaded);
      indexes.set(key, indexArticles(loaded.text));
    }
    results.push({ citation, ...lookup(indexes.get(key), citation) });
  }
  const label = file === '-' ? 'stdin' : file;
  console.log(values.json ? renderJson(label, results, sources) : renderMarkdown(label, results, sources, { maxChars: Number(values['max-chars']) }));
  return results.some((r) => PROBLEMS.has(r.status)) ? 1 : 0;
};

const art = async (actName, article, paragraph, values) => {
  const act = resolveAct(actName);
  if (!act) throw new Error(`Act nerecunoscut: ${actName}`);
  const loaded = await loadAct(act, { fresh: values.fresh });
  const citation = { article, paragraphs: paragraph ? [paragraph] : [], letter: null };
  const result = lookup(indexArticles(loaded.text), citation);
  console.log(`${act.label}, art. ${article}${paragraph ? ` alin. (${paragraph})` : ''}: ${result.status}`);
  console.log(`${loaded.source}, consolidarea din ${loaded.consolidation || 'necunoscută'}`);
  if (result.lastModified) console.log(`Ultima modificare notată: ${result.lastModified}`);
  if (result.text) console.log(`\n${result.text}`);
  return result.status === 'ok' ? 0 : 1;
};

const main = async () => {
  const { values, positionals } = parseArgs({ options, allowPositionals: true });
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return command ? 0 : 2;
  }
  if (command === 'check' && rest.length === 1) return check(rest[0], values);
  if (command === 'art' && rest.length >= 2) return art(rest[0], rest[1], rest[2], values);
  console.error(USAGE);
  return 2;
};

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(e instanceof PortalRefused ? e.message : `Eroare: ${e.message}`);
    process.exitCode = 2;
  });
