# Technical Data Enhancement Plan

## Overview

This document outlines the plan to enhance the product technical data system to support:
1. **Multi-variant products** (e.g., Atmosphere SX with Alive, Excite, Euphoria, Euphoria HC variants)
2. **Single-model products** (current simple 2-column format)
3. **Custom table editor** in Sanity Studio for intuitive editing experience
4. **Variant selection** in the product comparison tool

---

## Current State

### Schema (product.ts)
```typescript
technicalData: [
  { 
    title: string,           // "Wzmocnienie"
    value: PortableText[]    // "MC: 64 dB\nMM: 42 dB"
  }
]
```

### Limitations
- Only supports single-model products (2 columns: parameter + value)
- No support for multi-variant tables like Atmosphere SX
- Standard Sanity array input - not table-like editing experience
- Comparison tool cannot handle variant selection

---

## Proposed Schema

### New Structure

```typescript
// apps/studio/schemaTypes/documents/collections/product.ts

defineField({
  name: 'technicalData',
  title: 'Dane techniczne',
  type: 'object',
  group: GROUP.MAIN_CONTENT,
  fields: [
    // Optional: Product variants (for multi-model products)
    defineField({
      name: 'variants',
      title: 'Warianty produktu',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Np. "Alive", "Excite", "Euphoria". Pozostaw puste dla produktów bez wariantów.',
    }),
    
    // Optional: Group title (shown as header above variants)
    defineField({
      name: 'groupTitle',
      title: 'Nazwa grupy wariantów',
      type: 'string',
      description: 'Np. "Atmosphere SX". Wyświetla się jako nagłówek tabeli nad wariantami.',
      hidden: ({ parent }) => !parent?.variants || parent.variants.length === 0,
    }),
    
    // The actual specification rows
    defineField({
      name: 'rows',
      title: 'Parametry techniczne',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'technicalDataRow',
          fields: [
            defineField({
              name: 'title',
              title: 'Nazwa parametru',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'values',
              title: 'Wartości',
              type: 'array',
              of: [
                // Each value is a Portable Text block array
                {
                  type: 'object',
                  name: 'cellValue',
                  fields: [
                    customPortableText({
                      name: 'content',
                      title: 'Zawartość',
                      include: {
                        styles: ['normal'],
                        lists: ['bullet', 'number'],
                        decorators: ['strong', 'em'],
                        annotations: ['customLink'],
                      },
                    }),
                  ],
                  preview: {
                    select: { content: 'content' },
                    prepare: ({ content }) => ({
                      title: extractPlainText(content) || 'Pusta komórka',
                    }),
                  },
                },
              ],
              validation: (Rule) =>
                Rule.custom((values, context) => {
                  const parent = context.parent as { variants?: string[] };
                  const variantCount = parent?.variants?.length || 1;
                  if (values && values.length !== variantCount) {
                    return `Liczba wartości (${values.length}) musi być równa liczbie wariantów (${variantCount})`;
                  }
                  return true;
                }),
            }),
          ],
          preview: {
            select: {
              title: 'title',
              values: 'values',
            },
            prepare: ({ title, values }) => ({
              title: title || 'Parametr',
              subtitle: `${values?.length || 0} wartości`,
            }),
          },
        },
      ],
    }),
  ],
  // Custom input component for table-like editing
  components: {
    input: TechnicalDataTableInput,
  },
})
```

### Data Examples

#### Single-Model Product
```json
{
  "technicalData": {
    "variants": null,
    "groupTitle": null,
    "rows": [
      {
        "_key": "row1",
        "title": "Wzmocnienie",
        "values": [
          {
            "_key": "val1",
            "content": [
              { "_type": "block", "children": [{ "text": "MC: 64 dB" }] },
              { "_type": "block", "children": [{ "text": "MM: 42 dB" }] }
            ]
          }
        ]
      },
      {
        "_key": "row2",
        "title": "Impedancja",
        "values": [
          {
            "_key": "val1",
            "content": [
              { "_type": "block", "children": [{ "text": "MC: 10, 20, 80.6, 100, 200, 402 Ohm" }] },
              { "_type": "block", "children": [{ "text": "MM: 47 kΩ/200pF" }] }
            ]
          }
        ]
      }
    ]
  }
}
```

