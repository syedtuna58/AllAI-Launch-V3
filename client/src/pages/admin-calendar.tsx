import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { format, addDays, startOfWeek, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Reminder = {
  id: string;
  orgId: string;
  userId: string | null;
  propertyId: string | null;
  entityId: string | null;
  unitId: string | null;
  title: string;
  description: string | null;
  type: 'rent' | 'lease' | 'maintenance' | 'regulatory' | 'custom' | 'mortgage' | 'insurance' | 'property_tax' | 'hoa' | 'permit';
  dueAt: string;
  completedAt: string | null;
  priority: 'low' | 'medium' | 'high';
  recurring: boolean;
  recurringInterval: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  amount: number | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
};

type MaintenanceCase = {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  propertyId: string | null;
  unitId: string | null;
  category: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  orgId: string;
  createdAt: string;
  updatedAt: string;
};

const ORG_TIMEZONE = 'America/New_York';

// Status-based color coding
const REMINDER_STATUS_COLORS = {
  overdue: 'bg-red-100 border-red-500 text-red-900 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300',
  dueSoon: 'bg-orange-100 border-orange-500 text-orange-900 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300',
  upcoming: 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300',
  completed: 'bg-green-100 border-green-500 text-green-900 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300',
};

const CASE_STATUS_COLORS = {
  open: 'bg-yellow-100 border-yellow-500 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300',
  in_progress: 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300',
  on_hold: 'bg-gray-100 border-gray-500 text-gray-900 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-300',
  resolved: 'bg-green-100 border-green-500 text-green-900 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300',
  closed: 'bg-slate-100 border-slate-500 text-slate-900 dark:bg-slate-900/20 dark:border-slate-700 dark:text-slate-300',
};

function getReminderStatus(reminder: Reminder): 'overdue' | 'dueSoon' | 'upcoming' | 'completed' {
  if (reminder.completedAt) return 'completed';
  
  const now = new Date();
  const dueDate = new Date(reminder.dueAt);
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'dueSoon';
  return 'upcoming';
}

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(() => toZonedTime(new Date(), ORG_TIMEZONE));
  const [view, setView] = useState<'week' | 'month'>('week');
  const [filterMode, setFilterMode] = useState<'all' | 'reminders' | 'cases'>('all');
  const [reminderTypeFilter, setReminderTypeFilter] = useState<string>('all');

  // Fetch reminders
  const { data: reminders = [], isLoading: remindersLoading } = useQuery<Reminder[]>({
    queryKey: ['/api/reminders'],
    enabled: !!user,
  });

  // Fetch maintenance cases
  const { data: cases = [], isLoading: casesLoading } = useQuery<MaintenanceCase[]>({
    queryKey: ['/api/cases'],
    enabled: !!user,
  });

  const isLoading = remindersLoading || casesLoading;

  // Filter reminders by type
  const filteredReminders = reminderTypeFilter === 'all' 
    ? reminders 
    : reminders.filter(r => r.type === reminderTypeFilter);

  // Navigation handlers
  const goToPrevious = () => {
    setCurrentDate(prev => view === 'week' ? addWeeks(prev, -1) : addMonths(prev, -1));
  };

  const goToNext = () => {
    setCurrentDate(prev => view === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(toZonedTime(new Date(), ORG_TIMEZONE));
  };

  // Get current view title
  const getViewTitle = () => {
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayReminders = filterMode !== 'cases' ? filteredReminders.filter(r => {
      const dueDate = new Date(r.dueAt);
      return dueDate >= dayStart && dueDate <= dayEnd;
    }) : [];

    const dayCases = filterMode !== 'reminders' ? cases.filter(c => {
      if (!c.scheduledDate) return false;
      const schedDate = new Date(c.scheduledDate);
      return schedDate >= dayStart && schedDate <= dayEnd;
    }) : [];

    return { reminders: dayReminders, cases: dayCases };
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Admin Calendar" />
          <main className="flex-1 overflow-y-auto p-8">
            <p>Please log in to view the admin calendar.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Admin Calendar" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  Admin Calendar
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  View and manage reminders and maintenance cases
                </p>
              </div>
            </div>

            {/* Calendar Controls */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  {/* Navigation */}
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={goToPrevious}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToToday}>
                      Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToNext}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-semibold ml-2">{getViewTitle()}</span>
                  </div>

                  {/* View and Filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={view} onValueChange={(v: any) => setView(v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterMode} onValueChange={(v: any) => setFilterMode(v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Items</SelectItem>
                        <SelectItem value="reminders">Reminders Only</SelectItem>
                        <SelectItem value="cases">Cases Only</SelectItem>
                      </SelectContent>
                    </Select>

                    {filterMode !== 'cases' && (
                      <Select value={reminderTypeFilter} onValueChange={setReminderTypeFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="rent">Rent</SelectItem>
                          <SelectItem value="lease">Lease</SelectItem>
                          <SelectItem value="mortgage">Mortgage</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem>
                          <SelectItem value="property_tax">Property Tax</SelectItem>
                          <SelectItem value="hoa">HOA</SelectItem>
                          <SelectItem value="permit">Permit</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="regulatory">Regulatory</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isLoading ? (
                  <div className="py-12 text-center text-gray-500">Loading...</div>
                ) : (
                  <>
                    {view === 'week' && <WeekView currentDate={currentDate} getItemsForDate={getItemsForDate} />}
                    {view === 'month' && <MonthView currentDate={currentDate} getItemsForDate={getItemsForDate} />}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Color Legend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Reminders:</p>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-sm">Overdue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded"></div>
                      <span className="text-sm">Due Soon (≤7 days)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-sm">Upcoming</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">Completed</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Maintenance Cases:</p>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                      <span className="text-sm">Open</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-sm">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-500 rounded"></div>
                      <span className="text-sm">On Hold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">Resolved</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

function WeekView({ currentDate, getItemsForDate }: {
  currentDate: Date;
  getItemsForDate: (date: Date) => { reminders: Reminder[]; cases: MaintenanceCase[] };
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day, idx) => {
        const { reminders, cases } = getItemsForDate(day);
        const isToday = isSameDay(day, today);

        return (
          <div key={idx} className="min-h-[200px]">
            <div className={cn(
              "text-center p-2 font-semibold mb-2 rounded",
              isToday ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"
            )}>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {format(day, 'EEE')}
              </div>
              <div className="text-lg">
                {format(day, 'd')}
              </div>
            </div>

            <div className="space-y-1">
              {reminders.map(reminder => (
                <div
                  key={reminder.id}
                  className={cn(
                    "p-2 rounded border text-xs cursor-pointer hover:shadow-md transition-shadow",
                    REMINDER_STATUS_COLORS[getReminderStatus(reminder)]
                  )}
                  data-testid={`reminder-${reminder.id}`}
                >
                  <div className="font-semibold truncate">{reminder.title}</div>
                  <div className="text-xs opacity-75 capitalize">{reminder.type}</div>
                </div>
              ))}

              {cases.map(caseItem => (
                <div
                  key={caseItem.id}
                  className={cn(
                    "p-2 rounded border text-xs cursor-pointer hover:shadow-md transition-shadow",
                    CASE_STATUS_COLORS[caseItem.status]
                  )}
                  data-testid={`case-${caseItem.id}`}
                >
                  <div className="font-semibold truncate">{caseItem.title}</div>
                  <div className="text-xs opacity-75 capitalize">{caseItem.status}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ currentDate, getItemsForDate }: {
  currentDate: Date;
  getItemsForDate: (date: Date) => { reminders: Reminder[]; cases: MaintenanceCase[] };
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 0 }), 6);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = new Date();

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-sm text-gray-600 dark:text-gray-400 p-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, idx) => {
          const { reminders, cases } = getItemsForDate(day);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[100px] p-2 rounded border",
                isToday ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
                !isCurrentMonth && "opacity-40"
              )}
            >
              <div className={cn(
                "text-sm font-semibold mb-1",
                isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"
              )}>
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {reminders.slice(0, 2).map(reminder => (
                  <div
                    key={reminder.id}
                    className={cn(
                      "w-full h-1 rounded",
                      getReminderStatus(reminder) === 'overdue' && "bg-red-500",
                      getReminderStatus(reminder) === 'dueSoon' && "bg-orange-500",
                      getReminderStatus(reminder) === 'upcoming' && "bg-blue-500",
                      getReminderStatus(reminder) === 'completed' && "bg-green-500"
                    )}
                    title={reminder.title}
                  />
                ))}
                {cases.slice(0, 2).map(caseItem => (
                  <div
                    key={caseItem.id}
                    className={cn(
                      "w-full h-1 rounded",
                      caseItem.status === 'open' && "bg-yellow-500",
                      caseItem.status === 'in_progress' && "bg-blue-500",
                      caseItem.status === 'on_hold' && "bg-gray-500",
                      caseItem.status === 'resolved' && "bg-green-500"
                    )}
                    title={caseItem.title}
                  />
                ))}
                {(reminders.length + cases.length > 4) && (
                  <div className="text-xs text-gray-500">+{reminders.length + cases.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
