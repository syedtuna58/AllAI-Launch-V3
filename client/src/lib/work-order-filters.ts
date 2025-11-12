// Shared work order filtering logic
// Used by both maintenance.tsx and admin-calendar.tsx to ensure consistent filtering

// Active statuses exclude "On Hold" and "Closed"
export const ACTIVE_CASE_STATUSES = ["New", "In Review", "Scheduled", "In Progress", "Resolved"] as const;

// All possible case statuses from the schema
export type CaseStatus = "New" | "In Review" | "Scheduled" | "In Progress" | "On Hold" | "Resolved" | "Closed";

// Status filter options (includes "all" and "active" meta-options)
export type StatusFilterKey = "all" | "active" | CaseStatus;

export interface CaseWithStatus {
  status: string | null;
}

/**
 * Filter cases based on status filter key
 * @param cases - Array of cases with status property
 * @param statusKey - Filter key: "all", "active", or specific status
 * @returns Filtered array of cases
 */
export function filterCasesByStatus<T extends CaseWithStatus>(
  cases: T[],
  statusKey: StatusFilterKey
): T[] {
  if (statusKey === "all") {
    return cases;
  }
  
  if (statusKey === "active") {
    return cases.filter(c => ACTIVE_CASE_STATUSES.includes(c.status as any));
  }
  
  return cases.filter(c => c.status === statusKey);
}
