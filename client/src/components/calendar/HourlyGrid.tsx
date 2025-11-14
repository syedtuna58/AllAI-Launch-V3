import { ReactNode } from "react";
import { format } from "date-fns";
import { generateHourSlots } from "@/lib/calendarUtils";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";

interface HourlyGridProps {
  day: Date;
  dayIndex: number;
  isToday: boolean;
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  children?: ReactNode;
  className?: string;
}

interface HourSlotProps {
  day: Date;
  hour: number;
  hourHeight: number;
}

interface QuarterSlotProps {
  day: Date;
  hour: number;
  minute: number;
  quarterHeight: number;
  isLastQuarter: boolean;
}

/**
 * Individual 15-minute slot that is droppable
 */
function QuarterSlot({ day, hour, minute, quarterHeight, isLastQuarter }: QuarterSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `quarter:${day.getTime()}:${hour}:${minute}`,
    data: { date: day, hour, minute },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-colors",
        isLastQuarter ? "border-b border-border/50 dark:border-gray-700/50" : "border-b border-border/20 dark:border-gray-700/20",
        isOver && "bg-blue-100 dark:bg-blue-800/20"
      )}
      style={{ height: `${quarterHeight}px` }}
      data-hour={hour}
      data-minute={minute}
    />
  );
}

/**
 * Individual hour slot with 15-minute subdivisions
 */
function HourSlot({ day, hour, hourHeight }: HourSlotProps) {
  const quarterHeight = hourHeight / 4;
  const quarters = [0, 15, 30, 45];

  return (
    <div className="relative">
      {quarters.map((minute, idx) => (
        <QuarterSlot
          key={minute}
          day={day}
          hour={hour}
          minute={minute}
          quarterHeight={quarterHeight}
          isLastQuarter={idx === 3}
        />
      ))}
    </div>
  );
}

/**
 * Renders an hourly grid for a single day column
 * Shows 15-minute time slots from startHour to endHour
 */
export function HourlyGrid({
  day,
  dayIndex,
  isToday,
  startHour = 6,
  endHour = 20,
  hourHeight = 60,
  children,
  className,
}: HourlyGridProps) {
  const hours = generateHourSlots(startHour, endHour);
  
  // Make the entire day column droppable
  const { setNodeRef: setDayRef, isOver: isDayOver } = useDroppable({
    id: `day:${day.getTime()}`,
    data: { date: day },
  });

  return (
    <div ref={setDayRef} className={cn("relative flex-1", className)}>
      {/* Day header */}
      <div className={cn(
        "sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-border h-[60px] flex flex-col items-center justify-center",
        isToday && "bg-blue-50 dark:bg-blue-900/20",
        isDayOver && "bg-blue-100 dark:bg-blue-800/30"
      )}>
        <div className="text-xs text-muted-foreground dark:text-gray-400 uppercase">
          {format(day, 'EEE')}
        </div>
        <div className={cn(
          "text-2xl font-semibold",
          isToday ? "text-blue-600 dark:text-blue-400" : "text-foreground"
        )}>
          {format(day, 'd')}
        </div>
      </div>

      {/* Hourly grid slots */}
      <div className="relative">
        {hours.map((hour) => (
          <HourSlot
            key={hour}
            day={day}
            hour={hour}
            hourHeight={hourHeight}
          />
        ))}

        {/* Current time indicator (red line) */}
        {isToday && (() => {
          const now = new Date();
          const nowHours = now.getHours();
          const nowMinutes = now.getMinutes();
          
          // Only show if current time is within display range
          if (nowHours >= startHour && nowHours <= endHour) {
            const topPosition = ((nowHours - startHour) * hourHeight) + (nowMinutes * hourHeight / 60);
            return (
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-red-500/40 z-30 pointer-events-none"
                style={{ top: `${topPosition}px` }}
              >
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
            );
          }
          return null;
        })()}

        {/* Event layer - rendered via children */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="relative h-full pointer-events-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
