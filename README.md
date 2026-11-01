# lege-check

[Română](#română) · [English](#english)

## Română

Unealtă în linia de comandă (și skill pentru Claude) care citește un fișier Markdown, găsește citările de lege de tipul „art. 52 alin. (1) lit. c) din Codul muncii” și arată, lângă fiecare, **textul articolului din forma consolidată de azi** de pe [legislatie.just.ro](https://legislatie.just.ro).

Pentru ce: un text scris cu trimiteri la lege (memoriu, articol, contract, răspuns generat de AI) poate cita articole renumerotate, abrogate sau modificate de curând. Aici vezi textul de azi lângă citare, cu data consolidării și ultima modificare notată pe articol.

```
$ lege-check check examples/demo.md --act "Codul muncii"

## Linia 3: art. 52 alin. (1) lit. c) din Codul muncii
OK: găsit
Ultima modificare notată pe articol: 27-12-2020
> (1) Contractul individual de muncă poate fi suspendat din inițiativa angajatorului în următoarele situații:
> c) în cazul întreruperii sau reducerii temporare a activității, fără încetarea raportului de muncă, [...]

## Linia 5: art. 9999 din Codul muncii
DE VERIFICAT: articolul nu există în forma de azi
```

### Instalare

Node 22 sau mai nou, fără alte dependențe.

```bash
npx github:deniskrr/lege-check check fișier.md --act "Codul muncii"
```

Ca plugin Claude Code:

```
/plugin marketplace add deniskrr/lege-check
/plugin install lege-check@lege-check
```

### Folosire

```bash
lege-check check fișier.md [--act "Codul muncii"] [--json] [--fresh] [--max-chars 700]
lege-check art "Codul muncii" 41 1
```

Recunoaște: „art. 41”, „art. 52^1”, „alin. (1) și (2)”, „lit. a)”, „din Codul muncii / civil / penal / de procedură civilă / penală / fiscal / de procedură fiscală”, abrevieri (CM, CPC, CPP, CP, CF, CPF), „Legea nr. 31/1990”, „OUG”, „OG”, „HG”, și forma „Legea 31/1990, art. 194”. Citările din blocuri de cod sunt ignorate. Cod de ieșire: 0 totul găsit, 1 există citări de verificat, 2 eroare.

### Ce nu face

- Nu judecă dacă articolul susține afirmația din text. Îți arată textul, citești tu.
- Nu înlocuiește Monitorul Oficial. Forma consolidată de pe portal este neoficială, cu rol consultativ, și nu are forță juridică (vezi [termenii portalului](https://legislatie.just.ro/Public/Termeni)). Răspunderea pentru invocarea ei este a celui care o invocă.
- Nu e sfat juridic.

### Cum vorbește cu portalul

- Rulează pe calculatorul tău: serviciul web SOAP al Ministerului Justiției găsește actul, apoi pagina `DetaliiDocument` dă ultima consolidare.
- O cerere pe secundă, cache local pe zi în `~/.cache/lege-check` (sau `LEGE_CHECK_CACHE`).
- Nu schimbă user-agentul, nu folosește proxy. Dacă portalul refuză (HTTP 403, conexiune închisă, adrese de cloud sau de datacenter sunt de obicei refuzate), unealta se oprește și spune asta.
- Nu include și nu publică texte de lege.
- Pagina portalului poate să se schimbe; dacă extragerea se strică, deschide un issue.

### Alte proiecte

[sw33tr/claude-legislatie-ro](https://github.com/sw33tr/claude-legislatie-ro), [rboarescu/legislatie-ro-mcp](https://github.com/rboarescu/legislatie-ro-mcp), [matematicsolutions/ro-eli-mcp](https://github.com/matematicsolutions/ro-eli-mcp), [emilzaman/drept-ro](https://github.com/emilzaman/drept-ro), [lexifina/romania-law](https://github.com/lexifina/romania-law). Aici accentul e pe verificarea unui fișier întreg, local, fără server MCP.

Licență: MIT.

## English

A command-line tool (and a Claude skill) that reads a Markdown file, finds Romanian law citations such as "art. 52 alin. (1) lit. c) din Codul muncii" (Labour Code), and shows next to each one **the article text from today's consolidated form** on [legislatie.just.ro](https://legislatie.just.ro).

Why: a text with law references (a memo, an article, a contract, an AI-generated answer) may cite articles that were renumbered, repealed or amended recently. You see today's text next to the citation, with the consolidation date and the latest amendment noted on the article.

### Install

Node 22 or newer, no other dependencies.

```bash
npx github:deniskrr/lege-check check file.md --act "Codul muncii"
```

As a Claude Code plugin:

```
/plugin marketplace add deniskrr/lege-check
/plugin install lege-check@lege-check
```

### Usage

```bash
lege-check check file.md [--act "Codul muncii"] [--json] [--fresh] [--max-chars 700]
lege-check art "Codul muncii" 41 1
```

It understands article numbers with superscripts (`art. 52^1`), several paragraphs, letters, the main codes (labour, civil, criminal, civil and criminal procedure, tax, tax procedure) and their abbreviations, numbered acts (`Legea nr. 31/1990`, `OUG`, `OG`, `HG`), and the act-first form (`Legea 31/1990, art. 194`). `--act` sets the act for citations that name none. Exit code: 0 all found, 1 some citations need a look, 2 error.

### What it does not do

- It does not judge whether the article supports the claim in your text. It shows you the text; you read it.
- It is not the official source. The consolidated form on the portal is unofficial, consultative and has no legal force; only the Official Gazette (Monitorul Oficial) is authentic ([portal terms](https://legislatie.just.ro/Public/Termeni)).
- It is not legal advice.

### How it treats the portal

Runs on your machine, one request per second, a per-day local cache in `~/.cache/lege-check` (or `LEGE_CHECK_CACHE`), no user-agent tricks, no proxies. If the portal refuses the request (it usually refuses cloud and datacenter addresses), the tool stops and says so. No law text is bundled. The portal's HTML may change; if extraction breaks, open an issue.

### Other projects

See the list in the Romanian section above. This one focuses on checking a whole file locally, with no MCP server.

License: MIT.
