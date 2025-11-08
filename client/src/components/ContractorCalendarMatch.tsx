import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, X, AlertTriangle, Info } from "lucide-react";
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
  initialProposedStart?: string;  // Original/initial proposal start time
  initialProposedEnd?: string;  // Original/initial proposal end time
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
  initialProposedStart,
  initialProposedEnd,
  onAccept,
  onReject,
  isPending,
}: ContractorCalendarMatchProps) {
  // Parse proposed slots and convert to timezone
  const tenantSlots = proposedSlots.map(slot => ({
    start: toZonedTime(parseISO(slot.startAt), TIMEZONE),
    end: toZonedTime(parseISO(slot.endAt), TIMEZONE),
  }));
  
  // Parse initial proposal times
  const initialProposal = initialProposedStart && initialProposedEnd ? {
    start: toZonedTime(parseISO(initialProposedStart), TIMEZONE),
    end: toZonedTime(parseISO(initialProposedEnd), TIMEZONE),
  } : null;

  // Start from the earliest proposed slot's week (Monday start)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    if (tenantSlots.length > 0) {
      return startOfWeek(tenantSlots[0].start, { weekStartsOn: 1 }); // 1 = Monday
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  
  // View mode state
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [hideWeekends, setHideWeekends] = useState(true);
  
  // Selection state for contractor to pick a time block
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  
  // Generate days based on view mode
  const weekDays = (() => {
    if (viewMode === 'day') {
      return [currentWeekStart]; // Show only single day
    } else if (viewMode === 'month') {
      // Show 4 weeks worth of days
      if (hideWeekends) {
        // Generate enough days to get 20 weekdays (approximately 4 weeks)
        const days = [];
        let currentDay = currentWeekStart;
        while (days.length < 20) {
          if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
            days.push(currentDay);
          }
          currentDay = addDays(currentDay, 1);
        }
        return days;
      } else {
        // Show 28 days (4 weeks) including weekends
        return Array.from({ length: 28 }, (_, i) => addDays(currentWeekStart, i));
      }
    } else {
      // Week view: Monday to Friday if hideWeekends is true, otherwise Monday to Sunday
      return Array.from({ length: hideWeekends ? 5 : 7 }, (_, i) => addDays(currentWeekStart, i));
    }
  })();
  
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

  // Check if this cell is the initial proposal (which should be blocked/unavailable)
  const isInitialProposal = (day: Date, time: Date) => {
    if (!initialProposal) return false;
    
    const cellStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    const cellEnd = addMinutes(cellStart, INTERVAL_MINUTES);
    
    return areIntervalsOverlapping(
      { start: initialProposal.start, end: initialProposal.end },
      { start: cellStart, end: cellEnd },
      { inclusive: true }
    );
  };

  // Check if tenant is available during this cell time (excluding initial proposal)
  const isTenantAvailable = (day: Date, time: Date) => {
    // If this is the initial proposal time, it's NOT available
    if (isInitialProposal(day, time)) return false;
    
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

  // Find the valid consecutive window that contains this cell (returns start and end of window)
  const findValidWindowForCell = (day: Date, time: Date, requiredMinutes: number): { start: Date; end: Date } | null => {
    const cellStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    
    const hoursNeeded = Math.ceil(requiredMinutes / 60);
    
    // Check if this cell could be the START of a valid window
    let canStartHere = true;
    for (let i = 0; i < hoursNeeded; i++) {
      const checkTime = new Date(2000, 0, 1, addMinutes(cellStart, i * 60).getHours(), 0);
      const isAvailable = isTenantAvailable(day, checkTime) && !hasExistingJob(day, checkTime);
      if (!isAvailable) {
        canStartHere = false;
        break;
      }
    }
    if (canStartHere) {
      return {
        start: cellStart,
        end: addMinutes(cellStart, requiredMinutes)
      };
    }
    
    // Check if this cell could be WITHIN a valid window that started earlier
    for (let startOffset = 1; startOffset < hoursNeeded; startOffset++) {
      const potentialStart = addMinutes(cellStart, -startOffset * 60);
      
      // Verify all hours from potential start through the required duration are available
      let isValidWindow = true;
      for (let i = 0; i < hoursNeeded; i++) {
        const checkTime = new Date(2000, 0, 1, addMinutes(potentialStart, i * 60).getHours(), 0);
        const isAvailable = isTenantAvailable(day, checkTime) && !hasExistingJob(day, checkTime);
        if (!isAvailable) {
          isValidWindow = false;
          break;
        }
      }
      
      if (isValidWindow) {
        return {
          start: potentialStart,
          end: addMinutes(potentialStart, requiredMinutes)
        };
      }
    }
    
    return null;
  };

  // Check if this cell is part of a valid consecutive time window for the job
  const isPartOfValidWindow = (day: Date, time: Date, requiredMinutes: number): boolean => {
    return findValidWindowForCell(day, time, requiredMinutes) !== null;
  };

  // Check if this is a perfect match (tenant available AND contractor free AND part of valid time window)
  const isPerfectMatch = (day: Date, time: Date) => {
    const isBasicMatch = isTenantAvailable(day, time) && !hasExistingJob(day, time);
    if (!isBasicMatch) return false;
    
    // Also check if this cell is part of a valid consecutive window for the job duration
    return isPartOfValidWindow(day, time, jobDurationMinutes);
  };

  // Check if this is a partial match (both available but not enough consecutive hours)
  const isPartialMatch = (day: Date, time: Date) => {
    const isBasicMatch = isTenantAvailable(day, time) && !hasExistingJob(day, time);
    if (!isBasicMatch) return false;
    
    // It's a partial match if both are available but NOT part of a valid consecutive window
    return !isPartOfValidWindow(day, time, jobDurationMinutes);
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
    const isInitial = isInitialProposal(day, time);
    const hasPerfectMatch = isPerfectMatch(day, time);
    const hasPartialMatch = isPartialMatch(day, time);
    const hasTenantAvail = isTenantAvailable(day, time);
    const hasJob = hasExistingJob(day, time);

    // Initial proposal - shown with light orange background (no banner)
    if (isInitial) {
      return "bg-orange-200 dark:bg-orange-800 border-orange-300 dark:border-orange-700 relative";
    }
    
    // Perfect match - green
    if (hasPerfectMatch) {
      return "bg-green-100 dark:bg-green-900 border-green-400 hover:bg-green-200 dark:hover:bg-green-800 cursor-pointer relative";
    }
    
    // Partial match - faded green
    if (hasPartialMatch) {
      return "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900 relative opacity-60";
    }
    
    // All booked jobs - grey background (tags will be added as overlays)
    if (hasJob) {
      return "bg-gray-300 dark:bg-gray-700 border-gray-400 dark:border-gray-600 relative";
    }
    
    return "bg-white dark:bg-gray-900 border-gray-200 relative";
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
    
    // Cell is selected if its START time is within the selection window
    // (but before the end boundary to avoid selecting the next cell)
    return cellStart >= selectedSlot.start && cellStart < selectedSlot.end;
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
    
    // Check if clicking on an already selected cell - if so, unselect it
    if (isSelectedCell(day, time)) {
      setSelectedSlot(null);
      return;
    }
    
    // Find the actual valid window that contains this clicked cell
    const validWindow = findValidWindowForCell(day, time, jobDurationMinutes);
    if (!validWindow) return; // Should not happen if isPerfectMatch is true, but safety check
    
    // Auto-snap to the ACTUAL valid window bounds
    // This ensures clicking ANY hour in a 2-hour window selects the SAME 2-hour window
    // dragEnd is set to the LAST cell in the selection (not the end time)
    const endCellTime = addMinutes(validWindow.start, jobDurationMinutes - INTERVAL_MINUTES);
    
    setIsDragging(true);
    setDragStart(validWindow.start);
    setDragEnd(endCellTime);
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


      {/* Job Duration Info */}
      <Card className="bg-slate-50 dark:bg-slate-950 border-slate-200">
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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900 border border-green-400 rounded"></div>
          <span>Perfect Match</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 rounded opacity-60"></div>
          <span>Partial Match</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-200 dark:bg-orange-800 border border-orange-300 rounded"></div>
          <span>Initial Proposal (Declined)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-200 dark:bg-blue-900 rounded"></div>
          <span>Your New Selection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 dark:bg-gray-700 border border-gray-400 rounded"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 dark:bg-gray-700 border border-gray-400 rounded relative">
            <div className="absolute top-0 left-0 bg-purple-300 text-[6px] px-0.5 rounded text-white">TA</div>
          </div>
          <span>Booked (Tenant Available)</span>
        </div>
      </div>

      {/* View Controls and Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const increment = viewMode === 'day' ? -1 : viewMode === 'month' ? -30 : -7;
              setCurrentWeekStart(addDays(currentWeekStart, increment));
            }}
            data-testid="button-prev-period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              if (viewMode === 'day') {
                setCurrentWeekStart(today);
              } else {
                setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
              }
            }}
            data-testid="button-today"
          >
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('day')}
              data-testid="button-view-day"
            >
              Day
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
              data-testid="button-view-week"
            >
              Week
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
              data-testid="button-view-month"
            >
              Month
            </Button>
          </div>
          
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={hideWeekends}
              onChange={(e) => setHideWeekends(e.target.checked)}
              className="rounded"
              data-testid="checkbox-hide-weekends"
            />
            <span>Hide Weekends</span>
          </label>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const increment = viewMode === 'day' ? 1 : viewMode === 'month' ? 30 : 7;
            setCurrentWeekStart(addDays(currentWeekStart, increment));
          }}
          data-testid="button-next-period"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        <div 
          className="grid border-b bg-muted"
          style={{ gridTemplateColumns: `70px repeat(${weekDays.length}, minmax(0, 1fr))` }}
        >
          <div className="p-2 text-xs font-medium border-r">Time</div>
          {weekDays.map((day, i) => (
            <div key={i} className="p-2 text-xs font-medium text-center">
              <div>{format(day, 'EEE')}</div>
              <div className="text-muted-foreground">{format(day, 'M/d')}</div>
            </div>
          ))}
        </div>
        <div 
          className="select-none"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {timeSlots.map((time, timeIdx) => (
            <div 
              key={timeIdx}
              className="grid border-b last:border-b-0"
              style={{ gridTemplateColumns: `70px repeat(${weekDays.length}, minmax(0, 1fr))` }}
            >
              <div className="p-2 text-xs border-r bg-muted flex items-center justify-center">
                {format(time, 'h a')}
              </div>
              {weekDays.map((day, dayIdx) => {
                const isMatch = isPerfectMatch(day, time);
                const isSelected = isSelectedCell(day, time);
                const isDraggingOver = isDraggingOverCell(day, time);
                const isInitial = isInitialProposal(day, time);
                const hasTenantAvail = isTenantAvailable(day, time);
                const hasJob = hasExistingJob(day, time);
                
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "p-1 border-r last:border-r-0 min-h-[50px] flex items-center justify-center text-xs transition-colors",
                      getCellStyle(day, time),
                      isSelected && "!bg-blue-200 dark:!bg-blue-900",
                      isDraggingOver && isMatch && "!bg-blue-100 dark:!bg-blue-800"
                    )}
                    onMouseDown={() => handleMouseDown(day, time)}
                    onMouseEnter={() => handleMouseEnter(day, time)}
                    data-testid={`cell-${dayIdx}-${timeIdx}`}
                  >
                    {hasJob && hasTenantAvail && !isInitial && (
                      <div className="absolute top-0.5 left-0.5 bg-purple-300 dark:bg-purple-600 text-[9px] px-1 py-0.5 rounded text-white pointer-events-none z-10">
                        Tenant Available
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Time Slot */}
      {selectedSlot && (() => {
        const selectedDurationMinutes = Math.round((selectedSlot.end.getTime() - selectedSlot.start.getTime()) / (1000 * 60));
        const durationMatch = selectedDurationMinutes === jobDurationMinutes;
        
        return (
          <Card className={cn(
            "border-blue-300 bg-blue-50 dark:bg-blue-950",
            !durationMatch && "border-amber-300 bg-amber-50 dark:bg-amber-950"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {durationMatch ? (
                  <Check className="h-5 w-5 text-blue-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                Your New Selection
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
                  className="bg-blue-600 hover:bg-blue-700"
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

    </div>
  );
}
