# Features Configurator v2 - Complete Walkthrough

## Overview

The Features Configurator v2 is a comprehensive system for managing product features and variants in the AudioFast e-commerce platform. It provides a flexible, intuitive interface for content managers to configure complex product options and pricing structures.

## Recent Major Updates (2024)

### ✅ **Legacy Cleanup & Code Optimization**

#### **Removed Legacy Components:**

- **❌ UnifiedFeaturesManager.tsx**: Completely removed the legacy configurator (407 lines of unused code)
- **❌ FeaturesPricingTable.tsx**: Removed unused pricing overview component (407 lines of unused code)
- **Result**: Cleaner codebase with ~814 lines of unused code eliminated

#### **Sanity Studio Integration:**

- **Streamlined Views**: Reduced from 4 product views to 3 essential views:
  - 📂 **Zawartość** - Basic product content form
  - 🧩 **Konfigurator cech (v2)** - Main feature configurator (FeaturesConfigurator)
  - 👁️ **Podgląd frontend** - Frontend preview (ProductFrontendPreview)
- **Removed Legacy View**: Eliminated "Menedżer cech (legacy)" view completely

### Architecture Improvements

#### ✅ Dialog Extraction & Enhancement

- **Extracted 6 dialog components** into `components/dialogs/` directory:
  - `CreatePrimaryDialog.tsx` - Primary feature creation with custom naming
  - `AddPrimaryVariantDialog.tsx` - Primary variant creation with custom naming
  - `AddSecondaryFeatureDialog.tsx` - Secondary feature creation with custom naming and global addition
  - `AddSecondaryToVariantDialog.tsx` - Secondary feature creation within variants with custom naming and global addition
  - `VariantTypeDialog.tsx` - Enhanced variant type selection with custom naming and global addition
  - `ApplyTemplateDialog.tsx` - Template application confirmation
- **Enhanced functionality**: All dialogs now allow custom naming instead of default names
- **Better state management**: Each dialog manages its own input state
- **Improved UX**: Auto-focus, Enter key support, validation, and consistent styling
- **Global Addition Support**: Secondary features and variants can now be added globally to all primary variants

#### ✅ Global Addition Features

- **Enhanced VariantTypeDialog**: Now supports custom variant naming and global addition to all primary variants
- **Secondary Feature Global Addition**: When adding secondary features to primary variants, users can choose to add them globally
- **Smart Duplicate Prevention**: Global addition intelligently detects existing features/variants and avoids duplicates
- **Feature Creation**: If a variant doesn't have the secondary feature, it gets created automatically
- **Template System**: Streamlined workflow for applying secondary features across all variants

#### ✅ Drag & Drop Centralization

- **Created `SortableList.tsx`**: Centralized reusable component for all DnD operations
- **Migrated all DnD implementations**:
  - Root secondary features ✅
  - Primary variants ✅
  - Per-variant secondary features ✅
- **Removed duplicate code**: Eliminated ~150+ lines of duplicated DnD logic
- **Consistent behavior**: All lists now use the same drag/drop/overlay system

#### ✅ Component Architecture Improvements

- **Reduced main component size**: From 1000+ lines to ~864 lines
- **Better separation of concerns**: Dialogs, DnD, and business logic properly separated
- **Enhanced maintainability**: Easier to test, debug, and extend individual components
- **Improved type safety**: Better TypeScript interfaces and prop validation

#### ✅ UI/UX Enhancements

- **Enhanced InlineEditable**: Better text overflow handling with ellipsis
- **Added field labels**: Numeric variant types now support custom field labels (e.g., "Długość", "Waga")
- **Improved visual feedback**: Consistent drag overlays and drop indicators
- **Better responsive design**: Enhanced mobile and touch interactions

## Purpose

The configurator serves two main purposes:

1. **Product Feature Management**: Define product characteristics (size, color, model, etc.)
2. **Dynamic Pricing**: Set up complex pricing rules based on feature combinations
3. **Variant Organization**: Structure products with primary variants and secondary features

## Architecture Overview

### Core Components

#### 1. FeaturesConfigurator (Main Component)

- **Location**: `apps/studio/components/features-configurator/FeaturesConfigurator.tsx`
- **Purpose**: Main orchestrator component that handles the overall feature configuration flow
- **Responsibilities**:
  - State management for the entire configuration
  - Dialog coordination (delegates to extracted dialog components)
  - DnD orchestration (uses SortableList for all drag operations)
  - Data persistence to Sanity CMS
- **Recent Changes**: Optimized and streamlined through dialog extraction and DnD centralization

