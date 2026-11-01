export const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ţț]/gi, 't')
    .replace(/[şș]/gi, 's')
    .toLowerCase();

const LAW = { tip: 'LEGE' };

export const CODES = [
  { names: ['codul muncii', 'codul muncii', 'cm'], ...LAW, numar: 53, an: 2003, label: 'Codul muncii' },
  { names: ['codul civil', 'cod civil', 'c. civ.', 'c.civ.', 'cciv'], ...LAW, numar: 287, an: 2009, label: 'Codul civil' },
  { names: ['codul penal', 'cod penal', 'cp'], ...LAW, numar: 286, an: 2009, label: 'Codul penal' },
  { names: ['codul de procedura civila', 'cod de procedura civila', 'cpc'], ...LAW, numar: 134, an: 2010, label: 'Codul de procedură civilă' },
  { names: ['codul de procedura penala', 'cod de procedura penala', 'cpp'], ...LAW, numar: 135, an: 2010, label: 'Codul de procedură penală' },
  { names: ['codul fiscal', 'cod fiscal', 'cf'], ...LAW, numar: 227, an: 2015, label: 'Codul fiscal' },
  { names: ['codul de procedura fiscala', 'cod de procedura fiscala', 'cpf'], ...LAW, numar: 207, an: 2015, label: 'Codul de procedură fiscală' },
];

const TIPS = [
  { re: /^(legea|legii|lege)$/, tip: 'LEGE', short: 'Legea' },
  { re: /^(oug|ordonanta de urgenta|ordonantei de urgenta)( (a )?guvernului)?$/, tip: 'ORDONANȚĂ DE URGENȚĂ', short: 'OUG' },
  { re: /^(og|ordonanta|ordonantei)( (a )?guvernului)?$/, tip: 'ORDONANȚĂ', short: 'OG' },
  { re: /^(hg|hotararea|hotararii)( (a )?guvernului)?$/, tip: 'HOTĂRÂRE', short: 'HG' },
];

const codeNames = CODES.flatMap((c) => c.names).sort((a, b) => b.length - a.length);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const CODE_PATTERN = codeNames.map((n) => esc(n).replace(/ /g, '\\s+')).join('|');

export const NUMBERED_PATTERN =
  '(?:legea|legii|oug|og|hg|ordonan[tț]a(?:\\s+de\\s+urgen[tț][aă])?|ordonan[tț]ei(?:\\s+de\\s+urgen[tț][aă])?|hot[aă]r[aâ]rea|hot[aă]r[aâ]rii)(?:\\s+(?:a\\s+)?guvernului)?\\s*(?:nr\\.?)?\\s*\\d+\\s*\\/\\s*\\d{4}';

export const resolveAct = (raw) => {
  const text = fold(raw).replace(/\s+/g, ' ').trim();
  const code = CODES.find((c) => c.names.includes(text));
  if (code) return { tip: code.tip, numar: code.numar, an: code.an, label: code.label };
  const m = text.match(/^(.*?)\s*(?:nr\.?)?\s*(\d+)\s*\/\s*(\d{4})$/);
  if (!m) return null;
  const kind = TIPS.find((t) => t.re.test(m[1].replace(/\s*nr\.?$/, '').trim()));
  if (!kind) return null;
  return { tip: kind.tip, numar: Number(m[2]), an: Number(m[3]), label: `${kind.short} ${m[2]}/${m[3]}` };
};

export const actKey = (act) => `${act.tip}-${act.numar}-${act.an}`;
