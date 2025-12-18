# Comparator Parameter Transformation Feature - Implementation Plan

## Executive Summary

This document outlines the implementation of a **parameter transformation (rename) feature** for the Sanity Studio Comparator tool. The feature allows bulk renaming of parameter names across products within a category, preserving parameter values while standardizing inconsistent parameter names.

**Use Case**: After data migration, similar parameters may have slight variations (e.g., "Wymiary" vs "Wymiary:"). This feature enables one-click transformation to normalize parameter names across all products.

---

## 1. Current State Analysis

### 1.1 Product Schema Structure (`product.ts`)

The technical data in products is structured as:

```typescript
technicalData: {
  variants?: string[];           // Product variants (e.g., "Alive", "Excite")
  groups: Array<{                // Sections of parameters
    title?: string;              // Section name (optional)
    rows: Array<{                // Parameters within section
      title: string;             // PARAMETER NAME - this is what we want to transform
      values: Array<{            // Values (rich text, one per variant)
        content: PortableTextBlock[];
      }>;
    }>;
  }>;
}
```

**Key Insight**: The parameter name is stored in `technicalData.groups[].rows[].title` as a plain string.

### 1.2 Current Comparator Tool Structure (`tools/comparator/index.tsx`)

The comparator tool currently:

1. **Lists categories** - Grouped by parent category in sidebar
2. **Discovers parameters** - Extracts unique parameter names from all products in selected category
3. **Shows parameter stats** - Count of products with/without each parameter
4. **Shows product lists** - Expandable list of products for each parameter
5. **Manages comparison config** - Enables/disables parameters for frontend comparison

**Relevant State & Data**:

- `discoveredParams: DiscoveredParameter[]` - All unique parameters found in products
- `DiscoveredParameter.products: ProductInfo[]` - Products WITH the parameter
- `DiscoveredParameter.missingProducts: ProductInfo[]` - Products WITHOUT the parameter

### 1.3 Data Available for Transformation

When user expands a parameter in the discovered list, they see:

- Products WITH the parameter (green badge ✓)
- Products WITHOUT the parameter (yellow badge !)

This same data structure enables the transformation feature.

---

## 2. Feature Requirements

### 2.1 User Flow