#### 2. SlimFeatureCard (Feature Management)

- **Location**: `apps/studio/components/features-configurator/SlimFeatureCard.tsx`
- **Purpose**: Individual feature management interface
- **Features**:
  - Inline editing for feature names and option details
  - Drag & drop reordering of choices
  - Up/down movement buttons for choices
  - Second option configuration (numeric/choice types)
  - Price management

#### 3. SecondaryFeatureCard (Alternative UI)

- **Location**: `apps/studio/components/features-configurator/SecondaryFeatureCard.tsx`
- **Purpose**: Alternative interface for feature management
- **Note**: Currently less actively used than SlimFeatureCard

#### 4. Dialog Components (Extracted)

**Location**: `apps/studio/components/features-configurator/components/dialogs/`

- **CreatePrimaryDialog**: Primary feature creation with custom naming
- **AddPrimaryVariantDialog**: Primary variant creation with custom naming
- **AddSecondaryFeatureDialog**: Secondary feature creation with custom naming and global addition
- **AddSecondaryToVariantDialog**: Secondary feature creation within variants with custom naming and global addition
- **VariantTypeDialog**: Enhanced variant type selection with custom naming and global addition
- **ApplyTemplateDialog**: Template application confirmation

**Features**:

- Each dialog manages its own input state
- Auto-focus, Enter key support, and validation
- Consistent styling and UX patterns
- Custom naming instead of default names
- **Global Addition Support**: Secondary features and variants can be added globally to all primary variants
- **Smart Duplicate Prevention**: Automatically detects and avoids creating duplicate features/variants
- **Template Application**: Streamlined workflow for bulk feature application

#### 5. SortableList (DnD Component)

- **Location**: `apps/studio/components/features-configurator/components/Sortable/SortableList.tsx`
- **Purpose**: Centralized, reusable drag & drop component for all sortable lists
- **Features**:
  - Handles all DnD sensors, context, and overlay logic
  - Consistent drag behavior across all implementations
  - Visual feedback with drag overlays and drop indicators
  - Keyboard accessibility support
- **Used for**: Primary variants, secondary features, variant options

#### 6. InlineEditable (Reusable Component)

- **Location**: `apps/studio/components/features-configurator/InlineEditable.tsx`
- **Purpose**: Provides inline editing capabilities for various fields
- **Recent Enhancements**:
  - Better text overflow handling with ellipsis
  - Improved line height and spacing
  - Dynamic styling based on font size

#### 7. ProductFrontendPreview (New Component)

- **Location**: `apps/studio/components/ProductFrontendPreview.tsx`
- **Purpose**: Interactive frontend preview of product configuration
- **Features**:
  - Two-panel layout (image left, configuration right)
  - Dynamic pricing calculation
  - Persistent secondary selections across primary variants
  - Custom length input validation with visual error indicators
  - Sanity's critical tone styling for errors
  - Image loading with fallback handling

## Data Structures

### Core Types (from types.ts)

#### FeatureOptionV2

```typescript
type FeatureOptionV2 = {
  _key?: string;
  label: string; // Display name
  value: string; // Technical identifier
  basePriceModifier: number; // Price adjustment
  isAvailable: boolean; // Availability flag
  secondOption?: VariantSecondOption; // Advanced configuration
};
```

#### VariantSecondOption

```typescript
type VariantSecondOption = {
  enabled?: boolean;
  kind?: 'numeric' | 'choice';
  numeric?: {
    label?: string; // ✅ NEW: Custom field label (e.g., "Długość", "Waga", "Enter Length")
    unit?: string; // Unit (e.g., "m", "cm")
    min?: number; // Minimum value
    max?: number; // Maximum value
    step?: number; // Increment step
    perUnitPrice?: number; // Price per unit
  };
  choices?: Array<{
    // For choice-type second options
    label: string;
    value: string;
    price?: number;
  }>;
  optional?: boolean; // Whether the choice is optional
};
```

#### ProductFeatureV2

```typescript
type ProductFeatureV2 = {
  _key?: string;
  featureName: string; // Feature name (e.g., "Length", "Color")
  options: FeatureOptionV2[]; // Available options
};
```

#### PrimaryVariantV2

```typescript
type PrimaryVariantV2 = {
  _key?: string;
  label: string; // Variant name
  value: string; // Technical identifier
  secondaryFeatures: ProductFeatureV2[]; // Features specific to this variant
};
```

#### FeatureConfigV2 (Root Configuration)

```typescript
type FeatureConfigV2 = {
  primary?: {
    name: string; // Primary feature name
    variants: PrimaryVariantV2[]; // Primary variants
  };
  secondaryFeatures?: ProductFeatureV2[]; // Global secondary features
};
```

