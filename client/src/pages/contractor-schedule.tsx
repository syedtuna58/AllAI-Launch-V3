import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Plus, Users, Check, Circle, AlertTriangle, AlertOctagon, Zap, Info, ChevronDown, Edit2, Star } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format, addDays, startOfWeek, isSameDay, parseISO, startOfDay, endOfDay, differenceInCalendarDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type Team = {
  id: string;
  name: string;
  specialty: string;
  color: string;
  orgId: string;
};

type ScheduledJob = {
  id: string;
  title: string;
  description: string | null;
  teamId: string;
  propertyId: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  isAllDay: boolean;
  status: 'Unscheduled' | 'Scheduled' | 'Needs Review' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled';
  urgency: 'Low' | 'High' | 'Emergent';
  tenantConfirmed: boolean;
  notes: string | null;
  address: string | null;
  durationDays: number;
  orgId: string;
  createdAt: string;
  updatedAt: string;
};

const URGENCY_COLORS = {
  Low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  Emergent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
];

const ALL_SPECIALTIES = [
  'Appliance Repair',
  'Carpentry',
  'Cleaning',
  'Concrete',
  'Countertops',
  'Demolition',
  'Drywall',
  'Electrical',
  'Fencing',
  'Flooring',
  'General',
  'Gutter',
  'Handyman',
  'HVAC',
  'Insulation',
  'Landscaping',
  'Locksmith',
  'Masonry',
  'Other',
  'Painting',
  'Pest Control',
  'Plumbing',
  'Pool/Spa',
  'Roofing',
  'Siding',
  'Tile',
  'Window/Door',
].sort();

