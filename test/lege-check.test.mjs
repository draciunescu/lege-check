import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findCitations } from '../src/citations.mjs';
import { resolveAct } from '../src/acts.mjs';
import { toText, consolidatedBlock, history, NOTE_START, NOTE_END } from '../src/html.mjs';
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
  '(3) Abrogat.',
  '(4) Al patrulea.',
  '(la 01-03-2026, Alineatul (4) a fost introdus de LEGEA nr. 2 din 2026 )',
  '(5) Al cincilea.',
  NOTE_START,
  'Notă',
  'Articolul IV din LEGEA nr. 3 din 2026 prevede:',
  '(1) Alineat citat din alt act.',
  '(6) Alt alineat citat, cu număr care pare continuare.',
  NOTE_END,
  '(6) Al șaselea, după notă.',
  '=====',
  'Articolul 2^1',
  '(Abrogat).',
  '=====',
  'Articolul 1.350',
  '(1) Text cu punct de mii.',
  '=====',
  'Articolul 788.',
  'Text cu punct după număr.',
  '=====',
  'Articolul 3',
  'Dispozițiile se aplică:',
  'a) primei categorii;',
  NOTE_START,
  'Notă',
  'Prin DECIZIA nr. 1 s-a constatat ceva.',
  'b) literă citată în notă.',
  NOTE_END,
  'b) celei de-a doua categorii.',
  'NOTĂ:',
  'Reproducem mai jos dispozițiile altui act:',
  '(1) Alineat din alt act.',
].join('\n');

const articles = indexArticles(TEXT);
const one = (md) => findCitations(md)[0];

test('resolveAct knows codes, genitive, abbreviations and numbered acts', () => {
  assert.deepEqual(resolveAct('Codul muncii'), { tip: 'LEGE', numar: 53, an: 2003, label: 'Codul muncii' });
  assert.equal(resolveAct('Codului muncii').numar, 53);
  assert.equal(resolveAct('C.muncii').numar, 53);
  assert.equal(resolveAct('Codul de procedură civilă').numar, 134);
  assert.equal(resolveAct('C. proc. civ.').numar, 134);
  assert.equal(resolveAct('c.civ.').numar, 287);
  assert.deepEqual(resolveAct('Legea nr. 31/1990'), { tip: 'LEGE', numar: 31, an: 1990, label: 'Legea 31/1990' });
  assert.equal(resolveAct('O.U.G. nr. 195/2002').tip, 'ORDONANȚĂ DE URGENȚĂ');
  assert.equal(resolveAct('Ordonanța de urgență a Guvernului nr. 57/2019').label, 'Codul administrativ');
  assert.equal(resolveAct('Ordonanța Guvernului nr. 137/2000').tip, 'ORDONANȚĂ');
  assert.equal(resolveAct('H.G. nr. 905/2017').tip, 'HOTĂRÂRE');
  assert.equal(resolveAct('Regulamentul 5/2020'), null);
  assert.deepEqual(resolveAct('Legea nr. 53/2003'), { tip: 'LEGE', numar: 53, an: 2003, label: 'Codul muncii' });
  assert.deepEqual(resolveAct('LEGEA nr. 283 din 17 octombrie 2022'), { tip: 'LEGE', numar: 283, an: 2022, label: 'Legea 283/2022' });
  assert.equal(resolveAct('Legea-cadru nr. 153/2017').numar, 153);
  assert.deepEqual(resolveAct('Legea societăților nr. 31/1990'), { tip: 'LEGE', numar: 31, an: 1990, label: 'Legea 31/1990' });
  assert.equal(resolveAct('Codul administrativ').tip, 'ORDONANȚĂ DE URGENȚĂ');
});

test('findCitations reads article, paragraph, letter and act', () => {
  const c = one('Conform art. 41 alin. (1) lit. a) din Codul muncii, ceva.');
  assert.equal(c.article, '41');
  assert.deepEqual(c.paragraphs, ['1']);
  assert.equal(c.letter, 'a');
  assert.equal(c.act.numar, 53);
  assert.equal(c.raw, 'art. 41 alin. (1) lit. a) din Codul muncii');
});

test('findCitations handles superscripts in every common spelling', () => {
  for (const md of ['art. 52^1 din CPC', 'art. 52¹ din CPC', 'art. 52<sup>1</sup> din CPC', 'art. 52 ind. 1 din CPC', 'art. 52 indice 1 din CPC']) {
    const c = one(md);
    assert.equal(c.article, '52^1', md);
    assert.equal(c.act.numar, 134, md);
  }
});

test('findCitations reads several paragraphs, diacritics and abbreviations with dots', () => {
  const found = findCitations('Vezi art. 52 alin. (1) și (2) din Codul de procedură civilă, art. 1.169 nu, și art. 5 din C. civ. sau art. 41 C. muncii.');
  assert.deepEqual(found[0].paragraphs, ['1', '2']);
  assert.equal(found[0].act.numar, 134);
  assert.equal(found[1].article, '1169');
  const civ = found.find((c) => c.article === '5');
  assert.equal(civ.act.numar, 287);
  assert.equal(found.find((c) => c.article === '41').act.numar, 53);
});

test('findCitations reads thousands separators', () => {
  const c = one('Potrivit art. 1.350 alin. (2) C. civ., debitorul răspunde.');
  assert.equal(c.article, '1350');
  assert.equal(c.act.numar, 287);
  assert.equal(one('art. 1.169^1 din Codul civil').article, '1169^1');
});