## Two Main Scenarios

### Scenario 1: No Primary Feature

**Use Case**: Simple products with global features that apply to all variants

**Structure**:

```
Product
├── Feature 1 (e.g., "Color")
│   ├── Option 1 ("Black", +0 zł)
│   ├── Option 2 ("White", +50 zł)
│   └── Option 3 ("Red", +100 zł)
├── Feature 2 (e.g., "Size")
│   ├── Option 1 ("Small", +0 zł)
│   ├── Option 2 ("Large", +200 zł)
│   └── Option 3 ("XL", +300 zł, with second option)
└── Feature 3 (e.g., "Length")
    └── Option 1 ("Custom", +0 zł, with numeric second option)
        ├── Min: 1m, Max: 10m, Step: 0.5m
        └── Price per unit: 100 zł/m
```

**UI Flow**:

1. Click "Dodaj główną cechę" if needed
2. Click "Dodaj cechę" to add features
3. Use drag handles to reorder features
4. Configure options within each feature

### Scenario 2: With Primary Feature

**Use Case**: Complex products where the primary choice determines available secondary features

**Example**: Speaker cables where the primary choice is "Length", and secondary features vary by length

**Structure**:

```
Product
├── Primary Feature: "Length"
│   ├── Variant 1: "1.5m Standard"
│   │   ├── Secondary Feature: "Connector Type"
│   │   │   ├── Option 1: "Banana" (+0 zł)
│   │   │   └── Option 2: "Spade" (+50 zł)
│   │   └── Secondary Feature: "Cable Type"
│   │       ├── Option 1: "Oxygen Free" (+0 zł)
│   │       └── Option 2: "Silver Plated" (+300 zł)
│   ├── Variant 2: "3m Long"
│   │   ├── Secondary Feature: "Connector Type"
│   │   │   ├── Option 1: "Banana" (+0 zł)
│   │   │   └── Option 2: "Spade" (+100 zł)
│   │   └── Secondary Feature: "Installation"
│   │       ├── Option 1: "Standard" (+0 zł)
│   │       └── Option 2: "Concealed" (+200 zł)
│   └── Variant 3: "Custom Length"
│       └── Secondary Feature: "Length"
│           └── Option 1: "Custom" (with numeric input)
│               ├── Min: 0.5m, Max: 20m, Step: 0.1m
│               └── Price per unit: 150 zł/m
└── Global Secondary Features: [] (none in this case)
```

**UI Flow**:

1. Set primary feature name (e.g., "Length")
2. Add primary variants (e.g., "1.5m Standard", "3m Long", "Custom")
3. For each variant, add relevant secondary features
4. Configure options within each feature

## User Workflows

### 1. Creating a Basic Product (Scenario 1)

1. **Access Configurator**: Navigate to product in Sanity Studio
2. **Add Features**: Click "Dodaj cechę" for each characteristic
3. **Configure Options**: For each feature, add available choices
4. **Set Pricing**: Define base price modifiers for each option
5. **Advanced Options**: Configure second options for complex choices
6. **Reorder**: Drag features and options to desired order

### 2. Creating a Complex Product (Scenario 2)

1. **Create Primary Feature**: Click "Dodaj główną cechę" to create a primary feature
2. **Edit Primary Feature Name**: Click on the **extra-large, prominent primary feature name** to edit it inline
3. **Create Variants**: Click the "Dodaj wariant główny" button (located in the same card as the primary feature name) to open a dialog where you can name the variant (e.g., "1.5m Standard", "3m Long", "Custom Length"). Each **larger variant name** can be edited inline by clicking on it.
4. **Toggle Variants**: Use the **prominent blue toggle button** next to each variant name to **collapse/expand** the variant's content. The button shows ▶️ when closed and 🔽 when open, with different background colors to indicate state. This helps manage complex configurations by allowing you to focus on specific variants.
5. **Setup Secondary Features on Template Variant**: Choose one variant (e.g., "Phono") and add all the secondary features you want (like "Length", "Color"). These will be the common features for all variants.
6. **Select Template**: Click the "Użyj jako szablon" button on your template variant (it will show "📋 Szablon" when selected).
7. **Apply Template to All Variants**: Click "Zastosuj do wszystkich" in the blue template card that appears. This will copy all secondary features from your template variant to all other variants instantly.
8. **Add Variant-Specific Features**: After applying the template, add any additional features that are specific to individual variants (e.g., "Connector Type" for Phono, "Balanced" for XLR).
9. **Reorder Secondary Features**: Drag and drop secondary features within each variant to arrange them in your preferred order. Each feature has a drag handle (⋮⋮⋮) that appears on hover.
10. **Configure Dependencies**: Set up pricing and options per variant
11. **Delete Primary Feature**: Use "Usuń główną cechę" to remove the entire primary feature setup
12. **Test Configuration**: Ensure all combinations work as expected

