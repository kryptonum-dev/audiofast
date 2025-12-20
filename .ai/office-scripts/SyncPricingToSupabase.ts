/**
 * Synchronizacja cen z Excel do Supabase
 * Przenieś ceny do bazy danych
 */

const CONFIG = {
    SUPABASE_URL: 'https://xuwapsacaymdemmvblak.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1d2Fwc2FjYXltZGVtbXZibGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTg3ODYsImV4cCI6MjA3MjM5NDc4Nn0.qMH2oXCcutbLFdg-IBgJkyfjhq2mQftEUBYfr8e8s2Y',
    SHEET_USTAWIENIA: 'Ustawienia',
    PASSWORD_CELL: 'B1',
    SHEET_PRODUKTY: 'Produkty',
    SHEET_OPCJE: 'Opcje',
    SHEET_WARTOSCI: 'Wartości',
    SHEET_LISTY: 'Listy',
    DATA_START_ROW_PRODUKTY: 6,
    DATA_START_ROW_OPCJE: 3,
    DATA_START_ROW_WARTOSCI: 2,
    DATA_START_ROW_LISTY: 2,
};

interface NumericRule {
    min_value: number;
    max_value: number;
    step_value: number;
    price_per_step_cents: number;
    base_included_value: number;
}

interface OptionValue {
    name: string;
    price_delta_cents: number;
    position: number;
}

interface OptionGroup {
    name: string;
    input_type: 'select' | 'numeric_step';
    required: boolean;
    position: number;
    values?: OptionValue[];
    parent?: { group_name: string; value_name: string };
    numeric_rule?: NumericRule;
}

interface Variant {
    price_key: string;
    brand: string;
    product: string;
    model: string | null;
    base_price_cents: number;
    currency: string;
    related_products?: string[];
    groups: OptionGroup[];
}

function parsePriceToCents(priceStr: string): number {
    if (!priceStr || priceStr.trim() === '') return 0;
    const cleaned = priceStr.replace(/zł/gi, '').replace(/PLN/gi, '').replace(/\s/g, '').replace(',', '.').trim();
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : Math.round(value * 100);
}

function parsePolishDecimal(str: string): number {
    if (!str || str.trim() === '') return 0;
    const value = parseFloat(str.replace(',', '.').trim());
    return isNaN(value) ? 0 : value;
}

function isSuspiciousValue(value: string): boolean {
    const t = value.trim();
    if (!t) return true;
    if (/^\d+$/.test(t) || /^\d+[.,]\d+$/.test(t)) return true;
    const errors = ['#REF!', '#VALUE!', '#NAME?', '#DIV/0!', '#N/A', '#NULL!', '#NUM!'];
    for (const e of errors) { if (t.includes(e)) return true; }
    if (/^[£$€¥]\d/.test(t)) return true;
    if (t.length === 1 && !/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t)) return true;
    return false;
}

function variantKey(product: string, model: string | null): string {
    return model ? `${product}|||${model}` : product;
}

function cellStr(row: (string | number | boolean)[], index: number): string {
    const val = row[index];
    return val === null || val === undefined ? '' : String(val).trim();
}

function readProdukty(workbook: ExcelScript.Workbook): Map<string, Variant> {
    const sheet = workbook.getWorksheet(CONFIG.SHEET_PRODUKTY);
    if (!sheet) return new Map();
    const usedRange = sheet.getUsedRange();
    if (!usedRange) return new Map();
    const data = usedRange.getValues();
    const variants = new Map<string, Variant>();

    // Find P1-P4 columns dynamically from header row (row before data starts)
    const headerRowIndex = CONFIG.DATA_START_ROW_PRODUKTY - 1;
    const headerRow = data[headerRowIndex];
    
    let p1Col = -1, p2Col = -1, p3Col = -1, p4Col = -1;
    
    for (let col = 0; col < headerRow.length; col++) {
        const header = String(headerRow[col] || '').trim().toUpperCase();
        if (header === 'P1') p1Col = col;
        else if (header === 'P2') p2Col = col;
        else if (header === 'P3') p3Col = col;
        else if (header === 'P4') p4Col = col;
    }

    let relatedCount = 0;

    for (let i = CONFIG.DATA_START_ROW_PRODUKTY; i < data.length; i++) {
        const row = data[i];
        const brand = cellStr(row, 0);
        const product = cellStr(row, 1);
        const model = cellStr(row, 2);
        const priceStr = cellStr(row, 4);
        const priceKey = cellStr(row, 6);
        
        // Read related products from dynamically found columns
        const p1 = p1Col >= 0 ? cellStr(row, p1Col) : '';
        const p2 = p2Col >= 0 ? cellStr(row, p2Col) : '';
        const p3 = p3Col >= 0 ? cellStr(row, p3Col) : '';
        const p4 = p4Col >= 0 ? cellStr(row, p4Col) : '';

        if (!brand || !product || !priceKey) continue;
        if (priceKey.toLowerCase() === 'url' || product.toLowerCase() === 'produkt') continue;
        if (!priceKey.includes('/')) continue;

        const relatedProducts = [p1, p2, p3, p4].filter(p => p && p.trim() !== '');
        if (relatedProducts.length > 0) relatedCount++;
        
        variants.set(variantKey(product, model || null), {
            price_key: priceKey,
            brand,
            product,
            model: model || null,
            base_price_cents: parsePriceToCents(priceStr),
            currency: 'PLN',
            related_products: relatedProducts.length > 0 ? relatedProducts : undefined,
            groups: [],
        });
    }
    
    console.log(`Znaleziono ${relatedCount} produktów z powiązaniami (P1-P4 w kolumnach: ${p1Col >= 0 ? p1Col : 'brak'}, ${p2Col >= 0 ? p2Col : 'brak'}, ${p3Col >= 0 ? p3Col : 'brak'}, ${p4Col >= 0 ? p4Col : 'brak'})`);
    
    return variants;
}