#### Multi-Variant Product (Atmosphere SX)
```json
{
  "technicalData": {
    "variants": ["Alive", "Excite", "Euphoria", "Euphoria HC"],
    "groupTitle": "Atmosphere SX",
    "rows": [
      {
        "_key": "row1",
        "title": "Przewodnik Copper Matrix Alloy",
        "values": [
          { "_key": "v1", "content": [{ "_type": "block", "children": [{ "text": "3 wiązki\n12 AWG" }] }] },
          { "_key": "v2", "content": [{ "_type": "block", "children": [{ "text": "3 wiązki\n12 AWG" }] }] },
          { "_key": "v3", "content": [{ "_type": "block", "children": [{ "text": "3 wiązki\n12 AWG" }] }] },
          { "_key": "v4", "content": [{ "_type": "block", "children": [{ "text": "3 wiązki\n10 AWG" }] }] }
        ]
      },
      {
        "_key": "row2",
        "title": "Kondycjonowanie Quantum Tunelling",
        "values": [
          { "_key": "v1", "content": [{ "_type": "block", "children": [{ "text": "✔" }] }] },
          { "_key": "v2", "content": [{ "_type": "block", "children": [{ "text": "✔" }] }] },
          { "_key": "v3", "content": [{ "_type": "block", "children": [{ "text": "✔" }] }] },
          { "_key": "v4", "content": [{ "_type": "block", "children": [{ "text": "✔" }] }] }
        ]
      }
    ]
  }
}
```

---

## Sanity Studio: Custom Table Component

### Location
```
apps/studio/components/technical-data-table/
├── index.tsx                 # Main custom input component
├── TableEditor.tsx           # Table UI component
├── VariantManager.tsx        # Add/remove/rename variants
├── RowEditor.tsx             # Single row editing
├── CellEditor.tsx            # Portable Text cell editing
├── styles.module.css         # Component styles
└── types.ts                  # TypeScript types
```

### Component Design

#### Main View (TechnicalDataTableInput)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DANE TECHNICZNE                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Warianty produktu:  [Alive] [Excite] [Euphoria] [Euphoria HC] [+ Dodaj]   │
│  Nazwa grupy: [Atmosphere SX                                    ]           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┬────────────┬────────────┬────────────┬─────────────┐ │
│  │ Parametr         │ Alive      │ Excite     │ Euphoria   │ Euphoria HC │ │
│  ├──────────────────┼────────────┼────────────┼────────────┼─────────────┤ │
│  │ Przewodnik       │ 3 wiązki   │ 3 wiązki   │ 3 wiązki   │ 3 wiązki    │ │
│  │ Copper Matrix    │ 12 AWG     │ 12 AWG     │ 12 AWG     │ 10 AWG      │ │
│  │                  │ [Edytuj]   │ [Edytuj]   │ [Edytuj]   │ [Edytuj]    │ │
│  ├──────────────────┼────────────┼────────────┼────────────┼─────────────┤ │
│  │ Przewodnik       │ Srebro 99% │ Srebro 99% │ Srebro 99% │ Srebro 99%  │ │
│  │ Air String       │ Wolfram 1% │ Wolfram 1% │ Wolfram 1% │ Wolfram 1%  │ │
│  │                  │ [Edytuj]   │ [Edytuj]   │ [Edytuj]   │ [Edytuj]    │ │
│  ├──────────────────┼────────────┼────────────┼────────────┼─────────────┤ │
│  │ Kondycjonowanie  │     ✔      │     ✔      │     ✔      │     ✔       │ │
│  │ Quantum          │ [Edytuj]   │ [Edytuj]   │ [Edytuj]   │ [Edytuj]    │ │
│  ├──────────────────┼────────────┼────────────┼────────────┼─────────────┤ │
│  │ [+ Dodaj parametr]                                                    │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  [Usuń wszystkie dane] [Skopiuj z innego produktu]                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Single-Model View (No Variants)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DANE TECHNICZNE                                    [+ Dodaj wariant]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────┬───────────────────────────────────────────┐  │
│  │ Parametr                 │ Wartość                                   │  │
│  ├──────────────────────────┼───────────────────────────────────────────┤  │
│  │ Wzmocnienie              │ MC: 64 dB                                 │  │
│  │                          │ MM: 42 dB                                 │  │
│  │                          │ [Edytuj]                                  │  │
│  ├──────────────────────────┼───────────────────────────────────────────┤  │
│  │ Impedancja               │ MC: 10, 20, 80.6, 100, 200, 402 Ohm.     │  │
│  │                          │ Kastomizacja do 1 kOhm.                   │  │
│  │                          │ MM: 47 kΩ/200pF                           │  │
│  │                          │ [Edytuj]                                  │  │
│  ├──────────────────────────┼───────────────────────────────────────────┤  │
│  │ Dodatkowe informacje     │ • Brak negatywnego sprzężenia zwrotnego   │  │
│  │                          │ • Prawdziwa podwójna klasa mono klasy A   │  │
│  │                          │ • Wejścia dla wkładek z ruchomą cewką     │  │
│  │                          │ [Edytuj]                                  │  │
│  ├──────────────────────────┼───────────────────────────────────────────┤  │
│  │ [+ Dodaj parametr]                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cell Editor (Modal)

