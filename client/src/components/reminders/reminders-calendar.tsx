import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reminder } from "@shared/schema";

interface RemindersCalendarProps {
  reminders: Reminder[];
  onDateClick: (date: Date) => void;
}

export default function RemindersCalendar({ reminders, onDateClick }: RemindersCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Get calendar data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Calculate calendar grid
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  // Day names
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build calendar days array
  const calendarDays: (number | null)[] = [];
  
  // Add empty slots for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Helper function to check if a date matches a reminder
  const getRemindersForDate = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    return reminders.filter(reminder => {
      const reminderDate = new Date(reminder.dueAt);
      return (
        reminderDate.getFullYear() === dateToCheck.getFullYear() &&
        reminderDate.getMonth() === dateToCheck.getMonth() &&
        reminderDate.getDate() === dateToCheck.getDate()
      );
    });
  };

  // Helper function to categorize reminders by status
  const categorizeReminders = (dayReminders: Reminder[]) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const overdue: Reminder[] = [];
    const dueSoon: Reminder[] = [];
    const upcoming: Reminder[] = [];

    dayReminders.forEach(reminder => {
      const reminderDate = new Date(reminder.dueAt);
      
      if (reminder.status === "Overdue") {
        overdue.push(reminder);
      } else if (reminder.status === "Pending" && reminderDate <= thirtyDaysFromNow) {
        dueSoon.push(reminder);
      } else if (reminder.status === "Pending") {
        upcoming.push(reminder);
      }
    });

    return { overdue, dueSoon, upcoming };
  };

  // Check if a date is today
  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  return (
    <Card data-testid="calendar-reminders">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold" data-testid="text-calendar-month">
            {monthName}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day names header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
              data-testid={`text-day-${day.toLowerCase()}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className="aspect-square"
                  data-testid={`calendar-empty-${index}`}
                />
              );
            }

            const dayReminders = getRemindersForDate(day);
            const { overdue, dueSoon, upcoming } = categorizeReminders(dayReminders);
            const hasReminders = dayReminders.length > 0;
            const today = isToday(day);

            return (
              <button
                key={day}
                onClick={() => hasReminders && onDateClick(new Date(year, month, day))}
                className={`
                  aspect-square p-1 rounded-md text-sm transition-colors relative
                  ${today ? "bg-primary text-primary-foreground font-semibold" : ""}
                  ${!today && hasReminders ? "hover:bg-muted cursor-pointer" : ""}
                  ${!today && !hasReminders ? "text-muted-foreground cursor-default" : ""}
                  ${!today && !hasReminders ? "hover:bg-muted/50" : ""}
                `}
                disabled={!hasReminders}
                data-testid={`calendar-day-${day}`}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={today ? "text-primary-foreground" : ""}>{day}</span>
                  
                  {/* Reminder dots */}
                  {hasReminders && (
                    <div className="flex gap-0.5 mt-1" data-testid={`calendar-dots-${day}`}>
                      {overdue.length > 0 && (
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-red-500"
                          data-testid={`dot-overdue-${day}`}
                          title={`${overdue.length} overdue`}
                        />
                      )}
                      {dueSoon.length > 0 && (
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-yellow-500"
                          data-testid={`dot-due-soon-${day}`}
                          title={`${dueSoon.length} due soon`}
                        />
                      )}
                      {upcoming.length > 0 && (
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-blue-500"
                          data-testid={`dot-upcoming-${day}`}
                          title={`${upcoming.length} upcoming`}
                        />
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Overdue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Due Soon (30 days)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Upcoming</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
