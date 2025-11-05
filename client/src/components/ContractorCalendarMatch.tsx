import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, X, AlertTriangle } from "lucide-react";
import { format, addDays, startOfWeek, parseISO, addMinutes, isWithinInterval, areIntervalsOverlapping } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";

const TIMEZONE = "America/New_York";
const HOURS_START = 6; // 6 AM
const HOURS_END = 22; // 10 PM
const INTERVAL_MINUTES = 60; // 1-hour increments

interface ContractorCalendarMatchProps {
  counterProposalId: string;
  proposedSlots: Array<{ startAt: string; endAt: string }>;  // Tenant's proposed availability
  scheduledJobs: Array<any>;  // Contractor's existing schedule
  currentJobId: string;  // The job being rescheduled
  jobDurationMinutes?: number;  // Expected duration of the job in minutes
  onAccept: (slotIndex: number, selectedStart?: string, selectedEnd?: string) => void;
  onReject: () => void;
  isPending: boolean;
}

export default function ContractorCalendarMatch({
  counterProposalId,
  proposedSlots,
  scheduledJobs,
  currentJobId,
  jobDurationMinutes = 120, // Default to 2 hours
  onAccept,
  onReject,
  isPending,
}: ContractorCalendarMatchProps) {
  // Parse proposed slots and convert to timezone
  const tenantSlots = proposedSlots.map(slot => ({
    start: toZonedTime(parseISO(slot.startAt), TIMEZONE),
    end: toZonedTime(parseISO(slot.endAt), TIMEZONE),
  }));
  
  // Start from the earliest proposed slot's week
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    if (tenantSlots.length > 0) {
      return startOfWeek(tenantSlots[0].start, { weekStartsOn: 0 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 0 });
  });
  
  // Selection state for contractor to pick a time block
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  
  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = HOURS_START; hour < HOURS_END; hour++) {
      slots.push(new Date(2000, 0, 1, hour, 0)); // Using a fixed date, only time matters
    }
    return slots;
  };
  
  const timeSlots = generateTimeSlots();

  // Check if contractor has a job during this cell time
  const hasExistingJob = (day: Date, time: Date) => {
    const cellStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    const cellEnd = addMinutes(cellStart, INTERVAL_MINUTES);
    
    return scheduledJobs.some(job => {
      // Skip the current job being rescheduled
      if (job.id === currentJobId) return false;
      
      if (!job.scheduledStartAt || !job.scheduledEndAt) return false;
      
      const jobStart = toZonedTime(parseISO(job.scheduledStartAt), TIMEZONE);
      const jobEnd = toZonedTime(parseISO(job.scheduledEndAt), TIMEZONE);
      
      return areIntervalsOverlapping(
        { start: jobStart, end: jobEnd },
        { start: cellStart, end: cellEnd },
        { inclusive: true }
      );
    });
  };

  // Check if tenant is available during this cell time
  const isTenantAvailable = (day: Date, time: Date) => {
    const cellStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    const cellEnd = addMinutes(cellStart, INTERVAL_MINUTES);
    
    return tenantSlots.some(slot =>
      areIntervalsOverlapping(
        { start: slot.start, end: slot.end },
        { start: cellStart, end: cellEnd },
        { inclusive: true }
      )
    );
  };

  // Check if this is a perfect match (tenant available AND contractor free)
  const isPerfectMatch = (day: Date, time: Date) => {
    return isTenantAvailable(day, time) && !hasExistingJob(day, time);
  };

  // Find which tenant slot this cell belongs to (for accept button)
  const getTenantSlotIndex = (day: Date, time: Date) => {
    const cellStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    
    return tenantSlots.findIndex(slot => 
      isWithinInterval(cellStart, { start: slot.start, end: slot.end })
    );
  };

  // Get cell styling based on availability
  const getCellStyle = (day: Date, time: Date) => {
    const hasPerfectMatch = isPerfectMatch(day, time);
    const hasTenantAvail = isTenantAvailable(day, time);
    const hasJob = hasExistingJob(day, time);

    if (hasPerfectMatch) {
      return "bg-green-100 dark:bg-green-900 border-green-400 hover:bg-green-200 dark:hover:bg-green-800 cursor-pointer";
    } else if (hasJob) {
      // Booked Jobs - consolidated state for any time contractor is busy
      return "bg-orange-100 dark:bg-orange-900 border-orange-400";
    } else if (hasTenantAvail) {
      return "bg-blue-100 dark:bg-blue-900 border-blue-300";
    }
    
    return "bg-white dark:bg-gray-900 border-gray-200";
  };

  // Check if a cell is currently selected
  const isSelectedCell = (day: Date, time: Date) => {
    if (!selectedSlot) return false;
    
    const cellStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    const cellEnd = addMinutes(cellStart, INTERVAL_MINUTES);
    
    return areIntervalsOverlapping(
      { start: selectedSlot.start, end: selectedSlot.end },
      { start: cellStart, end: cellEnd },
      { inclusive: true }
    );
  };

  // Check if currently dragging over this cell
  const isDraggingOverCell = (day: Date, time: Date) => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    
    const cellStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    
    const dragInterval = {
      start: dragStart < dragEnd ? dragStart : dragEnd,
      end: dragStart < dragEnd ? dragEnd : dragStart,
    };
    
    return isWithinInterval(cellStart, dragInterval);
  };

  // Mouse handlers for selection
  const handleMouseDown = (day: Date, time: Date) => {
    // Only allow selection in perfect match areas
    if (!isPerfectMatch(day, time)) return;
    
    const cellTime = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    
    setIsDragging(true);
    setDragStart(cellTime);
    setDragEnd(cellTime);
  };

  const handleMouseEnter = (day: Date, time: Date) => {
    if (isDragging && dragStart) {
      // Only allow extending drag if the cell is a perfect match
      if (!isPerfectMatch(day, time)) return;
      
      const cellTime = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        time.getHours(),
        time.getMinutes()
      );
      setDragEnd(cellTime);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      const start = dragStart < dragEnd ? dragStart : dragEnd;
      const end = dragStart < dragEnd ? addMinutes(dragEnd, INTERVAL_MINUTES) : addMinutes(dragStart, INTERVAL_MINUTES);
      
      // Set the selected slot
      setSelectedSlot({ start, end });
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // Handle accepting the selected time
  const handleAcceptSelected = () => {
    if (!selectedSlot) return;
    
    // Find which tenant slot this overlaps with
    const slotIndex = tenantSlots.findIndex(slot =>
      areIntervalsOverlapping(
        { start: slot.start, end: slot.end },
        { start: selectedSlot.start, end: selectedSlot.end },
        { inclusive: true }
      )
    );
    
    // Validate that the selection overlaps with a tenant slot
    if (slotIndex < 0) {
      console.error('Selected time does not overlap with any tenant availability slot');
      return;
    }
    
    // Pass the selected time to the parent
    onAccept(slotIndex, selectedSlot.start.toISOString(), selectedSlot.end.toISOString());
  };

  // Rank slots by best match
  const rankedSlots = tenantSlots.map((slot, index) => {
    const slotStart = slot.start;
    const slotEnd = slot.end;
    
    // Count how many hour blocks are perfect matches (tenant available AND contractor free)
    let perfectMatchHours = 0;
    let current = new Date(slotStart);
    
    while (current < slotEnd) {
      // Create a time reference for the hour check
      const timeRef = new Date(2000, 0, 1, current.getHours(), current.getMinutes());
      
      // Check if contractor is free during this hour
      if (!hasExistingJob(current, timeRef)) {
        perfectMatchHours++;
      }
      current = addMinutes(current, 60);
    }
    
    return { index, slot, perfectMatchHours };
  }).sort((a, b) => b.perfectMatchHours - a.perfectMatchHours);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Calendar Match View</h3>
          <p className="text-sm text-muted-foreground">
            Find the best time that works for both you and the tenant
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          disabled={isPending}
          data-testid="button-reject-counter-proposal"
        >
          <X className="h-4 w-4 mr-1" />
          Decline All
        </Button>
      </div>

      {/* Top Matches */}
      {rankedSlots.length > 0 && rankedSlots[0].perfectMatchHours > 0 && (
        <Card className="border-green-300 bg-green-50 dark:bg-green-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Best Match{rankedSlots.filter(s => s.perfectMatchHours > 0).length > 1 ? 'es' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankedSlots.filter(s => s.perfectMatchHours > 0).slice(0, 3).map(({ index, slot, perfectMatchHours }) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="font-medium">
                    {formatInTimeZone(slot.start, TIMEZONE, "EEE, MMM d")} at {formatInTimeZone(slot.start, TIMEZONE, "h:mm a")} - {formatInTimeZone(slot.end, TIMEZONE, "h:mm a")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {perfectMatchHours === Math.ceil((slot.end.getTime() - slot.start.getTime()) / (1000 * 60 * 60)) 
                      ? "✓ Completely free" 
                      : `${perfectMatchHours}h available`}
                  </div>
                </div>
                <Button
                  onClick={() => onAccept(index)}
                  disabled={isPending}
                  data-testid={`button-accept-slot-${index}`}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Accept This Time
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Job Duration Info */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">Job Duration:</span>{' '}
              {jobDurationMinutes >= 60 && `${Math.floor(jobDurationMinutes / 60)}h `}
              {jobDurationMinutes % 60 > 0 && `${jobDurationMinutes % 60}min`}
            </div>
            <Badge variant="secondary" className="text-xs">
              Select from green "Perfect Match" areas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Selected Time Slot */}
      {selectedSlot && (() => {
        const selectedDurationMinutes = Math.round((selectedSlot.end.getTime() - selectedSlot.start.getTime()) / (1000 * 60));
        const durationMatch = selectedDurationMinutes === jobDurationMinutes;
        
        return (
          <Card className={cn(
            "border-purple-300 bg-purple-50 dark:bg-purple-950",
            !durationMatch && "border-amber-300 bg-amber-50 dark:bg-amber-950"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {durationMatch ? (
                  <Check className="h-5 w-5 text-purple-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                Selected Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="font-medium">
                    {formatInTimeZone(selectedSlot.start, TIMEZONE, "EEE, MMM d 'at' h:mm a")} - {formatInTimeZone(selectedSlot.end, TIMEZONE, "h:mm a")}
                  </div>
                  <div className={cn(
                    "text-sm",
                    durationMatch ? "text-muted-foreground" : "text-amber-600 dark:text-amber-500 font-medium"
                  )}>
                    Duration: {Math.floor(selectedDurationMinutes / 60)}h {selectedDurationMinutes % 60}min
                    {!durationMatch && ` (Expected: ${Math.floor(jobDurationMinutes / 60)}h ${jobDurationMinutes % 60}min)`}
                  </div>
                </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSlot(null)}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleAcceptSelected}
                  disabled={isPending}
                  data-testid="button-accept-selected"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Accept This Time
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })()}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900 border border-green-400 rounded"></div>
          <span>Perfect Match (Both Available)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-200 dark:bg-purple-900 border border-purple-500 rounded"></div>
          <span>Your Selection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 rounded"></div>
          <span>Tenant Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-100 dark:bg-orange-900 border border-orange-400 rounded"></div>
          <span>Booked Jobs</span>
        </div>
      </div>

      {/* Week Navigation */}
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

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-8 border-b bg-muted">
          <div className="p-2 text-xs font-medium border-r">Time</div>
          {weekDays.map((day, i) => (
            <div key={i} className="p-2 text-xs font-medium text-center">
              <div>{format(day, 'EEE')}</div>
              <div className="text-muted-foreground">{format(day, 'M/d')}</div>
            </div>
          ))}
        </div>
        <div 
          className="max-h-[600px] overflow-y-auto select-none"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {timeSlots.map((time, timeIdx) => (
            <div key={timeIdx} className="grid grid-cols-8 border-b last:border-b-0">
              <div className="p-2 text-xs border-r bg-muted flex items-center justify-center">
                {format(time, 'h a')}
              </div>
              {weekDays.map((day, dayIdx) => {
                const isMatch = isPerfectMatch(day, time);
                const isSelected = isSelectedCell(day, time);
                const isDraggingOver = isDraggingOverCell(day, time);
                
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "p-1 border-r last:border-r-0 min-h-[50px] flex items-center justify-center text-xs transition-colors",
                      getCellStyle(day, time),
                      isSelected && "bg-purple-200 dark:bg-purple-900 border-purple-500 ring-2 ring-purple-400",
                      isDraggingOver && isMatch && "bg-purple-100 dark:bg-purple-800"
                    )}
                    onMouseDown={() => handleMouseDown(day, time)}
                    onMouseEnter={() => handleMouseEnter(day, time)}
                    data-testid={`cell-${dayIdx}-${timeIdx}`}
                  >
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