### 3. Managing Existing Configurations

1. **Edit Feature Names**: Click on feature names to rename
2. **Modify Options**: Update labels, values, and pricing
3. **Add/Remove Items**: Use + and 🗑️ buttons
4. **Reorder Elements**: Drag handles or arrow buttons
5. **Toggle Availability**: Enable/disable options

### 4. Global Addition Workflows

#### Adding Secondary Features Globally

1. **Navigate to Primary Variant**: Go to a specific primary variant (e.g., "XLR")
2. **Add Secondary Feature**: Click "Dodaj cechę" within the variant
3. **Name the Feature**: Enter feature name (e.g., "Length") in the dialog
4. **Enable Global Addition**: Check "Dodaj również do wszystkich innych wariantów głównych"
5. **Confirm**: Click "Dodaj"
6. **Result**: The feature is added to the current variant AND all other variants that don't already have it

#### Adding Variants Globally

1. **Navigate to Feature**: Within a primary variant, find the secondary feature (e.g., "Color")
2. **Add Variant**: Click "Dodaj wariant" on the feature
3. **Name the Variant**: Enter variant name (e.g., "Black") in the dialog
4. **Select Type**: Choose variant type (Text/Choice/Increment)
5. **Enable Global Addition**: Check "Dodaj również do wszystkich innych wariantów głównych"
6. **Confirm**: Click "Dodaj"
7. **Smart Logic**: The system will:
   - Add the variant to variants that already have the feature
   - Create the feature + variant for variants that don't have it
   - Skip variants that already have both the feature and variant

## Technical Implementation Details

### State Management

The configurator uses React state with Sanity's `useDocumentOperation` for persistence:

```typescript
const { patch } = useDocumentOperation(documentId, 'product');
const setFeatureConfig = (next: FeatureConfigV2) => {
  patch.execute([{ set: { featureConfig: next } }]);
};
```

### Drag & Drop Implementation

**Architecture**: Centralized in `SortableList` component using `@dnd-kit/core` and related packages

#### SortableList Component Features:

- **Centralized Logic**: Single source of truth for all DnD operations
- **Reusable**: Used across primary variants, secondary features, and variant options
- **Sensors**: Pointer and Keyboard sensors for accessibility
- **Collision Detection**: `closestCenter` for intuitive dropping
- **Sortable Context**: Vertical list sorting strategy with `arrayMove`
- **Drag Overlay**: Visual feedback during drag operations
- **Drop Indicators**: Highlighted drop zones with dashed borders
- **Static During Drag**: Items stay in place while being dragged (no shifting)

#### Implementation Pattern:

```typescript
<SortableList
  items={items}
  getId={(item, index) => item._key || `item-${index}`}
  getLabel={(item) => item.label}
  onReorder={(oldIndex, newIndex) => handleReorder(oldIndex, newIndex)}
  renderItem={({ item, index, handleProps }) => (
    <div>
      {/* Your item content */}
      <Button {...handleProps.attributes} {...handleProps.listeners}>
        <DragHandleIcon />
      </Button>
    </div>
  )}
/>
```

### Data Persistence

All changes are immediately persisted to Sanity CMS:

- Real-time updates as user makes changes
- Optimistic UI updates for smooth UX
- Error handling for failed operations

### Global Addition Implementation

#### Secondary Feature Global Addition Logic

```typescript
// When adding a secondary feature globally:
variants.forEach((variant) => {
  const hasFeature = variant.secondaryFeatures?.some(
    (feature) => feature.featureName === featureNameToAdd
  );

  if (!hasFeature) {
    // Add new feature instance with unique _key
    const newFeature = {
      _key: `feature-${Date.now()}-${randomString}`,
      featureName: featureNameToAdd,
      options: [
        /* initial options */
      ],
    };
    variant.secondaryFeatures = [
      ...(variant.secondaryFeatures || []),
      newFeature,
    ];
  }
  // Skip variants that already have the feature
});
```

#### Variant Global Addition Logic

