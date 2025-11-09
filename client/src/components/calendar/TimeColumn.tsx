import { generateHourSlots, formatHourLabel } from "@/lib/calendarUtils";

interface TimeColumnProps {
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
}

/**
 * Renders a vertical column of time labels for the calendar grid
 * Default: 6 AM to 8 PM with 60px height per hour
 */
export function TimeColumn({ 
  startHour = 6, 
  endHour = 20, 
  hourHeight = 60 
}: TimeColumnProps) {
  const hours = generateHourSlots(startHour, endHour);

  return (
    <div className="pr-3 border-r border-border dark:border-gray-700 relative">
      {/* Spacer for header alignment */}
      <div className="h-[60px] border-b border-transparent"></div>
      
      {/* Hour labels */}
      {hours.map((hour) => (
        <div
          key={hour}
          className="text-xs text-muted-foreground dark:text-gray-400 text-right pr-2 relative"
          style={{ height: `${hourHeight}px` }}
        >
          <span className="absolute -top-2 right-2">{formatHourLabel(hour)}</span>
        </div>
      ))}
    </div>
  );
}