export default function ContractorSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 })); // 1 = Monday
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [jobFormData, setJobFormData] = useState({
    title: '',
    description: '',
    teamId: '',
    urgency: 'Low' as const,
    propertyId: null,
    address: '',
    city: '',
    state: '',
    tel: '',
    email: '',
    contactPerson: '',
    startTime: '08:00',
    duration: 120, // in minutes (default 2 hours)
    durationDays: 1,
    allDay: false,
  });
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [showJobDetailsDialog, setShowJobDetailsDialog] = useState(false);
  const [hideWeekends, setHideWeekends] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [teamFormData, setTeamFormData] = useState({
    id: null as string | null,
    name: '',
    specialty: 'General',
    color: '#3b82f6',
    isActive: true,
  });
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [creatingNewTeam, setCreatingNewTeam] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const { data: teams = [], isLoading: loadingTeams } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<ScheduledJob[]>({
    queryKey: ['/api/scheduled-jobs'],
  });

  const getFavoriteSpecialties = (): string[] => {
    try {
      const stored = localStorage.getItem('contractor-favorite-specialties');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const toggleFavoriteSpecialty = (specialty: string) => {
    const favorites = getFavoriteSpecialties();
    const newFavorites = favorites.includes(specialty)
      ? favorites.filter(s => s !== specialty)
      : [...favorites, specialty];
    localStorage.setItem('contractor-favorite-specialties', JSON.stringify(newFavorites));
  };

  const getSortedSpecialties = () => {
    const favorites = getFavoriteSpecialties();
    const favoriteSpecs = ALL_SPECIALTIES.filter(s => favorites.includes(s));
    const otherSpecs = ALL_SPECIALTIES.filter(s => !favorites.includes(s));
    return { favoriteSpecs, otherSpecs };
  };

  const createTeamMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/teams', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: "Team created successfully" });
      setShowTeamDialog(false);
      setEditingTeam(null);
      setTeamFormData({ id: null, name: '', specialty: 'General', color: '#3b82f6', isActive: true });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create team",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/teams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: "Team updated successfully" });
      setShowTeamDialog(false);
      setEditingTeam(null);
      setTeamFormData({ id: null, name: '', specialty: 'General', color: '#3b82f6', isActive: true });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update team",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/scheduled-jobs', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      toast({ title: "Job created successfully" });
      setShowJobDialog(false);
      setJobFormData({
        title: '',
        description: '',
        teamId: '',
        urgency: 'Low',
        propertyId: null,
        address: '',
        city: '',
        state: '',
        tel: '',
        email: '',
        contactPerson: '',
        startTime: '08:00',
        duration: 120,
        durationDays: 1,
        allDay: false,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create job",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/scheduled-jobs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      toast({ title: "Job updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update job",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const allWeekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekDays = hideWeekends ? allWeekDays.filter((_, i) => i < 5) : allWeekDays; // Filter out Sat/Sun if hideWeekends is true

  const unscheduledJobs = jobs.filter(job => !job.scheduledStartAt);
  const scheduledJobs = jobs.filter(job => job.scheduledStartAt);

  const getJobsForDay = (date: Date) => {
    return scheduledJobs.filter(job => {
      if (!job.scheduledStartAt) return false;
      
      // Use the full calendar day boundaries for the column
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      // Parse job times with full precision
      const jobStart = parseISO(job.scheduledStartAt);
      const jobEnd = job.scheduledEndAt ? parseISO(job.scheduledEndAt) : jobStart;
      
      // Treat end time as exclusive: a job ending at midnight should not appear on the next day
      // Check if job overlaps with the day: jobStart < dayEnd (exclusive) AND jobEnd > dayStart
      return jobStart <= dayEnd && jobEnd > dayStart;
    });
  };

  const calculateJobSpan = (job: ScheduledJob, currentDay: Date, weekDays: Date[]): {
    shouldRender: boolean;
    spanDays: number;
    isFirstDay: boolean;
    extendsBeyondWeek: boolean;
  } => {
    if (!job.scheduledStartAt || job.durationDays <= 1) {
      return { shouldRender: true, spanDays: 1, isFirstDay: true, extendsBeyondWeek: false };
    }

    const jobStartDate = startOfDay(parseISO(job.scheduledStartAt));
    const currentDayStart = startOfDay(currentDay);
    
    const currentDayIndex = weekDays.findIndex(d => isSameDay(d, currentDay));
    if (currentDayIndex === -1) {
      return { shouldRender: false, spanDays: 1, isFirstDay: false, extendsBeyondWeek: false };
    }

    const firstVisibleDay = startOfDay(weekDays[0]);
    const lastVisibleDay = startOfDay(weekDays[weekDays.length - 1]);
    
    const isFirstDay = isSameDay(jobStartDate, currentDayStart);
    const jobStartsBeforeWeek = jobStartDate < firstVisibleDay;
    const firstDayInWeek = jobStartsBeforeWeek ? firstVisibleDay : jobStartDate;
    
    const shouldRender = isSameDay(currentDayStart, firstDayInWeek);
    
    if (!shouldRender) {
      return { shouldRender: false, spanDays: 1, isFirstDay, extendsBeyondWeek: false };
    }

    const jobEndDate = addDays(jobStartDate, job.durationDays);
    const daysUntilWeekEnd = weekDays.length - currentDayIndex;
    const daysUntilJobEnd = differenceInCalendarDays(jobEndDate, currentDayStart);
    
    const spanDays = Math.min(daysUntilWeekEnd, daysUntilJobEnd);
    const extendsBeyondWeek = jobEndDate > lastVisibleDay;

    return {
      shouldRender: true,
      spanDays: Math.max(1, spanDays),
      isFirstDay,
      extendsBeyondWeek
    };
  };

  const getTeamColor = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team?.color || '#3b82f6';
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const jobId = active.id as string;
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) {
      setActiveId(null);
      return;
    }

    // If dropped on unscheduled area
    if (over.id === 'unscheduled') {
      updateJobMutation.mutate({
        id: jobId,
        data: {
          scheduledStartAt: null,
          scheduledEndAt: null,
          status: 'Unscheduled',
          tenantConfirmed: false,
        },
      });
      setActiveId(null);
      return;
    }

    // If dropped on a time slot
    if (over.id.toString().startsWith('day-') && over.id.toString().includes('-time-')) {
      const parts = over.id.toString().split('-');
      const dayIndex = parseInt(parts[1]);
      const targetHour = parseInt(parts[3]);
      const targetDate = weekDays[dayIndex];
      
      // Calculate duration in milliseconds to preserve exact time components
      let durationMs = 0;
      if (job.scheduledStartAt && job.scheduledEndAt) {
        const originalStart = parseISO(job.scheduledStartAt);
        const originalEnd = parseISO(job.scheduledEndAt);
        durationMs = originalEnd.getTime() - originalStart.getTime();
      }
      
      // Calculate new start and end times
      let newStartDate: Date;
      let newEndDate: Date;
      
      if (!job.scheduledStartAt) {
        // New job being scheduled - use the dropped time slot
        let durationMinutes = 120; // default 2 hours
        
        // Try to parse time preferences from notes field
        if (job.notes) {
          try {
            const parsed = JSON.parse(job.notes);
            if (parsed.timePreferences) {
              durationMinutes = parsed.timePreferences.duration || 120;
            }
          } catch (e) {
            // If notes isn't JSON or doesn't have timePreferences, use defaults
          }
        }
        
        // Use the target hour from the drop zone
        newStartDate = new Date(targetDate);
        newStartDate.setHours(targetHour, 0, 0, 0);
        
        // Calculate end time based on duration
        newEndDate = new Date(newStartDate.getTime() + durationMinutes * 60 * 1000);
        
        // For multi-day jobs, extend the end date
        if (job.durationDays > 1) {
          newEndDate = new Date(addDays(newStartDate, job.durationDays - 1).getTime() + durationMinutes * 60 * 1000);
        }
      } else {
        // Existing job being rescheduled - use the new time slot hour but preserve minutes and duration
        const originalStart = parseISO(job.scheduledStartAt);
        const originalMinutes = originalStart.getMinutes();
        
        // Set to new day and new hour, but preserve minutes
        newStartDate = new Date(targetDate);
        newStartDate.setHours(targetHour, originalMinutes, 0, 0);
        
        // Preserve the exact duration
        newEndDate = new Date(newStartDate.getTime() + durationMs);
      }
      
      // Update job with new scheduled date - jobs dropped on time slots are not all-day
      updateJobMutation.mutate({
        id: jobId,
        data: {
          scheduledStartAt: newStartDate.toISOString(),
          scheduledEndAt: newEndDate.toISOString(),
          isAllDay: false, // Time slot scheduling is never all-day
          status: 'Scheduled',
          tenantConfirmed: false, // Manual moves require tenant confirmation
        },
      });
    }

    setActiveId(null);
  };

  const handleCreateJob = () => {
    // Calculate end time from duration
    const calculateEndTime = (start: string, durationMinutes: number): string => {
      const [hours, minutes] = start.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    };
    
    // Store time preferences and address details in notes field as JSON for unscheduled jobs
    let notes = jobFormData.description || '';
    const addressDetails = {
      address: jobFormData.address,
      city: jobFormData.city,
      state: jobFormData.state,
      tel: jobFormData.tel,
      email: jobFormData.email,
      contactPerson: jobFormData.contactPerson,
    };
    
    if (!jobFormData.allDay) {
      const timePrefs = {
        startTime: jobFormData.startTime,
        duration: jobFormData.duration,
      };
      notes = JSON.stringify({ 
        timePreferences: timePrefs, 
        description: jobFormData.description,
        addressDetails: addressDetails,
      });
    } else {
      notes = JSON.stringify({ 
        description: jobFormData.description,
        addressDetails: addressDetails,
      });
    }
    
    const payload: any = {
      title: jobFormData.title,
      description: jobFormData.description,
      teamId: jobFormData.teamId,
      urgency: jobFormData.urgency,
      propertyId: jobFormData.propertyId,
      address: jobFormData.address || null,
      durationDays: jobFormData.durationDays,
      status: 'Unscheduled',
      isAllDay: jobFormData.allDay,
      tenantConfirmed: false,
      notes: notes,
    };
    
    // Don't include scheduledStartAt/scheduledEndAt for unscheduled jobs (omit instead of null)
    createJobMutation.mutate(payload);
  };

  const handleCreateTeam = () => {
    if (editingTeam) {
      updateTeamMutation.mutate({
        id: editingTeam.id,
        data: {
          name: teamFormData.name,
          specialty: teamFormData.specialty,
          color: teamFormData.color,
        }
      });
    } else {
      createTeamMutation.mutate({
        name: teamFormData.name,
        specialty: teamFormData.specialty,
        color: teamFormData.color,
      });
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setCreatingNewTeam(false);
    setTeamFormData({
      id: team.id,
      name: team.name,
      specialty: team.specialty,
      color: team.color,
      isActive: true,
    });
    setShowTeamDialog(true);
  };

  const activeJob = activeId ? jobs.find(j => j.id === activeId) : null;

  if (!user) {
    return (
      <div className="flex h-screen bg-background text-foreground dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Contractor Schedule" />
          <main className="flex-1 p-6">
            <p className="text-muted-foreground dark:text-gray-400">Please log in to view contractor schedules.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contractor Schedule" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground dark:text-white mb-2" data-testid="text-page-title">
                Contractor Schedule
              </h1>
              <p className="text-muted-foreground dark:text-gray-400">
                Manage team schedules and job assignments
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={showTeamDialog} onOpenChange={(open) => {
                setShowTeamDialog(open);
                if (!open) {
                  setEditingTeam(null);
                  setCreatingNewTeam(false);
                  setTeamFormData({ id: null, name: '', specialty: 'General', color: '#3b82f6', isActive: true });
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-team">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Teams
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTeam ? 'Edit Team' : 'Manage Teams'}</DialogTitle>
                    <DialogDescription>
                      {editingTeam ? 'Update team information.' : 'Create a new team or edit existing teams.'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!editingTeam && !creatingNewTeam && teams.length > 0 && (
                    <div className="space-y-2 mb-4 p-4 bg-muted dark:bg-gray-800 rounded-lg">
                      <Label className="text-sm font-medium">Existing Teams</Label>
                      <div className="space-y-2">
                        {teams.map(team => (
                          <div
                            key={team.id}
                            className="flex items-center justify-between p-2 bg-card dark:bg-gray-900 rounded border border-border dark:border-gray-700"
                            data-testid={`team-item-${team.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: team.color }}
                              />
                              <div>
                                <p className="text-sm font-medium">{team.name}</p>
                                <p className="text-xs text-muted-foreground">{team.specialty}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTeam(team)}
                              data-testid={`button-edit-team-${team.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(editingTeam || creatingNewTeam || teams.length === 0) && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="team-name">Team Name</Label>
                        <Input
                          id="team-name"
                          value={teamFormData.name}
                          onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                          placeholder="e.g., ABC Plumbing"
                          data-testid="input-team-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="team-specialty">Specialty</Label>
                        <Select
                          value={teamFormData.specialty}
                          onValueChange={(value: any) => {
                            setTeamFormData({ ...teamFormData, specialty: value });
                            toggleFavoriteSpecialty(value);
                          }}
                        >
                          <SelectTrigger id="team-specialty" data-testid="select-team-specialty">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const { favoriteSpecs, otherSpecs } = getSortedSpecialties();
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected specialties are automatically starred
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="team-color">Team Color</Label>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                className={cn(
                                  "w-10 h-10 rounded-md border-2 transition-all",
                                  teamFormData.color === color.value
                                    ? "border-foreground dark:border-white scale-110"
                                    : "border-transparent hover:scale-105"
                                )}
                                style={{ backgroundColor: color.value }}
                                onClick={() => setTeamFormData({ ...teamFormData, color: color.value })}
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
                              value={teamFormData.color}
                              onChange={(e) => setTeamFormData({ ...teamFormData, color: e.target.value })}
                              className="w-20 h-8"
                              data-testid="input-team-color"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {(editingTeam || creatingNewTeam) && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingTeam(null);
                              setCreatingNewTeam(false);
                              setTeamFormData({ id: null, name: '', specialty: 'General', color: '#3b82f6', isActive: true });
                            }}
                            className="flex-1"
                            data-testid="button-cancel-edit"
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          onClick={handleCreateTeam}
                          disabled={!teamFormData.name || createTeamMutation.isPending || updateTeamMutation.isPending}
                          className="flex-1"
                          data-testid="button-submit-team"
                        >
                          {createTeamMutation.isPending || updateTeamMutation.isPending 
                            ? 'Saving...' 
                            : editingTeam 
                              ? 'Update Team' 
                              : 'Create Team'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!editingTeam && !creatingNewTeam && teams.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreatingNewTeam(true);
                        setTeamFormData({ id: null, name: '', specialty: 'General', color: '#3b82f6', isActive: true });
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

              <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-job">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Job
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Job</DialogTitle>
                    <DialogDescription>
                      Add a new job to the unscheduled queue. Drag it to a day to schedule it.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="job-title">Job Title</Label>
                      <Input
                        id="job-title"
                        value={jobFormData.title}
                        onChange={(e) => setJobFormData({ ...jobFormData, title: e.target.value })}
                        placeholder="e.g., Fix leaky faucet"
                        data-testid="input-job-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="job-description">Description</Label>
                      <Textarea
                        id="job-description"
                        value={jobFormData.description}
                        onChange={(e) => setJobFormData({ ...jobFormData, description: e.target.value })}
                        placeholder="Additional details..."
                        data-testid="input-job-description"
                      />
                    </div>
                    <div>
                      <Label htmlFor="job-team">Assign to Team</Label>
                      <Select
                        value={jobFormData.teamId}
                        onValueChange={(value) => setJobFormData({ ...jobFormData, teamId: value })}
                      >
                        <SelectTrigger id="job-team" data-testid="select-job-team">
                          <SelectValue placeholder="Select a team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map(team => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name} ({team.specialty})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Collapsible open={addressExpanded} onOpenChange={setAddressExpanded}>
                      <div className="space-y-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-between"
                            data-testid="button-toggle-address"
                          >
                            <span>Address (optional)</span>
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform",
                              addressExpanded && "rotate-180"
                            )} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3">
                          <div>
                            <Label htmlFor="job-address" className="text-sm">Street Address</Label>
                            <Input
                              id="job-address"
                              value={jobFormData.address}
                              onChange={(e) => setJobFormData({ ...jobFormData, address: e.target.value })}
                              placeholder="e.g., 123 Main St, Apt 4B"
                              data-testid="input-job-address"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="job-city" className="text-sm">City</Label>
                              <Input
                                id="job-city"
                                value={jobFormData.city}
                                onChange={(e) => setJobFormData({ ...jobFormData, city: e.target.value })}
                                placeholder="City"
                                data-testid="input-job-city"
                              />
                            </div>
                            <div>
                              <Label htmlFor="job-state" className="text-sm">State</Label>
                              <Input
                                id="job-state"
                                value={jobFormData.state}
                                onChange={(e) => setJobFormData({ ...jobFormData, state: e.target.value })}
                                placeholder="State"
                                data-testid="input-job-state"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="job-tel" className="text-sm">Phone</Label>
                              <Input
                                id="job-tel"
                                value={jobFormData.tel}
                                onChange={(e) => setJobFormData({ ...jobFormData, tel: e.target.value })}
                                placeholder="Phone number"
                                type="tel"
                                data-testid="input-job-tel"
                              />
                            </div>
                            <div>
                              <Label htmlFor="job-email" className="text-sm">Email</Label>
                              <Input
                                id="job-email"
                                value={jobFormData.email}
                                onChange={(e) => setJobFormData({ ...jobFormData, email: e.target.value })}
                                placeholder="Email address"
                                type="email"
                                data-testid="input-job-email"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="job-contact-person" className="text-sm">Contact Person</Label>
                            <Input
                              id="job-contact-person"
                              value={jobFormData.contactPerson}
                              onChange={(e) => setJobFormData({ ...jobFormData, contactPerson: e.target.value })}
                              placeholder="Contact name"
                              data-testid="input-job-contact-person"
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                    <div>
                      <Label htmlFor="job-urgency">Urgency</Label>
                      <Select
                        value={jobFormData.urgency}
                        onValueChange={(value: any) => setJobFormData({ ...jobFormData, urgency: value })}
                      >
                        <SelectTrigger id="job-urgency" data-testid="select-job-urgency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Emergent">Emergent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="duration-days" className="text-sm">
                        Duration: {jobFormData.durationDays} {jobFormData.durationDays === 1 ? 'day' : 'days'}
                      </Label>
                      <Slider
                        id="duration-days"
                        min={1}
                        max={7}
                        step={1}
                        value={[jobFormData.durationDays]}
                        onValueChange={([value]) => setJobFormData({ 
                          ...jobFormData, 
                          durationDays: value,
                          allDay: value > 1 ? true : jobFormData.allDay // Auto-select all-day for multi-day jobs
                        })}
                        className="mt-2"
                        data-testid="slider-duration-days"
                      />
                      {jobFormData.durationDays > 1 && (
                        <p className="text-xs text-muted-foreground dark:text-gray-400 mt-2 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          This job will span {jobFormData.durationDays} consecutive days on the calendar
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="all-day"
                          checked={jobFormData.allDay}
                          onChange={(e) => setJobFormData({ ...jobFormData, allDay: e.target.checked })}
                          className="rounded"
                          data-testid="checkbox-all-day"
                        />
                        <Label htmlFor="all-day" className="cursor-pointer">All Day</Label>
                      </div>
                      {!jobFormData.allDay && (
                        <>
                          <div>
                            <Label htmlFor="start-time" className="text-sm">Start Time</Label>
                            <Input
                              id="start-time"
                              type="time"
                              value={jobFormData.startTime}
                              onChange={(e) => setJobFormData({ ...jobFormData, startTime: e.target.value })}
                              data-testid="input-start-time"
                            />
                          </div>
                          <div>
                            <Label htmlFor="duration" className="text-sm">
                              Duration: {Math.floor(jobFormData.duration / 60)}h {jobFormData.duration % 60}m
                            </Label>
                            <Slider
                              id="duration"
                              min={30}
                              max={480}
                              step={30}
                              value={[jobFormData.duration]}
                              onValueChange={([value]) => setJobFormData({ ...jobFormData, duration: value })}
                              className="mt-2"
                              data-testid="slider-duration"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <Button
                      onClick={handleCreateJob}
                      disabled={!jobFormData.title || !jobFormData.teamId || createJobMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-job"
                    >
                      {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-[1fr_250px] gap-6">
              {/* Weekly Calendar */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                          data-testid="button-prev-week"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle className="text-xl">
                          {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                          data-testid="button-next-week"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="hide-weekends"
                            checked={hideWeekends}
                            onCheckedChange={(checked) => setHideWeekends(checked as boolean)}
                            data-testid="checkbox-hide-weekends"
                          />
                          <Label htmlFor="hide-weekends" className="text-sm cursor-pointer">
                            Hide Weekends
                          </Label>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                          data-testid="button-today"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Today
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <div className="grid gap-2" style={{ gridTemplateColumns: hideWeekends ? '60px repeat(5, 1fr)' : '60px repeat(7, 1fr)' }}>
                        {/* Time labels column */}
                        <div className="pr-2 border-r border-border dark:border-gray-700">
                          <div className="h-[60px]"></div> {/* Spacer for header */}
                          {Array.from({ length: 15 }, (_, i) => i + 6).map(hour => (
                            <div key={hour} className="h-[40px] text-xs text-muted-foreground dark:text-gray-400 text-right pr-2">
                              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                            </div>
                          ))}
                        </div>
                        
                        {/* Day columns */}
                        {weekDays.map((day, index) => {
                          const dayJobs = getJobsForDay(day);
                          const isToday = isSameDay(day, new Date());
                          
                          return (
                            <DayColumn
                              key={index}
                              dayIndex={index}
                              date={day}
                              jobs={dayJobs}
                              teams={teams}
                              weekDays={weekDays}
                              calculateJobSpan={calculateJobSpan}
                              isToday={isToday}
                              onConfirmJob={(jobId) => {
                                updateJobMutation.mutate({
                                  id: jobId,
                                  data: { tenantConfirmed: true }
                                });
                              }}
                              onClick={(job) => {
                                setSelectedJob(job);
                                setShowJobDetailsDialog(true);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Unscheduled Jobs Sidebar */}
              <UnscheduledJobsPanel 
                jobs={unscheduledJobs} 
                teams={teams} 
                activeId={activeId}
                onJobClick={(job) => {
                  setSelectedJob(job);
                  setShowJobDetailsDialog(true);
                }}
              />
            </div>

            <DragOverlay>
              {activeJob ? (
                <div className="cursor-grabbing">
                  <JobCard
                    job={activeJob}
                    team={teams.find(t => t.id === activeJob.teamId)}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <div className="mt-6">
            <TeamLegend 
              teams={teams} 
              jobs={jobs} 
              isCollapsed={legendCollapsed}
              onToggle={() => setLegendCollapsed(!legendCollapsed)}
            />
          </div>

          <JobDetailsDialog
            job={selectedJob}
            team={selectedJob ? teams.find(t => t.id === selectedJob.teamId) : undefined}
            open={showJobDetailsDialog}
            onOpenChange={setShowJobDetailsDialog}
          />
        </main>
      </div>
    </div>
  );
}

function JobCard({ 
  job, 
  team, 
  isDragging, 
  spanDays = 1,
  isFirstDay = true,
  extendsBeyondWeek = false,
  onConfirm, 
  onClick 
}: { 
  job: ScheduledJob; 
  team?: Team; 
  isDragging?: boolean; 
  spanDays?: number;
  isFirstDay?: boolean;
  extendsBeyondWeek?: boolean;
  onConfirm?: (jobId: string) => void;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: job.id,
  });

  const isMultiDay = spanDays > 1 || extendsBeyondWeek;
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;
  
  const showConfirmButton = !job.tenantConfirmed && job.scheduledStartAt && onConfirm;

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'Low':
        return <Circle className="h-3 w-3 text-slate-500 dark:text-slate-400" />;
      case 'High':
        return <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-500" />;
      case 'Emergent':
        return <Zap className="h-4 w-4 text-red-600 dark:text-red-500" />;
      default:
        return null;
    }
  };

  const backgroundColor = team?.color || '#3b82f6';
  
  const wrapperStyle = isMultiDay && job.scheduledStartAt ? {
    ...style,
    width: `calc(${spanDays * 100}% + ${(spanDays - 1) * 0.5}rem)`,
    position: 'relative' as const,
    zIndex: 20,
  } : style;
  
  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className={cn(
        "rounded-md transition-all overflow-hidden group",
        isDragging && "opacity-50",
        !job.tenantConfirmed && job.scheduledStartAt && "opacity-70 border-2 border-dashed border-white/50",
        isMultiDay ? "mb-1.5" : "mb-0"
      )}
      data-testid={`job-card-${job.id}`}
    >
      <div 
        {...listeners} 
        {...attributes} 
        onClick={onClick}
        className={cn(
          "cursor-grab active:cursor-grabbing p-2 relative",
          isMultiDay && "bg-gradient-to-r from-current via-current to-current/90"
        )}
        style={{ 
          backgroundColor,
          opacity: 0.85,
          backgroundImage: isMultiDay ? `linear-gradient(to right, ${backgroundColor}, ${backgroundColor}dd)` : undefined
        }}
      >
        <div 
          className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none"
        />
        
        <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
          {isMultiDay && (
            <Badge 
              variant="secondary" 
              className="h-5 px-1.5 text-[10px] bg-white/20 text-white border-white/30 backdrop-blur-sm"
              data-testid={`badge-duration-${job.id}`}
            >
              {job.durationDays} {job.durationDays === 1 ? 'day' : 'days'}
              {extendsBeyondWeek && ' →'}
            </Badge>
          )}
          {getUrgencyIcon(job.urgency)}
        </div>
        
        <div className="pr-6">
          <p className="font-medium text-sm text-white truncate drop-shadow-sm">
            {job.title}
          </p>
          {!job.isAllDay && job.scheduledStartAt && job.scheduledEndAt && (
            <p className="text-xs text-white/90 font-medium mt-0.5 drop-shadow-sm">
              {format(parseISO(job.scheduledStartAt), 'h:mm a')} - {format(parseISO(job.scheduledEndAt), 'h:mm a')}
            </p>
          )}
          {!job.scheduledStartAt && !job.isAllDay && job.notes && (() => {
            try {
              const parsed = JSON.parse(job.notes);
              if (parsed.timePreferences) {
                const { startTime, duration } = parsed.timePreferences;
                const [hours, mins] = startTime.split(':').map(Number);
                const startMinutes = hours * 60 + mins;
                const endMinutes = startMinutes + duration;
                const endHours = Math.floor(endMinutes / 60) % 24;
                const endMins = endMinutes % 60;
                const formatTime = (h: number, m: number) => {
                  const period = h >= 12 ? 'PM' : 'AM';
                  const hour12 = h % 12 || 12;
                  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
                };
                return (
                  <p className="text-xs text-white/90 font-medium mt-0.5 drop-shadow-sm">
                    {formatTime(hours, mins)} - {formatTime(endHours, endMins)} ({duration}min)
                  </p>
                );
              }
            } catch (e) {}
            return null;
          })()}
          {isMultiDay && job.address && (
            <p className="text-xs text-white/80 truncate mt-0.5">
              {job.address}
            </p>
          )}
        </div>
      </div>
      
      {showConfirmButton && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-1 h-6 text-xs rounded-t-none"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm(job.id);
          }}
          data-testid={`button-confirm-${job.id}`}
        >
          <Check className="h-3 w-3 mr-1" />
          Confirm
        </Button>
      )}
    </div>
  );
}

function TimeSlot({ dayIndex, hour, date, isOver }: {
  dayIndex: number;
  hour: number;
  date: Date;
  isOver: boolean;
}) {
  const hourFormatted = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  
  return (
    <TooltipProvider>
      <Tooltip open={isOver} delayDuration={0}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "h-[40px] border-b border-border/30 dark:border-gray-700/30 transition-colors relative",
              isOver && "bg-primary/20 dark:bg-blue-500/20 border-primary dark:border-blue-500"
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-sm font-medium">
          {format(date, 'EEE MMM d')} at {hourFormatted}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DayColumn({ dayIndex, date, jobs, teams, weekDays, calculateJobSpan, isToday, onConfirmJob, onClick }: {
  dayIndex: number;
  date: Date;
  jobs: ScheduledJob[];
  teams: Team[];
  weekDays: Date[];
  calculateJobSpan: (job: ScheduledJob, currentDay: Date, weekDays: Date[]) => {
    shouldRender: boolean;
    spanDays: number;
    isFirstDay: boolean;
    extendsBeyondWeek: boolean;
  };
  isToday: boolean;
  onConfirmJob?: (jobId: string) => void;
  onClick?: (job: ScheduledJob) => void;
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM to 8 PM
  const [hoveredTimeSlot, setHoveredTimeSlot] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "rounded-lg border relative",
        "bg-card dark:bg-gray-800 border-border dark:border-gray-700",
        isToday && "border-primary dark:border-blue-500 border-2"
      )}
      data-testid={`day-column-${dayIndex}`}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card dark:bg-gray-800 px-2 py-2 border-b border-border dark:border-gray-700">
        <p className={cn(
          "text-sm font-medium",
          isToday ? "text-primary dark:text-blue-400" : "text-foreground dark:text-white"
        )}>
          {format(date, 'EEE')}
        </p>
        <p className={cn(
          "text-lg font-bold",
          isToday ? "text-primary dark:text-blue-400" : "text-foreground dark:text-white"
        )}>
          {format(date, 'd')}
        </p>
      </div>
      
      {/* Time slots with drop zones */}
      <div className="relative">
        {hours.map(hour => {
          const slotId = `day-${dayIndex}-time-${hour}`;
          const { setNodeRef, isOver } = useDroppable({ id: slotId });
          
          return (
            <div
              key={hour}
              ref={setNodeRef}
              onMouseEnter={() => setHoveredTimeSlot(hour)}
              onMouseLeave={() => setHoveredTimeSlot(null)}
            >
              <TimeSlot
                dayIndex={dayIndex}
                hour={hour}
                date={date}
                isOver={isOver}
              />
            </div>
          );
        })}
        
        {/* Jobs overlay - positioned absolutely */}
        <div className="absolute inset-0 pointer-events-none px-2">
          <div className="relative h-full pointer-events-auto">
            {jobs.map(job => {
              const team = teams.find(t => t.id === job.teamId);
              const spanInfo = calculateJobSpan(job, date, weekDays);
              
              if (!spanInfo.shouldRender) {
                return null;
              }
              
              // Calculate vertical position based on job time
              let topPosition = 0;
              let heightPx = 80; // default height
              
              if (job.scheduledStartAt && !job.isAllDay) {
                const startTime = parseISO(job.scheduledStartAt);
                const hours = startTime.getHours();
                const minutes = startTime.getMinutes();
                // Each hour slot is 40px, starting from hour 6
                topPosition = (hours - 6) * 40 + (minutes / 60) * 40;
                
                // Calculate height based on duration
                if (job.scheduledEndAt) {
                  const endTime = parseISO(job.scheduledEndAt);
                  const durationMs = endTime.getTime() - startTime.getTime();
                  const durationHours = durationMs / (1000 * 60 * 60);
                  heightPx = Math.max(40, durationHours * 40);
                }
              }
              
              return (
                <div
                  key={job.id}
                  style={{ 
                    position: 'absolute',
                    top: `${topPosition}px`,
                    left: 0,
                    right: 0,
                    height: job.scheduledStartAt && !job.isAllDay ? `${heightPx}px` : 'auto'
                  }}
                >
                  <JobCard
                    job={job}
                    team={team}
                    spanDays={spanInfo.spanDays}
                    isFirstDay={spanInfo.isFirstDay}
                    extendsBeyondWeek={spanInfo.extendsBeyondWeek}
                    onConfirm={onConfirmJob}
                    onClick={() => onClick?.(job)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamLegend({ teams, jobs, isCollapsed, onToggle }: { 
  teams: Team[]; 
  jobs: ScheduledJob[]; 
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const getActiveJobsCount = (teamId: string) => {
    return jobs.filter(j => j.teamId === teamId && j.status !== 'Completed' && j.status !== 'Cancelled').length;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          data-testid="button-toggle-legend"
        >
          <CardTitle className="text-base">Teams & Legend</CardTitle>
          <ChevronDown className={cn(
            "h-5 w-5 transition-transform text-muted-foreground",
            !isCollapsed && "rotate-180"
          )} />
        </button>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground dark:text-gray-400 mb-2">Teams</p>
              <div className="flex flex-wrap gap-2">
                {teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    No teams yet. Create one to get started.
                  </p>
                ) : (
                  teams.map(team => (
                    <TooltipProvider key={team.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border dark:border-gray-700 bg-card dark:bg-gray-800 cursor-help"
                            data-testid={`team-legend-${team.id}`}
                          >
                            <div
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="text-sm font-medium text-foreground dark:text-white">
                              {team.name}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <p className="font-semibold">{team.name}</p>
                            <p className="text-xs text-muted-foreground">Specialty: {team.specialty}</p>
                            <p className="text-xs text-muted-foreground">Active Jobs: {getActiveJobsCount(team.id)}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground dark:text-gray-400 mb-2">Urgency Levels</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2" data-testid="urgency-legend-low">
                  <Circle className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm text-foreground dark:text-white">Low</span>
                </div>
                <div className="flex items-center gap-2" data-testid="urgency-legend-high">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-500" />
                  <span className="text-sm text-foreground dark:text-white">High</span>
                </div>
                <div className="flex items-center gap-2" data-testid="urgency-legend-emergent">
                  <Zap className="h-4 w-4 text-red-600 dark:text-red-500" />
                  <span className="text-sm text-foreground dark:text-white">Emergent</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function UnscheduledJobsPanel({ 
  jobs, 
  teams, 
  activeId, 
  onJobClick 
}: { 
  jobs: ScheduledJob[]; 
  teams: Team[]; 
  activeId: string | null;
  onJobClick: (job: ScheduledJob) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled',
  });

  return (
    <div ref={setNodeRef}>
      <Card className={cn(
        "transition-all",
        isOver && "ring-2 ring-primary dark:ring-blue-500 bg-primary/5 dark:bg-blue-900/20"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            Unscheduled Jobs
            {isOver && (
              <Badge variant="secondary" className="text-xs">
                Drop to unschedule
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {isOver ? "Drop here to unschedule" : "No unscheduled jobs"}
            </p>
          ) : (
            jobs.map(job => {
              const team = teams.find(t => t.id === job.teamId);
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  team={team}
                  isDragging={activeId === job.id}
                  onClick={() => onJobClick(job)}
                />
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobDetailsDialog({ 
  job, 
  team, 
  open, 
  onOpenChange 
}: { 
  job: ScheduledJob | null; 
  team?: Team; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-job-details">
        <DialogHeader>
          <DialogTitle className="text-xl" data-testid="text-job-details-title">
            {job.title}
          </DialogTitle>
          <DialogDescription>
            View job details and information
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Team</Label>
              <div className="flex items-center gap-2 mt-1">
                {team && (
                  <>
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: team.color }}
                    />
                    <p className="text-sm font-medium" data-testid="text-job-team">
                      {team.name} ({team.specialty})
                    </p>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Urgency</Label>
              <Badge variant="secondary" className={cn("mt-1", URGENCY_COLORS[job.urgency])} data-testid="badge-job-urgency">
                {job.urgency}
              </Badge>
            </div>
          </div>

          {job.address && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Address</Label>
              <p className="text-sm mt-1" data-testid="text-job-address">{job.address}</p>
            </div>
          )}

          {job.scheduledStartAt && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Start Time</Label>
                <p className="text-sm mt-1" data-testid="text-job-start">
                  {format(parseISO(job.scheduledStartAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">End Time</Label>
                <p className="text-sm mt-1" data-testid="text-job-end">
                  {job.scheduledEndAt ? format(parseISO(job.scheduledEndAt), 'MMM d, yyyy h:mm a') : 'Not set'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
              <p className="text-sm mt-1" data-testid="text-job-status">{job.status}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
              <p className="text-sm mt-1" data-testid="text-job-duration">
                {job.durationDays} {job.durationDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>

          {job.description && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Description</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap" data-testid="text-job-description">
                {job.description}
              </p>
            </div>
          )}

          {job.notes && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground" data-testid="text-job-notes">
                {job.notes}
              </p>
            </div>
          )}

          {!job.tenantConfirmed && job.scheduledStartAt && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Awaiting tenant confirmation
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