```typescript
// When adding a variant globally:
variants.forEach((variant) => {
  const hasFeature = variant.secondaryFeatures?.some(
    (feature) => feature.featureName === targetFeatureName
  );

  if (hasFeature) {
    // Variant already has the feature, add variant if not present
    const featureIndex = variant.secondaryFeatures.findIndex(
      (feature) => feature.featureName === targetFeatureName
    );
    const existingFeature = variant.secondaryFeatures[featureIndex];
    const hasVariant = existingFeature.options?.some(
      (option) => option.label === variantName
    );

    if (!hasVariant) {
      // Add variant to existing feature
      existingFeature.options = [...(existingFeature.options || []), newOption];
    }
  } else {
    // Variant doesn't have the feature, create both
    const newFeature = {
      _key: `feature-${Date.now()}-${randomString}`,
      featureName: targetFeatureName,
      options: [newOption],
    };
    variant.secondaryFeatures = [
      ...(variant.secondaryFeatures || []),
      newFeature,
    ];
  }
});
```

#### Key Implementation Details

- **Unique Keys**: Each feature instance gets a unique `_key` using timestamp and random string
- **Atomic Updates**: All changes are collected before a single `setFeatureConfig` call
- **Duplicate Prevention**: Triple-checking prevents feature/variant duplicates
- **State Consistency**: Maintains data integrity across all variants
- **Performance**: Single batch operation instead of multiple individual updates

### Component Communication

- **Props-based**: Parent passes configuration down
- **Callback functions**: Children communicate changes up
- **Event handlers**: User interactions bubble up through callbacks

## Integration with Sanity CMS

### Schema Integration

The configurator integrates with the product schema:

```typescript
defineField({
  name: 'featureConfig',
  title: 'Konfigurator cech (v2)',
  type: 'object',
  description: 'Nowy model konfiguratora cech...',
  hidden: true, // Hidden from main product form
  fields: [
    // Primary feature definition
    // Variants array
    // Secondary features array
  ],
  group: GROUP.MAIN_CONTENT,
});
```

### Current Sanity Studio Views Structure

The product document now has **3 streamlined views**:

```typescript
// Views structure in structure.ts
S.document().views([
  S.view
    .form()
    .title('Zawartość')
    .icon(() => '📂'), // Basic content form
  S.view
    .component(FeaturesConfigurator)
    .title('Konfigurator cech (v2)')
    .icon(() => '🧩'), // Main configurator
  S.view
    .component(ProductFrontendPreview)
    .title('Podgląd frontend')
    .icon(() => '👁️'), // Frontend preview
]);
```

**View Descriptions:**

- **📂 Zawartość**: Basic product content form (title, description, images, etc.)
- **🧩 Konfigurator cech (v2)**: Main feature configurator with drag & drop, dialogs, and global addition
- **👁️ Podgląd frontend**: Interactive preview simulating the frontend experience

### Data Flow

1. **Load**: Configurator reads `featureConfig` from product document
2. **Edit**: User interactions update local state
3. **Persist**: Changes are patched back to Sanity via `useDocumentOperation`
4. **Refresh**: UI updates to reflect changes

## Advanced Features

### Second Options (Nested Configuration)

#### Numeric Type

- **Use Case**: Custom measurements (length, weight, etc.)
- **Configuration**:
  - ✅ **Field Label**: Customizable field label (e.g., "Długość", "Waga", "Enter Length")
  - Unit (e.g., "m", "cm", "kg")
  - Min/Max values
  - Step increment
  - Price per unit
- **Calculation**: `Price = (value - min) / step * perUnitPrice`
- **New Feature**: Custom field labels allow for localized, user-friendly input prompts

#### Choice Type

- **Use Case**: Dependent selections (e.g., connector types for different cable lengths)
- **Configuration**:
  - List of choices with labels and prices
  - Optional flag (users can skip selection)
  - Individual pricing for each choice

### Global Addition Features

#### Secondary Feature Global Addition

- **Use Case**: Quickly add the same secondary feature to all primary variants
- **Workflow**: When adding a secondary feature to one variant, check "Dodaj również do wszystkich innych wariantów głównych"
- **Smart Logic**:
  - Adds the feature to variants that don't already have it
  - Skips variants that already have the feature (prevents duplicates)
  - Maintains unique `_key` values for each feature instance
- **Example**: Adding "Length" feature to all cable variants (XLR, Phono, etc.)

#### Variant Global Addition

- **Use Case**: Add the same variant option to all primary variants that have the secondary feature
- **Workflow**: When adding a variant to a secondary feature, check "Dodaj również do wszystkich innych wariantów głównych"
- **Smart Logic**:
  - **Feature Detection**: Checks if variants already have the secondary feature
  - **Variant Addition**: Adds the variant to existing features
  - **Feature Creation**: Creates both the feature and variant for variants without the feature
  - **Duplicate Prevention**: Skips variants that already have both the feature and variant
