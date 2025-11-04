import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { format, addDays, startOfWeek, parseISO, addMinutes, isSameMinute, isWithinInterval, areIntervalsOverlapping } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";

const TIMEZONE = "America/New_York";
const HOURS_START = 6; // 6 AM
const HOURS_END = 22; // 10 PM
const INTERVAL_MINUTES = 60; // 1-hour increments for tenant view

interface TimeSlot {
  start: Date;
  end: Date;
  type: 'proposed' | 'selected' | 'conflict';
}

interface TenantAvailabilitySelectorProps {
  proposedStartTime: string;  // ISO string
  proposedEndTime: string;    // ISO string
  onSubmit: (availabilitySlots: Array<{ startAt: string; endAt: string }>) => void;
  onCancel: () => void;
}

export default function TenantAvailabilitySelector({
  proposedStartTime,
  proposedEndTime,
  onSubmit,
  onCancel,
}: TenantAvailabilitySelectorProps) {
  // Parse proposed time and convert to local timezone
  const proposedStart = toZonedTime(parseISO(proposedStartTime), TIMEZONE);
  const proposedEnd = toZonedTime(parseISO(proposedEndTime), TIMEZONE);
  
  // Calculate job duration in minutes
  const jobDurationMinutes = Math.round((proposedEnd.getTime() - proposedStart.getTime()) / (1000 * 60));
  
  // Start the week view from the proposed time's week
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(proposedStart, { weekStartsOn: 0 })
  );
  
  // Track selected time slots
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  
  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);
  
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  // Generate time slots
  const generateTimeSlots = () => {
    const slots: Date[] = [];
    for (let hour = HOURS_START; hour < HOURS_END; hour++) {
      for (let minute = 0; minute < 60; minute += INTERVAL_MINUTES) {
        slots.push(new Date(2000, 0, 1, hour, minute));
      }
    }
    return slots;
  };
  
  const timeSlots = generateTimeSlots();

  // Helper function to create a Date in the target timezone
  const createCellTime = (day: Date, time: Date): Date => {
    // Extract date in America/New_York timezone (not user's local timezone)
    const dateStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    
    // Create ISO string for the wall time in America/New_York
    const dateTimeStr = `${dateStr}T${hours}:${minutes}:00`;
    
    // Parse string as America/New_York time and convert to UTC
    return fromZonedTime(dateTimeStr, TIMEZONE);
  };

  // Check if a cell is the proposed time
  const isProposedTime = (day: Date, time: Date) => {
    const cellStart = createCellTime(day, time);
    const cellEnd = addMinutes(cellStart, INTERVAL_MINUTES);
    
    return areIntervalsOverlapping(
      { start: proposedStart, end: proposedEnd },
      { start: cellStart, end: cellEnd },
      { inclusive: true }
    );
  };

  // Check if a cell is selected
  const isSelected = (day: Date, time: Date) => {
    const cellStart = createCellTime(day, time);
    const cellEnd = addMinutes(cellStart, INTERVAL_MINUTES);
    
    return selectedSlots.some(slot =>
      areIntervalsOverlapping(
        { start: slot.start, end: slot.end },
        { start: cellStart, end: cellEnd },
        { inclusive: true }
      )
    );
  };

  // Check if currently dragging over this cell
  const isDraggingOver = (day: Date, time: Date) => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    
    const cellStart = createCellTime(day, time);
    
    const dragInterval = {
      start: dragStart < dragEnd ? dragStart : dragEnd,
      end: dragStart < dragEnd ? dragEnd : dragStart,
    };
    
    return isWithinInterval(cellStart, dragInterval);
  };

  // Handle mouse down on a cell
  const handleMouseDown = (day: Date, time: Date) => {
    const cellTime = createCellTime(day, time);
    setIsDragging(true);
    setDragStart(cellTime);
    setDragEnd(cellTime);
  };

  // Handle mouse enter on a cell during drag
  const handleMouseEnter = (day: Date, time: Date) => {
    if (isDragging && dragStart) {
      const cellTime = createCellTime(day, time);
      setDragEnd(cellTime);
    }
  };

  // Handle mouse up to complete selection
  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      const start = dragStart < dragEnd ? dragStart : dragEnd;
      const end = dragStart < dragEnd ? addMinutes(dragEnd, INTERVAL_MINUTES) : addMinutes(dragStart, INTERVAL_MINUTES);
      
      // Add the new slot
      setSelectedSlots(prev => [...prev, { start, end, type: 'selected' }]);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // Clear a specific slot
  const clearSlot = (index: number) => {
    setSelectedSlots(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedSlots([]);
  };

  // Handle submit
  const handleSubmit = () => {
    if (selectedSlots.length === 0) return;
    
    // Slots are already in UTC (created via fromZonedTime), just convert to ISO strings
    const slots = selectedSlots.map(slot => ({
      startAt: slot.start.toISOString(),
      endAt: slot.end.toISOString(),
    }));
    
    onSubmit(slots);
  };

  return (
    <div className="space-y-4">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
          data-testid="button-prev-week"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        <span className="text-sm font-medium">
          {formatInTimeZone(currentWeekStart, TIMEZONE, 'MMM d')} - {formatInTimeZone(addDays(currentWeekStart, 6), TIMEZONE, 'MMM d, yyyy')}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
          data-testid="button-next-week"
        >
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Job Duration Info */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">Job Duration:</span>{' '}
              {jobDurationMinutes >= 60 && `${Math.floor(jobDurationMinutes / 60)}h `}
              {jobDurationMinutes % 60 > 0 && `${jobDurationMinutes % 60}min`}
              {jobDurationMinutes < 60 && jobDurationMinutes % 60 === 0 && '< 1h'}
            </div>
            <Badge variant="secondary" className="text-xs">
              Select {jobDurationMinutes >= 60 && `${Math.floor(jobDurationMinutes / 60)}h `}
              {jobDurationMinutes % 60 > 0 && `${jobDurationMinutes % 60}min`}
              {jobDurationMinutes < 60 && jobDurationMinutes % 60 === 0 && '< 1h'} blocks
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-200 dark:bg-amber-900 border border-amber-400 rounded"></div>
          <span>Contractor's Proposed Time</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-200 dark:bg-green-900 border border-green-400 rounded"></div>
          <span>Your Available Times</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <div 
            ref={gridRef}
            className="select-none"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-0 border">
              {/* Day headers */}
              <div className="border-b bg-muted"></div>
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className="border-b bg-muted p-2 text-center text-sm font-medium"
                >
                  {formatInTimeZone(day, TIMEZONE, 'EEE M/d')}
                </div>
              ))}

              {/* Time slots */}
              {timeSlots.map((time, timeIdx) => (
                <>
                  {/* Time label */}
                  <div
                    key={`time-${timeIdx}`}
                    className="p-2 text-xs text-muted-foreground border-r text-right"
                  >
                    {format(time, 'h:mm a')}
                  </div>
                  
                  {/* Day cells */}
                  {weekDays.map((day, dayIdx) => {
                    const isProposed = isProposedTime(day, time);
                    const isSelectedCell = isSelected(day, time);
                    const isDraggingCell = isDraggingOver(day, time);
                    
                    return (
                      <div
                        key={`cell-${timeIdx}-${dayIdx}`}
                        className={cn(
                          "border-r border-b h-8 cursor-pointer transition-colors",
                          isProposed && "bg-amber-200 dark:bg-amber-900 border-amber-400",
                          isSelectedCell && "bg-green-200 dark:bg-green-900 border-green-400",
                          isDraggingCell && !isProposed && "bg-green-100 dark:bg-green-800",
                          !isProposed && !isSelectedCell && !isDraggingCell && "hover:bg-muted"
                        )}
                        onMouseDown={() => handleMouseDown(day, time)}
                        onMouseEnter={() => handleMouseEnter(day, time)}
                        data-testid={`calendar-cell-${dayIdx}-${timeIdx}`}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Slots Summary */}
      {selectedSlots.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Your Proposed Times ({selectedSlots.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                data-testid="button-clear-all"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedSlots.map((slot, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-muted rounded"
                data-testid={`selected-slot-${idx}`}
              >
                <span className="text-sm">
                  {formatInTimeZone(slot.start, TIMEZONE, 'EEE, MMM d, yyyy h:mm a')} - {formatInTimeZone(slot.end, TIMEZONE, 'h:mm a')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearSlot(idx)}
                  data-testid={`button-remove-slot-${idx}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="button-cancel-availability"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={selectedSlots.length === 0}
          data-testid="button-submit-availability"
        >
          Submit Counter-Proposal ({selectedSlots.length} time{selectedSlots.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );
}
