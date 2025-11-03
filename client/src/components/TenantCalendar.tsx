import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, Calendar } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

interface ScheduledJob {
  id: string;
  title: string;
  description: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  status: string;
  urgency: string;
  caseId: string | null;
  notes: string | null;
}

interface TenantCase {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
}

interface TenantCalendarProps {
  scheduledJobs: ScheduledJob[];
  myCases: TenantCase[];
  onJobClick: (job: ScheduledJob) => void;
}

const TIMEZONE = 'America/New_York';
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM to 8 PM

export default function TenantCalendar({ scheduledJobs, myCases, onJobClick }: TenantCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const nowInTz = toZonedTime(new Date(), TIMEZONE);
    return startOfWeek(nowInTz, { weekStartsOn: 1 });
  });

  // Get my case IDs for filtering
  const myCaseIds = new Set(myCases.map(c => c.id));

  // Filter jobs to only show those linked to my cases
  const myJobs = scheduledJobs.filter(job => 
    job.scheduledStartAt && job.caseId && myCaseIds.has(job.caseId)
  );

  // Get week days (Monday-Sunday) in America/New_York timezone
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePreviousWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7));
  };

  const getJobsForDayAndHour = (day: Date, hour: number) => {
    return myJobs.filter(job => {
      if (!job.scheduledStartAt || !job.scheduledEndAt) return false;

      // Parse job times
      const jobStart = parseISO(job.scheduledStartAt);
      const jobEnd = parseISO(job.scheduledEndAt);

      // Convert to organization timezone for display
      const jobStartInTz = toZonedTime(jobStart, TIMEZONE);
      const jobEndInTz = toZonedTime(jobEnd, TIMEZONE);

      // Check if job is on this day
      if (!isSameDay(jobStartInTz, day)) return false;

      // Check if job overlaps with this hour
      const jobStartHour = jobStartInTz.getHours();
      const jobEndHour = jobEndInTz.getHours();
      const jobStartMinute = jobStartInTz.getMinutes();
      const jobEndMinute = jobEndInTz.getMinutes();

      // Job overlaps if it starts before this hour ends and ends after this hour starts
      const hourEnd = hour + 1;
      const jobStartsBeforeHourEnds = jobStartHour < hourEnd || (jobStartHour === hourEnd && jobStartMinute === 0);
      const jobEndsAfterHourStarts = jobEndHour > hour || (jobEndHour === hour && jobEndMinute > 0);

      return jobStartsBeforeHourEnds && jobEndsAfterHourStarts;
    });
  };

  const formatJobTime = (startTime: string, endTime: string) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    
    return `${formatInTimeZone(start, TIMEZONE, 'h:mm a')} - ${formatInTimeZone(end, TIMEZONE, 'h:mm a')}`;
  };

  const isPendingApproval = (job: ScheduledJob) => {
    return job.status === 'Pending Approval';
  };

  const isScheduledOrConfirmed = (job: ScheduledJob) => {
    return job.status === 'Scheduled' || job.status === 'Confirmed';
  };

  return (
    <Card data-testid="tenant-calendar">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Service Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousWeek}
              data-testid="button-previous-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {formatInTimeZone(currentWeekStart, TIMEZONE, 'MMM d')} - {formatInTimeZone(addDays(currentWeekStart, 6), TIMEZONE, 'MMM d, yyyy')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextWeek}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header with day names */}
            <div className="grid grid-cols-8 border-b">
              <div className="p-2 text-xs font-medium text-muted-foreground">Time</div>
              {weekDays.map((day, i) => {
                const todayInTz = toZonedTime(new Date(), TIMEZONE);
                const isTodayInTz = isSameDay(day, todayInTz);
                
                return (
                  <div
                    key={i}
                    className={cn(
                      "p-2 text-center border-l",
                      isTodayInTz && "bg-primary/5"
                    )}
                    data-testid={`calendar-day-${i}`}
                  >
                    <div className={cn(
                      "text-xs font-medium",
                      isTodayInTz && "text-primary"
                    )}>
                      {formatInTimeZone(day, TIMEZONE, 'EEE M/d')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time slots */}
            {HOURS.map((hour) => {
              const hourDate = new Date(2025, 0, 1, hour, 0, 0, 0);
              return (
              <div key={hour} className="grid grid-cols-8 border-b min-h-[60px]">
                {/* Hour label */}
                <div className="p-2 text-xs text-muted-foreground border-r">
                  {formatInTimeZone(hourDate, TIMEZONE, 'h:mm a')}
                </div>

                {/* Day columns */}
                {weekDays.map((day, dayIndex) => {
                  const jobs = getJobsForDayAndHour(day, hour);
                  const isFirstHourForJobs = jobs.filter(job => {
                    if (!job.scheduledStartAt) return false;
                    const jobStart = toZonedTime(parseISO(job.scheduledStartAt), TIMEZONE);
                    return jobStart.getHours() === hour;
                  });
                  
                  const todayInTz = toZonedTime(new Date(), TIMEZONE);
                  const isTodayInTz = isSameDay(day, todayInTz);

                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        "p-1 border-l relative",
                        isTodayInTz && "bg-primary/5"
                      )}
                      data-testid={`calendar-cell-${dayIndex}-${hour}`}
                    >
                      {/* Only render job cards at their start hour to avoid duplicates */}
                      {isFirstHourForJobs.map(job => (
                        <button
                          key={job.id}
                          onClick={() => onJobClick(job)}
                          className={cn(
                            "w-full text-left p-2 rounded-md border text-xs mb-1 transition-all hover:shadow-md",
                            isPendingApproval(job) 
                              ? "bg-muted/50 border-muted opacity-50" 
                              : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                          )}
                          data-testid={`job-card-${job.id}`}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-semibold line-clamp-1">{job.title}</span>
                            {isPendingApproval(job) ? (
                              <Badge 
                                variant="outline" 
                                className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700 text-[10px] px-1 py-0 shrink-0"
                                data-testid={`badge-proposed-${job.id}`}
                              >
                                Proposed
                              </Badge>
                            ) : isScheduledOrConfirmed(job) ? (
                              <Check className="h-3 w-3 text-green-600 shrink-0" data-testid={`icon-confirmed-${job.id}`} />
                            ) : null}
                          </div>
                          {job.scheduledStartAt && job.scheduledEndAt && (
                            <div className="text-[10px] text-muted-foreground">
                              {formatJobTime(job.scheduledStartAt, job.scheduledEndAt)}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"></div>
            <span>Scheduled</span>
            <Check className="h-3 w-3 text-green-600 ml-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted/50 border border-muted opacity-50"></div>
            <span>Pending Approval</span>
            <Badge 
              variant="outline" 
              className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700 text-[10px] px-1 py-0 ml-1"
            >
              Proposed
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