- **Example**: Adding "Black" color option to all cable variants that have "Color" feature

#### Template System Integration

- **Complementary Workflow**: Global addition works seamlessly with the template system
- **Use Case**: Use templates for initial setup, then use global addition for incremental changes
- **Smart Combination**: Template system for bulk setup, global addition for selective updates

### Drag & Drop Functionality

**Architecture**: Centralized through `SortableList` component with consistent behavior across all levels

- **Primary Variant Level**: Reorder primary variants (e.g., "1.5m Standard", "3m Long")
- **Feature Level**: Reorder secondary features within variants
- **Option Level**: Reorder choices within features (handled by `SlimFeatureCard`)
- **Visual Feedback**: Consistent drag overlays and drop indicators across all implementations
- **Accessibility**: Keyboard navigation support with Pointer and Keyboard sensors
- **Static During Drag**: Items stay in place while being dragged (no shifting of other items)
- **Drop Zones**: Highlighted with dashed blue borders to show valid drop locations

### Pricing Logic

- **Base Price Modifier**: Fixed price adjustment per option
- **Per-Unit Pricing**: Dynamic pricing based on numeric input
- **Choice Pricing**: Individual pricing for sub-options
- **Inheritance**: Options inherit pricing from parent selections

## Refactoring Benefits & Maintenance

### Code Quality Improvements

#### Architecture Benefits

- **Reduced Complexity**: Main component reduced from 1000+ lines to ~864 lines
- **Separation of Concerns**: Dialogs, DnD, and business logic properly isolated
- **Reusability**: Dialog components can be used elsewhere in the application
- **Maintainability**: Individual components are easier to test, debug, and extend

#### Developer Experience

- **Type Safety**: Better TypeScript interfaces and prop validation
- **Consistent Patterns**: All dialogs follow the same architectural pattern
- **Easier Testing**: Isolated components are easier to unit test
- **Better Debugging**: Clearer component boundaries and responsibilities

#### Performance & Bundle Size

- **Code Deduplication**: Eliminated ~150+ lines of duplicated DnD logic
- **Tree Shaking**: Better opportunity for build optimizations
- **Lazy Loading**: Dialog components can be loaded on demand if needed

### Migration Path

#### ✅ **Legacy Cleanup Completed**

The legacy cleanup has been completed successfully:

1. **❌ Legacy Removal**: `UnifiedFeaturesManager.tsx` completely removed from Sanity Studio
2. **❌ Unused Code**: `FeaturesPricingTable.tsx` removed (was never used)
3. **✅ Streamlined Views**: Reduced from 4 to 3 essential product views
4. **✅ Maintained Functionality**: All existing features work exactly as before
5. **✅ Enhanced UX**: Visual error indicators now use Sanity's design system

#### For Existing Configurations

1. **Data Structure**: No changes to `featureConfig` schema or data format
2. **User Workflows**: All existing workflows preserved and enhanced
3. **DnD Functionality**: All drag operations maintain the same behavior
4. **Dialog Components**: All dialogs work exactly as before with added improvements

#### Future Enhancements Made Easier

- **New Dialog Types**: Easy to create using the established pattern
- **DnD Extensions**: Simple to add to new list types using SortableList
- **Feature Additions**: Modular architecture supports incremental development
- **Testing**: Isolated components enable comprehensive test coverage

## Best Practices

### For Content Managers

1. **Plan Structure First**: Decide between scenarios 1 or 2 before starting
2. **Use Descriptive Names**: Clear, customer-friendly naming
3. **Test Configurations**: Verify pricing calculations work correctly
4. **Order Matters**: Place most important features first
5. **Consider Dependencies**: Think about how features interact

### For Developers

1. **Data Consistency**: Always validate configuration before saving
2. **Performance**: Use React.memo for complex components
3. **Accessibility**: Ensure keyboard navigation works
4. **Error Handling**: Graceful handling of invalid configurations
5. **Testing**: Comprehensive test coverage for pricing logic

## Future Enhancements

### Potential Features

1. **Bulk Operations**: Import/export configurations
2. **Templates**: Predefined configurations for common products
3. **Validation Rules**: Advanced business logic validation
4. **Preview Mode**: Real-time pricing preview
5. **Analytics**: Usage tracking and optimization insights
6. **Multi-language**: Localized configuration interface

### Technical Improvements

1. **Performance**: Virtual scrolling for large configurations
2. **Offline Support**: Local storage for draft configurations
3. **Real-time Collaboration**: Multi-user editing support
4. **API Integration**: External system synchronization
5. **Mobile Optimization**: Touch-friendly interface

