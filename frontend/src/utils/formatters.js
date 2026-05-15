/**
 * Utility formatters for currency, dates, etc.
 */

/**
 * Format cents to MYR currency string.
 * @param {number} cents - Amount in cents
 * @returns {string} Formatted currency string
 */
export function formatCurrency(cents) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

/**
 * Format ISO date string to readable format.
 * @param {string} isoString - ISO 8601 date string
 * @returns {string} Formatted date string
 */
export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate UUID for display.
 * @param {string} uuid - Full UUID
 * @returns {string} Truncated UUID
 */
export function truncateUUID(uuid) {
  if (!uuid) return '';
  return `${uuid.slice(0, 8)}...${uuid.slice(-4)}`;
}
