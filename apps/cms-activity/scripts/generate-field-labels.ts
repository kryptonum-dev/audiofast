/**
 * Development-time generator for Polish field and type labels.
 *
 * Scans the Studio schema sources (`apps/studio/schemaTypes/**\/*.{ts,tsx}`)
 * for `name` / `title` pairs in `defineType`, `defineField`,
 * `defineArrayMember` (and helper calls or plain objects of the same shape)
 * and writes `src/generated/field-labels.json`:
 *
 *   {
 *     fields: { [fieldName]: title },          // global, first occurrence wins
 *     types:  { [typeName]: title },           // document/object/array-member types
 *     byType: { [typeName]: { [fieldName]: title } } // direct fields per type
 *   }
 *
 * The output is committed; the app never depends on Studio at runtime.
 * Duplicate names with different titles keep the first occurrence and are
 * reported on stderr.
 *
 * Run: `bun run generate:labels` (inside apps/cms-activity).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_ROOT = join(APP_ROOT, '..', 'studio', 'schemaTypes');
const OUTPUT = join(APP_ROOT, 'src', 'generated', 'field-labels.json');

/** Arrays whose object elements carry `name`/`title` but are not fields. */
const NON_FIELD_ARRAYS = new Set([
  'groups',
  'fieldsets',
  'views',
  'list',
  'orderings',
  'styles',
  'lists',
  'decorators',
  'annotations',
]);

/** Suffixes that only matter inside the Studio form, not in a report. */
const OPTIONAL_SUFFIX = /\s*\((?:opcjonaln\w*|optional)\)\s*$/i;

type Kind = 'type' | 'member' | 'field';

type LabelMaps = {
  fields: Record<string, string>;
  types: Record<string, string>;
  byType: Record<string, Record<string, string>>;
};

const labels: LabelMaps = { fields: {}, types: {}, byType: {} };
const conflicts: string[] = [];

/**
 * Scan order decides which title wins for a shared field name: documents
 * first (closest to what editors see at the top level), then definitions and
 * shared helpers, page-builder blocks and Portable Text members last (their
 * titles are the most context-specific).
 */
const FOLDER_PRIORITY = [
  'documents',
  'definitions',
  'shared',
  'blocks',
  'portableText',
];

function folderRank(file: string): number {
  const top = file.split(/[\\/]/)[0] ?? '';
  const rank = FOLDER_PRIORITY.indexOf(top);
  return rank === -1 ? FOLDER_PRIORITY.length : rank;
}

function listSchemaFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
    .sort((a, b) => folderRank(a) - folderRank(b) || a.localeCompare(b, 'en'))
    .map((file) => join(root, file));
}

function cleanTitle(title: string): string {
  return title.replace(OPTIONAL_SUFFIX, '').replace(/\s+/g, ' ').trim();
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

/** `const title = '…'` declarations of one file, for shorthand titles. */
function collectStringConstants(source: ts.SourceFile): Map<string, string> {
  const constants = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isStringLiteral(node.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      if (!constants.has(node.name.text)) {
        constants.set(node.name.text, node.initializer.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return constants;
}

function stringValue(
  node: ts.Expression,
  constants: Map<string, string>,
): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isIdentifier(node)) return constants.get(node.text);
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return stringValue(node.expression, constants);
  }
  return undefined;
}

function readStringProperty(
  object: ts.ObjectLiteralExpression,
  key: string,
  constants: Map<string, string>,
): string | undefined {
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === key
    ) {
      return stringValue(property.initializer, constants);
    }
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === key
    ) {
      return constants.get(property.name.text);
    }
  }
  return undefined;
}

function readArrayProperty(
  object: ts.ObjectLiteralExpression,
  key: string,
): ts.ArrayLiteralExpression | undefined {
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === key &&
      ts.isArrayLiteralExpression(property.initializer)
    ) {
      return property.initializer;
    }
  }
  return undefined;
}

function calleeName(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}

/** Property name of the array literal that directly contains `node`. */
function enclosingArrayProperty(node: ts.Node): string | undefined {
  let current: ts.Node = node;
  // Step over a wrapping call, e.g. `of: [defineArrayMember({...})]`.
  if (current.parent && ts.isCallExpression(current.parent)) {
    current = current.parent;
  }
  const array = current.parent;
  if (!array || !ts.isArrayLiteralExpression(array)) return undefined;
  const holder = array.parent;
  if (holder && ts.isPropertyAssignment(holder)) {
    return propertyName(holder.name);
  }
  return undefined;
}

