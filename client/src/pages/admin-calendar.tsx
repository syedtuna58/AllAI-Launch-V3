import { useState } from "react";
import { filterCasesByStatus, type StatusFilterKey } from "@/lib/work-order-filters";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Filter, Edit2, Check, X } from "lucide-react";
import { DndContext, useDraggable, useDroppable, DragOverlay, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ReminderForm from "@/components/forms/reminder-form";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import WorkOrderCard from "@/components/cards/work-order-card";
import { formatWorkOrderLocation } from "@/lib/formatters";
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
import type { Reminder } from "@shared/schema";
import AvailabilityCalendar from "@/components/contractor/availability-calendar";

type MaintenanceCase = {
  id: string;
  title: string;
  description: string | null;
  status: "New" | "In Review" | "Scheduled" | "In Progress" | "On Hold" | "Resolved" | "Closed" | null;
  priority: "Low" | "Medium" | "High" | "Urgent" | null;
  propertyId: string | null;
  unitId: string | null;
  category: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  completedDate: string | null;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  scheduledJobs?: Array<{
    id: string;
    teamId?: string | null;
    teamName?: string | null;
    teamColor?: string | null;
    teamSpecialty?: string | null;
  }>;
};

const ORG_TIMEZONE = 'America/New_York';

// DraggableCalendarItem component - wraps calendar items to make them draggable
function DraggableCalendarItem({ 
  id, 
  children, 
  className,
  style,
  disabled = false
}: { 
  id: string; 
  children: React.ReactNode; 
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
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
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      className={cn(disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing", className)}
      style={{ ...style, ...dragStyle }}
    >
      {children}
    </div>
  );
}

// UnscheduledDropZone component - makes the unscheduled section droppable
function UnscheduledDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled',
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="unscheduled-drop-zone"
      className={cn(
        "space-y-3 min-h-[100px] p-2 rounded transition-colors",
        isOver && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500"
      )}
      style={{ position: 'relative', zIndex: 1 }}
    >
      {children}
      {/* Invisible overlay to catch drops over draggable children */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          pointerEvents: 'none',
          zIndex: -1
        }} 
      />
    </div>
  );
}

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const role = user?.primaryRole;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(() => toZonedTime(new Date(), ORG_TIMEZONE));
  const [view, setView] = useState<'week' | 'month'>('week');
  const [filterMode, setFilterMode] = useState<'all' | 'reminders' | 'cases'>('all');
  const [reminderTypeFilter, setReminderTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('active');
  const [hideWeekends, setHideWeekends] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Fetch reminders
  const { data: reminders = [], isLoading: remindersLoading } = useQuery<Reminder[]>({
    queryKey: ['/api/reminders'],
    enabled: !!user,
  });

  // Fetch contractor profile if needed
  const { data: contractorProfile } = useQuery<any>({
    queryKey: ["/api/contractors/me"],
    enabled: role === "contractor",
    retry: false,
  });

  // Fetch teams for the current contractor
  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["/api/teams"],
    enabled: role === "contractor",
    retry: false,
  });

  // Fetch maintenance cases - use contractor endpoint for contractors
  const casesEndpoint = role === 'contractor' ? '/api/contractor/cases' : '/api/cases';
  const { data: cases = [], isLoading: casesLoading } = useQuery<MaintenanceCase[]>({
    queryKey: [casesEndpoint],
    enabled: !!user,
  });

  const isLoading = remindersLoading || casesLoading;

  // Mutation to update reminder date with optimistic updates
  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, dueAt }: { id: string; dueAt: string | null }) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, { dueAt });
    },
    onMutate: async ({ id, dueAt }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/reminders'] });
      
      // Snapshot the previous value
      const previousReminders = queryClient.getQueryData<Reminder[]>(['/api/reminders']);
      
      // Optimistically update the cache
      if (previousReminders) {
        queryClient.setQueryData<Reminder[]>(['/api/reminders'], (old) => 
          old?.map(reminder => 
            reminder.id === id 
              ? { ...reminder, dueAt: dueAt || null }
              : reminder
          ) || []
        );
      }
      
      // Return context with snapshot for rollback
      return { previousReminders };
    },
    onSuccess: (data) => {
      // Update cache with server response to ensure consistency
      queryClient.setQueryData<Reminder[]>(['/api/reminders'], (old) => 
        old?.map(reminder => 
          reminder.id === data.id ? data : reminder
        ) || []
      );
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousReminders) {
        queryClient.setQueryData(['/api/reminders'], context.previousReminders);
      }
      toast({ title: "Failed to update reminder", variant: "destructive" });
      // Invalidate on error to refetch correct state
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
    },
  });

  // Mutation to update case date with optimistic updates
  const canReschedule = true; // Allow all users to reschedule via drag and drop
  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, scheduledStartAt, scheduledEndAt }: { id: string; scheduledStartAt: string | null; scheduledEndAt?: string | null }) => {
      console.log('🚀 Frontend mutation called with:', { id, scheduledStartAt, scheduledEndAt });
      return await apiRequest('PATCH', `/api/cases/${id}`, { scheduledStartAt, scheduledEndAt });
    },
    onMutate: async ({ id, scheduledStartAt, scheduledEndAt }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: [casesEndpoint] });
      
      // Snapshot the previous value
      const previousCases = queryClient.getQueryData<MaintenanceCase[]>([casesEndpoint]);
      
      // Optimistically update the cache
      if (previousCases) {
        queryClient.setQueryData<MaintenanceCase[]>([casesEndpoint], (old) => 
          old?.map(caseItem => 
            caseItem.id === id 
              ? { 
                  ...caseItem, 
                  scheduledStartAt: scheduledStartAt || null,
                  scheduledEndAt: scheduledEndAt !== undefined ? (scheduledEndAt || null) : caseItem.scheduledEndAt
                }
              : caseItem
          ) || []
        );
      }
      
      // Return context with snapshot for rollback
      return { previousCases };
    },
    onSuccess: (data) => {
      // Update cache with server response to ensure consistency
      queryClient.setQueryData<MaintenanceCase[]>([casesEndpoint], (old) => 
        old?.map(caseItem => 
          caseItem.id === data.id ? data : caseItem
        ) || []
      );
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousCases) {
        queryClient.setQueryData([casesEndpoint], context.previousCases);
      }
      toast({ title: "Failed to update work order", variant: "destructive" });
      // Invalidate on error to refetch correct state
      queryClient.invalidateQueries({ queryKey: [casesEndpoint] });
    },
  });

  // Mutation to complete reminder
  const completeReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, { status: 'Completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      toast({ title: "Reminder marked as completed" });
    },
    onError: () => {
      toast({ title: "Failed to complete reminder", variant: "destructive" });
    },
  });

  // Mutation to cancel reminder
  const cancelReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, { status: 'Cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      toast({ title: "Reminder cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel reminder", variant: "destructive" });
    },
  });

  // Supporting queries for ReminderForm (loaded when dialog opens)
  const { data: entities = [] } = useQuery<any[]>({
    queryKey: ['/api/entities'],
    enabled: showReminderForm && !!user,
  });

  // Only fetch properties/units when viewing cases (not reminders-only mode)
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ['/api/properties'],
    enabled: !!user && filterMode !== 'reminders',
  });

  const { data: units = [] } = useQuery<any[]>({
    queryKey: ['/api/units'],
    enabled: !!user && filterMode !== 'reminders',
  });

  // Handler functions for reminder actions
  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setShowReminderForm(true);
  };

  const handleCompleteReminder = (id: string) => {
    completeReminderMutation.mutate(id);
  };

  const handleCancelReminder = (id: string) => {
    cancelReminderMutation.mutate(id);
  };

  // Handler function for case/work order edit
  const handleEditCase = (caseId: string) => {
    navigate(`/maintenance?caseId=${caseId}`);
  };

  // Filter reminders by type
  const filteredReminders = reminderTypeFilter === 'all' 
    ? reminders 
    : reminders.filter(r => r.type === reminderTypeFilter);
  
  // Filter cases by status using shared utility
  const filteredCases = filterCasesByStatus(cases, statusFilter);

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

    console.log('🎯 Drag ended - over.id:', over?.id, 'active.id:', active.id);

    // Parse the dragged item ID (format: "reminder:id" or "case:id")
    const [itemType, itemId] = active.id.split(':');

    // Handle drop to unscheduled section (removes schedule)
    if (over && over.id === 'unscheduled') {
      console.log('📍 Dropping to unscheduled, itemType:', itemType, 'itemId:', itemId);
      if (itemType === 'reminder') {
        updateReminderMutation.mutate({ id: itemId, dueAt: null });
      } else if (itemType === 'case') {
        console.log('📍 Calling mutation to unschedule case');
        updateCaseMutation.mutate({ id: itemId, scheduledStartAt: null, scheduledEndAt: null });
      }
      return;
    }
    
    // If dropped outside any valid area, do nothing
    if (!over) return;
    
    // Parse the drop target ID (format: "day:timestamp" or "hour:timestamp:hour")
    const dropData = over.id.toString().split(':');
    
    // Check if it's a valid time slot (starts with "day:" or "hour:")
    if (dropData[0] !== 'day' && dropData[0] !== 'hour') {
      console.log('⚠️ Invalid drop target:', over.id);
      return;
    }
    
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

      // Calculate duration if scheduledEndAt exists, preserve it when rescheduling
      let scheduledEndAt: string | undefined;
      if (caseItem.scheduledStartAt && caseItem.scheduledEndAt) {
        const originalStart = new Date(caseItem.scheduledStartAt);
        const originalEnd = new Date(caseItem.scheduledEndAt);
        const durationMs = originalEnd.getTime() - originalStart.getTime();
        const newEnd = new Date(utcDate.getTime() + durationMs);
        scheduledEndAt = newEnd.toISOString();
      }

      updateCaseMutation.mutate({ id: itemId, scheduledStartAt: utcDate.toISOString(), scheduledEndAt });
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

    const dayCases = filterMode !== 'reminders' ? filteredCases.filter(c => {
      if (!c.scheduledStartAt) return false;
      const schedDate = new Date(c.scheduledStartAt);
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
    <>
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
                  View and manage reminders and work orders
                </p>
              </div>
            </div>

            {/* Main Grid: Calendar + Unscheduled Sidebar */}
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              collisionDetection={closestCenter}
            >
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
                    {/* Contractor Availability Button */}
                    {role === "contractor" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAvailabilityCalendar(true)}
                        className="flex items-center gap-2"
                        data-testid="button-open-availability"
                      >
                        <Calendar className="h-4 w-4" />
                        My Availability
                      </Button>
                    )}
                    
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
                    
                    {filterMode !== 'reminders' && (
                      <Select value={statusFilter} onValueChange={(v: StatusFilterKey) => setStatusFilter(v)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active Work</SelectItem>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="In Review">In Review</SelectItem>
                          <SelectItem value="Scheduled">Scheduled</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
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
                {isLoading ? (
                  <div className="py-12 text-center text-gray-500">Loading...</div>
                ) : (
                  <>
                    {view === 'week' && <WeekView currentDate={currentDate} getItemsForDate={getItemsForDate} hideWeekends={hideWeekends} properties={properties} units={units} canReschedule={canReschedule} onEditReminder={handleEditReminder} onCompleteReminder={handleCompleteReminder} onCancelReminder={handleCancelReminder} />}
                    {view === 'month' && <MonthView currentDate={currentDate} getItemsForDate={getItemsForDate} properties={properties} units={units} />}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Unscheduled Items Sidebar */}
            {(() => {
              const unscheduledReminders = filterMode !== 'cases' 
                ? filteredReminders.filter(r => !r.dueAt) 
                : [];
              const unscheduledCases = filterMode !== 'reminders'
                ? filteredCases.filter(c => !c.scheduledStartAt)
                : [];
              
              if (unscheduledReminders.length === 0 && unscheduledCases.length === 0) {
                return null;
              }
              
              return (
                <Card className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                  <CardHeader>
                    <CardTitle className="text-sm">Unscheduled Items</CardTitle>
                    <p className="text-xs text-muted-foreground">Drag items here to unschedule, or drag from here to schedule</p>
                  </CardHeader>
                  <CardContent>
                    <UnscheduledDropZone>
                      {unscheduledReminders.map(reminder => {
                        const effectiveStatus = reminder.status || (reminder.dueAt && new Date(reminder.dueAt) < new Date() ? 'Overdue' : null);
                        return (
                          <DraggableCalendarItem
                            key={reminder.id}
                            id={`reminder:${reminder.id}`}
                            disabled={!canReschedule}
                            className={cn(
                              "p-3 rounded text-xs hover:shadow-md transition-shadow group",
                              "bg-yellow-50 dark:bg-yellow-950/20"
                            )}
                          >
                            <div data-testid={`unscheduled-reminder-${reminder.id}`}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="font-semibold truncate flex-1">{reminder.title}</div>
                                <div className="flex items-center gap-1">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`menu-reminder-${reminder.id}`}>
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditReminder(reminder); }} data-testid={`edit-reminder-${reminder.id}`}>
                                        <Edit2 className="h-3 w-3 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCompleteReminder(reminder.id); }} data-testid={`complete-reminder-${reminder.id}`}>
                                        <Check className="h-3 w-3 mr-2" />
                                        Complete
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCancelReminder(reminder.id); }} data-testid={`cancel-reminder-${reminder.id}`}>
                                        <X className="h-3 w-3 mr-2" />
                                        Cancel
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {effectiveStatus && (
                                    <Badge className={cn("text-[10px] px-1 py-0", 
                                      effectiveStatus === 'Overdue' && "bg-red-100 text-red-800",
                                      effectiveStatus === 'Completed' && "bg-green-100 text-green-800",
                                      effectiveStatus === 'Cancelled' && "bg-gray-100 text-gray-800"
                                    )} data-testid={`badge-${effectiveStatus}`}>
                                      {effectiveStatus}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs opacity-75 capitalize">{reminder.type?.replace(/_/g, ' ')}</div>
                            </div>
                          </DraggableCalendarItem>
                        );
                      })}
                      
                      {unscheduledCases.map(caseItem => (
                        <DraggableCalendarItem
                          key={caseItem.id}
                          id={`case:${caseItem.id}`}
                          disabled={!canReschedule}
                        >
                          <WorkOrderCard
                            workOrder={caseItem}
                            userRole={role}
                            properties={properties}
                            units={units}
                            teams={teams}
                            variant="compact"
                            showActions={false}
                            onEdit={() => {}}
                            onReminder={() => {}}
                            onDelete={() => {}}
                            onAccept={() => {}}
                            onReviewCounter={() => {}}
                          />
                        </DraggableCalendarItem>
                      ))}
                    </UnscheduledDropZone>
                  </CardContent>
                </Card>
              );
            })()}
              </div>
              
              <DragOverlay>
                {activeId ? (
                  <div className="p-2 bg-white dark:bg-gray-800 rounded shadow-lg border-2 border-blue-500 opacity-90 cursor-grabbing">
                    <div className="text-xs font-semibold">Moving item...</div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Calendar Visual System</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  All reminders use yellow backgrounds • Status badges show Overdue/Completed/Cancelled
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Reminder Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-4 bg-yellow-100 dark:bg-yellow-900/30 rounded"></div>
                      <span className="text-xs">Active (no badge)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 text-[10px]">Overdue</Badge>
                      <span className="text-xs">Past due date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 text-[10px]">Completed</Badge>
                      <span className="text-xs">Task completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gray-100 text-gray-800 text-[10px]">Cancelled</Badge>
                      <span className="text-xs">Task cancelled</span>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold mb-2">Month View Indicators</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-1.5 bg-yellow-500 rounded"></div>
                        <span className="text-xs">Active</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-1.5 bg-red-500 rounded"></div>
                        <span className="text-xs">Overdue</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-1.5 bg-green-500 rounded"></div>
                        <span className="text-xs">Completed</span>
                      </div>
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

    {/* Reminder Edit Dialog */}
    <Dialog open={showReminderForm} onOpenChange={setShowReminderForm}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Create Reminder'}</DialogTitle>
          <DialogDescription>
            {editingReminder ? 'Update reminder details below.' : 'Create a new reminder for your properties.'}
          </DialogDescription>
        </DialogHeader>
        <ReminderForm
          reminder={editingReminder || undefined}
          entities={entities}
          properties={properties}
          units={units}
          isLoading={false}
          onSubmit={async (data) => {
            // The form handles the API call, we just need to handle success
            setShowReminderForm(false);
            setEditingReminder(null);
            queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
            toast({ title: editingReminder ? 'Reminder updated' : 'Reminder created' });
          }}
          onCancel={() => {
            setShowReminderForm(false);
            setEditingReminder(null);
          }}
        />
      </DialogContent>
    </Dialog>
    
    {/* Contractor Availability Calendar Dialog */}
    {role === "contractor" && contractorProfile && (
      <Dialog open={showAvailabilityCalendar} onOpenChange={setShowAvailabilityCalendar}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-availability-calendar">
          <DialogHeader>
            <DialogTitle>Manage My Availability</DialogTitle>
          </DialogHeader>
          <AvailabilityCalendar 
            contractorId={contractorProfile.id}
            onReviewCounterProposal={() => {}}
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

function WeekView({ currentDate, getItemsForDate, hideWeekends = false, properties = [], units = [], canReschedule, onEditReminder, onCompleteReminder, onCancelReminder }: {
  currentDate: Date;
  getItemsForDate: (date: Date) => { reminders: Reminder[]; cases: MaintenanceCase[] };
  hideWeekends?: boolean;
  properties?: any[];
  units?: any[];
  canReschedule: boolean;
  onEditReminder: (reminder: Reminder) => void;
  onCompleteReminder: (id: string) => void;
  onCancelReminder: (id: string) => void;
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
                  if (!caseItem.scheduledStartAt) return;
                  const schedDate = new Date(caseItem.scheduledStartAt);
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
                        // Get effective status (null for active, Overdue/Completed/Cancelled when applicable)
                        const effectiveStatus = reminder.status || (reminder.dueAt && new Date(reminder.dueAt) < new Date() ? 'Overdue' : null);
                        
                        return (
                          <DraggableCalendarItem
                            key={`allday-reminder-${reminder.id}`}
                            id={`reminder:${reminder.id}`}
                            disabled={!canReschedule}
                            className={cn(
                              "absolute left-1 right-1 p-1.5 rounded text-xs hover:shadow-md transition-shadow z-10 group",
                              "bg-yellow-50 dark:bg-yellow-950/20"
                            )}
                            style={{ top: `${2 + stackIndex * 36}px`, minHeight: '32px' }}
                          >
                            <div data-testid={`reminder-${reminder.id}`}>
                              <div className="flex items-center justify-between gap-1">
                                <div className="font-semibold truncate flex-1">{reminder.title}</div>
                                <div className="flex items-center gap-1">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`menu-reminder-${reminder.id}`}>
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditReminder(reminder); }} data-testid={`edit-reminder-${reminder.id}`}>
                                        <Edit2 className="h-3 w-3 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCompleteReminder(reminder.id); }} data-testid={`complete-reminder-${reminder.id}`}>
                                        <Check className="h-3 w-3 mr-2" />
                                        Complete
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancelReminder(reminder.id); }} data-testid={`cancel-reminder-${reminder.id}`}>
                                        <X className="h-3 w-3 mr-2" />
                                        Cancel
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {effectiveStatus && (
                                    <Badge className={cn("text-[10px] px-1 py-0", 
                                      effectiveStatus === 'Overdue' && "bg-red-100 text-red-800",
                                      effectiveStatus === 'Completed' && "bg-green-100 text-green-800",
                                      effectiveStatus === 'Cancelled' && "bg-gray-100 text-gray-800"
                                    )} data-testid={`badge-${effectiveStatus}`}>
                                      {effectiveStatus}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DraggableCalendarItem>
                        );
                      } else {
                        const caseItem = item as MaintenanceCase;
                        const locationLabel = formatWorkOrderLocation(caseItem.propertyId, caseItem.unitId, properties, units);
                        const teamColor = caseItem.scheduledJobs?.[0]?.teamColor;
                        // Validate and convert team color to rgba
                        const isValidHex = teamColor && /^#[0-9A-F]{6}$/i.test(teamColor);
                        const teamBgColor = isValidHex ? `${teamColor}20` : undefined;
                        const teamBorderColor = isValidHex ? teamColor : undefined;
                        // Fallback to status colors if no valid team color
                        const caseColors = !isValidHex ? (CASE_STATUS_COLORS[caseItem.status] || CASE_STATUS_COLORS.New) : null;
                        
                        return (
                          <DraggableCalendarItem
                            key={`allday-case-${caseItem.id}`}
                            id={`case:${caseItem.id}`}
                            disabled={!canReschedule}
                            className={cn(
                              "absolute left-1 right-1 p-1.5 rounded border-l-4 text-xs hover:shadow-md transition-shadow z-10 group",
                              caseColors?.bg,
                              caseColors?.border
                            )}
                            style={isValidHex ? { 
                              top: `${2 + stackIndex * 36}px`, 
                              minHeight: '32px',
                              backgroundColor: teamBgColor,
                              borderLeftColor: teamBorderColor
                            } : { 
                              top: `${2 + stackIndex * 36}px`, 
                              minHeight: '32px'
                            }}
                          >
                            <div data-testid={`case-${caseItem.id}`}>
                              <div className="flex items-center justify-between gap-1">
                                <div className="font-semibold truncate flex-1">{caseItem.title}</div>
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" 
                                    onClick={(e) => { e.stopPropagation(); handleEditCase(caseItem.id); }}
                                    data-testid={`button-edit-case-${caseItem.id}`}
                                  >
                                    <Edit2 className="h-3 w-3" data-testid={`edit-case-${caseItem.id}`} />
                                  </Button>
                                  {caseItem.scheduledJobs?.[0]?.teamName && (
                                    <div 
                                      className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                                      style={isValidHex ? { 
                                        color: teamColor,
                                        borderColor: teamColor,
                                        fontWeight: '600'
                                      } : undefined}
                                      data-testid={`badge-team-${caseItem.id}`}
                                    >
                                      {caseItem.scheduledJobs[0].teamName}
                                    </div>
                                  )}
                                  {(caseItem.priority === 'High' || caseItem.priority === 'Urgent') && (
                                    <Badge variant="destructive" className="text-[10px] px-1 py-0" data-testid={`badge-${caseItem.priority}`}>
                                      {caseItem.priority}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {locationLabel && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate mt-0.5">
                                  {locationLabel}
                                </div>
                              )}
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
                        // Get effective status (null for active, Overdue/Completed/Cancelled when applicable)
                        const effectiveStatus = reminder.status || (reminder.dueAt && new Date(reminder.dueAt) < new Date() ? 'Overdue' : null);
                        
                        return (
                          <DraggableCalendarItem
                            key={`timed-reminder-${reminder.id}`}
                            id={`reminder:${reminder.id}`}
                            disabled={!canReschedule}
                            className={cn(
                              "absolute left-1 right-1 p-2 rounded text-xs hover:shadow-md transition-shadow z-10 group",
                              "bg-yellow-50 dark:bg-yellow-950/20"
                            )}
                            style={{ top: `${topPosition}px`, minHeight: '50px' }}
                          >
                            <div data-testid={`reminder-${reminder.id}`}>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="font-semibold truncate flex-1">{reminder.title}</div>
                                <div className="flex items-center gap-1">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`menu-reminder-${reminder.id}`}>
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditReminder(reminder); }} data-testid={`edit-reminder-${reminder.id}`}>
                                        <Edit2 className="h-3 w-3 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCompleteReminder(reminder.id); }} data-testid={`complete-reminder-${reminder.id}`}>
                                        <Check className="h-3 w-3 mr-2" />
                                        Complete
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancelReminder(reminder.id); }} data-testid={`cancel-reminder-${reminder.id}`}>
                                        <X className="h-3 w-3 mr-2" />
                                        Cancel
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {effectiveStatus && (
                                    <Badge className={cn("text-[10px] px-1 py-0", 
                                      effectiveStatus === 'Overdue' && "bg-red-100 text-red-800",
                                      effectiveStatus === 'Completed' && "bg-green-100 text-green-800",
                                      effectiveStatus === 'Cancelled' && "bg-gray-100 text-gray-800"
                                    )} data-testid={`badge-${effectiveStatus}`}>
                                      {effectiveStatus}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs opacity-75">{format(time, 'h:mm a')}</div>
                              <div className="text-xs opacity-75 capitalize">{reminder.type?.replace(/_/g, ' ')}</div>
                            </div>
                          </DraggableCalendarItem>
                        );
                      } else {
                        const caseItem = item as MaintenanceCase;
                        const locationLabel = formatWorkOrderLocation(caseItem.propertyId, caseItem.unitId, properties, units);
                        const teamColor = caseItem.scheduledJobs?.[0]?.teamColor;
                        // Validate and convert team color to rgba
                        const isValidHex = teamColor && /^#[0-9A-F]{6}$/i.test(teamColor);
                        const teamBgColor = isValidHex ? `${teamColor}20` : undefined;
                        const teamBorderColor = isValidHex ? teamColor : undefined;
                        // Fallback to status colors if no valid team color
                        const caseColors = !isValidHex ? (CASE_STATUS_COLORS[caseItem.status] || CASE_STATUS_COLORS.New) : null;
                        
                        return (
                          <DraggableCalendarItem
                            key={`timed-case-${caseItem.id}`}
                            id={`case:${caseItem.id}`}
                            disabled={!canReschedule}
                            className={cn(
                              "absolute left-1 right-1 p-2 rounded border-l-4 text-xs hover:shadow-md transition-shadow z-10 group",
                              caseColors?.bg,
                              caseColors?.border
                            )}
                            style={isValidHex ? { 
                              top: `${topPosition}px`, 
                              minHeight: '50px',
                              backgroundColor: teamBgColor,
                              borderLeftColor: teamBorderColor
                            } : { 
                              top: `${topPosition}px`, 
                              minHeight: '50px'
                            }}
                          >
                            <div data-testid={`case-${caseItem.id}`}>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="font-semibold truncate flex-1">{caseItem.title}</div>
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" 
                                    onClick={(e) => { e.stopPropagation(); handleEditCase(caseItem.id); }}
                                    data-testid={`button-edit-case-${caseItem.id}`}
                                  >
                                    <Edit2 className="h-3 w-3" data-testid={`edit-case-${caseItem.id}`} />
                                  </Button>
                                  {caseItem.scheduledJobs?.[0]?.teamName && (
                                    <div 
                                      className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                                      style={isValidHex ? { 
                                        color: teamColor,
                                        borderColor: teamColor,
                                        fontWeight: '600'
                                      } : undefined}
                                      data-testid={`badge-team-${caseItem.id}`}
                                    >
                                      {caseItem.scheduledJobs[0].teamName}
                                    </div>
                                  )}
                                  {(caseItem.priority === 'High' || caseItem.priority === 'Urgent') && (
                                    <Badge variant="destructive" className="text-[10px] px-1 py-0" data-testid={`badge-${caseItem.priority}`}>
                                      {caseItem.priority}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {locationLabel && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">{locationLabel}</div>
                              )}
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

function MonthView({ currentDate, getItemsForDate, properties = [], units = [] }: {
  currentDate: Date;
  getItemsForDate: (date: Date) => { reminders: Reminder[]; cases: MaintenanceCase[] };
  properties?: any[];
  units?: any[];
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
                  // Get effective status for color coding
                  const effectiveStatus = reminder.status || (reminder.dueAt && new Date(reminder.dueAt) < new Date() ? 'Overdue' : null);
                  return (
                  <div
                    key={reminder.id}
                    className={cn(
                      "w-full h-1.5 rounded",
                      effectiveStatus === 'Overdue' && "bg-red-500",
                      effectiveStatus === 'Completed' && "bg-green-500",
                      effectiveStatus === 'Cancelled' && "bg-gray-400",
                      !effectiveStatus && "bg-yellow-500"
                    )}
                    title={`${reminder.title}${effectiveStatus ? ` (${effectiveStatus})` : ''}`}
                  />
                  );
                })}
                {cases.slice(0, 2).map(caseItem => {
                  const locationLabel = formatWorkOrderLocation(caseItem.propertyId, caseItem.unitId, properties, units);
                  const tooltipParts = [
                    caseItem.title,
                    locationLabel,
                    caseItem.category,
                    caseItem.status
                  ].filter(Boolean);
                  return (
                    <div
                      key={caseItem.id}
                      className={cn(
                        "w-full h-1 rounded",
                        caseItem.status === 'New' && "bg-yellow-500",
                        caseItem.status === 'In Progress' && "bg-blue-500",
                        caseItem.status === 'On Hold' && "bg-gray-500",
                        caseItem.status === 'Resolved' && "bg-green-500",
                        caseItem.status === 'Closed' && "bg-green-500"
                      )}
                      title={tooltipParts.join(' • ')}
                    />
                  );
                })}
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
