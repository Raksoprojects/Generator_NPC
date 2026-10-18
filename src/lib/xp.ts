/**
 * Koszty rozwoju w PD wg podrecznika podstawowego (s. 47-49):
 * - Cechy i Umiejetnosci: koszt rozwiniecia zalezy od liczby juz posiadanych rozwiniec
 *   (przedzialy po 5, tabela "Koszt rozwoju Cech i Umiejetnosci w PD");
 * - Talent: 100 PD + 100 PD za kazde juz posiadane jego rozwiniecie;
 * - przejscie na kolejny poziom profesji albo do nowej profesji: 100 PD (200 PD, gdy
 *   obecny poziom nie jest skompletowany), nowa profesja z innej Klasy: +100 PD;
 * - skompletowanie poziomu N: wszystkie Cechy poziomu z 5 x N rozwinieciami, 8 dostepnych
 *   Umiejetnosci z 5 x N rozwinieciami i co najmniej 1 Talent z obecnego poziomu.
 */

const CHAR_COST = [25, 30, 40, 50, 70, 90, 120, 150, 190, 230, 280, 330, 390, 450, 520];
const SKILL_COST = [10, 15, 20, 30, 40, 60, 80, 110, 140, 180, 220, 270, 320, 380, 440];

/** Koszt kolejnego rozwiniecia, gdy postac ma juz `owned` rozwiniec. */
export function nextAdvanceCost(kind: "char" | "skill", owned: number): number {
  const table = kind === "char" ? CHAR_COST : SKILL_COST;
  return table[Math.min(table.length - 1, Math.floor(Math.max(0, owned) / 5))];
}

/** Koszt dojscia z `from` do `to` rozwiniec. */
export function advanceCost(kind: "char" | "skill", from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += nextAdvanceCost(kind, i);
  return sum;
}

/** Koszt kolejnego poziomu Talentu, gdy postac ma ich juz `owned`. */
export const talentCost = (owned: number) => 100 * (owned + 1);

/** Laczny koszt `levels` poziomow Talentu (1 = 100, 2 = 300, 3 = 600...). */
export const talentTotalCost = (levels: number) => (100 * levels * (levels + 1)) / 2;

/** Rozwiniecia wymagane do skompletowania poziomu profesji. */
export const levelRequirement = (level: number) => 5 * level;

/** Przejscie na kolejny poziom albo do nowej profesji. */
export const CAREER_STEP_COST = 100;
export const CLASS_CHANGE_EXTRA = 100;