function classify(object: ts.ObjectLiteralExpression): Kind | null {
  const arrayProperty = enclosingArrayProperty(object);
  if (arrayProperty && NON_FIELD_ARRAYS.has(arrayProperty)) return null;

  const parent = object.parent;
  if (parent && ts.isCallExpression(parent)) {
    const callee = calleeName(parent);
    if (callee === 'defineType') return 'type';
    if (callee === 'defineArrayMember') return 'member';
  }
  if (arrayProperty === 'of') return 'member';
  return 'field';
}

/** Object literal behind a field entry: `{…}` or `helper({…})`. */
function fieldObject(
  element: ts.Expression,
): ts.ObjectLiteralExpression | undefined {
  if (ts.isObjectLiteralExpression(element)) return element;
  if (ts.isCallExpression(element)) {
    const first = element.arguments[0];
    if (first && ts.isObjectLiteralExpression(first)) return first;
  }
  return undefined;
}

function record(
  map: Record<string, string>,
  scope: string,
  name: string,
  title: string,
  where: string,
): void {
  const existing = map[name];
  if (existing === undefined) {
    map[name] = title;
    return;
  }
  if (existing !== title) {
    conflicts.push(
      `[${scope}] "${name}": keeping "${existing}", ignoring "${title}" (${where})`,
    );
  }
}

/**
 * Field definitions stored in a variable (`export const pageBuilderField =
 * defineField({...})`), so a type's `fields: [pageBuilderField]` entry can be
 * resolved across files after the scan.
 */
const namedFields = new Map<string, { name: string; title: string }>();

/** `fields: [someFieldVariable]` entries resolved after every file is read. */
const pendingFieldRefs: { type: string; variable: string; where: string }[] =
  [];

function rememberNamedField(
  object: ts.ObjectLiteralExpression,
  name: string,
  title: string,
): void {
  let node: ts.Node = object;
  if (node.parent && ts.isCallExpression(node.parent)) node = node.parent;
  const declaration = node.parent;
  if (
    declaration &&
    ts.isVariableDeclaration(declaration) &&
    ts.isIdentifier(declaration.name) &&
    !namedFields.has(declaration.name.text)
  ) {
    namedFields.set(declaration.name.text, { name, title });
  }
}

function collectTypeFields(
  typeName: string,
  fields: ts.ArrayLiteralExpression,
  constants: Map<string, string>,
  where: string,
): void {
  const own = (labels.byType[typeName] ??= {});
  for (const element of fields.elements) {
    if (ts.isIdentifier(element)) {
      pendingFieldRefs.push({ type: typeName, variable: element.text, where });
      continue;
    }
    const child = fieldObject(element);
    if (!child) continue;
    const childName = readStringProperty(child, 'name', constants);
    const childTitle = readStringProperty(child, 'title', constants);
    if (childName && childTitle) {
      record(
        own,
        `byType.${typeName}`,
        childName,
        cleanTitle(childTitle),
        where,
      );
    }
  }
}

function resolvePendingFieldRefs(): void {
  for (const ref of pendingFieldRefs) {
    const field = namedFields.get(ref.variable);
    if (!field) continue;
    const own = (labels.byType[ref.type] ??= {});
    record(own, `byType.${ref.type}`, field.name, field.title, ref.where);
  }
}

function scanFile(file: string): void {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const constants = collectStringConstants(source);
  const where = relative(join(APP_ROOT, '..'), file).split(sep).join('/');

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const name = readStringProperty(node, 'name', constants);
      const rawTitle = readStringProperty(node, 'title', constants);
      const kind = name ? classify(node) : null;

      if (name && kind) {
        if (rawTitle) {
          const title = cleanTitle(rawTitle);
          if (kind === 'field') {
            record(labels.fields, 'fields', name, title, where);
          } else {
            record(labels.types, 'types', name, title, where);
          }
          rememberNamedField(node, name, title);
        }

        // Direct fields of a type (or inline array-member object).
        const fields =
          kind === 'field' ? undefined : readArrayProperty(node, 'fields');
        if (fields) collectTypeFields(name, fields, constants, where);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function sortRecord<T>(input: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(input).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
}

const files = listSchemaFiles(SCHEMA_ROOT);
for (const file of files) scanFile(file);
resolvePendingFieldRefs();

const output = {
  fields: sortRecord(labels.fields),
  types: sortRecord(labels.types),
  byType: sortRecord(
    Object.fromEntries(
      Object.entries(labels.byType)
        .filter(([, fields]) => Object.keys(fields).length > 0)
        .map(([type, fields]) => [type, sortRecord(fields)]),
    ),
  ),
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

for (const conflict of conflicts) process.stderr.write(`${conflict}\n`);
process.stderr.write(
  `field-labels: ${files.length} files, ${Object.keys(output.fields).length} fields, ` +
    `${Object.keys(output.types).length} types, ${Object.keys(output.byType).length} typed field maps, ` +
    `${conflicts.length} conflicts → ${relative(APP_ROOT, OUTPUT)}\n`,
);