function readWartosci(workbook: ExcelScript.Workbook): Map<string, NumericRule> {
    const sheet = workbook.getWorksheet(CONFIG.SHEET_WARTOSCI);
    if (!sheet) return new Map();
    const usedRange = sheet.getUsedRange();
    if (!usedRange) return new Map();
    const data = usedRange.getValues();
    const rules = new Map<string, NumericRule>();

    for (let i = CONFIG.DATA_START_ROW_WARTOSCI; i < data.length; i++) {
        const row = data[i];
        const product = cellStr(row, 0);
        const model = cellStr(row, 1);
        const opcja = cellStr(row, 2);
        if (!product || !opcja) continue;
        if (product.toLowerCase() === 'produkt' || opcja.toLowerCase() === 'opcja') continue;
        if (isSuspiciousValue(opcja)) continue;

        const minVal = parsePolishDecimal(cellStr(row, 3));
        const maxVal = parsePolishDecimal(cellStr(row, 4));
        const stepVal = parsePolishDecimal(cellStr(row, 5));

        rules.set(`${product}|||${model}|||${opcja}`, {
            min_value: minVal,
            max_value: maxVal,
            step_value: stepVal > 0 ? stepVal : 1,
            price_per_step_cents: parsePriceToCents(cellStr(row, 6)),
            base_included_value: minVal,
        });
    }
    return rules;
}

function readListy(workbook: ExcelScript.Workbook): Map<string, OptionValue[]> {
    const sheet = workbook.getWorksheet(CONFIG.SHEET_LISTY);
    if (!sheet) return new Map();
    const usedRange = sheet.getUsedRange();
    if (!usedRange) return new Map();
    const data = usedRange.getValues();
    const listyMap = new Map<string, OptionValue[]>();

    for (let i = CONFIG.DATA_START_ROW_LISTY; i < data.length; i++) {
        const row = data[i];
        const product = cellStr(row, 0);
        const model = cellStr(row, 1);
        const opcja = cellStr(row, 2);
        const valueName = cellStr(row, 3);
        if (!product || !opcja || !valueName) continue;
        if (product.toLowerCase() === 'produkt' || opcja.toLowerCase() === 'opcja') continue;
        if (isSuspiciousValue(opcja)) continue;

        const key = `${product}|||${model}|||${opcja}`;
        if (!listyMap.has(key)) listyMap.set(key, []);
        const values = listyMap.get(key)!;
        values.push({
            name: valueName,
            price_delta_cents: parsePriceToCents(cellStr(row, 4)),
            position: values.length,
        });
    }
    return listyMap;
}

