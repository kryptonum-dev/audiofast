/**
 * Data transformers for Dealer to Store migration
 */

import type {
  DealerRecord,
  ParsedAddress,
  SanityStoreDocument,
  ValidationError,
} from "./types";

/**
 * Split the City field into postal code and city name
 * Input format: "XX-XXX CityName" (e.g., "00-621 Warszawa")
 */
export function splitCityField(cityField: string): ParsedAddress {
  const trimmed = cityField.trim();

  // Regex to match Polish postal code format: XX-XXX
  const postalCodeRegex = /^(\d{2}-\d{3})\s+(.+)$/;
  const match = trimmed.match(postalCodeRegex);

  if (match) {
    return {
      postalCode: match[1], // e.g., "00-621"
      city: match[2].trim(), // e.g., "Warszawa"
    };
  }

  // Fallback: try to extract postal code from anywhere in string
  const fallbackMatch = trimmed.match(/(\d{2}-\d{3})/);
  if (fallbackMatch) {
    const postalCode = fallbackMatch[1];
    const city = trimmed.replace(postalCode, "").trim();
    return { postalCode, city: city || "Unknown" };
  }

  // If no postal code found, return with placeholder
  console.warn(`Could not parse city field: "${cityField}"`);
  return { postalCode: "00-000", city: trimmed || "Unknown" };
}

/**
 * Normalize phone number to +48XXXXXXXXX format
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "+48000000000";

  // Take only the first number if multiple are provided (comma-separated)
  const firstNumber = phone.split(",")[0].trim();

  // Remove all non-digit characters
  const digitsOnly = firstNumber.replace(/\D/g, "");

  // Handle different cases
  if (digitsOnly.length === 9) {
    // Mobile or landline without country code
    return `+48${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("48")) {
    // Already has country code
    return `+${digitsOnly}`;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith("048")) {
    // Old format with leading 0
    return `+${digitsOnly.substring(1)}`;
  } else if (digitsOnly.length >= 7 && digitsOnly.length <= 11) {
    // Variable length - just prepend +48
    return `+48${digitsOnly}`;
  }

  // Log warning for unusual formats but still return something valid
  console.warn(`Unusual phone format: "${phone}" -> "${digitsOnly}"`);
  return `+48${digitsOnly.padEnd(9, "0").substring(0, 9)}`;
}

/**
 * Normalize email address
 * - Replace obfuscated @ symbols
 * - Validate format
 */
export function normalizeEmail(email: string | null): string | undefined {
  if (!email) return undefined;

  // Replace obfuscated @ symbol variations
  const normalized = email
    .replace(/\s*\(at\)\s*/gi, "@")
    .replace(/\s*\[at\]\s*/gi, "@")
    .replace(/\s*{at}\s*/gi, "@")
    .replace(/\s*<at>\s*/gi, "@")
    .trim();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(normalized)) {
    return normalized;
  }

  console.warn(`Invalid email format: "${email}" -> "${normalized}"`);
  return undefined;
}

/**
 * Normalize website URL
 */
export function normalizeWebsite(website: string | null): string | undefined {
  if (!website) return undefined;

  const trimmed = website.trim();
  if (!trimmed) return undefined;

  // Ensure URL has protocol
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Normalize street address
 */
export function normalizeStreet(street: string): string {
  const trimmed = street.trim();

  // Remove leading/trailing whitespace
  return trimmed;
}

/**
 * Generate a proper Sanity UUID v4 format
 * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12)
 */
export function generateSanityId(dealerId: number): string {
  // Create a deterministic but unique ID based on dealer ID
  // This ensures the same dealer always gets the same Sanity ID (idempotent)
  const seed = `store-dealer-${dealerId}`;

  // Simple hash function to generate hex characters deterministically
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate UUID-like string using the hash as seed
  const hexChars = "0123456789abcdef";
  const segments = [8, 4, 4, 4, 12]; // UUID segment lengths
  const parts: string[] = [];

  let seedValue = Math.abs(hash);

  for (const length of segments) {
    let segment = "";
    for (let i = 0; i < length; i++) {
      // Use combination of seed value and position for variety
      const index = (seedValue + dealerId * (i + 1) * 7 + i * 13) % 16;
      segment += hexChars[index];
      seedValue = (seedValue * 31 + i) % 2147483647;
    }
    parts.push(segment);
  }

  return parts.join("-");
}

/**
 * Transform a Dealer record to a Sanity Store document
 */
export function transformDealerToStore(dealer: DealerRecord): {
  document: SanityStoreDocument;
  warnings: ValidationError[];
} {
  const warnings: ValidationError[] = [];

  // Parse address
  const parsedAddress = splitCityField(dealer.City);
  if (parsedAddress.postalCode === "00-000") {
    warnings.push({
      dealerId: dealer.ID,
      field: "City",
      originalValue: dealer.City,
      error: "Could not parse postal code from city field",
    });
  }

  // Normalize phone
  const phone = normalizePhone(dealer.Phone);
  if (dealer.Phone && dealer.Phone.includes(",")) {
    warnings.push({
      dealerId: dealer.ID,
      field: "Phone",
      originalValue: dealer.Phone,
      error: "Multiple phone numbers found, using first one only",
    });
  }

  // Normalize email
  const email = normalizeEmail(dealer.Email);
  if (dealer.Email && !email) {
    warnings.push({
      dealerId: dealer.ID,
      field: "Email",
      originalValue: dealer.Email,
      error: "Invalid email format, skipping",
    });
  }

  // Normalize website
  const website = normalizeWebsite(dealer.WWW);

  // Build the Sanity document
  const document: SanityStoreDocument = {
    _type: "store",
    _id: generateSanityId(dealer.ID),
    name: dealer.Name.trim(),
    address: {
      postalCode: parsedAddress.postalCode,
      city: parsedAddress.city,
      street: normalizeStreet(dealer.Street),
    },
    phone,
  };

  // Add optional fields only if they have values
  if (email) {
    document.email = email;
  }
  if (website) {
    document.website = website;
  }

  return { document, warnings };
}

/**
 * Validate a Sanity Store document
 */
export function validateStoreDocument(
  document: SanityStoreDocument,
  dealerId: number,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check required fields
  if (!document.name || document.name.trim() === "") {
    errors.push({
      dealerId,
      field: "name",
      originalValue: document.name,
      error: "Name is required",
    });
  }

  if (
    !document.address.postalCode ||
    !/^\d{2}-\d{3}$/.test(document.address.postalCode)
  ) {
    errors.push({
      dealerId,
      field: "address.postalCode",
      originalValue: document.address.postalCode,
      error: "Postal code must be in XX-XXX format",
    });
  }

  if (!document.address.city || document.address.city.trim() === "") {
    errors.push({
      dealerId,
      field: "address.city",
      originalValue: document.address.city,
      error: "City is required",
    });
  }

  if (!document.address.street || document.address.street.trim() === "") {
    errors.push({
      dealerId,
      field: "address.street",
      originalValue: document.address.street,
      error: "Street is required",
    });
  }

  if (!document.phone || !/^\+48\d{7,11}$/.test(document.phone)) {
    errors.push({
      dealerId,
      field: "phone",
      originalValue: document.phone,
      error: "Phone must be in +48XXXXXXX format (7-11 digits after +48)",
    });
  }

  return errors;
}
