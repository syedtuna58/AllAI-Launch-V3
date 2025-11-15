import { useState, useEffect, useRef } from "react";
import { filterCasesByStatus, type StatusFilterKey } from "@/lib/work-order-filters";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Filter, Edit2, Check, X, Plus, Users, Star } from "lucide-react";
import CompactCalendarCard from "@/components/calendar/CompactCalendarCard";
import { DndContext, useDraggable, useDroppable, DragOverlay, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, getClientRect, MeasuringStrategy } from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
import { format, addDays, startOfWeek, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, getDay } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { Trash2 } from "lucide-react";
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
  reporterUserId?: string | null;
  reporter?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
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

/**
 * Custom collision detection that accounts for scroll offsets
 * This ensures drag-drop works correctly even when the calendar is scrolled
 * 
 * Note: After testing, we may find that DnD Kit's built-in collision detection
 * already handles scroll correctly. This custom implementation is a safety net.
 */
function createScrollAwareCollisionDetection(scrollContainerRef: React.RefObject<HTMLDivElement>): CollisionDetection {
  return (args) => {
    // For now, just use closestCenter directly
    // DnD Kit measures in viewport coordinates, which already account for scroll
    // If issues persist, we can add scroll compensation here
    return closestCenter(args);
  };
}

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const role = user?.primaryRole;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(() => toZonedTime(new Date(), ORG_TIMEZONE));
  const [view, setView] = useState<'week' | 'month'>('week');
  const [filterMode, setFilterMode] = useState<'all' | 'reminders' | 'cases'>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [hideWeekends, setHideWeekends] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [showWorkOrderDialog, setShowWorkOrderDialog] = useState(false);

  // Ref for scroll container (used in collision detection)
  const weekViewScrollRef = useRef<HTMLDivElement>(null);

  // Team management hook
  const teamManagement = useTeamManagement();

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Create scroll-aware collision detection
  const scrollAwareCollisionDetection = createScrollAwareCollisionDetection(weekViewScrollRef);

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

  // Fetch teams for all users
  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["/api/teams"],
    enabled: !!user,
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
      
      // Optimistically update the cache (schedule only, backend will set status)
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

  // Mutation to update team assignment
  const updateJobTeamMutation = useMutation({
    mutationFn: async ({ jobId, teamId }: { jobId: string; teamId: string }) => {
      return await apiRequest('PATCH', `/api/scheduled-jobs/${jobId}`, { teamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [casesEndpoint] });
      toast({ title: "Team updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update team", variant: "destructive" });
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

  // Handler function for case double-click
  const handleCaseDoubleClick = (caseId: string) => {
    setSelectedWorkOrderId(caseId);
    setShowWorkOrderDialog(true);
  };

  // Filter cases by team
  const filteredCases = teamFilter === 'all' 
    ? cases 
    : cases.filter(c => c.scheduledJobs?.some(j => j.teamId === teamFilter));

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
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  // Track drag over state for time preview
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Calculate preview time from drag over ID
  const getPreviewTime = (overId: string | null): string | null => {
    if (!overId) return null;
    
    const dropData = overId.toString().split(':');
    
    // Handle unscheduled drop
    if (overId === 'unscheduled') {
      return 'Unscheduled';
    }
    
    // Parse time from drop target
    if (dropData[0] === 'quarter' || dropData[0] === 'hour' || dropData[0] === 'day') {
      const targetTimestamp = parseInt(dropData[1]);
      const dateStr = formatInTimeZone(new Date(targetTimestamp), ORG_TIMEZONE, 'EEE, MMM d');
      
      let hour = 0;
      let minute = 0;
      
      if (dropData[0] === 'quarter') {
        hour = dropData[2] ? parseInt(dropData[2]) : 0;
        minute = dropData[3] ? parseInt(dropData[3]) : 0;
      } else if (dropData[0] === 'hour') {
        hour = dropData[2] ? parseInt(dropData[2]) : 0;
        minute = 0;
      }
      
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const displayMinute = minute.toString().padStart(2, '0');
      
      return `${dateStr} at ${displayHour}:${displayMinute} ${period}`;
    }
    
    return null;
  };

  // Drag handlers
  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    setDragOverId(null);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    setDragOverId(over?.id || null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    setDragOverId(null);

    console.log('🎯 Drag ended - over.id:', over?.id, 'active.id:', active.id);

    // Parse the dragged item ID (format: "reminder:id" or "case:id")
    const [itemType, itemId] = active.id.split(':');

    // Handle drop to unscheduled section (removes schedule)
    if (over && over.id === 'unscheduled') {
      console.log('📍 Dropping to unscheduled, itemType:', itemType, 'itemId:', itemId);
      if (itemType === 'reminder') {
        updateReminderMutation.mutate({ id: itemId, dueAt: null });
      } else if (itemType === 'case') {
        console.log('📍 Calling mutation to unschedule case (backend will auto-set status to On Hold)');
        updateCaseMutation.mutate({ 
          id: itemId, 
          scheduledStartAt: null, 
          scheduledEndAt: null
        });
      }
      return;
    }
    
    // If dropped outside any valid area, do nothing
    if (!over) return;
    
    // Parse the drop target ID (format: "day:timestamp", "hour:timestamp:hour", or "quarter:timestamp:hour:minute")
    const dropData = over.id.toString().split(':');
    
    // Check if it's a valid time slot (starts with "day:", "hour:", or "quarter:")
    if (dropData[0] !== 'day' && dropData[0] !== 'hour' && dropData[0] !== 'quarter') {
      console.log('⚠️ Invalid drop target:', over.id);
      return;
    }
    
    const targetTimestamp = parseInt(dropData[1]);
    
    // Get date string in org timezone (YYYY-MM-DD)
    const dateStr = formatInTimeZone(new Date(targetTimestamp), ORG_TIMEZONE, 'yyyy-MM-dd');
    
    // Determine the hour and minute based on drop target type
    let hour = 0;
    let minute = 0;
    
    if (dropData[0] === 'quarter') {
      // Quarter slots have format: "quarter:timestamp:hour:minute"
      hour = dropData[2] ? parseInt(dropData[2]) : 0;
      minute = dropData[3] ? parseInt(dropData[3]) : 0;
    } else if (dropData[0] === 'hour') {
      // Hour slots have format: "hour:timestamp:hour"
      hour = dropData[2] ? parseInt(dropData[2]) : 0;
      minute = 0;
    }
    // else day slot defaults to 00:00
    
    const hourStr = hour.toString().padStart(2, '0');
    const minuteStr = minute.toString().padStart(2, '0');
    
    // Build ISO string in org timezone (e.g., "2025-11-09T14:15:00")
    const dateTimeStr = `${dateStr}T${hourStr}:${minuteStr}:00`;
    
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

    const dayReminders = filterMode !== 'cases' ? reminders.filter(r => {
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
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 items-center justify-center">
        <p>Please log in to view the admin calendar.</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} data-testid="button-back-dashboard">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Button>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                Admin Calendar
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/maintenance')} data-testid="button-quick-add">
              <Plus className="h-4 w-4 mr-2" />
              Quick Add
            </Button>
            <Button variant="outline" onClick={() => setShowTeamDialog(true)} data-testid="button-manage-teams">
              <Users className="h-4 w-4 mr-2" />
              Manage Teams
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Grid with Unscheduled Left, Calendar Right */}
      <div className="flex-1 overflow-hidden">
        <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              collisionDetection={scrollAwareCollisionDetection}
              measuring={{
                droppable: {
                  strategy: MeasuringStrategy.Always,
                },
              }}
            >
              <div className="grid h-full" style={{ gridTemplateColumns: '260px 1fr' }}>
                {/* Left Sidebar: Unscheduled Items + Mini Calendar */}
                {(() => {
                  const unscheduledReminders = filterMode !== 'cases' 
                    ? reminders.filter(r => !r.dueAt) 
                    : [];
                  const unscheduledCases = filterMode !== 'reminders'
                    ? filteredCases.filter(c => !c.scheduledStartAt)
                    : [];
                  
                  return (
                    <div className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                      {/* Unscheduled Items - Scrollable */}
                      <div className="flex-1 overflow-y-auto p-4">
                        <div className="mb-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Unscheduled Items</h3>
                          <p className="text-xs text-muted-foreground">Drag to schedule</p>
                        </div>
                        <UnscheduledDropZone>
                          {unscheduledReminders.map(reminder => {
                            const effectiveStatus = reminder.status || (reminder.dueAt && new Date(reminder.dueAt) < new Date() ? 'Overdue' : null);
                            return (
                              <DraggableCalendarItem
                                key={reminder.id}
                                id={`reminder:${reminder.id}`}
                                disabled={!canReschedule}
                                className={cn(
                                  "p-3 rounded text-xs hover:shadow-md transition-shadow group mb-3",
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
                          
                          {unscheduledCases.map(caseItem => {
                            const firstJob = caseItem.scheduledJobs?.[0];
                            const team = firstJob?.teamId ? teams.find((t: any) => t.id === firstJob.teamId) : undefined;
                            const tenantName = caseItem.reporter 
                              ? `${caseItem.reporter.firstName || ''} ${caseItem.reporter.lastName || ''}`.trim() || caseItem.reporter.email
                              : undefined;
                            const property = caseItem.propertyId ? properties.find((p: any) => p.id === caseItem.propertyId) : undefined;
                            const propertyStreet = property?.street;
                            
                            return (
                              <DraggableCalendarItem
                                key={caseItem.id}
                                id={`case:${caseItem.id}`}
                                disabled={!canReschedule}
                                className="mb-3"
                              >
                                <div data-testid={`unscheduled-case-${caseItem.id}`}>
                                  <CompactCalendarCard
                                    workOrder={caseItem}
                                    team={team}
                                    teams={teams}
                                    tenantName={tenantName}
                                    propertyStreet={propertyStreet}
                                    onDoubleClick={() => handleCaseDoubleClick(caseItem.id)}
                                    onTeamChange={firstJob ? (teamId) => updateJobTeamMutation.mutate({ jobId: firstJob.id, teamId }) : undefined}
                                  />
                                </div>
                              </DraggableCalendarItem>
                            );
                          })}
                          
                          {unscheduledReminders.length === 0 && unscheduledCases.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">No unscheduled items</p>
                          )}
                        </UnscheduledDropZone>
                      </div>
                      
                      {/* Mini Calendar at Bottom */}
                      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-gray-900 dark:text-white">{format(currentDate, 'MMMM yyyy')}</h3>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              onClick={() => setCurrentDate(addMonths(currentDate, -1))}
                              data-testid="button-prev-month"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                              data-testid="button-next-month"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                            <div key={idx} className="text-center text-[10px] font-medium text-gray-500 dark:text-gray-400">
                              {day}
                            </div>
                          ))}
                        </div>
                        {/* Calendar grid */}
                        {(() => {
                          const monthStart = startOfMonth(currentDate);
                          const monthEnd = endOfMonth(currentDate);
                          const firstDayOfWeek = getDay(monthStart);
                          const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                          const today = new Date();
                          
                          // Adjust for Monday start (getDay returns 0 for Sunday, we want Monday=0)
                          const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
                          
                          // Get dates with scheduled work orders
                          const datesWithWorkOrders = new Set(
                            filteredCases
                              .filter(c => c.scheduledStartAt)
                              .map(c => format(new Date(c.scheduledStartAt!), 'yyyy-MM-dd'))
                          );
                          
                          return (
                            <div className="grid grid-cols-7 gap-0.5">
                              {/* Empty cells for offset */}
                              {Array.from({ length: offset }).map((_, idx) => (
                                <div key={`empty-${idx}`} className="aspect-square" />
                              ))}
                              {/* Days of the month */}
                              {daysInMonth.map((day, idx) => {
                                const isToday = isSameDay(day, today);
                                const isSelected = isSameDay(day, currentDate);
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const hasWorkOrders = datesWithWorkOrders.has(dateKey);
                                
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => setCurrentDate(day)}
                                    data-testid={`mini-cal-day-${dateKey}`}
                                    className={cn(
                                      "aspect-square text-[10px] rounded transition-colors relative",
                                      "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700",
                                      isToday && "font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
                                      isSelected && !isToday && "bg-gray-200 dark:bg-gray-700"
                                    )}
                                  >
                                    {format(day, 'd')}
                                    {hasWorkOrders && (
                                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* Right Side: Calendar */}
                <div className="overflow-hidden flex flex-col">
                  <Card className="flex-1 flex flex-col m-4">
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

                    {filterMode !== 'reminders' && (
                      <Select value={teamFilter} onValueChange={setTeamFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Teams</SelectItem>
                          {teams.map((team: any) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
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
                    {view === 'week' && <WeekView currentDate={currentDate} getItemsForDate={getItemsForDate} hideWeekends={hideWeekends} properties={properties} units={units} teams={teams} canReschedule={canReschedule} onEditReminder={handleEditReminder} onCompleteReminder={handleCompleteReminder} onCancelReminder={handleCancelReminder} onCaseDoubleClick={handleCaseDoubleClick} onTeamChange={(jobId, teamId) => updateJobTeamMutation.mutate({ jobId, teamId })} scrollRef={weekViewScrollRef} />}
                    {view === 'month' && <MonthView currentDate={currentDate} getItemsForDate={getItemsForDate} properties={properties} units={units} />}
                  </>
                )}
              </CardContent>
            </Card>
                </div>
              </div>
              
              <DragOverlay>
                {/* Empty overlay - keep original card visible */}
                {null}
              </DragOverlay>
            </DndContext>
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

    {/* Work Order Details Dialog */}
    <Dialog open={showWorkOrderDialog} onOpenChange={(open) => {
      setShowWorkOrderDialog(open);
      if (!open) {
        setSelectedWorkOrderId(null);
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Work Order Details</DialogTitle>
        </DialogHeader>
        {(() => {
          const selectedWorkOrder = selectedWorkOrderId 
            ? cases.find(c => c.id === selectedWorkOrderId)
            : null;
          
          if (!selectedWorkOrder) {
            return <div className="py-8 text-center text-muted-foreground">Work order not found</div>;
          }
          
          return (
            <WorkOrderCard
              workOrder={selectedWorkOrder}
              properties={properties}
              units={units}
              onEdit={() => {
                setShowWorkOrderDialog(false);
                setSelectedWorkOrderId(null);
                navigate(`/maintenance?caseId=${selectedWorkOrder.id}`);
              }}
            />
          );
        })()}
      </DialogContent>
    </Dialog>

    {/* Team Management Dialog */}
    <Dialog open={showTeamDialog} onOpenChange={(open) => {
      setShowTeamDialog(open);
      if (!open) {
        teamManagement.resetForm();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{teamManagement.editingTeam ? 'Edit Team' : 'Manage Teams'}</DialogTitle>
          <DialogDescription>
            {teamManagement.editingTeam ? 'Update team information.' : 'Create a new team or edit existing teams.'}
          </DialogDescription>
        </DialogHeader>
        
        {!teamManagement.editingTeam && !teamManagement.creatingNewTeam && teams.length > 0 && (
          <div className="space-y-2 mb-4 p-4 bg-muted dark:bg-gray-800 rounded-lg">
            <Label className="text-sm font-medium">Existing Teams</Label>
            <div className="space-y-2">
              {teams.map((team: any) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-2 bg-card dark:bg-gray-900 rounded border border-border dark:border-gray-700"
                  data-testid={`team-item-${team.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: team.color }} />
                    <div>
                      <p className="text-sm font-medium">{team.name}</p>
                      <p className="text-xs text-muted-foreground">{team.specialty}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => teamManagement.handleEditTeam(team)}
                    data-testid={`button-edit-team-${team.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(teamManagement.editingTeam || teamManagement.creatingNewTeam || teams.length === 0) && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={teamManagement.teamFormData.name}
                onChange={(e) => teamManagement.setTeamFormData({ ...teamManagement.teamFormData, name: e.target.value })}
                placeholder="e.g., ABC Plumbing"
                data-testid="input-team-name"
              />
            </div>
            <div>
              <Label htmlFor="team-specialty">Specialty</Label>
              <Select
                value={teamManagement.teamFormData.specialty}
                onValueChange={(value: any) => {
                  teamManagement.setTeamFormData({ ...teamManagement.teamFormData, specialty: value });
                }}
              >
                <SelectTrigger id="team-specialty" data-testid="select-team-specialty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const { favoriteSpecs, otherSpecs } = teamManagement.getSortedSpecialties();
                    return (
                      <>
                        {favoriteSpecs.length > 0 && (
                          <>
                            {favoriteSpecs.map(spec => (
                              <SelectItem key={spec} value={spec}>
                                <div className="flex items-center gap-2">
                                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                  {spec}
                                </div>
                              </SelectItem>
                            ))}
                            <div className="h-px bg-border my-1" />
                          </>
                        )}
                        {otherSpecs.map(spec => (
                          <SelectItem key={spec} value={spec}>
                            {spec}
                          </SelectItem>
                        ))}
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => teamManagement.toggleFavoriteSpecialty(teamManagement.teamFormData.specialty)}
                className="mt-1"
                data-testid="button-toggle-favorite-specialty"
              >
                <Star className={cn(
                  "h-4 w-4 mr-1",
                  teamManagement.getFavoriteSpecialties().includes(teamManagement.teamFormData.specialty)
                    ? "fill-yellow-500 text-yellow-500"
                    : "text-muted-foreground"
                )} />
                {teamManagement.getFavoriteSpecialties().includes(teamManagement.teamFormData.specialty) ? 'Remove from' : 'Add to'} favorites
              </Button>
            </div>
            <div>
              <Label htmlFor="team-color">Team Color</Label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {teamManagement.PRESET_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={cn(
                        "w-10 h-10 rounded-md border-2 transition-all",
                        teamManagement.teamFormData.color === color.value
                          ? "border-foreground dark:border-white scale-110"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color.value }}
                      onClick={() => teamManagement.setTeamFormData({ ...teamManagement.teamFormData, color: color.value })}
                      title={color.name}
                      data-testid={`color-preset-${color.name.toLowerCase()}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="team-color-custom" className="text-sm">Custom:</Label>
                  <Input
                    id="team-color-custom"
                    type="color"
                    value={teamManagement.teamFormData.color}
                    onChange={(e) => teamManagement.setTeamFormData({ ...teamManagement.teamFormData, color: e.target.value })}
                    className="w-20 h-8"
                    data-testid="input-team-color"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {teamManagement.editingTeam && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this team?')) {
                      teamManagement.handleDeleteTeam(teamManagement.editingTeam.id);
                    }
                  }}
                  disabled={teamManagement.deleteTeamMutation.isPending}
                  data-testid="button-delete-team"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              {(teamManagement.editingTeam || teamManagement.creatingNewTeam) && (
                <Button
                  variant="outline"
                  onClick={() => teamManagement.resetForm()}
                  className="flex-1"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={teamManagement.handleCreateTeam}
                disabled={!teamManagement.teamFormData.name || teamManagement.createTeamMutation.isPending || teamManagement.updateTeamMutation.isPending}
                className="flex-1"
                data-testid="button-submit-team"
              >
                {teamManagement.createTeamMutation.isPending || teamManagement.updateTeamMutation.isPending 
                  ? 'Saving...' 
                  : teamManagement.editingTeam 
                    ? 'Update Team' 
                    : 'Create Team'}
              </Button>
            </div>
          </div>
        )}

        {!teamManagement.editingTeam && !teamManagement.creatingNewTeam && teams.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              teamManagement.setCreatingNewTeam(true);
              teamManagement.setTeamFormData({ id: null, name: '', specialty: 'General', color: '#3b82f6', isActive: true });
            }}
            className="w-full"
            data-testid="button-add-new-team"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Team
          </Button>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

function WeekView({ currentDate, getItemsForDate, hideWeekends = false, properties = [], units = [], teams = [], canReschedule, onEditReminder, onCompleteReminder, onCancelReminder, onCaseDoubleClick, onTeamChange, scrollRef }: {
  currentDate: Date;
  getItemsForDate: (date: Date) => { reminders: Reminder[]; cases: MaintenanceCase[] };
  hideWeekends?: boolean;
  properties?: any[];
  units?: any[];
  teams?: any[];
  canReschedule: boolean;
  onEditReminder: (reminder: Reminder) => void;
  onCompleteReminder: (id: string) => void;
  onCancelReminder: (id: string) => void;
  onCaseDoubleClick?: (caseId: string) => void;
  onTeamChange?: (jobId: string, teamId: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
  // Show current week + next week (14 days total) to allow dragging to future dates
  const allWeekDays = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));
  
  // Filter out weekends if hideWeekends is true (5 = Saturday, 6 = Sunday in Monday-start week)
  const weekDays = hideWeekends 
    ? allWeekDays.filter(day => {
        const dayOfWeek = day.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6; // 0=Sunday, 6=Saturday
      })
    : allWeekDays;
  
  const today = new Date();
  
  const START_HOUR = 0;  // Midnight (12 AM)
  const END_HOUR = 24;   // Midnight next day (full 24-hour day)
  const HOUR_HEIGHT = 60; // pixels

  // Use provided ref or create new one
  const timeScrollRef = scrollRef || useRef<HTMLDivElement>(null);

  // Auto-scroll to current time on mount (1/3 from top)
  useEffect(() => {
    if (!timeScrollRef.current) return;

    // Vertical scroll to current time - position at 1/3 from top
    const now = new Date();
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    
    if (nowHour >= START_HOUR && nowHour < END_HOUR) {
      const offset = ((nowHour - START_HOUR) * HOUR_HEIGHT) + (nowMinute * HOUR_HEIGHT / 60);
      const containerHeight = timeScrollRef.current.clientHeight;
      // Position current time near the top (10% from top)
      const scrollTop = Math.max(0, offset - containerHeight * 0.1);
      
      setTimeout(() => {
        timeScrollRef.current?.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }, 100);
    }
  }, [currentDate, weekDays.length]);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
      {/* Horizontal scroll container - allows scrolling to next week */}
      <div className="overflow-x-auto overflow-y-hidden">
        {/* Vertical scroll container - allows scrolling through hours */}
        <div className="overflow-y-auto max-h-[calc(100vh-16rem)]" ref={timeScrollRef}>
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${weekDays.length}, 180px)` }}>
            {/* Time labels column - sticky on left */}
            <div className="sticky left-0 z-30 bg-white dark:bg-gray-800">
              <TimeColumn startHour={START_HOUR} endHour={END_HOUR} hourHeight={HOUR_HEIGHT} />
            </div>
          
          {/* Week grid - all days visible */}
        {weekDays.map((day, idx) => {
          const { reminders, cases } = getItemsForDate(day);
          const isToday = isSameDay(day, today);

          return (
            <div key={idx} data-day-column>
              <HourlyGrid
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
                        const firstJob = caseItem.scheduledJobs?.[0];
                        const team = firstJob?.teamId ? teams.find((t: any) => t.id === firstJob.teamId) : undefined;
                        const tenantName = caseItem.reporter 
                          ? `${caseItem.reporter.firstName || ''} ${caseItem.reporter.lastName || ''}`.trim() || caseItem.reporter.email
                          : undefined;
                        const property = caseItem.propertyId ? properties.find((p: any) => p.id === caseItem.propertyId) : undefined;
                        const propertyStreet = property?.street;
                        
                        return (
                          <DraggableCalendarItem
                            key={`allday-case-${caseItem.id}`}
                            id={`case:${caseItem.id}`}
                            disabled={!canReschedule}
                            className="absolute left-0 right-0 z-10"
                            style={{ top: `${2 + stackIndex * 36}px`, height: '34px' }}
                          >
                            <div data-testid={`case-${caseItem.id}`} className="h-full">
                              <CompactCalendarCard
                                workOrder={caseItem}
                                team={team}
                                teams={teams}
                                tenantName={tenantName}
                                propertyStreet={propertyStreet}
                                onDoubleClick={onCaseDoubleClick ? () => onCaseDoubleClick(caseItem.id) : undefined}
                                onTeamChange={firstJob && onTeamChange ? (teamId) => onTeamChange(firstJob.id, teamId) : undefined}
                              />
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
                        const firstJob = caseItem.scheduledJobs?.[0];
                        const team = firstJob?.teamId ? teams.find((t: any) => t.id === firstJob.teamId) : undefined;
                        const tenantName = caseItem.reporter 
                          ? `${caseItem.reporter.firstName || ''} ${caseItem.reporter.lastName || ''}`.trim() || caseItem.reporter.email
                          : undefined;
                        const property = caseItem.propertyId ? properties.find((p: any) => p.id === caseItem.propertyId) : undefined;
                        const propertyStreet = property?.street;
                        
                        return (
                          <DraggableCalendarItem
                            key={`timed-case-${caseItem.id}`}
                            id={`case:${caseItem.id}`}
                            disabled={!canReschedule}
                            className="absolute left-0 right-0 z-10"
                            style={{ top: `${topPosition}px`, height: `${HOUR_HEIGHT}px` }}
                          >
                            <div data-testid={`case-${caseItem.id}`} className="h-full">
                              <CompactCalendarCard
                                workOrder={caseItem}
                                team={team}
                                teams={teams}
                                tenantName={tenantName}
                                propertyStreet={propertyStreet}
                                onDoubleClick={onCaseDoubleClick ? () => onCaseDoubleClick(caseItem.id) : undefined}
                                onTeamChange={firstJob && onTeamChange ? (teamId) => onTeamChange(firstJob.id, teamId) : undefined}
                              />
                            </div>
                          </DraggableCalendarItem>
                        );
                      }
                    })}
                  </>
                );
              })()}
              </HourlyGrid>
            </div>
          );
        })}
        </div>
      </div>
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
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6);
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
