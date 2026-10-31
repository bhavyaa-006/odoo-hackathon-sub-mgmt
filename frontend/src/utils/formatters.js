/**
 * Brightloop Financial & General Formatting Utilities
 * Handles integer minor units (_minor) safely without floating point inaccuracies.
 */

/**
 * Format minor unit amounts (e.g., paise, cents) into a formatted currency string.
 * @param {number|string|null|undefined} amountMinor - Amount in integer minor units (e.g., 10000 = 100.00)
 * @param {string} [currency='INR'] - Currency code ('INR', 'USD', 'EUR')
 * @param {object} [options={}] - Additional formatting options
 * @returns {string} Formatted currency string
 */
export const formatMoney = (amountMinor, currency = 'INR', options = {}) => {
  if (amountMinor === null || amountMinor === undefined || isNaN(Number(amountMinor))) {
    return '—';
  }

  const numericMinor = Math.round(Number(amountMinor));
  const isNegative = numericMinor < 0;
  const absMinor = Math.abs(numericMinor);

  const majorUnits = Math.floor(absMinor / 100);
  const minorUnits = absMinor % 100;
  const paddedMinor = minorUnits.toString().padStart(2, '0');

  // Format integer part with locale groupings
  let formattedMajor = majorUnits.toLocaleString('en-IN');
  if (currency === 'USD' || currency === 'EUR' || currency === 'GBP') {
    formattedMajor = majorUnits.toLocaleString('en-US');
  }

  const symbolMap = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  const symbol = symbolMap[currency] || (currency ? `${currency} ` : '₹');

  const formattedAmount = `${symbol}${formattedMajor}.${paddedMinor}`;

  if (isNegative) {
    if (options.parentheses) {
      return `(${formattedAmount})`;
    }
    return `-${formattedAmount}`;
  }

  return formattedAmount;
};

/**
 * Parse a standard major currency string or number to integer minor units.
 * Never uses floating-point multiplication directly on floats.
 * @param {string|number} majorAmount
 * @returns {number} Integer minor units
 */
export const toMinorUnits = (majorAmount) => {
  if (majorAmount === null || majorAmount === undefined) return 0;
  const str = String(majorAmount).trim().replace(/[^0-9.-]/g, '');
  if (!str) return 0;

  const parts = str.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const fraction = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const isNeg = whole < 0 || str.startsWith('-');

  const wholeMinor = Math.abs(whole) * 100;
  const fracMinor = parseInt(fraction, 10) || 0;
  const total = wholeMinor + fracMinor;

  return isNeg ? -total : total;
};

/**
 * Format ISO dates into user-friendly presentation format: "12 Oct 2026"
 * @param {string|Date|null|undefined} dateInput
 * @returns {string}
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
};

/**
 * Format ISO dates with time: "12 Oct 2026, 02:30 PM"
 * @param {string|Date|null|undefined} dateInput
 * @returns {string}
 */
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateInput);
  }
};

/**
 * Format relative time (e.g. "2 hours ago", "Yesterday")
 * @param {string|Date} dateInput
 * @returns {string}
 */
export const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateInput);
  } catch {
    return formatDate(dateInput);
  }
};
