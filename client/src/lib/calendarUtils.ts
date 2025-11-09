/**
 * Calendar utility functions for hourly grid rendering
 * Shared between admin calendar and contractor schedule
 */

/**
 * Generate an array of hour numbers for the grid
 * @param startHour - Starting hour (e.g., 6 for 6 AM)
 * @param endHour - Ending hour (e.g., 20 for 8 PM)
 * @returns Array of hour numbers [6, 7, 8, ..., 20]
 */
export function generateHourSlots(startHour: number = 6, endHour: number = 20): number[] {
  const length = endHour - startHour + 1;
  return Array.from({ length }, (_, i) => startHour + i);
}

/**
 * Calculate the top position (in pixels) for a given time within the grid
 * @param date - The date/time to position
 * @param startHour - Grid starting hour (default 6 for 6 AM)
 * @param hourHeight - Height of each hour slot in pixels (default 60)
 * @returns Top position in pixels from the grid start
 */
export function calculateTimePosition(
  date: Date,
  startHour: number = 6,
  hourHeight: number = 60
): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Calculate position relative to start hour
  const topPosition = ((hours - startHour) * hourHeight) + (minutes * hourHeight / 60);
  
  return topPosition;
}

/**
 * Snap a date to the nearest 15-minute interval
 * @param date - The date to snap
 * @returns New date object snapped to nearest quarter hour
 */
export function snapToQuarterHour(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  
  snapped.setMinutes(roundedMinutes);
  snapped.setSeconds(0);
  snapped.setMilliseconds(0);
  
  return snapped;
}

/**
 * Format hour number to 12-hour time string
 * @param hour - Hour in 24-hour format (0-23)
 * @returns Formatted time string (e.g., "6 AM", "12 PM", "8 PM")
 */
export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/**
 * Check if a time falls within the visible grid range
 * @param date - The date to check
 * @param startHour - Grid starting hour (default 6)
 * @param endHour - Grid ending hour (default 20)
 * @returns true if time is within range
 */
export function isTimeInRange(
  date: Date,
  startHour: number = 6,
  endHour: number = 20
): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Before start hour
  if (hours < startHour) return false;
  
  // After end hour (anything at or past endHour:00 is out of range)
  if (hours >= endHour) return false;
  
  return true;
}

/**
 * Calculate duration in minutes between two dates
 * @param start - Start date
 * @param end - End date
 * @returns Duration in minutes
 */
export function calculateDurationMinutes(start: Date, end: Date): number {
  const durationMs = end.getTime() - start.getTime();
  return durationMs / (1000 * 60);
}
