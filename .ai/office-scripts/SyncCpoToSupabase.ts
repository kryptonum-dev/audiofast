// @ts-nocheck
// Office Script (Excel): paste this file only into Automate → Script; do not combine with other scripts in one editor tab.
/**
 * Synchronizacja produktów CPO z Excel do Sanity przez Supabase Edge Function.
 * Skrypt czyta wyłącznie arkusz CPO i wysyła dane do cpo-product-sync.
 */

const CPO_SYNC_CONFIG = {
  SUPABASE_URL: "https://xuwapsacaymdemmvblak.supabase.co",
  ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1d2Fwc2FjYXltZGVtbXZibGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTg3ODYsImV4cCI6MjA3MjM5NDc4Nn0.qMH2oXCcutbLFdg-IBgJkyfjhq2mQftEUBYfr8e8s2Y",
  SHEET_USTAWIENIA: "Ustawienia",
  PASSWORD_CELL: "B1",
  SHEET_CPO: "CPO",
  DATA_START_ROW_CPO: 1,
};

interface CpoProduct {
  brand: string;
  name: string;
  key: string;
  price_cents: number;
  url: string;
  description: string;
}

function parsePriceToCents(priceStr: string): number {
  if (!priceStr || priceStr.trim() === "") return 0;
  const cleaned = priceStr
    .replace(/zł/gi, "")
    .replace(/PLN/gi, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : Math.round(value * 100);
}

function cellStr(row: (string | number | boolean)[], index: number): string {
  const val = row[index];
  return val === null || val === undefined ? "" : String(val).trim();
}

/** Arkusz Excel: Klucz jako /segment/ — API dostaje sam segment */
function normalizeCpoKey(raw: string): string {
  return raw.trim().replace(/^\/+|\/+$/g, "");
}

/** URL wewnętrzny jako /marka/produkt/ — API dostaje marka/produkt; https bez zmian */
function normalizeCpoUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return t.replace(/^\/+|\/+$/g, "");
}

function readCpo(workbook: ExcelScript.Workbook): CpoProduct[] {
  const sheet = workbook.getWorksheet(CPO_SYNC_CONFIG.SHEET_CPO);
  if (!sheet) return [];

  const usedRange = sheet.getUsedRange();
  if (!usedRange) return [];

  const data = usedRange.getValues();
  const products: CpoProduct[] = [];

  for (let i = CPO_SYNC_CONFIG.DATA_START_ROW_CPO; i < data.length; i++) {
    const row = data[i];
    const brand = cellStr(row, 0);
    const name = cellStr(row, 1);
    const key = normalizeCpoKey(cellStr(row, 2));
    const priceStr = cellStr(row, 3);
    const url = normalizeCpoUrl(cellStr(row, 4));
    const description = cellStr(row, 5);

    if (!brand || !name || !key) continue;
    if (brand.toLowerCase() === "marka" || name.toLowerCase() === "nazwa" || key.toLowerCase() === "klucz") {
      continue;
    }

    products.push({
      brand,
      name,
      key,
      price_cents: parsePriceToCents(priceStr),
      url,
      description,
    });
  }

  return products;
}

async function main(workbook: ExcelScript.Workbook): Promise<void> {
  console.log("Rozpoczynam synchronizację CPO...");

  try {
    const settingsSheet = workbook.getWorksheet(CPO_SYNC_CONFIG.SHEET_USTAWIENIA);
    if (!settingsSheet) {
      console.log('BŁĄD: Brak arkusza "Ustawienia" z hasłem w komórce B1');
      return;
    }

    const password = String(settingsSheet.getRange(CPO_SYNC_CONFIG.PASSWORD_CELL).getValue() || "")
      .trim()
      .replace(/[^\x20-\x7E]/g, "");

    if (!password || password.length < 8) {
      console.log("BŁĄD: Hasło musi mieć min. 8 znaków");
      return;
    }

    const cpoProducts = readCpo(workbook);
    if (cpoProducts.length === 0) {
      console.log("Brak produktów CPO do synchronizacji");
      return;
    }

    console.log(`Wysyłam ${cpoProducts.length} produktów CPO...`);

    const payload = { mode: "replace", products: cpoProducts };
    const response = await fetch(CPO_SYNC_CONFIG.SUPABASE_URL + "/functions/v1/cpo-product-sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + CPO_SYNC_CONFIG.ANON_KEY,
        "X-Excel-Token": password,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.log(`BŁĄD HTTP ${response.status}: ${responseText}`);
      return;
    }

    const result = JSON.parse(responseText) as {
      ok?: boolean;
      created?: number;
      updated?: number;
      archived?: number;
      unarchived?: number;
      drafts?: number;
      errors?: string[];
    };

    console.log("=== SYNCHRONIZACJA CPO ZAKOŃCZONA ===");
    console.log(`Status: ${result.ok ? "SUKCES ✓" : "BŁĄD"}`);
    console.log(`Utworzono: ${result.created || 0}`);
    console.log(`Zaktualizowano: ${result.updated || 0}`);
    console.log(`Zarchiwizowano: ${result.archived || 0}`);
    console.log(`Przywrócono: ${result.unarchived || 0}`);
    if (result.drafts) {
      console.log(`Szkice (wymagają uzupełnienia w Sanity): ${result.drafts}`);
    }
    if (result.errors?.length) {
      console.log(`Błędy: ${result.errors.join(", ")}`);
    }
  } catch (error) {
    console.log(`BŁĄD: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  }
}