When clicking "Edytuj" on a cell, opens a modal with full Portable Text editor:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Edycja wartości: "Dodatkowe informacje" → Euphoria                    [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [B] [I] [U] [Link] [•] [1.] [Akapit ▾]                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │ • Brak negatywnego sprzężenia zwrotnego                             │   │
│  │ • Prawdziwa podwójna klasa mono klasy A.                            │   │
│  │ • Wejścia dla wkładek z ruchomą cewką (MC oraz MI) i ruchomym       │   │
│  │   magnesem (MM)                                                     │   │
│  │ • Oporność obciążenia MC można ustawić zewnętrznie za pomocą        │   │
│  │   przełączników na lewym / prawym panelu tylnym                     │   │
│  │ • Wewnętrzne przełączanie między MC i MM                            │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                              [Anuluj]  [Zapisz]             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Variant Management**
   - Add/remove variants dynamically
   - Rename variants inline
   - When adding variant, automatically adds empty cell to each row
   - When removing variant, confirms and removes that column from all rows

2. **Row Management**
   - Add new rows at bottom
   - Delete rows with confirmation
   - Reorder rows via drag-and-drop
   - Duplicate row functionality

3. **Cell Editing**
   - Click to edit in modal
   - Full Portable Text support (bold, italic, links, bullets, numbered lists)
   - Preview shows formatted content
   - Copy/paste between cells

4. **Validation**
   - Each row must have exactly N values (where N = variant count or 1)
   - Parameter title is required
   - Visual indicators for incomplete/invalid rows

5. **UX Improvements**
   - Keyboard navigation between cells
   - Bulk operations (clear row, copy row)
   - Undo/redo support via Sanity's built-in mechanisms

---

## Document View Structure

### New View Tab for Technical Data

Add a dedicated view tab in the product document structure:

```typescript
// apps/studio/structure.ts

// Product document views
S.document()
  .documentId(documentId)
  .schemaType('product')
  .views([
    // Default form view
    S.view.form().title('Edycja').icon(EditIcon),
    
    // Technical Data table view
    S.view
      .component(TechnicalDataView)
      .title('Dane techniczne')
      .icon(TableIcon),
    
    // Preview view
    S.view
      .component(PreviewView)
      .title('Podgląd')
      .icon(EyeIcon),
  ])
```

This creates a dedicated tab for technical data editing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Wilson Audio Sasha DAW                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Edycja] [Dane techniczne] [Podgląd]                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  (Full-screen table editor here)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend: Product Page

### Updated TechnicalData Component

Location: `apps/web/src/components/products/TechnicalData/`

