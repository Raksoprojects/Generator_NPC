/**
 * Czytelny podzial opisow z podrecznikow (zaklecia, Cechy Stworzen, talenty, przedmioty):
 * akapity z etykietami (Przeciążanie:, Dar:, Skaza:...), wypunktowania (w zrodlach znak "0"
 * albo "•") i tabele k10 ("1-3 ...", "4-6 ...") jako osobne wiersze.
 */

export interface TextItem {
  label?: string;
  text: string;
}

export type TextBlock = { type: "p"; label?: string; text: string } | { type: "list"; items: TextItem[] };

/** Etykieta na poczatku zdania: 1-3 slowa zakonczone dwukropkiem ("Wzmocnienie:", "Czas trwania:"). */
const LABEL_RE = /(?:^|(?<=[.!?)])\s+)(\p{Lu}[\p{L}\d!]*(?:\s[\p{L}\d!]+){0,2}):\s?(?=\S)/gu;
/** Zwroty z dwukropkiem, ktore nie sa etykietami ("Patrz: strona 190", "Na przykład: ..."). */
const NOT_LABELS = /^(Patrz|Przykładowo|Pytania|Dla|Na|Oto|Dodatek|Wiek|Przykłady)\b/;
/** Kolejne progi Przeciążania/Nadczarowania: "+4 PS — ...". */
const LEVEL_RE = /(?:^|(?<=[.!?:]))\s*(?=\+\s?\d+\s?PS\s?[—–-])/;
/** Naglowki bez dwukropka na poczatku wiersza (Bestiariusz 2.0). */
const HEADINGS = ["Korekta profilu", "Zasady walki Roju", "Zabicie Roju", "Tyle maleńkich stworzonek"];
/** Punkt wyliczenia po dwukropku lub koncu zdania: w tekstach z PDF "0 " albo "• ". */
const BULLET_RE = /(?:^|(?<=[:;.!?)])\s+)(?:0|•)\s(?=[\p{Lu}+„"(])/u;
/** Wiersz tabeli rzutu: "1-3 Tekst", "7 Tekst", "01–04 Tekst". */
const ROW_RE = /(?:^|\s)(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?\s(?=\p{Lu})/gu;
const LINE_ROW_RE = /^(\d{1,3}(?:\s?[-–]\s?\d{1,3})?)\s+(\S.*)$/;
const TABLE_HEAD_RE = /\s*(?:Rzut\s*)?(?:1?k100?\s*)?Efekt\s*$/;

function splitLabels(text: string): { label?: string; text: string }[] {
  const out: { label?: string; text: string }[] = [];
  let last = 0;
  let label: string | undefined;
  for (const m of text.matchAll(LABEL_RE)) {
    if (NOT_LABELS.test(m[1])) continue;
    const before = text.slice(last, m.index).trim();
    if (before || label) out.push({ label, text: before });
    label = m[1];
    last = (m.index ?? 0) + m[0].length;
  }
  out.push({ label, text: text.slice(last).trim() });
  return out.filter((p) => p.text || p.label);
}

/** Tabela k10/k100 w jednym ciagu: numery wierszy od 1 kolejno az do 10 albo 100. */
function tableRows(text: string): { lead: string; rows: TextItem[] } | null {
  if (!/k10/.test(text)) return null;
  const seq: RegExpMatchArray[] = [];
  let expect = 1;
  for (const h of text.matchAll(ROW_RE)) {
    const a = parseInt(h[1], 10);
    const b = h[2] ? parseInt(h[2], 10) : a;
    if (a === expect && b >= a) {
      seq.push(h);
      expect = b + 1;
    }
  }
  if (seq.length < 3 || (expect !== 11 && expect !== 101)) return null;
  const rows = seq.map((h, i) => {
    const start = (h.index ?? 0) + h[0].length;
    const end = i + 1 < seq.length ? seq[i + 1].index : text.length;
    return { label: h[0].trim().replace(/\s/g, ""), text: text.slice(start, end).trim() };
  });
  return { lead: text.slice(0, seq[0].index).replace(TABLE_HEAD_RE, "").trim(), rows };
}

function pushItem(blocks: TextBlock[], item: TextItem) {
  const last = blocks.at(-1);
  if (last?.type === "list") last.items.push(item);
  else blocks.push({ type: "list", items: [item] });
}

export function formatText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const raw of (text ?? "").split(/\n+/)) {
    let line = raw.trim();
    if (!line) continue;
    const row = LINE_ROW_RE.exec(line);
    if (row) {
      pushItem(blocks, { label: row[1].replace(/\s/g, ""), text: row[2] });
      continue;
    }
    const heading = HEADINGS.find((h) => line.startsWith(`${h} `));
    if (heading) line = `${heading}: ${line.slice(heading.length + 1)}`;
    // Tabela przed etykietami - wiersze tabel tez maja dwukropki ("1-2 Otępienie: ...").
    const table = tableRows(line);
    paragraphs(blocks, table ? table.lead : line);
    if (table) blocks.push({ type: "list", items: table.rows });
  }
  return blocks;
}

function paragraphs(blocks: TextBlock[], text: string) {
  for (const part of splitLabels(text)) {
    const levels = part.text.split(LEVEL_RE).map((s) => s.trim());
    const [first, ...bullets] = (levels.length > 1 ? levels : part.text.split(BULLET_RE)).map((s) => s.trim());
    if (first || part.label) blocks.push({ type: "p", label: part.label, text: first });
    if (bullets.length) blocks.push({ type: "list", items: bullets.filter(Boolean).map((t) => ({ text: t })) });
  }
}
