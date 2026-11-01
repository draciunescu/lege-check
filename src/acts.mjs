export const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const squash = (s) => fold(s).replace(/\s+/g, '');

const LAW = { tip: 'LEGE' };

export const CODES = [
  { names: ['codul muncii', 'codului muncii', 'c. muncii', 'cm'], ...LAW, numar: 53, an: 2003, label: 'Codul muncii' },
  { names: ['codul civil', 'codului civil', 'cod civil', 'c. civ.', 'c. civil'], ...LAW, numar: 287, an: 2009, label: 'Codul civil' },
  { names: ['codul penal', 'codului penal', 'cod penal', 'c. pen.', 'cp'], ...LAW, numar: 286, an: 2009, label: 'Codul penal' },
  { names: ['codul de procedura civila', 'codului de procedura civila', 'cod de procedura civila', 'c. proc. civ.', 'cpc'], ...LAW, numar: 134, an: 2010, label: 'Codul de procedură civilă' },
  { names: ['codul de procedura penala', 'codului de procedura penala', 'cod de procedura penala', 'c. proc. pen.', 'cpp'], ...LAW, numar: 135, an: 2010, label: 'Codul de procedură penală' },
  { names: ['codul fiscal', 'codului fiscal', 'cod fiscal', 'cf'], ...LAW, numar: 227, an: 2015, label: 'Codul fiscal' },
  { names: ['codul administrativ', 'codului administrativ', 'cod administrativ'], tip: 'ORDONANȚĂ DE URGENȚĂ', numar: 57, an: 2019, label: 'Codul administrativ' },
  { names: ['codul de procedura fiscala', 'codului de procedura fiscala', 'cod de procedura fiscala', 'cpf'], ...LAW, numar: 207, an: 2015, label: 'Codul de procedură fiscală' },
];

const TIPS = [
  { re: /^(legea|legii|lege)(-cadru)?$/, tip: 'LEGE', short: 'Legea' },
  { re: /^(oug|o\.u\.g\.?|ordonant(a|ei)deurgenta(a?guvernului)?)$/, tip: 'ORDONANȚĂ DE URGENȚĂ', short: 'OUG' },
  { re: /^(og|o\.g\.?|ordonant(a|ei)(a?guvernului)?)$/, tip: 'ORDONANȚĂ', short: 'OG' },
  { re: /^(hg|h\.g\.?|hotarar(ea|ii)(a?guvernului)?)$/, tip: 'HOTĂRÂRE', short: 'HG' },
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const CODE_PATTERN = CODES.flatMap((c) => c.names)
  .sort((a, b) => b.length - a.length)
  .map((n) => esc(n).replace(/ /g, '\\s*'))
  .join('|');

const MONTHS = 'ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie';

export const NUMBERED_PATTERN =
  '(?:(?:legea|legii)(?:\\s+[a-z-]+){1,4}?\\s+(?=nr)|legea(?:-cadru)?|legii(?:-cadru)?|oug|o\\.\\s*u\\.\\s*g\\.?|og|o\\.\\s*g\\.?|hg|h\\.\\s*g\\.?|ordonanta(?:\\s+de\\s+urgenta)?|ordonantei(?:\\s+de\\s+urgenta)?|hotararea|hotararii)(?:\\s+(?:a\\s+)?guvernului)?\\s*(?:nr\\.?)?\\s*\\d+\\s*(?:\\/\\s*\\d{4}|\\s+din\\s+\\d{1,2}\\s+(?:' + MONTHS + ')\\s+\\d{4})';

export const resolveAct = (raw) => {
  const text = squash(fold(raw).replace(/^(legea|legii)\s+(?!nr)[^\d]*?\s*(?=nr)/, '$1 '));
  const code = CODES.find((c) => c.names.some((n) => squash(n) === text));
  if (code) return { tip: code.tip, numar: code.numar, an: code.an, label: code.label };
  const m = text.match(new RegExp(`^(.*?)(?:nr\\.?)?(\\d+)(?:\\/(\\d{4})|din\\d{1,2}(?:${MONTHS})(\\d{4}))$`));
  if (!m) return null;
  const kind = TIPS.find((t) => t.re.test(m[1]));
  if (!kind) return null;
  const numar = Number(m[2]);
  const an = Number(m[3] || m[4]);
  const same = CODES.find((c) => c.tip === kind.tip && c.numar === numar && c.an === an);
  return { tip: kind.tip, numar, an, label: same ? same.label : `${kind.short} ${numar}/${an}` };
};

export const actKey = (act) => `${act.tip}-${act.numar}-${act.an}`;