```typescript
// index.tsx

interface TechnicalDataProps {
  data: {
    variants?: string[] | null;
    groupTitle?: string | null;
    rows: Array<{
      title: string;
      values: Array<{
        content: PortableTextBlock[];
      }>;
    }>;
  } | null;
  customId?: string;
}

export default function TechnicalData({ data, customId }: TechnicalDataProps) {
  if (!data || !data.rows || data.rows.length === 0) return null;

  const hasVariants = data.variants && data.variants.length > 0;

  return (
    <section className={`${styles.technicalData} max-width-block`} id={customId}>
      <h2 className={styles.heading}>Dane techniczne</h2>
      
      <table className={styles.table}>
        {hasVariants && (
          <thead>
            {/* Group title row */}
            {data.groupTitle && (
              <tr className={styles.groupTitleRow}>
                <th></th>
                <th colSpan={data.variants!.length}>{data.groupTitle}</th>
              </tr>
            )}
            {/* Variant names row */}
            <tr className={styles.variantRow}>
              <th></th>
              {data.variants!.map((variant, idx) => (
                <th key={idx} className={styles.variantHeader}>{variant}</th>
              ))}
            </tr>
          </thead>
        )}
        
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className={styles.row}>
              <td className={styles.parameterCell}>{row.title}</td>
              {row.values.map((value, valIdx) => (
                <td key={valIdx} className={styles.valueCell}>
                  <PortableText value={value.content} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

### Visual Design

#### Single-Model Table
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DANE TECHNICZNE                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────┬───────────────────────────────────────────┐  │
│  │ Wzmocnienie              │ MC: 64 dB                                 │  │
│  │                          │ MM: 42 dB                                 │  │
│  ├──────────────────────────┼───────────────────────────────────────────┤  │
│  │ Impedancja               │ MC: 10, 20, 80.6, 100, 200, 402 Ohm.     │  │
│  │                          │ MM: 47 kΩ/200pF                           │  │
│  ├──────────────────────────┼───────────────────────────────────────────┤  │
│  │ Dodatkowe informacje     │ • Brak negatywnego sprzężenia zwrotnego   │  │
│  │                          │ • Prawdziwa podwójna klasa mono...        │  │
│  └──────────────────────────┴───────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Multi-Variant Table
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DANE TECHNICZNE                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┬─────────────────────────────────────────────────┐  │
│  │                    │              Atmosphere SX                      │  │
│  │                    ├────────────┬────────────┬──────────┬───────────┤  │
│  │                    │ Alive      │ Excite     │ Euphoria │ Euph. HC  │  │
│  ├────────────────────┼────────────┼────────────┼──────────┼───────────┤  │
│  │ Przewodnik Copper  │ 3 wiązki   │ 3 wiązki   │ 3 wiązki │ 3 wiązki  │  │
│  │ Matrix Alloy       │ 12 AWG     │ 12 AWG     │ 12 AWG   │ 10 AWG    │  │
│  ├────────────────────┼────────────┼────────────┼──────────┼───────────┤  │
│  │ Kondycjonowanie    │     ✔      │     ✔      │     ✔    │     ✔     │  │
│  │ Quantum Tunelling  │            │            │          │           │  │
│  ├────────────────────┼────────────┼────────────┼──────────┼───────────┤  │
│  │ Moduły tuningowe   │     -      │ ✔ BLACK    │ ✔ BLACK  │ ✔ BLACK   │  │
│  │ SX                 │            │            │ ✔ GOLD   │ ✔ GOLD    │  │
│  │                    │            │            │ ✔ SILVER │ ✔ SILVER  │  │
│  └────────────────────┴────────────┴────────────┴──────────┴───────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mobile Responsive

For multi-variant tables on mobile, use horizontal scroll:

```scss
.technicalData {
  // ... base styles
  
  @media (max-width: 56.1875rem) {
    .table {
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      
      // Minimum column width to ensure readability
      th, td {
        min-width: 6rem;
      }
    }
  }
}
```

---

## Frontend: Comparison Tool

### Updated Types

```typescript
// apps/web/src/global/comparison/types.ts

export type ComparisonProduct = {
  _id: string;
  name: string;
  slug: string;
  subtitle: string;
  basePriceCents: number | null;
  brand: {
    _id: string;
    name: string;
    slug: string;
    logo: SanityProjectedImage | null;
  };
  mainImage: SanityProjectedImage | null;
  imageSource: 'preview' | 'gallery';
  
  // Updated technical data structure
  technicalData: {
    variants?: string[] | null;
    groupTitle?: string | null;
    rows: Array<{
      title: string;
      values: Array<{
        content: PortableTextBlock[];
      }>;
    }>;
  } | null;
  
  categories: Array<{
    slug: string;
  }>;
};

// Selected variant index per product
export type VariantSelections = Record<string, number>; // productId -> variantIndex
```

### Variant Selector UI

Add dropdown selector in `ComparisonProductCard`:

```typescript
// apps/web/src/components/comparison/ComparisonProductCard/index.tsx

interface ComparisonProductCardProps {
  product: ComparisonProduct;
  selectedVariantIndex: number;
  onVariantChange: (productId: string, variantIndex: number) => void;
  onRemove: (productId: string, productName: string) => void;
  index: number;
  isCompact?: boolean;
}

