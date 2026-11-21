export const MAX_NAME_LENGTH = 80;

/** The application accepts trimmed, non-empty and bounded player/company names. */
export function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_NAME_LENGTH && value === value.trim();
}
