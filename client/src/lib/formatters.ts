// Number formatting utilities for financial inputs

/**
 * Formats a number with commas for thousands separator
 * @param value - The numeric value to format
 * @returns Formatted string with commas
 */
export function formatNumberWithCommas(value: number | string): string {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US');
}

/**
 * Removes commas from a formatted number string
 * @param value - The formatted string with commas
 * @returns Clean numeric string
 */
export function removeCommas(value: string): string {
  return value.replace(/,/g, '');
}

/**
 * Formats currency with dollar sign and commas
 * @param value - The numeric value to format
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string): string {
  if (!value && value !== 0) return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return `$${num.toLocaleString('en-US')}`;
}

/**
 * Handle financial input changes without formatting while typing
 * @param e - The input change event  
 * @param onChange - The form field onChange handler
 */
export function handleFinancialInput(e: React.ChangeEvent<HTMLInputElement>, onChange: (value: number | undefined) => void) {
  const rawValue = removeCommas(e.target.value);
  const numericValue = rawValue === '' ? undefined : parseFloat(rawValue);
  onChange(numericValue);
}

/**
 * Handle financial input blur - format the display value
 * @param e - The input blur event
 * @param value - Current field value
 * @param onChange - The form field onChange handler  
 */
export function handleFinancialBlur(e: React.FocusEvent<HTMLInputElement>, value: number | undefined, onChange: (value: number | undefined) => void) {
  if (value && !isNaN(value)) {
    // Format the input value with commas
    e.target.value = formatNumberWithCommas(value);
  }
}

/**
 * Get display value for financial inputs (unformatted for controlled inputs)
 * @param value - The numeric value
 * @returns String value for input display
 */
export function getFinancialDisplayValue(value: number | undefined): string {
  return value !== undefined ? String(value) : '';
}

/**
 * Formats work order location (property + unit) for display
 * @param propertyId - The property ID
 * @param unitId - The unit ID
 * @param properties - Array of properties
 * @param units - Array of units
 * @returns Formatted location string or null
 */
export function formatWorkOrderLocation(
  propertyId: string | null | undefined,
  unitId: string | null | undefined,
  properties: Array<{ id: string; name?: string; street?: string; city?: string }> = [],
  units: Array<{ id: string; label?: string }> = []
): string | null {
  const property = propertyId ? properties.find(p => p.id === propertyId) : null;
  const unit = unitId ? units.find(u => u.id === unitId) : null;
  
  const propertyName = property ? (property.name || property.street) : null;
  const unitLabel = unit?.label;
  
  if (propertyName && unitLabel) return `${propertyName} - ${unitLabel}`;
  if (propertyName) return propertyName;
  if (unitLabel) return `Unit ${unitLabel}`;
  return null;
}