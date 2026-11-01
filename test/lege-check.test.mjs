import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findCitations } from '../src/citations.mjs';
import { resolveAct } from '../src/acts.mjs';
import { toText, consolidatedBlock, history } from '../src/html.mjs';
import { indexArticles, lookup } from '../src/lookup.mjs';

const TEXT = [
  '=====',
  'Articolul 1',
  '(1) Primul alineat al articolului unu.',
  '(2) Al doilea alineat:',
  'a) prima literă;',
  'b) a doua literă.',
  '(la 10-02-2025,',
  'Alineatul (2) a fost modificat de Articolul I din LEGEA nr. 1 din 2025',
  ')',
  '(3) Al treilea.',
  '=====',
  'Articolul 2^1',
  '(Abrogat).',
].join('\n');

const articles = indexArticles(TEXT);

test('resolveAct knows codes, abbreviations and numbered acts', () => {
  assert.deepEqual(resolveAct('Codul muncii'), { tip: 'LEGE', numar: 53, an: 2003, label: 'Codul muncii' });
  assert.equal(resolveAct('Codul de procedură civilă').numar, 134);
  assert.equal(resolveAct('CPC').numar, 134);
  assert.deepEqual(resolveAct('Legea nr. 31/1990'), { tip: 'LEGE', numar: 31, an: 1990, label: 'Legea 31/1990' });
  assert.equal(resolveAct('OUG nr. 195/2002').tip, 'ORDONANȚĂ DE URGENȚĂ');
  assert.equal(resolveAct('Ordonanța Guvernului nr. 137/2000').tip, 'ORDONANȚĂ');
  assert.equal(resolveAct('Regulamentul 5/2020'), null);
});

test('findCitations reads article, paragraph, letter and act', () => {
  const [c] = findCitations('Conform art. 41 alin. (1) lit. a) din Codul muncii, ceva.');
  assert.equal(c.article, '41');
  assert.deepEqual(c.paragraphs, ['1']);
  assert.equal(c.letter, 'a');
  assert.equal(c.act.numar, 53);
  assert.match(c.raw, /^art\. 41 alin\. \(1\) lit\. a\) din Codul muncii/);
});

test('findCitations handles superscripts, several paragraphs and diacritics', () => {
  const found = findCitations('Vezi art. 52^1 alin. (1) și (2) din Codul de procedură civilă și articolul 3 din Legea nr. 31/1990.');
  assert.equal(found.length, 2);
  assert.equal(found[0].article, '52^1');
  assert.deepEqual(found[0].paragraphs, ['1', '2']);
  assert.equal(found[0].act.numar, 134);
  assert.equal(found[1].act.label, 'Legea 31/1990');
});

test('findCitations reads act-first form and flags citations without an act', () => {
  const found = findCitations('Legea 31/1990, art. 194 alin. (1)\nsi apoi art. 7 alin. (2) singur.');
  assert.equal(found[0].article, '194');
  assert.equal(found[0].act.numar, 31);
  assert.equal(found[1].act, null);
  assert.equal(found[1].actRaw, null);
});

test('findCitations skips fenced code', () => {
  assert.equal(findCitations('```\nart. 1 din Codul muncii\n```').length, 0);
});

test('lookup returns the paragraph, the letter and the last amendment date', () => {
  const para = lookup(articles, { article: '1', paragraphs: ['2'], letter: null });
  assert.equal(para.status, 'ok');
  assert.match(para.text, /Al doilea alineat/);
  assert.doesNotMatch(para.text, /Al treilea/);
  assert.equal(para.lastModified, '10-02-2025');
  const letter = lookup(articles, { article: '1', paragraphs: ['2'], letter: 'b' });
  assert.match(letter.text, /a doua literă/);
  assert.doesNotMatch(letter.text, /prima literă/);
});

test('lookup reports missing article, paragraph and repealed article', () => {
  assert.equal(lookup(articles, { article: '99', paragraphs: [], letter: null }).status, 'articol-negasit');
  assert.equal(lookup(articles, { article: '1', paragraphs: ['9'], letter: null }).status, 'alineat-negasit');
  assert.equal(lookup(articles, { article: '1', paragraphs: ['2'], letter: 'z' }).status, 'litera-negasita');
  assert.equal(lookup(articles, { article: '2^1', paragraphs: [], letter: null }).status, 'abrogat');
});

test('toText turns a portal page into articles separated by markers', () => {
  const html = readFileSync(new URL('./fixtures/act.html', import.meta.url), 'utf8');
  const text = toText(consolidatedBlock(html));
  const index = indexArticles(text);
  assert.deepEqual([...index.keys()], ['1', '2^1', '3']);
  assert.equal(lookup(index, { article: '3', paragraphs: ['1'], letter: null }).text, '(1) Text de trei.');
  assert.deepEqual(history(html), [{ date: '01.03.2026', id: '2' }]);
});
