/**
 * Options for formatting numbers.
 */
type FormatNumberOptions = {
  /** The maximum number of fraction digits to display. Defaults to 8. */
  maximumFractionDigits?: number;
  /** The minimum number of fraction digits to display. */
  minimumFractionDigits?: number;
};

/**
 * Formats a number according to the US locale with grouping enabled.
 * 
 * @param value - The number to format.
 * @param options - Formatting options for fraction digits.
 * @returns A formatted string or an empty string if the value is not a finite number.
 */
export function formatLocaleNumber(value: number, options: FormatNumberOptions = {}) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const { maximumFractionDigits = 8, minimumFractionDigits } = options;

  return new Intl.NumberFormat("en-US", {
    useGrouping: true,
    maximumFractionDigits,
    ...(minimumFractionDigits !== undefined ? { minimumFractionDigits } : {})
  }).format(value);
}

/**
 * Parses a numeric string into a number, attempting to handle common locale variations
 * for thousands separators (commas/dots) and decimal points.
 * 
 * @param value - The string to parse.
 * @returns The parsed number, or NaN if the input is empty or invalid.
 */
export function parseLocaleNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return NaN;
  }

  const normalized = trimmed.replace(/\s/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");

    if (lastDot > lastComma) {
      return Number(normalized.replace(/,/g, ""));
    }

    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }

  if (normalized.includes(",")) {
    const parts = normalized.split(",");
    const looksLikeThousandsSeparator =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && /^\d{1,3}$/.test(parts[0]));

    if (looksLikeThousandsSeparator) {
      return Number(normalized.replace(/,/g, ""));
    }

    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }

  return Number(normalized);
}

/**
 * Parses a string input and re-formats it if it's a valid positive number.
 * Used for formatting input values as they are typed or blurred.
 * 
 * @param value - The input string to format.
 * @param options - Formatting options.
 * @returns The formatted string if valid, otherwise the original input string.
 */
export function formatLocaleNumberInput(value: string, options: FormatNumberOptions = {}) {
  const parsed = parseLocaleNumber(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return value;
  }

  return formatLocaleNumber(parsed, options);
}

/**
 * Removes all comma grouping separators from a string.
 * 
 * @param value - The string to process.
 * @returns The string with all commas removed.
 */
export function removeNumberGrouping(value: string) {
  return value.replace(/,/g, "");
}
