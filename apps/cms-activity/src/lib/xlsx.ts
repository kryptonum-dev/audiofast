import type { SheetCell, SheetTable } from './export-tables.js';
import { zipStore, type ZipEntry } from './zip.js';

/**
 * Minimal Office Open XML workbook: one worksheet per table with a bold,
 * frozen, filterable header row, real dates / times / numbers, sized
 * columns and clickable links. An XLSX opens in columns in every Excel,
 * Numbers and Google Sheets, unlike a CSV, whose separator Excel takes from
 * the computer's regional settings.
 */

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS =
  'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Cell style indexes into `cellXfs` in `STYLES`. */
const STYLE = { header: 1, date: 2, time: 3, link: 4 } as const;

const STYLES = `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts>
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Characters XML 1.0 does not allow, even escaped. */
// eslint-disable-next-line no-control-regex -- matching them is the point
const INVALID_XML_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
/** Excel's limit for the text of one cell. */
const MAX_CELL_TEXT = 32_767;

function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_RE, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 → `A`, 25 → `Z`, 26 → `AA`. */
export function columnName(index: number): string {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** `YYYY-MM-DD` → Excel serial day number (1900 date system). */
export function excelDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const utc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  // Serial 25569 is 1970-01-01 (the 1900 system counts the phantom 1900-02-29).
  return utc / 86_400_000 + 25_569;
}

function inlineString(ref: string, value: string, style?: number): string {
  const s = style === undefined ? '' : ` s="${style}"`;
  const textValue = escapeXml(value.slice(0, MAX_CELL_TEXT));
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${textValue}</t></is></c>`;
}

function cellXml(ref: string, cell: SheetCell): string {
  if (!cell) return '';
  switch (cell.type) {
    case 'text':
      return inlineString(ref, cell.value);
    case 'link':
      return inlineString(ref, cell.value, STYLE.link);
    case 'number':
      return Number.isFinite(cell.value)
        ? `<c r="${ref}"><v>${cell.value}</v></c>`
        : '';
    case 'date': {
      const serial = excelDate(cell.value);
      return serial === null
        ? inlineString(ref, cell.value)
        : `<c r="${ref}" s="${STYLE.date}"><v>${serial}</v></c>`;
    }
    case 'time':
      return `<c r="${ref}" s="${STYLE.time}"><v>${cell.value / 1440}</v></c>`;
  }
}

/** Display width of a cell in characters, for the column widths. */
function cellWidth(cell: SheetCell): number {
  if (!cell) return 0;
  switch (cell.type) {
    case 'text':
    case 'link':
      return cell.value.length;
    case 'number':
      return String(cell.value).length;
    case 'date':
      return 10;
    case 'time':
      return 5;
  }
}

const MIN_WIDTH = 6;
const MAX_WIDTH = 60;
const FILTER_BUTTON_WIDTH = 4;

type SheetXml = { sheet: string; rels: string | null };

function sheetXml(table: SheetTable, selected: boolean): SheetXml {
  const columns = table.header.length;
  const lastColumn = columnName(columns - 1);
  const lastRow = table.rows.length + 1;
  const range = `A1:${lastColumn}${lastRow}`;

  const cols = table.header
    .map((title, index) => {
      const content = table.rows.reduce(
        (max, row) => Math.max(max, cellWidth(row[index] ?? null)),
        0,
      );
      // The header cell also holds the filter button.
      const width = Math.max(content + 2, title.length + FILTER_BUTTON_WIDTH);
      const chars = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
      return `<col min="${index + 1}" max="${index + 1}" width="${chars}" customWidth="1"/>`;
    })
    .join('');

  const header = table.header
    .map((title, index) =>
      inlineString(`${columnName(index)}1`, title, STYLE.header),
    )
    .join('');
  const links: string[] = [];
  const rels: string[] = [];
  const body = table.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = row
        .map((cell, index) => {
          const ref = `${columnName(index)}${r}`;
          if (cell?.type === 'link') {
            const id = `rId${rels.length + 1}`;
            rels.push(
              `<Relationship Id="${id}" Type="${REL_NS}/hyperlink" Target="${escapeXml(cell.url)}" TargetMode="External"/>`,
            );
            links.push(`<hyperlink ref="${ref}" r:id="${id}"/>`);
          }
          return cellXml(ref, cell);
        })
        .join('');
      return `<row r="${r}">${cells}</row>`;
    })
    .join('');

  const sheet = `${XML_HEAD}<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
<dimension ref="${range}"/>
<sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData><row r="1">${header}</row>${body}</sheetData>
<autoFilter ref="${range}"/>${links.length > 0 ? `\n<hyperlinks>${links.join('')}</hyperlinks>` : ''}
</worksheet>`;

  return {
    sheet,
    rels:
      rels.length > 0
        ? `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">${rels.join('')}</Relationships>`
        : null,
  };
}

/** Sheet names: at most 31 characters, none of `\ / ? * [ ] :`. */
function sheetName(name: string): string {
  const clean = name
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31);
  return clean === '' ? 'Arkusz' : clean;
}

/** Build an `.xlsx` workbook with one worksheet per table, in order. */
export function buildXlsx(tables: readonly SheetTable[]): Uint8Array {
  const encoder = new TextEncoder();
  const file = (name: string, content: string): ZipEntry => ({
    name,
    data: encoder.encode(content),
  });

  const sheets = tables.map((table, index) => ({
    table,
    name: sheetName(table.name),
    path: `worksheets/sheet${index + 1}.xml`,
    xml: sheetXml(table, index === 0),
  }));

  const contentTypes = `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets
  .map(
    (sheet) =>
      `<Override PartName="/xl/${sheet.path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join('\n')}
</Types>`;

  const rootRels = `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')}</sheets>
<definedNames>${sheets
    .map((sheet, index) => {
      const lastColumn = columnName(sheet.table.header.length - 1);
      const lastRow = sheet.table.rows.length + 1;
      const quoted = `'${sheet.name.replace(/'/g, "''")}'`;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${escapeXml(quoted)}!$A$1:$${lastColumn}$${lastRow}</definedName>`;
    })
    .join('')}</definedNames>
</workbook>`;

  const workbookRels = `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">${sheets
    .map(
      (sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="${REL_NS}/worksheet" Target="${sheet.path}"/>`,
    )
    .join(
      '',
    )}<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`;

  const entries: ZipEntry[] = [
    file('[Content_Types].xml', contentTypes),
    file('_rels/.rels', rootRels),
    file('xl/workbook.xml', workbook),
    file('xl/_rels/workbook.xml.rels', workbookRels),
    file('xl/styles.xml', STYLES),
  ];
  sheets.forEach((sheet, index) => {
    entries.push(file(`xl/${sheet.path}`, sheet.xml.sheet));
    if (sheet.xml.rels) {
      entries.push(
        file(`xl/worksheets/_rels/sheet${index + 1}.xml.rels`, sheet.xml.rels),
      );
    }
  });
  return zipStore(entries);
}
