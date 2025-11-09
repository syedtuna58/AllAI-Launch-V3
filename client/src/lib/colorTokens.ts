/**
 * Shared Color Token System - Dual Encoding
 * 
 * Type-based: Background/fill colors for reminder types and maintenance cases
 * Status-based: Border and badge colors for urgency/completion status
 * 
 * This ensures visual consistency across:
 * - Reminders page
 * - Admin calendar
 * - Contractor calendar
 * - Dashboard widgets
 */

export type ReminderType = 
  | 'rent'
  | 'lease'
  | 'mortgage'
  | 'insurance'
  | 'property_tax'
  | 'hoa'
  | 'permit'
  | 'maintenance'
  | 'regulatory'
  | 'custom';

export type ReminderStatus = 'overdue' | 'due_soon' | 'upcoming' | 'completed';

export type CaseStatus = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';

/**
 * Reminder Type Colors (Background/Fill) - Pastel
 * These match the existing colors from the reminders page
 */
export const REMINDER_TYPE_COLORS: Record<ReminderType, string> = {
  lease: 'bg-[#D8E2FF] dark:bg-[hsl(223,75%,18%)]',
  maintenance: 'bg-[#FFF1C1] dark:bg-[hsl(44,70%,18%)]',
  regulatory: 'bg-[#F9D7E5] dark:bg-[hsl(343,60%,18%)]',
  mortgage: 'bg-[#D6F2E0] dark:bg-[hsl(152,45%,18%)]',
  insurance: 'bg-[#E8E5F5] dark:bg-[hsl(258,55%,18%)]',
  property_tax: 'bg-[#FFE3D9] dark:bg-[hsl(25,70%,18%)]',
  hoa: 'bg-[#D7F4FF] dark:bg-[hsl(197,70%,18%)]',
  permit: 'bg-[#FFE8D6] dark:bg-[hsl(36,70%,18%)]',
  custom: 'bg-[#E4E7ED] dark:bg-[hsl(222,12%,20%)]',
  rent: 'bg-[#D7E8FF] dark:bg-[hsl(213,60%,18%)]',
};

/**
 * Status Colors (Borders/Badges)
 * Used to overlay urgency/completion status on type-colored items
 */
export const STATUS_COLORS: Record<ReminderStatus, { bg: string; border: string; text: string }> = {
  overdue: {
    bg: 'bg-[hsl(0,78%,86%)] dark:bg-[hsl(0,60%,20%)]',
    border: 'border-[hsl(0,63%,60%)] dark:border-[hsl(0,70%,50%)]',
    text: 'text-[hsl(0,70%,35%)] dark:text-[hsl(0,80%,70%)]',
  },
  due_soon: {
    bg: 'bg-[hsl(32,87%,87%)] dark:bg-[hsl(32,65%,20%)]',
    border: 'border-[hsl(28,74%,58%)] dark:border-[hsl(28,75%,55%)]',
    text: 'text-[hsl(28,80%,30%)] dark:text-[hsl(28,85%,70%)]',
  },
  upcoming: {
    bg: 'bg-[hsl(213,77%,88%)] dark:bg-[hsl(213,60%,20%)]',
    border: 'border-[hsl(213,64%,55%)] dark:border-[hsl(213,65%,55%)]',
    text: 'text-[hsl(213,70%,30%)] dark:text-[hsl(213,75%,70%)]',
  },
  completed: {
    bg: 'bg-[hsl(152,57%,87%)] dark:bg-[hsl(152,45%,20%)]',
    border: 'border-[hsl(152,49%,45%)] dark:border-[hsl(152,50%,45%)]',
    text: 'text-[hsl(152,55%,25%)] dark:text-[hsl(152,60%,70%)]',
  },
};

/**
 * Maintenance Case Status Colors
 * Separate from reminder statuses as they have different lifecycle states
 */
export const CASE_STATUS_COLORS: Record<CaseStatus, { bg: string; border: string }> = {
  open: {
    bg: 'bg-[hsl(47,95%,88%)] dark:bg-[hsl(47,70%,20%)]',
    border: 'border-[hsl(45,93%,58%)] dark:border-[hsl(45,80%,55%)]',
  },
  in_progress: {
    bg: 'bg-[hsl(211,75%,89%)] dark:bg-[hsl(211,60%,20%)]',
    border: 'border-[hsl(211,70%,58%)] dark:border-[hsl(211,70%,55%)]',
  },
  on_hold: {
    bg: 'bg-[hsl(240,8%,90%)] dark:bg-[hsl(240,6%,22%)]',
    border: 'border-[hsl(240,6%,60%)] dark:border-[hsl(240,8%,55%)]',
  },
  resolved: {
    bg: 'bg-[hsl(142,52%,88%)] dark:bg-[hsl(142,45%,20%)]',
    border: 'border-[hsl(142,52%,50%)] dark:border-[hsl(142,50%,48%)]',
  },
  closed: {
    bg: 'bg-[hsl(210,14%,91%)] dark:bg-[hsl(210,12%,22%)]',
    border: 'border-[hsl(210,12%,65%)] dark:border-[hsl(210,14%,60%)]',
  },
};

/**
 * Helper to get the full CSS classes for a reminder with dual encoding
 * @param type - Reminder type (determines background color)
 * @param status - Reminder status (determines border and badges)
 * @returns CSS class string for the reminder card
 */
export function getReminderClasses(type: ReminderType, status: ReminderStatus): string {
  const typeColor = REMINDER_TYPE_COLORS[type];
  const statusColors = STATUS_COLORS[status];
  return `${typeColor} ${statusColors.border} ${statusColors.text} border-2`;
}

/**
 * Helper to get the full CSS classes for a maintenance case
 * @param status - Case status
 * @returns CSS class string for the case card
 */
export function getCaseClasses(status: CaseStatus): string {
  const colors = CASE_STATUS_COLORS[status];
  return `${colors.bg} ${colors.border} border-2`;
}

/**
 * Helper to get badge text for a reminder status
 */
export function getStatusBadgeText(status: ReminderStatus): string {
  switch (status) {
    case 'overdue':
      return 'Overdue';
    case 'due_soon':
      return 'Due Soon';
    case 'upcoming':
      return 'Upcoming';
    case 'completed':
      return 'Completed';
  }
}

/**
 * Helper to determine status based on due date
 */
export function getReminderStatus(dueAt: string | Date | null, completedAt: string | Date | null): ReminderStatus {
  if (completedAt) return 'completed';
  if (!dueAt) return 'upcoming';
  
  const now = new Date();
  const dueDate = new Date(dueAt);
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'due_soon';
  return 'upcoming';
}