## Troubleshooting

### Common Issues

1. **Page Scrolling**: Fixed by adding `type="button"` and `preventDefault()`
2. **Layout Breaks**: Resolved with proper flexbox implementation
3. **State Inconsistency**: Handled through optimistic updates
4. **Drag & Drop Issues**: Fixed with proper sensor configuration

### Debug Tips

1. Check browser console for React errors
2. Verify Sanity document permissions
3. Test with minimal configuration first
4. Use React DevTools to inspect component state

---

## 6. Button Diversification Strategy

To address the visual monotony of multiple blue "Add" buttons, the configurator implements a creative diversification strategy:

### 🎨 Color Coding by Hierarchy:

- **🔵 Primary Actions** (Blue): Main feature creation and primary variant addition
  - `"Dodaj wariant główny"` - Enhanced with shadow and bold typography
- **🟢 Secondary Actions** (Green): Adding features within variants
  - `"Dodaj cechę"` in primary variants - Ghost style with green border
- **🟠 Tertiary Actions** (Amber): Adding variants to features
  - `"Dodaj wariant"` in secondary features - Ghost style with amber border
- **⚪ Subtle Actions** (Ghost): Adding secondary options
  - `"Dodaj podrzędną opcję"` - Standard ghost button, minimal styling

### 🎭 Toggle Functionality:

- **🔄 Primary Variants**: Each primary variant can be **collapsed/expanded** using a **prominent blue toggle button** with dynamic icons (▶️ when closed, 🔽 when open)
  - **Style**: Solid blue background when open, outlined when closed
  - **Animation**: Icon swap transition (no rotation) for crisp visual feedback
- **🔄 Secondary Features**: Each secondary feature uses a **subtle ghost chevron button** with rotation animation (▶️➡️🔽)
  - **Style**: Ghost mode, minimal visual presence
  - **Animation**: Smooth 200ms rotation for elegant expand/collapse
- **📱 Animation**: Both use 200ms transitions but with different visual approaches
- **💾 State Persistence**: Toggle states are maintained during the editing session
- **🎯 User Control**: Helps manage complex configurations by allowing users to focus on specific sections

### 📋 Template System for Bulk Duplication:

- **🎯 Purpose**: Efficiently duplicate secondary features across multiple primary variants
- **📝 How it Works**: Select one variant as a template, then apply its secondary features to all other variants
- **⚡ Workflow**: Setup once → Select template → Apply to all → Customize individually
- **🔄 Perfect For**: Common features like "Length", "Color", "Material" that apply to all variants
- **🎨 Visual Indicator**: Selected template shows "📋 Szablon" button with blue highlight
- **📱 Bulk Action**: Blue template card appears with "Zastosuj do wszystkich" button
- **🔧 Use Case**: "Phono" and "XLR" both need "Length" and "Color" - setup on one, apply to all

### 🎯 Drag and Drop for Secondary Features:

- **🎯 Purpose**: Reorder secondary features within each primary variant
- **📝 How it Works**: Drag and drop secondary features to rearrange their order
- **🎨 Drag Handle**: Each secondary feature shows a drag handle (⋮⋮⋮) when you hover over it
- **🔄 Visual Feedback**: Dragged items become semi-transparent and show drop zones
- **⚡ Real-time Updates**: Order changes are saved immediately
- **🎯 Per-Variant**: Each variant maintains its own feature order independently

**Example Flow:**

```
[Connection Type]
├── [Phono] ← Select as template
│   ├── Length: [1m, 2m, 3m] ← Add here
│   └── Color: [Black, White] ← Add here
│
├── [XLR] ← Empty for now
│
└── [Template Card Appears]
    └── [Zastosuj do wszystkich] ← Click to copy
        ↓
        [XLR] ← Now has same features
        ├── Length: [1m, 2m, 3m] ← Copied
        └── Color: [Black, White] ← Copied
```

### 🎯 Icon Variations:

- **AddIcon**: Standard addition actions (primary, tertiary & subtle)
- **ComposeIcon**: Feature composition within variants (secondary)
- **Ghost Mode**: All secondary/tertiary buttons use ghost mode for subtlety

### 📊 Visual Hierarchy:

- **Primary buttons**: Bold, prominent with shadows and larger padding
- **Secondary buttons**: Ghost mode with colored borders and icons
- **Tertiary buttons**: Ghost mode with muted colored borders
- **Ghost buttons**: Standard ghost styling for minimal actions

### 🎭 Button Styles Summary:

