import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { toText, consolidatedBlock, history, dmy } from './html.mjs';

export const HOST = 'https://legislatie.just.ro';
const SOAP = `${HOST}/apiws/FreeWebService.svc/SOAP`;
const GAP_MS = 1100;

export class PortalRefused extends Error {}

let last = 0;
const throttle = async () => {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
};

const refused = (what, detail) =>
  new PortalRefused(`Portalul a refuzat cererea (${what}: ${detail}). Nu insistăm și nu ocolim blocajul. Încearcă de pe o conexiune obișnuită sau mai târziu.`);

const request = async (url, init, what) => {
  await throttle();
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw refused(what, e.cause?.code || e.message);
  }
  const body = await res.text();
  if (res.status === 403 || res.status === 429) throw refused(what, `HTTP ${res.status}`);
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return body;
};

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const field = (item, name) => decode((item.match(new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`)) || [])[1] || '');

const soap = (op, body) =>
  request(
    SOAP,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"http://tempuri.org/IFreeWebService/${op}"` },
      body: `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`,
    },
    op,
  );

const getToken = async () => {
  const xml = await soap('GetToken', '<GetToken xmlns="http://tempuri.org/"/>');
  const token = (xml.match(/<GetTokenResult>([^<]+)</) || [])[1];
  if (!token) throw new Error('GetToken: răspuns fără token');
  return token;
};

const PAGE = 10;
const MAX_PAGES = 10;

const search = async (token, act) => {
  const items = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const xml = await soap(
      'Search',
      `<Search xmlns="http://tempuri.org/"><SearchModel xmlns:d="http://schemas.datacontract.org/2004/07/FreeWebService" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><d:NumarPagina>${page}</d:NumarPagina><d:RezultatePagina>${PAGE}</d:RezultatePagina><d:SearchAn>${act.an}</d:SearchAn><d:SearchNumar>${act.numar}</d:SearchNumar><d:SearchText i:nil="true"/><d:SearchTitlu i:nil="true"/></SearchModel><tokenKey>${token}</tokenKey></Search>`,
    );
    const found = [...xml.matchAll(/<a:Legi>([\s\S]*?)<\/a:Legi>/g)].map(([, item]) => item);
    items.push(...found);
    if (found.length < PAGE) break;
  }
  const hits = items
    .map((item) => ({ tip: field(item, 'TipAct'), numar: field(item, 'Numar'), vigoare: field(item, 'DataVigoare'), link: field(item, 'LinkHtml') }))
    .filter((h) => h.tip === act.tip && h.numar === String(act.numar))
    .sort((a, b) => a.vigoare.localeCompare(b.vigoare));
  if (!hits.length) {
    const seen = [...new Set(items.map((i) => `${field(i, 'TipAct')} ${field(i, 'Numar')}`))].slice(0, 6).join(', ');
    throw new Error(`Nu am găsit ${act.tip} ${act.numar}/${act.an} pe portal${seen ? ` (am văzut: ${seen})` : ''}`);
  }
  const id = (hits[0].link.match(/DetaliiDocument\/(\d+)/) || [])[1];
  if (!id) throw new Error(`Căutare ${act.tip} ${act.numar}/${act.an}: link fără DetaliiDocument (${hits[0].link})`);
  return id;
};

const load = async (id) => {
  let pageId = id;
  let html = await request(`${HOST}/Public/DetaliiDocument/${pageId}`, undefined, `DetaliiDocument/${pageId}`);
  for (let hop = 0; hop < 2 && !consolidatedBlock(html).includes('class="S_ART"'); hop++) {
    const next = (consolidatedBlock(html).match(/DetaliiDocument(?:Afis)?\/(\d+)/) || [])[1];
    if (!next || next === pageId) break;
    pageId = next;
    html = await request(`${HOST}/Public/DetaliiDocument/${pageId}`, undefined, `DetaliiDocument/${pageId}`);
  }
  return { html, pageId };
};

export const fetchAct = async (act) => {
  const token = await getToken();
  const id = await search(token, act);
  let { html, pageId } = await load(id);
  let forms = history(html);
  const shown = forms.find((f) => !f.id);
  const newest = forms.filter((f) => f.id).sort((a, b) => dmy(b.date).localeCompare(dmy(a.date)))[0];
  if (newest && (!shown || dmy(newest.date) > dmy(shown.date))) {
    ({ html, pageId } = await load(newest.id));
    forms = history(html);
  }
  const block = consolidatedBlock(html);
  if (!block.includes('class="S_ART"')) throw new Error(`Pagina DetaliiDocument/${pageId} nu are corpul articolelor`);
  return {
    act,
    source: `${HOST}/Public/DetaliiDocument/${pageId}`,
    consolidation: (forms.find((f) => !f.id) || {}).date || null,
    text: toText(block),
  };
};

const cacheDir = () => process.env.LEGE_CHECK_CACHE || join(homedir(), '.cache', 'lege-check');

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });

export const loadAct = async (act, { fresh = false } = {}) => {
  const dir = cacheDir();
  const file = join(dir, `${act.tip}-${act.numar}-${act.an}-${today()}.json`.replace(/[^\w.-]/g, '_'));
  if (!fresh && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const result = await fetchAct(act);
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(result));
  return result;
};