export default function ComparisonProductCard({
  product,
  selectedVariantIndex,
  onVariantChange,
  onRemove,
  index,
  isCompact = false,
}: ComparisonProductCardProps) {
  const hasVariants = product.technicalData?.variants && 
                      product.technicalData.variants.length > 0;

  return (
    <li className={styles.card} data-compact={isCompact}>
      <button
        className={styles.removeButton}
        onClick={() => onRemove(product._id, product.name)}
        aria-label={`Usuń ${product.name} z porównania`}
      >
        <CloseIcon />
      </button>
      
      {/* Variant selector - only show if product has variants */}
      {hasVariants && !isCompact && (
        <div className={styles.variantSelector}>
          <label htmlFor={`variant-${product._id}`} className="sr-only">
            Wybierz wariant
          </label>
          <select
            id={`variant-${product._id}`}
            value={selectedVariantIndex}
            onChange={(e) => onVariantChange(product._id, Number(e.target.value))}
            className={styles.variantDropdown}
          >
            {product.technicalData!.variants!.map((variant, idx) => (
              <option key={idx} value={idx}>
                {variant}
              </option>
            ))}
          </select>
          <ChevronDownIcon className={styles.dropdownIcon} />
        </div>
      )}
      
      {/* Compact variant indicator */}
      {hasVariants && isCompact && (
        <span className={styles.variantBadge}>
          {product.technicalData!.variants![selectedVariantIndex]}
        </span>
      )}
      
      {/* Rest of card content... */}
      <ProductImage ... />
      <ProductInfo ... />
    </li>
  );
}
```

### Updated Comparison Table

```typescript
// apps/web/src/components/comparison/ComparisonTable/index.tsx

export default function ComparisonTable({
  products,
  availableProducts,
}: ComparisonTableProps) {
  // Track selected variant for each product
  const [variantSelections, setVariantSelections] = useState<VariantSelections>(
    () => {
      // Default to first variant (index 0) for all products
      const initial: VariantSelections = {};
      products.forEach((p) => {
        initial[p._id] = 0;
      });
      return initial;
    }
  );

  const handleVariantChange = (productId: string, variantIndex: number) => {
    setVariantSelections((prev) => ({
      ...prev,
      [productId]: variantIndex,
    }));
  };

  // Process comparison data with variant selections
  const comparisonData = useMemo(
    () => processComparisonDataWithVariants(currentProducts, variantSelections),
    [currentProducts, variantSelections]
  );

  // ... rest of component
}
```

### Updated Comparison Helpers

```typescript
// apps/web/src/global/comparison/comparison-helpers.ts

/**
 * Extract technical data for a specific variant
 */
export function getProductTechDataForVariant(
  product: ComparisonProduct,
  variantIndex: number
): Array<{ title: string; value: PortableTextBlock[] }> {
  if (!product.technicalData?.rows) return [];
  
  return product.technicalData.rows.map((row) => ({
    title: row.title,
    value: row.values[variantIndex]?.content || [],
  }));
}

/**
 * Process products into comparison table data with variant support
 */
export function processComparisonDataWithVariants(
  products: ComparisonProduct[],
  variantSelections: VariantSelections
): ComparisonTableData {
  // Build normalized tech data per product using selected variants
  const normalizedProducts = products.map((product) => {
    const variantIndex = variantSelections[product._id] ?? 0;
    return {
      ...product,
      normalizedTechData: getProductTechDataForVariant(product, variantIndex),
    };
  });

  // Extract all unique headings
  const allHeadings = extractAllHeadingsFromNormalized(normalizedProducts);
  
  // Create comparison rows
  const comparisonRows = allHeadings.map((heading) => {
    const values = normalizedProducts.map((product) => {
      const item = product.normalizedTechData.find((d) => d.title === heading);
      return item?.value || null;
    });
    return { heading, values };
  });

  return {
    products,
    allHeadings,
    comparisonRows,
  };
}
```

---

## GROQ Query Updates

### Product Query

```typescript
// apps/web/src/global/sanity/query.ts

