import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Plus, Users, Check, Circle, AlertTriangle, AlertOctagon, Zap, Info } from "lucide-react";
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
    startTime: '08:00',
    duration: 120, // in minutes (default 2 hours)
    durationDays: 1,
    allDay: false,
  });
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [showJobDetailsDialog, setShowJobDetailsDialog] = useState(false);
  const [hideWeekends, setHideWeekends] = useState(true);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    specialty: 'General' as const,
    color: '#3b82f6',
  });

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

  const createTeamMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/teams', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: "Team created successfully" });
      setShowTeamDialog(false);
      setTeamFormData({ name: '', specialty: 'General', color: '#3b82f6' });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create team",
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

    // If dropped on a day slot
    if (over.id.toString().startsWith('day-')) {
      const dayIndex = parseInt(over.id.toString().replace('day-', ''));
      const targetDate = weekDays[dayIndex];
      
      // Calculate duration in milliseconds to preserve exact time components
      let durationMs = 0;
      if (job.scheduledStartAt && job.scheduledEndAt) {
        const originalStart = parseISO(job.scheduledStartAt);
        const originalEnd = parseISO(job.scheduledEndAt);
        durationMs = originalEnd.getTime() - originalStart.getTime();
      }
      
      // For unscheduled jobs being scheduled for the first time, set to all-day
      let newStartDate: Date;
      let newEndDate: Date;
      
      if (!job.scheduledStartAt) {
        // New job being scheduled - check if it's all-day or has specific times
        if (job.isAllDay) {
          // All-day job: span the full day
          newStartDate = startOfDay(targetDate);
          newEndDate = endOfDay(targetDate);
        } else {
          // Non-all-day job: parse stored time preferences or use defaults
          let startHour = 8, startMin = 0, durationMinutes = 120;
          
          // Try to parse time preferences from notes field
          if (job.notes) {
            try {
              const parsed = JSON.parse(job.notes);
              if (parsed.timePreferences) {
                const [sH, sM] = parsed.timePreferences.startTime.split(':').map(Number);
                startHour = sH;
                startMin = sM;
                durationMinutes = parsed.timePreferences.duration || 120;
              }
            } catch (e) {
              // If notes isn't JSON or doesn't have timePreferences, use defaults
            }
          }
          
          newStartDate = new Date(targetDate);
          newStartDate.setHours(startHour, startMin, 0, 0);
          newEndDate = new Date(newStartDate.getTime() + durationMinutes * 60 * 1000);
        }
      } else {
        // Existing job being rescheduled - preserve time components by shifting the day
        const originalStart = parseISO(job.scheduledStartAt);
        const originalDayStart = startOfDay(originalStart);
        const targetDayStart = startOfDay(targetDate);
        
        // Calculate the time offset from start of original day
        const timeOffset = originalStart.getTime() - originalDayStart.getTime();
        
        // Apply the same time offset to the new target day
        newStartDate = new Date(targetDayStart.getTime() + timeOffset);
        newEndDate = new Date(newStartDate.getTime() + durationMs);
      }
      
      // Update job with new scheduled date, preserving exact duration
      updateJobMutation.mutate({
        id: jobId,
        data: {
          scheduledStartAt: newStartDate.toISOString(),
          scheduledEndAt: newEndDate.toISOString(),
          isAllDay: job.isAllDay ?? true,
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
    
    // Store time preferences in notes field as JSON for unscheduled jobs
    let notes = jobFormData.description || '';
    if (!jobFormData.allDay) {
      const timePrefs = {
        startTime: jobFormData.startTime,
        duration: jobFormData.duration,
      };
      notes = JSON.stringify({ timePreferences: timePrefs, description: jobFormData.description });
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
    createTeamMutation.mutate(teamFormData);
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
              <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-team">
                    <Users className="mr-2 h-4 w-4" />
                    Add Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                    <DialogDescription>
                      Add a new contractor team to your organization.
                    </DialogDescription>
                  </DialogHeader>
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
                        onValueChange={(value: any) => setTeamFormData({ ...teamFormData, specialty: value })}
                      >
                        <SelectTrigger id="team-specialty" data-testid="select-team-specialty">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Handyman">Handyman</SelectItem>
                          <SelectItem value="HVAC">HVAC</SelectItem>
                          <SelectItem value="Plumbing">Plumbing</SelectItem>
                          <SelectItem value="Electrical">Electrical</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <Button
                      onClick={handleCreateTeam}
                      disabled={!teamFormData.name || createTeamMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-team"
                    >
                      {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
                    </Button>
                  </div>
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
                    <div>
                      <Label htmlFor="job-address">Address</Label>
                      <Input
                        id="job-address"
                        value={jobFormData.address}
                        onChange={(e) => setJobFormData({ ...jobFormData, address: e.target.value })}
                        placeholder="e.g., 123 Main St, Apt 4B"
                        data-testid="input-job-address"
                      />
                    </div>
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
                        onValueChange={([value]) => setJobFormData({ ...jobFormData, durationDays: value })}
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
            <TeamLegend teams={teams} jobs={jobs} />
            
            <div className="grid grid-cols-[1fr_250px] gap-6 mt-6">
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
                            id={`day-${index}`}
                            date={day}
                            jobs={dayJobs}
                            teams={teams}
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
                  </CardContent>
                </Card>
              </div>

              {/* Unscheduled Jobs Sidebar */}
              <div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Unscheduled Jobs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {unscheduledJobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground dark:text-gray-400">
                        No unscheduled jobs
                      </p>
                    ) : (
                      unscheduledJobs.map(job => {
                        const team = teams.find(t => t.id === job.teamId);
                        return (
                          <JobCard
                            key={job.id}
                            job={job}
                            team={team}
                            isDragging={activeId === job.id}
                            onClick={() => {
                              setSelectedJob(job);
                              setShowJobDetailsDialog(true);
                            }}
                          />
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
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
  onConfirm, 
  onClick 
}: { 
  job: ScheduledJob; 
  team?: Team; 
  isDragging?: boolean; 
  onConfirm?: (jobId: string) => void;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: job.id,
  });

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
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-md transition-all overflow-hidden group",
        isDragging && "opacity-50",
        !job.tenantConfirmed && job.scheduledStartAt && "opacity-70 border-2 border-dashed border-white/50"
      )}
      data-testid={`job-card-${job.id}`}
    >
      <div 
        {...listeners} 
        {...attributes} 
        onClick={onClick}
        className="cursor-grab active:cursor-grabbing p-2 relative"
        style={{ 
          backgroundColor,
          opacity: 0.85 
        }}
      >
        <div 
          className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none"
        />
        
        <div className="absolute top-1 right-1 z-10">
          {getUrgencyIcon(job.urgency)}
        </div>
        
        <div className="pr-6">
          <p className="font-medium text-sm text-white truncate drop-shadow-sm">
            {job.title}
          </p>
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

function DayColumn({ id, date, jobs, teams, isToday, onConfirmJob, onClick }: {
  id: string;
  date: Date;
  jobs: ScheduledJob[];
  teams: Team[];
  isToday: boolean;
  onConfirmJob?: (jobId: string) => void;
  onClick?: (job: ScheduledJob) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <TooltipProvider>
      <Tooltip open={isHovered && isOver}>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              "min-h-[400px] p-2 rounded-lg border transition-colors",
              "bg-card dark:bg-gray-800 border-border dark:border-gray-700",
              isToday && "border-primary dark:border-blue-500 border-2",
              isOver && "bg-primary/10 dark:bg-blue-900/20 shadow-lg"
            )}
            data-testid={`day-column-${id}`}
          >
            <div className="mb-3">
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
            <div className="space-y-1.5">
              {jobs.map(job => {
                const team = teams.find(t => t.id === job.teamId);
                return (
                  <JobCard
                    key={job.id}
                    job={job}
                    team={team}
                    onConfirm={onConfirmJob}
                    onClick={() => onClick?.(job)}
                  />
                );
              })}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-sm">
          <p className="font-semibold">{format(date, 'EEEE, MMMM d')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Drop job here to schedule for this day
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TeamLegend({ teams, jobs }: { teams: Team[]; jobs: ScheduledJob[] }) {
  const getActiveJobsCount = (teamId: string) => {
    return jobs.filter(j => j.teamId === teamId && j.status !== 'Completed' && j.status !== 'Cancelled').length;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Team & Urgency Legend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground dark:text-gray-400 mb-2">Teams</p>
            <div className="flex flex-wrap gap-2">
              {teams.map(team => (
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
              ))}
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
    </Card>
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