1. User selects a category (e.g., "Wzmacniacze")
2. User sees discovered parameters list (e.g., "Wymiary:" - 10 products, "Wymiary" - 8 products)
3. User identifies a parameter that should be renamed/consolidated
4. User initiates transformation:
   - **Source parameter**: "Wymiary:" (to be renamed)
   - **Target parameter**: Either:
     - Select from existing parameters dropdown (e.g., "Wymiary")
     - **OR type a custom new name** (e.g., "Wymiary [mm]" - doesn't exist yet)
5. System shows preview:
   - "8 products have 'Wymiary:' but NOT 'Wymiary'" (eligible)
   - "2 products have BOTH parameters (will be skipped)"
   - **Each eligible product has a checkbox** (all selected by default)
6. **User can uncheck specific products** to exclude them from transformation
7. User confirms transformation
8. System renames `title: "Wymiary:"` → `title: "Wymiary"` only in the **selected** products
9. Values (rich text) are preserved unchanged
10. User sees success message with count of transformed products

### 2.2 Business Rules

1. **Only rename if target doesn't exist**: If a product already has parameter Y, don't rename X → Y (would cause duplicate)
2. **Preserve all values**: The rich text content in `values[]` must remain unchanged
3. **Category-scoped**: Only affects products in the selected category
4. **Batch operation**: Updates multiple products in a single transaction
5. **Confirmation required**: Show preview before executing
6. **Audit trail**: Show success/error message with affected product count
7. **Custom target names allowed**: User can type a new parameter name that doesn't exist in any product yet
8. **Selective transformation**: User can uncheck individual products to exclude them from transformation (all selected by default)

### 2.3 Edge Cases

| Scenario                                  | Behavior                                                       |
| ----------------------------------------- | -------------------------------------------------------------- |
| Product has both source and target params | Skip - don't modify (shown in "skipped" section)               |
| Product has only source param             | Eligible - shown with checkbox (selected by default)           |
| Product has only target param             | N/A - not affected                                             |
| Product has neither                       | N/A - not affected                                             |
| Source and target are the same            | Show error - cannot transform to same name                     |
| No products eligible                      | Show info message - nothing to transform                       |
| Sanity API error during patch             | Rollback transaction, show error                               |
| **Custom target name (new)**              | Allow - creates new parameter name in selected products        |
| **Custom name with whitespace only**      | Show error - parameter name cannot be empty/whitespace         |
| **User unchecks all products**            | Disable confirm button - at least 1 product must be selected   |
| **User unchecks some products**           | Only transform checked products                                |
| **Custom name matches existing param**    | Treat as existing param - apply same duplicate detection logic |

---

## 3. Technical Architecture

### 3.1 UI Component Location

**File**: `apps/studio/tools/comparator/index.tsx`

**New UI Elements**:

1. **Transform button** - On each discovered parameter row (or context menu)
2. **Transform modal/dialog** - To select target parameter and confirm
3. **Transform preview** - Shows affected products before execution

### 3.2 Data Flow

```
User clicks "Transform to..." on parameter X
                ↓
Modal opens with:
  - Dropdown of existing parameters in category
  - Text input for custom parameter name (new name that doesn't exist yet)
                ↓
User EITHER selects existing parameter Y from dropdown
       OR types custom name in text input
                ↓
System calculates eligible products:
  - If existing param: Products with X but NOT Y → eligible
  - If custom name: ALL products with X → eligible (since target doesn't exist)
  - Products with both X and Y → will be skipped (only for existing params)
                ↓
User sees preview with checkboxes (all selected by default)
                ↓
User can UNCHECK specific products to exclude them
                ↓
User confirms transformation
                ↓
System patches ONLY CHECKED products via Sanity client:
  for each selected product:
    - Find row where title === sourceParam
    - Change title to targetParam
    - Commit patch
                ↓
Refresh discovered parameters
                ↓
Show success message with count
```

### 3.3 Sanity Mutation Strategy

**Option A: Individual Patches** (Safer, slower)

```typescript
for (const product of eligibleProducts) {
  await client
    .patch(product._id)
    .set({
      /* path to title */
    })
    .commit();
}
```

**Option B: Transaction** (Faster, atomic - RECOMMENDED)

```typescript
const transaction = client.transaction();
for (const product of eligibleProducts) {
  transaction.patch(product._id, (patch) =>
    patch.set({
      /* path to title */
    })
  );
}
await transaction.commit();
```

**Recommendation**: Use **Transaction** for atomicity - if one fails, all fail. This prevents partial transformations.

### 3.4 Finding the Parameter Path

The challenge is finding the exact path to the parameter within the nested structure. We need to:

1. Fetch full technical data for each product
2. Iterate through `groups[].rows[]` to find the row with matching `title`
3. Construct the Sanity path: `technicalData.groups[groupIndex].rows[rowIndex].title`

---

## 4. Implementation Plan

### 4.1 Phase 1: UI Components (2-3 hours)

#### Task 1.1: Add Transform Button to Discovered Parameters

**Location**: Inside the discovered parameter card (around line 1197-1437)

**Changes**:

- Add a "Transform" button (icon: `GitMerge` or `ArrowRightLeft`) next to expand button
- Button appears on hover or always visible
- Only enabled when there are other parameters to transform into

```tsx
<Button
  icon={ArrowRightLeft}
  mode='ghost'
  padding={2}
  onClick={() => openTransformModal(param)}
  title='Przekształć w inny parametr'
  disabled={discoveredParams.length < 2}
/>
```

#### Task 1.2: Create Transform Modal Component

**New component or inline state** in `index.tsx`:

```tsx
// State for modal
const [transformModalOpen, setTransformModalOpen] = useState(false);
const [sourceParam, setSourceParam] = useState<DiscoveredParameter | null>(
  null
);

// Target can be selected from dropdown OR typed as custom name
const [selectedExistingParam, setSelectedExistingParam] = useState<string>(''); // From dropdown
const [customParamName, setCustomParamName] = useState<string>(''); // Custom input

// Computed target name (prioritize custom if filled, otherwise use selected)
const targetParamName = customParamName.trim() || selectedExistingParam;

const [transformPreview, setTransformPreview] = useState<{
  eligible: ProductInfo[];
  skipped: ProductInfo[];
} | null>(null);

// NEW: Track which products are selected for transformation (by product ID)
const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
  new Set()
);

const [isTransforming, setIsTransforming] = useState(false);
```

**Modal Content**:

```
┌─────────────────────────────────────────────────────────────┐
│  Przekształć parametr                                   [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Parametr źródłowy: "Wymiary:" (10 produktów)              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Przekształć w istniejący parametr:                        │
│  ┌──────────────────────────────────────────────────┐      │
│  │ [Dropdown] Wybierz parametr docelowy...        ▼ │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ───────────── lub wpisz nową nazwę ─────────────          │
│                                                             │
│  Nowa nazwa parametru:                                     │
│  ┌──────────────────────────────────────────────────┐      │
│  │ [Text Input] Wpisz nową nazwę...                  │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [Podgląd po wybraniu/wpisaniu parametru docelowego]       │
│                                                             │
│  ✓ Produkty do przekształcenia (8):                        │
│    [✓] Produkt A - Brand X                                 │
│    [✓] Produkt B - Brand Y                                 │
│    [✓] Produkt C - Brand Z                                 │
│    [ ] Produkt D - Brand W  (unchecked = excluded)         │
│    ... i 4 więcej                                          │
│                                                             │
│  ⚠ Produkty pominięte - mają już "Wymiary" (2):            │
│    • Produkt E - Brand X                                   │
│    • Produkt F - Brand Y                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                           [Anuluj]  [Przekształć 7 prod.]   │
└─────────────────────────────────────────────────────────────┘
```

#### Task 1.3: Add Modal to UI Tree

Render modal at the end of the component, controlled by state:

```tsx
{
  transformModalOpen && sourceParam && (
    <TransformParameterModal
      sourceParam={sourceParam}
      availableTargets={discoveredParams.filter(
        (p) => p.name !== sourceParam.name
      )}
      onClose={() => setTransformModalOpen(false)}
      onConfirm={handleTransformConfirm}
      isTransforming={isTransforming}
    />
  );
}
```

### 4.2 Phase 2: Preview Logic (1-2 hours)

#### Task 2.1: Calculate Eligible Products

When user selects target parameter OR types custom name, calculate:

```typescript
function calculateTransformPreview(
  sourceParam: DiscoveredParameter,
  targetParamName: string,
  discoveredParams: DiscoveredParameter[]
): { eligible: ProductInfo[]; skipped: ProductInfo[] } {
  // Check if target parameter already exists in the category
  const existingTargetParam = discoveredParams.find(
    (p) => p.name === targetParamName
  );

  if (existingTargetParam) {
    // Target exists - check for duplicates
    const targetProductIds = new Set(
      existingTargetParam.products.map((p) => p._id)
    );

    // Eligible: have source, don't have target
    const eligible = sourceParam.products.filter(
      (p) => !targetProductIds.has(p._id)
    );

    // Skipped: have both source and target
    const skipped = sourceParam.products.filter((p) =>
      targetProductIds.has(p._id)
    );

    return { eligible, skipped };
  } else {
    // Target is a NEW name that doesn't exist yet
    // ALL products with source are eligible (no duplicates possible)
    return {
      eligible: sourceParam.products,
      skipped: [],
    };
  }
}
```

#### Task 2.2: Initialize Selected Products

When preview is calculated, initialize all eligible products as selected:

```typescript
// After calculating preview, select all eligible products by default
useEffect(() => {
  if (transformPreview?.eligible) {
    setSelectedProductIds(new Set(transformPreview.eligible.map((p) => p._id)));
  }
}, [transformPreview?.eligible]);
```

#### Task 2.3: Handle Product Selection Toggle

```typescript
const toggleProductSelection = useCallback((productId: string) => {
  setSelectedProductIds((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    return newSet;
  });
}, []);

const selectAllProducts = useCallback(() => {
  if (transformPreview?.eligible) {
    setSelectedProductIds(new Set(transformPreview.eligible.map((p) => p._id)));
  }
}, [transformPreview?.eligible]);

const deselectAllProducts = useCallback(() => {
  setSelectedProductIds(new Set());
}, []);
```

#### Task 2.4: Display Preview with Checkboxes

Show preview in modal:

- Green section: Products eligible for transformation **with checkboxes**
  - Each product has a checkbox (checked by default)
  - "Select all" / "Deselect all" buttons
  - Count updates based on selection
- Yellow section: Products that will be SKIPPED (have both parameters) - no checkboxes
- Button text shows count of **selected** products (not total eligible)

### 4.3 Phase 3: Transform Execution (2-3 hours)

#### Task 3.1: Fetch Full Product Data

For transformation, we need the full `technicalData` structure to find exact paths:

```typescript
async function fetchProductsForTransform(
  productIds: string[]
): Promise<FullProductData[]> {
  const query = `*[_type == "product" && _id in $productIds] {
    _id,
    name,
    "technicalData": technicalData {
      variants,
      groups[] {
        _key,
        title,
        rows[] {
          _key,
          title,
          values
        }
      }
    }
  }`;

  return await client.fetch(query, { productIds });
}
```

#### Task 3.2: Build Patch Operations

For each product, find the parameter and build the patch:

```typescript
function buildPatchForProduct(
  product: FullProductData,
  sourceParamName: string,
  targetParamName: string
): { productId: string; path: string } | null {
  const groups = product.technicalData?.groups || [];

  for (let gi = 0; gi < groups.length; gi++) {
    const rows = groups[gi].rows || [];
    for (let ri = 0; ri < rows.length; ri++) {
      if (rows[ri].title === sourceParamName) {
        // Found it! Return the path
        return {
          productId: product._id,
          path: `technicalData.groups[${gi}].rows[${ri}].title`,
        };
      }
    }
  }

  return null; // Parameter not found (shouldn't happen if data is correct)
}
```

**Important**: Use `_key` based paths for robustness:

```typescript
// Better approach using _key (survives array reordering)
path: `technicalData.groups[_key=="${groupKey}"].rows[_key=="${rowKey}"].title`;
```

#### Task 3.3: Execute Transaction (Only Selected Products)

```typescript
async function executeTransform(
  eligibleProducts: FullProductData[],
  selectedProductIds: Set<string>, // NEW: Only process selected products
  sourceParamName: string,
  targetParamName: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const transaction = client.transaction();
    let patchCount = 0;

    for (const product of eligibleProducts) {
      // NEW: Skip products that are not selected
      if (!selectedProductIds.has(product._id)) {
        continue;
      }

      const patchInfo = buildPatchForProduct(
        product,
        sourceParamName,
        targetParamName
      );
      if (patchInfo) {
        transaction.patch(product._id, (patch) =>
          patch.set({ [patchInfo.path]: targetParamName })
        );
        patchCount++;
      }
    }

    if (patchCount === 0) {
      return { success: true, count: 0 };
    }

    await transaction.commit();
    return { success: true, count: patchCount };
  } catch (error) {
    console.error('Transform error:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Nieznany błąd',
    };
  }
}
```

### 4.4 Phase 4: Post-Transform (1 hour)

#### Task 4.1: Refresh Data

After successful transform:

1. Refresh discovered parameters (call `fetchParameters(selectedCategoryId, true)`)
2. Show success toast
3. Close modal

```typescript
const handleTransformComplete = async (result: TransformResult) => {
  if (result.success) {
    toast.push({
      status: 'success',
      title: 'Przekształcono!',
      description: `${result.count} produktów zostało zaktualizowanych.`,
    });

    // Refresh data
    await fetchParameters(selectedCategoryId!, true);

    // Close modal
    setTransformModalOpen(false);
    setSourceParam(null);
    setTargetParamName('');
    setTransformPreview(null);
  } else {
    toast.push({
      status: 'error',
      title: 'Błąd przekształcenia',
      description: result.error || 'Nie udało się przekształcić parametrów.',
    });
  }

  setIsTransforming(false);
};
```

#### Task 4.2: Handle Edge Cases

- Empty selection → Disable confirm button
- Same source and target → Show error
- No eligible products → Show info message
- API error → Show error toast, keep modal open for retry

---

## 5. Detailed File Changes

### 5.1 `apps/studio/tools/comparator/index.tsx`

**New Imports**:

```typescript
import { ArrowRightLeft } from 'lucide-react'; // Transform icon
import {
  Dialog,
  Select,
  TextInput,
  Checkbox,
  // ... other Sanity UI components already imported
} from '@sanity/ui';
```

**New Types** (add near top of file):

```typescript
type TransformPreview = {
  eligible: ProductInfo[];
  skipped: ProductInfo[];
};

type FullProductTechnicalData = {
  _id: string;
  name: string;
  technicalData: {
    variants?: string[];
    groups?: Array<{
      _key: string;
      title?: string;
      rows?: Array<{
        _key: string;
        title: string;
        values?: any[];
      }>;
    }>;
  };
};
```

**New State** (add in ComparatorTool component):

```typescript
// Transform modal state
const [transformModalOpen, setTransformModalOpen] = useState(false);
const [sourceParam, setSourceParam] = useState<DiscoveredParameter | null>(
  null
);

// Target parameter - can be selected from dropdown OR typed as custom
const [selectedExistingParam, setSelectedExistingParam] = useState<string>('');
const [customParamName, setCustomParamName] = useState<string>('');

// Computed: prioritize custom name if filled, otherwise use dropdown selection
const targetParamName = customParamName.trim() || selectedExistingParam;

const [transformPreview, setTransformPreview] =
  useState<TransformPreview | null>(null);

// NEW: Track which eligible products are selected for transformation
const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
  new Set()
);

const [isTransforming, setIsTransforming] = useState(false);
```

**New Functions** (add in ComparatorTool component):

```typescript
// Open transform modal
const openTransformModal = useCallback((param: DiscoveredParameter) => {
  setSourceParam(param);
  setSelectedExistingParam('');
  setCustomParamName('');
  setTransformPreview(null);
  setSelectedProductIds(new Set());
  setTransformModalOpen(true);
}, []);

// Calculate preview when target changes (works for both dropdown and custom input)
const calculatePreview = useCallback(
  (targetName: string) => {
    if (!sourceParam || !targetName.trim()) {
      setTransformPreview(null);
      setSelectedProductIds(new Set());
      return;
    }

    // Check if target parameter already exists in the category
    const existingTargetParam = discoveredParams.find(
      (p) => p.name === targetName.trim()
    );

    let eligible: ProductInfo[];
    let skipped: ProductInfo[];

    if (existingTargetParam) {
      // Target exists - check for duplicates
      const targetProductIds = new Set(
        existingTargetParam.products.map((p) => p._id)
      );
      eligible = sourceParam.products.filter(
        (p) => !targetProductIds.has(p._id)
      );
      skipped = sourceParam.products.filter((p) => targetProductIds.has(p._id));
    } else {
      // Target is a NEW name - all products with source are eligible
      eligible = sourceParam.products;
      skipped = [];
    }

    setTransformPreview({ eligible, skipped });
    // Select all eligible products by default
    setSelectedProductIds(new Set(eligible.map((p) => p._id)));
  },
  [sourceParam, discoveredParams]
);

// Handle dropdown selection
const handleExistingParamSelect = useCallback(
  (value: string) => {
    setSelectedExistingParam(value);
    setCustomParamName(''); // Clear custom input when dropdown is used
    calculatePreview(value);
  },
  [calculatePreview]
);

// Handle custom name input
const handleCustomNameChange = useCallback(
  (value: string) => {
    setCustomParamName(value);
    setSelectedExistingParam(''); // Clear dropdown when custom input is used
    calculatePreview(value);
  },
  [calculatePreview]
);

// Toggle single product selection
const toggleProductSelection = useCallback((productId: string) => {
  setSelectedProductIds((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    return newSet;
  });
}, []);

// Select all eligible products
const selectAllProducts = useCallback(() => {
  if (transformPreview?.eligible) {
    setSelectedProductIds(new Set(transformPreview.eligible.map((p) => p._id)));
  }
}, [transformPreview?.eligible]);

// Deselect all products
const deselectAllProducts = useCallback(() => {
  setSelectedProductIds(new Set());
}, []);

// Execute transformation (only for SELECTED products)
const handleTransformConfirm = useCallback(async () => {
  const finalTargetName = customParamName.trim() || selectedExistingParam;

  if (
    !sourceParam ||
    !finalTargetName ||
    !transformPreview?.eligible.length ||
    selectedProductIds.size === 0
  ) {
    return;
  }

  // Validation: target cannot be same as source
  if (finalTargetName === sourceParam.name) {
    toast.push({
      status: 'error',
      title: 'Błąd',
      description: 'Nazwa docelowa nie może być taka sama jak źródłowa.',
    });
    return;
  }

  setIsTransforming(true);

  try {
    // 1. Fetch full product data for SELECTED products only
    const productIds = Array.from(selectedProductIds);
    const fullProducts = await client.fetch<FullProductTechnicalData[]>(
      `*[_type == "product" && _id in $productIds] {
        _id,
        name,
        technicalData {
          variants,
          groups[] {
            _key,
            title,
            rows[] {
              _key,
              title,
              values
            }
          }
        }
      }`,
      { productIds }
    );

    // 2. Build and execute transaction
    const transaction = client.transaction();
    let patchCount = 0;

    for (const product of fullProducts) {
      const groups = product.technicalData?.groups || [];

      for (const group of groups) {
        const rows = group.rows || [];
        for (const row of rows) {
          if (row.title === sourceParam.name) {
            // Use _key based path for reliability
            transaction.patch(product._id, (patch) =>
              patch.set({
                [`technicalData.groups[_key=="${group._key}"].rows[_key=="${row._key}"].title`]:
                  finalTargetName,
              })
            );
            patchCount++;
            break; // Only patch first occurrence per group
          }
        }
      }
    }

    if (patchCount > 0) {
      await transaction.commit();
    }

    // 3. Success handling
    toast.push({
      status: 'success',
      title: 'Przekształcono!',
      description: `Zaktualizowano ${patchCount} parametrów w ${selectedProductIds.size} produktach.`,
    });

    // 4. Refresh data and close modal
    await fetchParameters(selectedCategoryId!, true);
    setTransformModalOpen(false);
    setSourceParam(null);
    setSelectedExistingParam('');
    setCustomParamName('');
    setTransformPreview(null);
    setSelectedProductIds(new Set());
  } catch (error) {
    console.error('Transform error:', error);
    toast.push({
      status: 'error',
      title: 'Błąd przekształcenia',
      description:
        error instanceof Error
          ? error.message
          : 'Nie udało się przekształcić parametrów.',
    });
  } finally {
    setIsTransforming(false);
  }
}, [
  sourceParam,
  selectedExistingParam,
  customParamName,
  transformPreview,
  selectedProductIds,
  client,
  toast,
  fetchParameters,
  selectedCategoryId,
]);
```

**UI Changes**:

1. Add transform button to discovered parameter cards (around line 1262-1278):

```tsx
{
  /* Existing expand button */
}
{
  hasAnyProducts && (
    <Button
      icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
      mode='bleed'
      padding={3}
      onClick={() => toggleDiscoveredParamExpand(param.name)}
      title='Pokaż produkty'
    />
  );
}

{
  /* NEW: Transform button */
}
{
  param.products.length > 0 && discoveredParams.length > 1 && (
    <Button
      icon={ArrowRightLeft}
      mode='bleed'
      padding={3}
      onClick={(e) => {
        e.stopPropagation();
        openTransformModal(param);
      }}
      title='Przekształć w inny parametr'
    />
  );
}
```

2. Add modal at end of component (before closing `</ToastProvider>`):

```tsx
{
  /* Transform Parameter Modal */
}
{
  transformModalOpen && sourceParam && (
    <Dialog
      id='transform-parameter-modal'
      header='Przekształć parametr'
      onClose={() => {
        setTransformModalOpen(false);
        setSourceParam(null);
        setSelectedExistingParam('');
        setCustomParamName('');
        setTransformPreview(null);
        setSelectedProductIds(new Set());
      }}
      width={1}>
      <Box padding={4}>
        <Stack space={4}>
          {/* Source parameter info */}
          <Card padding={3} radius={2} tone='primary'>
            <Stack space={2}>
              <Text size={1} weight='medium'>
                Parametr źródłowy:
              </Text>
              <Flex align='center' gap={2}>
                <Text size={2} weight='semibold'>
                  {sourceParam.name}
                </Text>
                <Badge tone='positive'>
                  {sourceParam.products.length} produktów
                </Badge>
              </Flex>
            </Stack>
          </Card>

          {/* Target selection - Dropdown for existing params */}
          <Stack space={2}>
            <Label size={1}>Przekształć w istniejący parametr:</Label>
            <Select
              value={selectedExistingParam}
              onChange={(e) =>
                handleExistingParamSelect(e.currentTarget.value)
              }>
              <option value=''>Wybierz parametr docelowy...</option>
              {discoveredParams
                .filter((p) => p.name !== sourceParam.name)
                .map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.products.length} produktów)
                  </option>
                ))}
            </Select>
          </Stack>

          {/* Divider */}
          <Flex align='center' gap={3}>
            <Box
              style={{
                flex: 1,
                height: '1px',
                background: 'var(--card-border-color)',
              }}
            />
            <Text size={0} muted>
              lub wpisz nową nazwę
            </Text>
            <Box
              style={{
                flex: 1,
                height: '1px',
                background: 'var(--card-border-color)',
              }}
            />
          </Flex>

          {/* Custom name input */}
          <Stack space={2}>
            <Label size={1}>Nowa nazwa parametru:</Label>
            <TextInput
              value={customParamName}
              onChange={(e) => handleCustomNameChange(e.currentTarget.value)}
              placeholder='Wpisz nową nazwę parametru...'
            />
            {customParamName.trim() &&
              !discoveredParams.find(
                (p) => p.name === customParamName.trim()
              ) && (
                <Text size={0} muted>
                  ✨ Ta nazwa nie istnieje jeszcze w tej kategorii - zostanie
                  utworzona
                </Text>
              )}
          </Stack>

          {/* Preview with checkboxes */}
          {transformPreview && (
            <Card padding={3} radius={2} border>
              <Stack space={3}>
                {/* Eligible products with checkboxes */}
                {transformPreview.eligible.length > 0 && (
                  <Stack space={2}>
                    <Flex align='center' justify='space-between'>
                      <Flex align='center' gap={2}>
                        <Badge tone='positive'>✓</Badge>
                        <Text size={1} weight='medium'>
                          Produkty do przekształcenia ({selectedProductIds.size}
                          /{transformPreview.eligible.length}):
                        </Text>
                      </Flex>
                      <Flex gap={2}>
                        <Button
                          text='Zaznacz wszystkie'
                          mode='ghost'
                          fontSize={0}
                          padding={2}
                          onClick={selectAllProducts}
                          disabled={
                            selectedProductIds.size ===
                            transformPreview.eligible.length
                          }
                        />
                        <Button
                          text='Odznacz wszystkie'
                          mode='ghost'
                          fontSize={0}
                          padding={2}
                          onClick={deselectAllProducts}
                          disabled={selectedProductIds.size === 0}
                        />
                      </Flex>
                    </Flex>
                    <Stack space={1}>
                      {transformPreview.eligible.map((p) => (
                        <Flex
                          key={p._id}
                          align='center'
                          gap={2}
                          padding={2}
                          style={{
                            background: selectedProductIds.has(p._id)
                              ? 'var(--card-bg2-color)'
                              : 'transparent',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleProductSelection(p._id)}>
                          <Checkbox
                            checked={selectedProductIds.has(p._id)}
                            onChange={() => toggleProductSelection(p._id)}
                          />
                          <Avatar
                            src={p.imageUrl}
                            size={1}
                            style={{ borderRadius: '4px' }}
                          />
                          <Box flex={1}>
                            <Text size={1}>{p.name}</Text>
                          </Box>
                          {p.brandName && (
                            <Badge tone='primary' fontSize={0} padding={1}>
                              {p.brandName}
                            </Badge>
                          )}
                        </Flex>
                      ))}
                    </Stack>
                  </Stack>
                )}

                {/* Skipped products (no checkboxes - just info) */}
                {transformPreview.skipped.length > 0 && (
                  <Stack space={2}>
                    <Flex align='center' gap={2}>
                      <Badge tone='caution'>⚠</Badge>
                      <Text size={1} weight='medium'>
                        Produkty pominięte - mają już "
                        {customParamName.trim() || selectedExistingParam}" (
                        {transformPreview.skipped.length}):
                      </Text>
                    </Flex>
                    <Stack space={1}>
                      {transformPreview.skipped.slice(0, 5).map((p) => (
                        <Flex key={p._id} align='center' gap={2} padding={1}>
                          <Avatar
                            src={p.imageUrl}
                            size={1}
                            style={{ borderRadius: '4px', opacity: 0.6 }}
                          />
                          <Text size={0} muted>
                            {p.name}
                          </Text>
                        </Flex>
                      ))}
                      {transformPreview.skipped.length > 5 && (
                        <Text size={0} muted>
                          ... i {transformPreview.skipped.length - 5} więcej
                        </Text>
                      )}
                    </Stack>
                  </Stack>
                )}

                {/* No eligible products message */}
                {transformPreview.eligible.length === 0 && (
                  <Card padding={3} radius={2} tone='caution'>
                    <Text size={1}>
                      Wszystkie produkty z "{sourceParam.name}" mają już
                      parametr "
                      {customParamName.trim() || selectedExistingParam}". Nie ma
                      nic do przekształcenia.
                    </Text>
                  </Card>
                )}
              </Stack>
            </Card>
          )}

          {/* Actions */}
          <Flex gap={3} justify='flex-end'>
            <Button
              text='Anuluj'
              mode='ghost'
              onClick={() => {
                setTransformModalOpen(false);
                setSourceParam(null);
                setSelectedExistingParam('');
                setCustomParamName('');
                setTransformPreview(null);
                setSelectedProductIds(new Set());
              }}
              disabled={isTransforming}
            />
            <Button
              text={
                isTransforming
                  ? 'Przekształcanie...'
                  : selectedProductIds.size > 0
                    ? `Przekształć ${selectedProductIds.size} prod.`
                    : 'Przekształć'
              }
              tone='positive'
              onClick={handleTransformConfirm}
              disabled={
                !(customParamName.trim() || selectedExistingParam) ||
                selectedProductIds.size === 0 ||
                isTransforming
              }
              loading={isTransforming}
            />
          </Flex>
        </Stack>
      </Box>
    </Dialog>
  );
}
```

---

## 6. Testing Plan

### 6.1 Unit Tests (Manual)

| Test Case                      | Steps                                                              | Expected Result                                 |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------- |
| Basic transform (existing)     | Select source "A" (10 products), target "B" from dropdown, confirm | 5 products transformed (those with A but not B) |
| Custom name transform          | Source "A" (10 products), type "C" (new name), confirm             | All 10 products transformed to new param "C"    |
| All products have both         | Source "A" (5 products), target "B" (5 same products)              | Preview shows 0 eligible, 5 skipped             |
| No overlap                     | Source "A" (5 products), target "B" (5 different products)         | All 5 transformed                               |
| Cancel                         | Open modal, cancel                                                 | No changes                                      |
| Error handling                 | Simulate API error                                                 | Error toast, modal stays open                   |
| Data refresh                   | Transform, check parameter list                                    | Source param gone/reduced, target increased     |
| **Selective transform**        | Uncheck 3 out of 8 products, confirm                               | Only 5 checked products transformed             |
| **Select all / Deselect all**  | Click "Deselect all", then "Select all"                            | Selection toggles correctly                     |
| **Custom name already exists** | Type existing param name in custom input                           | Treats as existing param (shows duplicates)     |

### 6.2 Edge Case Tests

| Test Case                        | Expected Behavior                                |
| -------------------------------- | ------------------------------------------------ |
| Empty category                   | No transform button (no params)                  |
| Single parameter                 | Transform button disabled                        |
| Very long parameter name         | Truncate in modal, full on hover                 |
| Special characters in name       | Correctly escaped in query                       |
| Large batch (50+ products)       | Progress indication, no timeout                  |
| **Custom name with only spaces** | Validation error - name cannot be empty          |
| **All products unchecked**       | Confirm button disabled                          |
| **Switching dropdown/custom**    | Clears the other input, recalculates preview     |
| **Same name as source**          | Validation error - cannot transform to same name |

---

## 7. Risks & Mitigations

| Risk                           | Impact | Mitigation                                     |
| ------------------------------ | ------ | ---------------------------------------------- |
| Data loss                      | High   | Transaction rollback, preview before execution |
| Wrong parameter selected       | Medium | Clear preview with product names               |
| Performance with large batches | Medium | Transaction batching, loading states           |
| Concurrent edits               | Low    | Use Sanity's optimistic locking                |
| Sanity API rate limits         | Medium | Batch in transaction (single API call)         |

---

## 8. Future Enhancements

1. **Bulk source selection**: Select multiple source parameters to transform at once (currently single source only)
2. **Regex matching**: Transform all parameters matching a pattern (e.g., `*:` → remove colon)
3. **Undo/History**: Track transformations for potential rollback
4. ~~**Dry run mode**: Preview changes without executing~~ ✅ Implemented via checkboxes
5. **Cross-category transform**: Apply same transformation across multiple categories
6. **Batch custom rename**: Rename multiple parameters to new names in one operation

---

## 9. Implementation Checklist

### Phase 1: UI Components

- [ ] Add `ArrowRightLeft` icon import
- [ ] Add transform button to discovered parameter cards
- [ ] Add transform modal state variables (including new ones for custom input & selection)
- [ ] Create modal UI structure with:
  - [ ] Dropdown for existing parameters
  - [ ] "OR" divider
  - [ ] Text input for custom parameter name
  - [ ] Hint text for new parameter names

### Phase 2: Preview Logic

- [ ] Implement `calculatePreview` function (handles both existing and custom names)
- [ ] Wire up dropdown selection to preview calculation
- [ ] Wire up custom input to preview calculation (with debounce)
- [ ] Handle mutual exclusion (dropdown clears custom, custom clears dropdown)
- [ ] Initialize selectedProductIds with all eligible products
- [ ] Implement toggle/select all/deselect all functions

### Phase 3: Preview UI with Checkboxes

- [ ] Display eligible products with checkboxes
- [ ] Add "Select all" / "Deselect all" buttons
- [ ] Show selection count (selected/total)
- [ ] Display skipped products (no checkboxes, just info)
- [ ] Update confirm button text with selected count

### Phase 4: Transform Execution

- [ ] Implement `handleTransformConfirm` function
- [ ] Validate target name (not empty, not same as source)
- [ ] Filter to only selected products
- [ ] Add GROQ query for full product data
- [ ] Build transaction with patches
- [ ] Handle success/error states

### Phase 5: Post-Transform

- [ ] Refresh parameters after transform
- [ ] Show success/error toast
- [ ] Close modal and reset all state
- [ ] Test edge cases (custom names, partial selection, etc.)

---

## 10. Estimated Timeline

| Phase     | Duration       | Description                                             |
| --------- | -------------- | ------------------------------------------------------- |
| Phase 1   | 2-3 hours      | UI components, modal with dropdown + custom input       |
| Phase 2   | 1-2 hours      | Preview logic (existing + custom names), state handling |
| Phase 3   | 1-2 hours      | Checkbox UI, select/deselect functionality              |
| Phase 4   | 2-3 hours      | Transform execution, Sanity mutations                   |
| Phase 5   | 1 hour         | Post-transform handling, testing                        |
| **Total** | **7-11 hours** | Full implementation                                     |

---

## 11. Approval & Next Steps

**Before Implementation**:

1. ✅ Review this plan
2. ⬜ Approve approach
3. ⬜ Clarify any questions
4. ⬜ Begin Phase 1

**Resolved from Feedback**:

1. ✅ Custom target names - Implemented: Users can now type a new parameter name that doesn't exist yet
2. ✅ Selective transformation - Implemented: Checkboxes allow excluding specific products from transformation

**Remaining Questions for Stakeholder**:

1. Should the transform button be always visible or only on hover?
2. Should we add a "reverse transform" option (Y → X)?
3. Do we need an audit log for transformations?
4. Should admins be able to undo transformations?

---

**Document Version**: 1.1  
**Created**: December 18, 2025  
**Updated**: December 18, 2025  
**Status**: Awaiting Approval

**Changelog**:

- v1.1: Added custom target parameter name input (for new names that don't exist yet)
- v1.1: Added selective product transformation with checkboxes (can exclude specific products)