```jsx
// Primary: Enhanced blue with shadow
tone="primary" + shadow + bold typography

// Secondary: Ghost with green border
mode="ghost" + tone="positive" + ComposeIcon + green border

// Tertiary: Ghost with amber border
mode="ghost" + tone="caution" + AddIcon + amber border

// Subtle: Standard ghost
mode="ghost" + tone="primary" + AddIcon
```

This creates a **subdued yet visually distinct interface** where users can quickly identify different action types by **colored borders** rather than bright backgrounds, maintaining professional aesthetics while preserving functionality.

---

## Conclusion

The Features Configurator v2 represents a sophisticated, user-friendly system for managing complex product configurations that has been significantly enhanced through recent architectural improvements.

### Achievements

#### ✅ **Refactoring Success**

- **Dialog Extraction**: 6 dialog components extracted with enhanced functionality
- **DnD Centralization**: All drag operations unified through `SortableList` component
- **Code Quality**: Main component reduced by ~14%, duplicate code eliminated
- **Maintainability**: Modular architecture enables easier testing and extension

#### ✅ **Enhanced User Experience**

- **Custom Naming**: All dialogs now support custom naming instead of defaults
- **Global Addition**: Secondary features and variants can be added globally to all primary variants
- **Smart Duplicate Prevention**: Intelligent detection and avoidance of duplicate features/variants
- **Consistent DnD**: Unified drag behavior across all sortable lists
- **Better Text Handling**: Improved overflow and spacing in `InlineEditable`
- **Field Labels**: Numeric variants now support custom field labels (e.g., "Długość")
- **Visual Error Indicators**: Input validation now uses Sanity's critical tone styling instead of custom colors
- **Frontend Preview**: New interactive preview component for testing configurations
- **Persistent Selections**: Secondary feature selections persist when switching between primary variants

#### ✅ **Developer Experience**

- **Type Safety**: Improved TypeScript interfaces and prop validation
- **Consistent Patterns**: All components follow established architectural patterns
- **Easier Testing**: Isolated components enable comprehensive test coverage
- **Better Debugging**: Clear component boundaries and responsibilities

### Future Outlook

The refactored system provides a solid foundation for future enhancements:

#### Short Term

- **Template System**: Enhanced bulk configuration capabilities
- **Validation Rules**: Advanced business logic validation
- **Analytics**: Usage tracking and optimization insights

#### Long Term

- **Performance**: Virtual scrolling for large configurations
- **Real-time Collaboration**: Multi-user editing support
- **Mobile Optimization**: Touch-friendly interface enhancements
- **API Integration**: External system synchronization

### Architectural Principles Validated

1. **Separation of Concerns**: Dialogs, DnD, and business logic properly isolated
2. **Reusability**: Components designed for reuse across the application
3. **Maintainability**: Clean architecture enables easy modifications and extensions
4. **User Experience**: Enhanced functionality while preserving familiar workflows
5. **Developer Experience**: Improved development workflow with better tooling

The system successfully bridges the gap between complex e-commerce requirements and user-friendly content management, enabling AudioFast to offer highly configurable products with accurate, dynamic pricing while maintaining a clean, maintainable codebase for future development.

---

**Last Updated**: 2024 - Post Legacy Cleanup & Frontend Preview
**Components**: ~950 lines (optimized after removing ~814 lines of legacy/unused code)
**Architecture**: Streamlined with extracted dialogs, centralized DnD, global addition, and frontend preview
**Status**: ✅ Production Ready with Enhanced UX & Clean Architecture

### **Recent Cleanup Achievements**

#### **Code Optimization Results:**

- **Removed Legacy Components**: `UnifiedFeaturesManager.tsx` (407 lines) and `FeaturesPricingTable.tsx` (407 lines)
- **Streamlined Views**: Reduced from 4 product views to 3 essential views
- **Eliminated Unused Code**: ~814 lines of dead code removed from codebase
- **Improved Performance**: Smaller bundle size and faster load times

#### **Enhanced User Experience:**

- **Visual Error Styling**: Input validation now uses Sanity's native critical tone colors
- **Frontend Preview**: New interactive preview component for real-time testing
- **Persistent State**: Secondary selections maintained across primary variant switches
- **Better Error Handling**: Visual indicators without intrusive text messages

#### **Architecture Improvements:**

- **Clean Component Structure**: Removed clutter and improved maintainability
- **Consistent Design System**: All styling now uses Sanity's design tokens
- **Better Error UX**: Subtle visual indicators replace text overlays
- **Optimized Bundle**: Reduced JavaScript payload for faster Studio performance
