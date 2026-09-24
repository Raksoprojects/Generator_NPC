/**
 * Pobieranie i wczytywanie plikow w przegladarce (dziala na telefonie i
 * komputerze, bez File System Access API).
 */

/** Bezpieczna nazwa pliku z dowolnego tekstu. */
export function safeFileName(name: string, extension: string): string {
  const base = (name || "bn")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/[^0-9a-zA-Z_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${base || "bn"}.${extension}`;
}

/** Pobiera tekst jako plik. */
export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Otwiera okno wyboru pliku; zwraca plik albo null po anulowaniu. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null));
    window.addEventListener("focus", () => setTimeout(() => finish(null), 500), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** Kopiuje tekst do schowka (z awaryjna sciezka dla starszych przegladarek). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
