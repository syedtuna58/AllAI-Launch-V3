import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Filter, Edit2 } from "lucide-react";
import { DndContext, useDraggable, useDroppable, DragOverlay, closestCenter } from '@dnd-kit/core';
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { format, addDays, startOfWeek, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TimeColumn } from "@/components/calendar/TimeColumn";
import { HourlyGrid } from "@/components/calendar/HourlyGrid";
import { calculateTimePosition, isTimeInRange } from "@/lib/calendarUtils";
import { REMINDER_TYPE_COLORS, STATUS_COLORS, CASE_STATUS_COLORS, getReminderStatus, getStatusBadgeClasses, type ReminderType, type CaseStatus } from "@/lib/colorTokens";

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

// DraggableCalendarItem component - wraps calendar items to make them draggable
function DraggableCalendarItem({ 
  id, 
  children, 
  className,
  style 
}: { 
  id: string; 
  children: React.ReactNode; 
  className?: string;
  style?: React.CSSProperties;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
      }
    : {};

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab active:cursor-grabbing", className)}
      style={{ ...style, ...dragStyle }}
    >
      {children}
    </div>
  );
}

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(() => toZonedTime(new Date(), ORG_TIMEZONE));
  const [view, setView] = useState<'week' | 'month'>('week');
  const [filterMode, setFilterMode] = useState<'all' | 'reminders' | 'cases'>('all');
  const [reminderTypeFilter, setReminderTypeFilter] = useState<string>('all');
  const [hideWeekends, setHideWeekends] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Mutation to update reminder date
  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, dueAt }: { id: string; dueAt: string }) => {
      return await apiRequest(`/api/reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ dueAt }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      toast({ title: "Reminder updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update reminder", variant: "destructive" });
    },
  });

  // Mutation to update case date
  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, scheduledDate }: { id: string; scheduledDate: string }) => {
      return await apiRequest(`/api/cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledDate }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({ title: "Maintenance case updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update maintenance case", variant: "destructive" });
    },
  });

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

  // Drag handlers
  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Parse the dragged item ID (format: "reminder:id" or "case:id")
    const [itemType, itemId] = active.id.split(':');
    
    // Parse the drop target ID (format: "day:timestamp" or "hour:timestamp:hour")
    const dropData = over.id.split(':');
    const targetTimestamp = parseInt(dropData[1]);
    
    // Get date string in org timezone (YYYY-MM-DD)
    const dateStr = formatInTimeZone(new Date(targetTimestamp), ORG_TIMEZONE, 'yyyy-MM-dd');
    
    // Determine the hour (either from drop target or midnight)
    const hour = (dropData[0] === 'hour' && dropData[2]) ? parseInt(dropData[2]) : 0;
    const hourStr = hour.toString().padStart(2, '0');
    
    // Build ISO string in org timezone (e.g., "2025-11-09T14:00:00")
    const dateTimeStr = `${dateStr}T${hourStr}:00:00`;
    
    // Convert from org timezone to UTC
    const utcDate = fromZonedTime(dateTimeStr, ORG_TIMEZONE);

    if (itemType === 'reminder') {
      // Find the reminder
      const reminder = reminders.find(r => r.id === itemId);
      if (!reminder) return;

      updateReminderMutation.mutate({ id: itemId, dueAt: utcDate.toISOString() });
    } else if (itemType === 'case') {
      // Find the case
      const caseItem = cases.find(c => c.id === itemId);
      if (!caseItem) return;

      updateCaseMutation.mutate({ id: itemId, scheduledDate: utcDate.toISOString() });
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

            {/* Main Grid: Calendar + Unscheduled Sidebar */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Calendar Card */}
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

                    {view === 'week' && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id="hide-weekends"
                          checked={hideWeekends}
                          onCheckedChange={setHideWeekends}
                          data-testid="toggle-hide-weekends"
                        />
                        <Label htmlFor="hide-weekends" className="text-sm font-medium cursor-pointer">
                          Hide Weekends
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <DndContext
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  collisionDetection={closestCenter}
                >
                  {isLoading ? (
                    <div className="py-12 text-center text-gray-500">Loading...</div>
                  ) : (
                    <>
                      {view === 'week' && <WeekView currentDate={currentDate} getItemsForDate={getItemsForDate} hideWeekends={hideWeekends} />}
                      {view === 'month' && <MonthView currentDate={currentDate} getItemsForDate={getItemsForDate} />}
                    </>
                  )}
                  <DragOverlay>
                    {activeId ? (
                      <div className="p-2 bg-white dark:bg-gray-800 rounded shadow-lg border-2 border-blue-500 opacity-90 cursor-grabbing">
                        <div className="text-xs font-semibold">Moving item...</div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </CardContent>
            </Card>

            {/* Unscheduled Items Sidebar */}
            {(() => {
              const unscheduledReminders = filterMode !== 'cases' 
                ? filteredReminders.filter(r => !r.dueAt) 
                : [];
              const unscheduledCases = filterMode !== 'reminders'
                ? cases.filter(c => !c.scheduledDate)
                : [];
              
              if (unscheduledReminders.length === 0 && unscheduledCases.length === 0) {
                return null;
              }
              
              return (
                <Card className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                  <CardHeader>
                    <CardTitle className="text-sm">Unscheduled Items</CardTitle>
                    <p className="text-xs text-muted-foreground">Items without assigned dates</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {unscheduledReminders.map(reminder => {
                        return (
                          <DraggableCalendarItem
                            key={reminder.id}
                            id={`reminder:${reminder.id}`}
                            className={cn(
                              "p-3 rounded border-l-4 border-gray-400 text-xs hover:shadow-md transition-shadow group",
                              REMINDER_TYPE_COLORS[reminder.type as ReminderType] || REMINDER_TYPE_COLORS.custom
                            )}
                          >
                            <div data-testid={`unscheduled-reminder-${reminder.id}`}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="font-semibold truncate flex-1">{reminder.title}</div>
                                <div className="flex items-center gap-1">
                                  <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    Unscheduled
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-xs opacity-75 capitalize">{reminder.type}</div>
                              {reminder.description && (
                                <div className="text-xs opacity-60 mt-1 line-clamp-2">{reminder.description}</div>
                              )}
                            </div>
                          </DraggableCalendarItem>
                        );
                      })}
                      
                      {unscheduledCases.map(caseItem => (
                        <DraggableCalendarItem
                          key={caseItem.id}
                          id={`case:${caseItem.id}`}
                          className={cn(
                            "p-3 rounded border-l-4 text-xs hover:shadow-md transition-shadow group",
                            (CASE_STATUS_COLORS[caseItem.status] || CASE_STATUS_COLORS.open).bg,
                            (CASE_STATUS_COLORS[caseItem.status] || CASE_STATUS_COLORS.open).border
                          )}
                        >
                          <div data-testid={`unscheduled-case-${caseItem.id}`}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="font-semibold truncate flex-1">{caseItem.title}</div>
                              <div className="flex items-center gap-1">
                                <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                {(caseItem.priority === 'high' || caseItem.priority === 'urgent') && (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                    {caseItem.priority === 'urgent' ? 'Urgent' : 'High'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-xs opacity-75 capitalize">{caseItem.status}</div>
                            {caseItem.description && (
                              <div className="text-xs opacity-60 mt-1 line-clamp-2">{caseItem.description}</div>
                            )}
                          </div>
                        </DraggableCalendarItem>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
            </div>

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Dual-Encoding Color System</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Background colors indicate reminder TYPE or case STATUS • Border colors indicate reminder STATUS or case PRIORITY
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Reminder Types (Background)</p>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[hsl(var(--periwinkle))] rounded"></div>
                      <span className="text-xs">Lease</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[hsl(var(--butter))] rounded"></div>
                      <span className="text-xs">Maintenance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[hsl(var(--petal))] rounded"></div>
                      <span className="text-xs">Regulatory</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[hsl(var(--seafoam))] rounded"></div>
                      <span className="text-xs">Rent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[hsl(var(--sage))] rounded"></div>
                      <span className="text-xs">Mortgage / Insurance / Tax / HOA</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Reminder Status (Border)</p>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-4 border-red-500 rounded bg-white dark:bg-gray-800"></div>
                      <span className="text-xs">Overdue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-4 border-orange-500 rounded bg-white dark:bg-gray-800"></div>
                      <span className="text-xs">Due Soon (≤7 days)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-4 border-blue-500 rounded bg-white dark:bg-gray-800"></div>
                      <span className="text-xs">Upcoming</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-4 border-green-500 rounded bg-white dark:bg-gray-800"></div>
                      <span className="text-xs">Completed</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Case Status (Background)</p>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-100 border border-yellow-500 rounded"></div>
                      <span className="text-xs">Open</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-100 border border-blue-500 rounded"></div>
                      <span className="text-xs">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-100 border border-gray-500 rounded"></div>
                      <span className="text-xs">On Hold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-100 border border-green-500 rounded"></div>
                      <span className="text-xs">Resolved / Closed</span>
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

function WeekView({ currentDate, getItemsForDate, hideWeekends = false }: {
  currentDate: Date;
  getItemsForDate: (date: Date) => { reminders: Reminder[]; cases: MaintenanceCase[] };
  hideWeekends?: boolean;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const allWeekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Filter out weekends if hideWeekends is true (0 = Sunday, 6 = Saturday)
  const weekDays = hideWeekends 
    ? allWeekDays.filter(day => {
        const dayOfWeek = day.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
      })
    : allWeekDays;
  
  const today = new Date();
  
  const START_HOUR = 6;  // 6 AM
  const END_HOUR = 20;   // 8 PM
  const HOUR_HEIGHT = 60; // pixels

  return (
    <div className="grid grid-cols-[80px_1fr] gap-0 border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Time labels column */}
      <TimeColumn startHour={START_HOUR} endHour={END_HOUR} hourHeight={HOUR_HEIGHT} />
      
      {/* Week grid */}
      <div className={cn("grid", weekDays.length === 5 ? "grid-cols-5" : "grid-cols-7")}>
        {weekDays.map((day, idx) => {
          const { reminders, cases } = getItemsForDate(day);
          const isToday = isSameDay(day, today);

          return (
            <HourlyGrid
              key={idx}
              day={day}
              dayIndex={idx}
              isToday={isToday}
              startHour={START_HOUR}
              endHour={END_HOUR}
              hourHeight={HOUR_HEIGHT}
              className={idx < weekDays.length - 1 ? "border-r border-border dark:border-gray-700" : ""}
            >
              {(() => {
                // Separate all-day and timed items
                const allDayItems: Array<{type: 'reminder' | 'case', item: Reminder | MaintenanceCase}> = [];
                const timedItems: Array<{type: 'reminder' | 'case', item: Reminder | MaintenanceCase, time: Date}> = [];
                
                reminders.forEach(reminder => {
                  const dueDate = new Date(reminder.dueAt);
                  const hours = dueDate.getHours();
                  const minutes = dueDate.getMinutes();
                  
                  if (hours === 0 && minutes === 0) {
                    allDayItems.push({ type: 'reminder', item: reminder });
                  } else if (isTimeInRange(dueDate, START_HOUR, END_HOUR)) {
                    timedItems.push({ type: 'reminder', item: reminder, time: dueDate });
                  }
                });
                
                cases.forEach(caseItem => {
                  if (!caseItem.scheduledDate) return;
                  const schedDate = new Date(caseItem.scheduledDate);
                  const hours = schedDate.getHours();
                  const minutes = schedDate.getMinutes();
                  
                  if (hours === 0 && minutes === 0) {
                    allDayItems.push({ type: 'case', item: caseItem });
                  } else if (isTimeInRange(schedDate, START_HOUR, END_HOUR)) {
                    timedItems.push({ type: 'case', item: caseItem, time: schedDate });
                  }
                });
                
                return (
                  <>
                    {/* Render all-day items stacked at top */}
                    {allDayItems.slice(0, 3).map(({ type, item }, stackIndex) => {
                      if (type === 'reminder') {
                        const reminder = item as Reminder;
                        const status = getReminderStatus(reminder.dueAt, reminder.completedAt);
                        const typeColor = REMINDER_TYPE_COLORS[reminder.type as ReminderType] || REMINDER_TYPE_COLORS.custom;
                        const statusBorder = STATUS_COLORS[status]?.border || STATUS_COLORS.upcoming.border;
                        return (
                          <DraggableCalendarItem
                            key={`allday-reminder-${reminder.id}`}
                            id={`reminder:${reminder.id}`}
                            className={cn(
                              "absolute left-1 right-1 p-1.5 rounded border-l-4 text-xs hover:shadow-md transition-shadow z-10 group",
                              typeColor,
                              statusBorder
                            )}
                            style={{ top: `${2 + stackIndex * 36}px`, minHeight: '32px' }}
                          >
                            <div data-testid={`reminder-${reminder.id}`}>
                              <div className="flex items-center justify-between gap-1">
                                <div className="font-semibold truncate flex-1">{reminder.title}</div>
                                <div className="flex items-center gap-1">
                                  <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`edit-reminder-${reminder.id}`} />
                                  <Badge className={cn("text-[10px] px-1 py-0", getStatusBadgeClasses(status))} data-testid={`badge-${status}`}>
                                    {status === 'overdue' ? 'Overdue' : status === 'due_soon' ? 'Due Soon' : status === 'upcoming' ? 'Upcoming' : 'Done'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </DraggableCalendarItem>
                        );
                      } else {
                        const caseItem = item as MaintenanceCase;
                        const caseColors = CASE_STATUS_COLORS[caseItem.status] || CASE_STATUS_COLORS.open;
                        return (
                          <DraggableCalendarItem
                            key={`allday-case-${caseItem.id}`}
                            id={`case:${caseItem.id}`}
                            className={cn(
                              "absolute left-1 right-1 p-1.5 rounded border-l-4 text-xs hover:shadow-md transition-shadow z-10 group",
                              caseColors.bg,
                              caseColors.border
                            )}
                            style={{ top: `${2 + stackIndex * 36}px`, minHeight: '32px' }}
                          >
                            <div data-testid={`case-${caseItem.id}`}>
                              <div className="flex items-center justify-between gap-1">
                                <div className="font-semibold truncate flex-1">{caseItem.title}</div>
                                <div className="flex items-center gap-1">
                                  <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`edit-case-${caseItem.id}`} />
                                  {(caseItem.priority === 'high' || caseItem.priority === 'urgent') && (
                                    <Badge variant="destructive" className="text-[10px] px-1 py-0" data-testid={`badge-${caseItem.priority}`}>
                                      {caseItem.priority === 'urgent' ? 'Urgent' : 'High'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DraggableCalendarItem>
                        );
                      }
                    })}
                    
                    {/* Show overflow count for all-day items */}
                    {allDayItems.length > 3 && (
                      <div className="absolute top-[110px] left-1 right-1 text-xs text-muted-foreground text-center">
                        +{allDayItems.length - 3} more
                      </div>
                    )}
                    
                    {/* Render timed items positioned by time */}
                    {timedItems.map(({ type, item, time }) => {
                      const topPosition = calculateTimePosition(time, START_HOUR, HOUR_HEIGHT);
                      
                      if (type === 'reminder') {
                        const reminder = item as Reminder;
                        const status = getReminderStatus(reminder.dueAt, reminder.completedAt);
                        const typeColor = REMINDER_TYPE_COLORS[reminder.type as ReminderType] || REMINDER_TYPE_COLORS.custom;
                        const statusBorder = STATUS_COLORS[status]?.border || STATUS_COLORS.upcoming.border;
                        return (
                          <DraggableCalendarItem
                            key={`timed-reminder-${reminder.id}`}
                            id={`reminder:${reminder.id}`}
                            className={cn(
                              "absolute left-1 right-1 p-2 rounded border-l-4 text-xs hover:shadow-md transition-shadow z-10 group",
                              typeColor,
                              statusBorder
                            )}
                            style={{ top: `${topPosition}px`, minHeight: '50px' }}
                          >
                            <div data-testid={`reminder-${reminder.id}`}>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="font-semibold truncate flex-1">{reminder.title}</div>
                                <div className="flex items-center gap-1">
                                  <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`edit-reminder-${reminder.id}`} />
                                  <Badge className={cn("text-[10px] px-1 py-0", getStatusBadgeClasses(status))} data-testid={`badge-${status}`}>
                                    {status === 'overdue' ? 'Overdue' : status === 'due_soon' ? 'Due Soon' : status === 'upcoming' ? 'Upcoming' : 'Done'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-xs opacity-75">{format(time, 'h:mm a')}</div>
                              <div className="text-xs opacity-75 capitalize">{reminder.type}</div>
                            </div>
                          </DraggableCalendarItem>
                        );
                      } else {
                        const caseItem = item as MaintenanceCase;
                        const caseColors = CASE_STATUS_COLORS[caseItem.status] || CASE_STATUS_COLORS.open;
                        return (
                          <DraggableCalendarItem
                            key={`timed-case-${caseItem.id}`}
                            id={`case:${caseItem.id}`}
                            className={cn(
                              "absolute left-1 right-1 p-2 rounded border-l-4 text-xs hover:shadow-md transition-shadow z-10 group",
                              caseColors.bg,
                              caseColors.border
                            )}
                            style={{ top: `${topPosition}px`, minHeight: '50px' }}
                          >
                            <div data-testid={`case-${caseItem.id}`}>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="font-semibold truncate flex-1">{caseItem.title}</div>
                                <div className="flex items-center gap-1">
                                  <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`edit-case-${caseItem.id}`} />
                                  {(caseItem.priority === 'high' || caseItem.priority === 'urgent') && (
                                    <Badge variant="destructive" className="text-[10px] px-1 py-0" data-testid={`badge-${caseItem.priority}`}>
                                      {caseItem.priority === 'urgent' ? 'Urgent' : 'High'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs opacity-75">{format(time, 'h:mm a')}</div>
                              <div className="text-xs opacity-75 capitalize">{caseItem.status}</div>
                            </div>
                          </DraggableCalendarItem>
                        );
                      }
                    })}
                  </>
                );
              })()}
            </HourlyGrid>
          );
        })}
      </div>
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
                {reminders.slice(0, 2).map(reminder => {
                  const status = getReminderStatus(reminder.dueAt, reminder.completedAt);
                  return (
                  <div
                    key={reminder.id}
                    className={cn(
                      "w-full h-1 rounded",
                      status === 'overdue' && "bg-red-500",
                      status === 'due_soon' && "bg-orange-500",
                      status === 'upcoming' && "bg-blue-500",
                      status === 'completed' && "bg-green-500"
                    )}
                    title={reminder.title}
                  />
                  );
                })}
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
