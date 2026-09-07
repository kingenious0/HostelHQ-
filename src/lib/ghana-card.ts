/**
 * Ghana Card Identification & Anti-Spoofing Guard
 *
 * Implements client-side structural validation, keyboard-mashing prevention,
 * and format masking for National Identification Authority (NIA) Ghana Cards
 * backed by statutory liability under Section 3 of the Statutory Declarations Act, 1971 (Act 389).
 */

export const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

export const GHANA_CARD_PERJURY_WARNING =
  "Perjury Warning under Section 3 of the Statutory Declarations Act, 1971 (Act 389): " +
  "Any person who knowingly makes a false declaration or provides spoofed national identity credentials " +
  "in a matter concerning commercial premises licensing, student welfare, or residential lease agreements " +
  "commits a criminal offense punishable under the laws of Ghana.";

export interface GhanaCardValidationResult {
  isValid: boolean;
  error?: string;
  formatted?: string;
}

/**
 * Validates a Ghana Card number for correct structure and anti-spoofing criteria.
 *
 * Requirements:
 * 1. Must match standard format: GHA-XXXXXXXXX-X (where X is a digit)
 * 2. Cannot consist of repeated digits (e.g., GHA-000000000-0 or GHA-111111111-1)
 * 3. Cannot consist of sequential runs (e.g., GHA-123456789-0 or GHA-987654321-0)
 * 4. Cannot match common test mashing (e.g., TEST, SAMPLE, DUMMY, AAAA)
 */
export function validateGhanaCard(rawInput: string): GhanaCardValidationResult {
  if (!rawInput || typeof rawInput !== "string") {
    return {
      isValid: false,
      error: "Ghana Card PIN is required for statutory attestation.",
    };
  }

  const cleaned = rawInput.trim().toUpperCase();

  // Test keyword spoofing
  const forbiddenPatterns = ["TEST", "SAMPLE", "DUMMY", "FAKE", "AAAA", "BBBB"];
  for (const pattern of forbiddenPatterns) {
    if (cleaned.includes(pattern)) {
      return {
        isValid: false,
        error: "Spoofed or test Ghana Card detected. Real NIA identification is required.",
      };
    }
  }

  // Check strict regex
  if (!GHANA_CARD_REGEX.test(cleaned)) {
    return {
      isValid: false,
      error: "Invalid format. Expected format: GHA-XXXXXXXXX-X (e.g. GHA-723819472-1).",
    };
  }

  // Extract the 9-digit body and check digit
  const match = cleaned.match(/^GHA-(\d{9})-(\d)$/);
  if (!match) {
    return {
      isValid: false,
      error: "Invalid Ghana Card structure.",
    };
  }

  const bodyDigits = match[1];
  const checkDigit = match[2];

  // Check 1: All identical digits (e.g. 000000000, 111111111)
  const isAllSameDigit = bodyDigits.split("").every((d) => d === bodyDigits[0]);
  if (isAllSameDigit) {
    return {
      isValid: false,
      error: "Repeated keyboard-mashing detected. Enter your genuine Ghana Card number.",
    };
  }

  // Check 2: Sequential ascending or descending digits (123456789, 987654321)
  const ascending = "0123456789";
  const descending = "9876543210";
  if (ascending.includes(bodyDigits) || descending.includes(bodyDigits)) {
    return {
      isValid: false,
      error: "Sequential digit run detected. Spoofed credentials violate Act 389.",
    };
  }

  // Check 3: Repetitive 2-digit alternating pattern (e.g. 121212121, 010101010)
  const isAlternating = bodyDigits
    .split("")
    .every((d, idx) => d === bodyDigits[idx % 2]);
  if (isAlternating) {
    return {
      isValid: false,
      error: "Repetitive pattern detected. Enter a genuine NIA identification number.",
    };
  }

  return {
    isValid: true,
    formatted: cleaned,
  };
}

/**
 * Automatically formats a user-typed string into GHA-XXXXXXXXX-X format.
 */
export function formatGhanaCardInput(input: string): string {
  if (!input) return "";

  // Strip all non-alphanumeric characters and force upper case
  let val = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // If user pasted or typed with or without 'GHA' prefix
  if (val.startsWith("GHA")) {
    val = val.slice(3);
  }

  // Retain only digits for the remainder
  const digits = val.replace(/\D/g, "").slice(0, 10);

  if (digits.length === 0) {
    return "GHA-";
  }

  if (digits.length <= 9) {
    return `GHA-${digits}`;
  }

  return `GHA-${digits.slice(0, 9)}-${digits.slice(9, 10)}`;
}