export const queryProductBySlug = defineQuery(/* groq */ `
  *[_type == "product" && slug.current == $slug][0]{
    _id,
    name,
    // ... other fields
    
    // Updated technicalData query
    technicalData {
      variants,
      groupTitle,
      rows[] {
        _key,
        title,
        values[] {
          _key,
          ${portableTextFragment('content')}
        }
      }
    },
    
    // ... rest of query
  }
`);
```

### Comparison Products Query

```typescript
export const queryComparisonProducts = defineQuery(/* groq */ `
  *[_type == "product" && _id in $productIds]{
    _id,
    name,
    "slug": slug.current,
    subtitle,
    basePriceCents,
    // ... other fields
    
    technicalData {
      variants,
      groupTitle,
      rows[] {
        _key,
        title,
        values[] {
          _key,
          ${portableTextFragment('content')}
        }
      }
    },
    
    // ... rest
  }
`);
```

---

## TypeScript Types

```typescript
// apps/web/src/global/sanity/sanity.types.ts (auto-generated)
// These will be auto-generated, but for reference:

export type TechnicalDataCellValue = {
  _key: string;
  content: PortableTextBlock[];
};

export type TechnicalDataRow = {
  _key: string;
  title: string;
  values: TechnicalDataCellValue[];
};

export type TechnicalData = {
  variants?: string[] | null;
  groupTitle?: string | null;
  rows: TechnicalDataRow[];
} | null;
```

---

## Implementation Phases

### Phase 1: Schema & Types (Day 1)
- [ ] Update product schema with new `technicalData` structure
- [ ] Create TypeScript types for the new structure
- [ ] Update GROQ queries
- [ ] Run `sanity typegen generate` to update auto-generated types

### Phase 2: Custom Sanity Component (Days 2-3)
- [ ] Create `TechnicalDataTableInput` custom component
- [ ] Implement variant management (add/remove/rename)
- [ ] Implement row management (add/delete/reorder)
- [ ] Implement cell editing modal with Portable Text
- [ ] Add document view tab for technical data
- [ ] Style the component to match Sanity Studio theme

### Phase 3: Frontend - Product Page (Day 4)
- [ ] Update `TechnicalData` component for new structure
- [ ] Handle single-model display
- [ ] Handle multi-variant display with header rows
- [ ] Implement mobile horizontal scroll
- [ ] Update styles

### Phase 4: Frontend - Comparison Tool (Day 5)
- [ ] Add variant selection state management
- [ ] Create variant dropdown in `ComparisonProductCard`
- [ ] Update `processComparisonData` for variant support
- [ ] Update comparison table rendering
- [ ] Handle sticky header with variant indicators

### Phase 5: Testing & Polish (Day 6)
- [ ] Test with single-model products
- [ ] Test with multi-variant products
- [ ] Test comparison tool with mixed products
- [ ] Test mobile responsiveness
- [ ] Test Portable Text features (links, bullets, formatting)
- [ ] Edge cases (empty data, single row, many variants)

---

## Files to Create/Modify

### New Files
```
apps/studio/components/technical-data-table/
├── index.tsx
├── TableEditor.tsx
├── VariantManager.tsx
├── RowEditor.tsx
├── CellEditor.tsx
├── styles.module.css
└── types.ts

apps/studio/views/
└── TechnicalDataView.tsx
```

### Modified Files
```
apps/studio/
├── schemaTypes/documents/collections/product.ts  # Schema update
├── structure.ts                                   # Add document view

apps/web/src/
├── components/products/TechnicalData/
│   ├── index.tsx                                  # Component update
│   └── styles.module.scss                         # Style update
├── components/comparison/
│   ├── ComparisonTable/index.tsx                  # Variant selection
│   ├── ComparisonProductCard/index.tsx            # Variant dropdown
│   └── ComparisonProductCard/styles.module.scss   # Dropdown styles
├── global/comparison/
│   ├── types.ts                                   # Type updates
│   └── comparison-helpers.ts                      # Variant support
└── global/sanity/
    └── query.ts                                   # GROQ updates
```

---

## Notes

### Backward Compatibility
The new structure is a complete replacement. Existing `technicalData` arrays will need to be transformed during the data migration to the new object structure.

### Performance Considerations
- The Portable Text content in cells should be kept concise
- Multi-variant tables with many columns may need horizontal scroll on mobile
- Consider lazy loading cell editors in Sanity Studio for large tables

### Editor Experience
- Provide clear visual feedback when cells are incomplete
- Auto-focus on parameter name when adding new row
- Show preview of formatted content in cells (not raw blocks)
- Keyboard shortcuts: Tab to move between cells, Enter to save

