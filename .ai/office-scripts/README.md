# Office Scripts for Excel Web - Pricing Sync

## Overview

This folder contains Office Scripts for syncing pricing data from Excel Web to Supabase and Sanity.

## Files

- `SyncPricingToSupabase.ts` - Main script that reads pricing data and syncs to backend

## Setup Instructions

### Step 1: Open Excel Web

1. Go to [office.com](https://www.office.com) and sign in
2. Open your pricing spreadsheet (or upload the `.xlsx` file)

### Step 2: Add the Script

1. Click **Automate** tab in the ribbon
2. Click **New Script**
3. Delete the default code
4. Copy and paste the entire contents of `SyncPricingToSupabase.ts`
5. Click **Save script** (give it a name like "Sync Pricing")

### Step 3: Verify Sheet Names

The script expects these sheet names (adjust in CONFIG if different):
- `Produkty` - Main products sheet
- `Opcje` - Options sheet
- `Wartości` - Numeric rules sheet
- `Listy` - Nested select values sheet

### Step 4: Run the Script

**Option A: Manual Run**
1. Click **Automate** > **Script name** > **Run**

**Option B: Add a Button (Recommended)**
1. Go to **Insert** > **Shapes** > Select a rectangle
2. Draw the button on your sheet
3. Right-click the shape > **Assign Script**
4. Select your script

## Expected Sheet Structure

### Produkty Sheet (Columns)

| Column | Name | Description |
|--------|------|-------------|
| A | Brand | Brand name |
| B | PRODUKT | Product name |
| C | MODEL | Model variant (optional) |
| E | Cena WWW | Base price (e.g., "16 730 zł") |
| G | URL | Price key / slug |
| AA | P1 | Related product 1 URL |
| AB | P2 | Related product 2 URL |
| AC | P3 | Related product 3 URL |
| AD | P4 | Related product 4 URL |

### Opcje Sheet (Columns)

| Column | Name | Description |
|--------|------|-------------|
| A | Produkt | Product name |
| B | Model | Model variant |
| C | Opcja | Option group name |
| D | Pozycja słownikowa | Option value name |
| E | Cena | Price delta |
| F | Pod-opcja wartości | Link to Wartości (numeric input) |
| G | Pod-opcja listy | Link to Listy (nested select) |

### Wartości Sheet (Columns)

| Column | Name | Description |
|--------|------|-------------|
| A | Produkt | Product name |
| B | Model | Model variant |
| C | Opcja | Option name |
| D | Min | Minimum value |
| E | Max | Maximum value |
| F | Skok | Step increment |
| G | Dopłata | Price per step |

### Listy Sheet (Columns)

| Column | Name | Description |
|--------|------|-------------|
| A | Produkt | Product name |
| B | Model | Model variant |
| C | Opcja | Option name |
| D | Pozycja słownikowa | Nested value name |
| E | Dopłata | Price delta |

## Output

The script logs results to the console (visible in the Script pane):

```
=== Starting Pricing Sync ===
Timestamp: 2025-12-03T08:30:00.000Z

--- Reading sheets ---
Read 50 products from Produkty sheet
Read 10 numeric rules from Wartości sheet
Read 15 list option groups from Listy sheet
Processed option groups for 30 variants

--- Payload Summary ---
Total variants: 50
Variants with options: 30
Variants with related products: 25

--- Sending to Supabase ---

=== SYNC COMPLETE ===
Status: SUCCESS

Supabase:
  Variants: 50
  Groups: 45
  Values: 120
  Numeric Rules: 10

Sanity Prices:
  Updated: 50
  Skipped: 0

Sanity Related Products:
  Updated: 25
  Skipped: 0
```

## Troubleshooting

### "Sheet not found" Error
- Check that sheet names match exactly (including case and Polish characters)
- Update the `CONFIG` section in the script if your sheets have different names

### "HTTP 401" Error
- Check that `ANON_KEY` and `EXCEL_TOKEN` are correct
- Tokens may have expired - contact developer for new tokens

### "Invalid JSON" Error
- Check for special characters in product names that might break JSON
- Ensure price formats follow Polish convention ("16 730 zł")

### Products Not Syncing to Sanity
- Verify the URL/price_key matches product slugs in Sanity
- Check the errors array in the response for specific issues

## Security Notes

⚠️ **The script contains API keys.** These are "publishable" keys safe for client-side use, but:
- Don't share the script publicly
- The `EXCEL_TOKEN` should be rotated periodically
- Contact developer if you suspect keys are compromised

