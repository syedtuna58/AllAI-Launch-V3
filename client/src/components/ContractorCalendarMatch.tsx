import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
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
  onAccept: (slotIndex: number) => void;
  onReject: () => void;
  isPending: boolean;
}

export default function ContractorCalendarMatch({
  counterProposalId,
  proposedSlots,
  scheduledJobs,
  currentJobId,
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
    } else if (hasTenantAvail && hasJob) {
      return "bg-blue-50 dark:bg-blue-950 border-blue-300 opacity-60";
    } else if (hasTenantAvail) {
      return "bg-blue-100 dark:bg-blue-900 border-blue-300";
    } else if (hasJob) {
      return "bg-gray-100 dark:bg-gray-800 border-gray-300";
    }
    
    return "bg-white dark:bg-gray-900 border-gray-200";
  };

  // Rank slots by best match
  const rankedSlots = tenantSlots.map((slot, index) => {
    const slotStart = slot.start;
    const slotEnd = slot.end;
    
    // Count how many hour blocks are perfect matches
    let perfectMatchHours = 0;
    let current = slotStart;
    
    while (current < slotEnd) {
      if (!hasExistingJob(current, new Date(2000, 0, 1, current.getHours(), 0))) {
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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900 border border-green-400 rounded"></div>
          <span>Perfect Match (Both Available)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 rounded"></div>
          <span>Tenant Available (You're Free)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 dark:bg-blue-950 border border-blue-300 rounded opacity-60"></div>
          <span>Tenant Available (You Have Job)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 rounded"></div>
          <span>Your Scheduled Job</span>
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
        <div className="max-h-[600px] overflow-y-auto">
          {timeSlots.map((time, timeIdx) => (
            <div key={timeIdx} className="grid grid-cols-8 border-b last:border-b-0">
              <div className="p-2 text-xs border-r bg-muted flex items-center justify-center">
                {format(time, 'h a')}
              </div>
              {weekDays.map((day, dayIdx) => {
                const slotIndex = getTenantSlotIndex(day, time);
                const isMatch = isPerfectMatch(day, time);
                
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "p-1 border-r last:border-r-0 min-h-[50px] flex items-center justify-center text-xs transition-colors",
                      getCellStyle(day, time)
                    )}
                    onClick={() => isMatch && slotIndex >= 0 && onAccept(slotIndex)}
                    data-testid={`cell-${dayIdx}-${timeIdx}`}
                  >
                    {isMatch && slotIndex >= 0 && (
                      <div className="flex flex-col items-center gap-1">
                        <Check className="h-3 w-3 text-green-600" />
                        <span className="text-[10px] font-medium">Click to accept</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* All Proposed Slots */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Tenant Proposed Times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {proposedSlots.map((slot, index) => {
            const matchInfo = rankedSlots.find(r => r.index === index);
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">
                    {formatInTimeZone(parseISO(slot.startAt), TIMEZONE, "EEE, MMM d 'at' h:mm a")} - {formatInTimeZone(parseISO(slot.endAt), TIMEZONE, "h:mm a")}
                  </div>
                  {matchInfo && matchInfo.perfectMatchHours > 0 && (
                    <div className="text-sm text-green-600">
                      ✓ {matchInfo.perfectMatchHours}h available
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => onAccept(index)}
                  disabled={isPending}
                  variant={matchInfo && matchInfo.perfectMatchHours > 0 ? "default" : "outline"}
                  data-testid={`button-accept-list-${index}`}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Accept
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