test('findCitations does not swallow the next words', () => {
  const c = one('Potrivit art. 41 alin. (1) și art. 5, părțile pot.');
  assert.equal(c.raw, 'art. 41 alin. (1)');
});

test('findCitations marks an act it does not know instead of dropping it', () => {
  const c = one('Conform art. 16 din Constituție, toți sunt egali.');
  assert.equal(c.act, null);
  assert.equal(c.actRaw, 'Constituție');
  assert.equal(one('Vezi art. 5 alin. (2) din prezenta lege.').actRaw, 'prezenta lege');
  assert.equal(one('Art. 41 a fost modificat.').actRaw, null);
  assert.equal(one('Articolul 17 din Capitolul I, Titlul II').actRaw, null);
  assert.equal(one('art. 194 din Legea societăților nr. 31/1990').act.numar, 31);
  assert.equal(one('art. 5 din art. 3').actRaw, null);
  assert.equal(one('art. 3 din Legea nr. 283 din 17 octombrie 2022').act.numar, 283);
  assert.equal(one('Art. 1 a Constituției României').actRaw, 'Constituției României');
});

test('findCitations reads the act-first form without stealing a forward act', () => {
  const back = one('Legea 31/1990, art. 194 alin. (1)');
  assert.equal(back.article, '194');
  assert.equal(back.act.numar, 31);
  assert.equal(back.raw, 'Legea 31/1990, art. 194 alin. (1)');
  const found = findCitations('art. 1 din Codul muncii, art. 5 alin. (2)');
  assert.equal(found.length, 2);
  assert.equal(found[0].act.numar, 53);
  assert.equal(found[1].act, null);
  assert.equal(found[1].actRaw, null);
});

test('findCitations skips fenced code and keeps line numbers', () => {
  const found = findCitations('```\nart. 1 din Codul muncii\n```\n\nart. 2 din Codul muncii');
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 5);
});

test('lookup returns the paragraph, the letter and the last amendment date', () => {
  const para = lookup(articles, { article: '1', paragraphs: ['2'], letter: null });
  assert.equal(para.status, 'ok');
  assert.equal(para.text, '(2) Al doilea alineat:\na) prima literă;\nb) a doua literă.');
  assert.equal(para.lastModified, '01-03-2026');
  const letter = lookup(articles, { article: '1', paragraphs: ['2'], letter: 'b' });
  assert.equal(letter.text, '(2) Al doilea alineat:\nb) a doua literă.');
});

test('indexArticles reads thousands separators and a trailing dot in headings', () => {
  assert.equal(lookup(articles, { article: '1350', paragraphs: ['1'], letter: null }).text, '(1) Text cu punct de mii.');
  assert.equal(lookup(articles, { article: '788', paragraphs: [], letter: null }).text, 'Text cu punct după număr.');
});

test('lookup keeps text after a one-line amendment note', () => {
  assert.equal(lookup(articles, { article: '1', paragraphs: ['5'], letter: null }).text, '(5) Al cincilea.');
});

test('lookup does not take paragraphs quoted inside a note', () => {
  const r = lookup(articles, { article: '1', paragraphs: ['5'], letter: null });
  assert.equal(r.text, '(5) Al cincilea.');
  assert.equal(lookup(articles, { article: '1', paragraphs: ['6'], letter: null }).text, '(6) Al șaselea, după notă.');
  assert.doesNotMatch(lookup(articles, { article: '1', paragraphs: [], letter: null }).text, /citat/);
});

test('lookup finds a letter without a paragraph and skips notes', () => {
  const r = lookup(articles, { article: '3', paragraphs: [], letter: 'b' });
  assert.equal(r.status, 'ok');
  assert.equal(r.text, 'b) celei de-a doua categorii.');
  assert.doesNotMatch(lookup(articles, { article: '3', paragraphs: [], letter: null }).text, /DECIZIA|Reproducem/);
  assert.equal(lookup(articles, { article: '3', paragraphs: ['1'], letter: null }).status, 'alineat-negasit');
});

test('lookup reports missing units and repealed articles and paragraphs', () => {
  assert.equal(lookup(articles, { article: '99', paragraphs: [], letter: null }).status, 'articol-negasit');
  assert.equal(lookup(articles, { article: '1', paragraphs: ['9'], letter: null }).status, 'alineat-negasit');
  assert.equal(lookup(articles, { article: '1', paragraphs: ['2'], letter: 'z' }).status, 'litera-negasita');
  assert.equal(lookup(articles, { article: '2^1', paragraphs: [], letter: null }).status, 'abrogat');
  assert.equal(lookup(articles, { article: '1', paragraphs: ['3'], letter: null }).status, 'abrogat');
  assert.equal(lookup(articles, { article: '1', paragraphs: ['1'], letter: null }).status, 'ok');
});

test('toText turns a portal page into articles separated by markers', () => {
  const html = readFileSync(new URL('./fixtures/act.html', import.meta.url), 'utf8');
  const index = indexArticles(toText(consolidatedBlock(html)));
  assert.deepEqual([...index.keys()], ['1', '2^1', '3']);
  assert.equal(lookup(index, { article: '3', paragraphs: ['1'], letter: null }).text, '(1) Text de trei.');
  assert.equal(lookup(index, { article: '1', paragraphs: ['2'], letter: null }).text, '(2) Al doilea alineat.\na) prima literă;\nb) a doua literă.');
  assert.deepEqual(history(html), [{ date: '01.03.2026', id: '2' }]);
});