function readOpcje(
    workbook: ExcelScript.Workbook,
    variants: Map<string, Variant>,
    wartosciRules: Map<string, NumericRule>,
    listyValues: Map<string, OptionValue[]>
): void {
    const sheet = workbook.getWorksheet(CONFIG.SHEET_OPCJE);
    if (!sheet) return;
    const usedRange = sheet.getUsedRange();
    if (!usedRange) return;
    const data = usedRange.getValues();

    const variantGroups = new Map<string, OptionGroup[]>();
    const parentGroupsMap = new Map<string, Map<string, OptionGroup>>();

    for (let i = CONFIG.DATA_START_ROW_OPCJE; i < data.length; i++) {
        const row = data[i];
        const product = cellStr(row, 0);
        const model = cellStr(row, 1);
        const opcjaName = cellStr(row, 2);
        const valueName = cellStr(row, 3);
        const priceStr = cellStr(row, 4);
        const podOpcjaWartosci = cellStr(row, 5);
        const podOpcjaListy = cellStr(row, 6);

        if (!product || !opcjaName) continue;
        if (product.toLowerCase() === 'produkt' || opcjaName.toLowerCase() === 'opcja') continue;

        const vKey = variantKey(product, model || null);
        const variant = variants.get(vKey);
        if (!variant) continue;

        if (!variantGroups.has(vKey)) variantGroups.set(vKey, []);
        if (!parentGroupsMap.has(vKey)) parentGroupsMap.set(vKey, new Map());
        const allGroups = variantGroups.get(vKey)!;
        const parentGroups = parentGroupsMap.get(vKey)!;

        if (!parentGroups.has(opcjaName)) {
            const newGroup: OptionGroup = {
                name: opcjaName,
                input_type: 'select',
                required: false,
                position: parentGroups.size,
                values: [],
            };
            parentGroups.set(opcjaName, newGroup);
            allGroups.push(newGroup);
        }
        const parentGroup = parentGroups.get(opcjaName)!;

        if (!parentGroup.values) parentGroup.values = [];
        parentGroup.values.push({
            name: valueName || opcjaName,
            price_delta_cents: parsePriceToCents(priceStr),
            position: parentGroup.values.length,
        });

        if (podOpcjaWartosci && !isSuspiciousValue(podOpcjaWartosci)) {
            const rule = wartosciRules.get(`${product}|||${model}|||${podOpcjaWartosci}`);
            if (rule) {
                allGroups.push({
                    name: podOpcjaWartosci,
                    input_type: 'numeric_step',
                    required: false,
                    position: allGroups.length,
                    parent: { group_name: opcjaName, value_name: valueName || opcjaName },
                    numeric_rule: rule,
                });
            }
        }

        if (podOpcjaListy && !isSuspiciousValue(podOpcjaListy)) {
            const childValues = listyValues.get(`${product}|||${model}|||${podOpcjaListy}`);
            if (childValues && childValues.length > 0) {
                allGroups.push({
                    name: podOpcjaListy,
                    input_type: 'select',
                    required: false,
                    position: allGroups.length,
                    parent: { group_name: opcjaName, value_name: valueName || opcjaName },
                    values: childValues,
                });
            }
        }
    }

    const variantKeys = Array.from(variantGroups.keys());
    for (let i = 0; i < variantKeys.length; i++) {
        const vKey = variantKeys[i];
        const groups = variantGroups.get(vKey);
        const variant = variants.get(vKey);
        if (variant && groups) variant.groups = groups;
    }
}

async function main(workbook: ExcelScript.Workbook): Promise<void> {
    console.log('Rozpoczynam synchronizację...');

    try {
        // Odczyt hasła
        const settingsSheet = workbook.getWorksheet(CONFIG.SHEET_USTAWIENIA);
        if (!settingsSheet) {
            console.log('BŁĄD: Brak arkusza "Ustawienia" z hasłem w komórce B1');
            return;
        }

        const password = String(settingsSheet.getRange(CONFIG.PASSWORD_CELL).getValue() || '').trim().replace(/[^\x20-\x7E]/g, '');
        if (!password || password.length < 8) {
            console.log('BŁĄD: Hasło musi mieć min. 8 znaków (komórka B1 w arkuszu Ustawienia)');
            return;
        }

        // Odczyt danych
        const variants = readProdukty(workbook);
        if (variants.size === 0) {
            console.log('BŁĄD: Nie znaleziono produktów');
            return;
        }
        console.log(`Produkty: ${variants.size}`);

        const wartosciRules = readWartosci(workbook);
        const listyValues = readListy(workbook);
        readOpcje(workbook, variants, wartosciRules, listyValues);

        // Wysyłanie
        const variantsArray = Array.from(variants.values());
        const payload = { mode: 'replace', variants: variantsArray };

        console.log(`Wysyłam ${variantsArray.length} produktów...`);

        const response = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/pricing-ingest', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + CONFIG.ANON_KEY,
                'X-Excel-Token': password,
                'Content-Type': 'application/json; charset=utf-8',
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
            supabase?: { counts?: { variants?: number }; deleted_products?: number };
            sanity?: { 
                prices?: string;
                related_products?: string;
                related_products_count?: number;
            };
        };

        console.log('=== SYNCHRONIZACJA ZAKOŃCZONA ===');
        console.log(`Status: ${result.ok ? 'SUKCES ✓' : 'BŁĄD'}`);
        if (result.supabase?.counts) {
            console.log(`Zaktualizowano: ${result.supabase.counts.variants} produktów`);
        }
        if (result.supabase?.deleted_products && result.supabase.deleted_products > 0) {
            console.log(`Usunięto: ${result.supabase.deleted_products} produktów (brak URL)`);
        }
        if (result.sanity) {
            console.log(`Powiązane produkty: ${result.sanity.related_products || 'w trakcie'}`);
        }
        console.log('Ceny w Sanity zostaną zaktualizowane w tle.');

    } catch (error) {
        console.log(`BŁĄD: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
}
