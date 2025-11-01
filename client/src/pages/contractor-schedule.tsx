import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
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
    startTime: '08:00',
    duration: 120, // in minutes (default 2 hours)
    allDay: false,
  });
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
        startTime: '08:00',
        duration: 120,
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
          <Header />
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
        <Header />
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
            <div className="grid grid-cols-[1fr_320px] gap-6">
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
                    <div className={cn("grid gap-2", hideWeekends ? "grid-cols-5" : "grid-cols-7")}>
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
                  <CardHeader>
                    <CardTitle className="text-lg">Unscheduled Jobs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
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
        </main>
      </div>
    </div>
  );
}

function JobCard({ job, team, isDragging }: { job: ScheduledJob; team?: Team; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: job.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all",
        "bg-white dark:bg-gray-800 border-border dark:border-gray-700",
        isDragging && "opacity-50",
        !job.tenantConfirmed && job.scheduledStartAt && "opacity-60 border-dashed"
      )}
      data-testid={`job-card-${job.id}`}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-1 h-full rounded"
          style={{ backgroundColor: team?.color || '#3b82f6' }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground dark:text-white truncate">
            {job.title}
          </p>
          {team && (
            <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
              {team.name}
            </p>
          )}
          {job.scheduledStartAt && !job.isAllDay && (
            <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
              {format(parseISO(job.scheduledStartAt), 'h:mm a')} - {format(parseISO(job.scheduledEndAt!), 'h:mm a')}
            </p>
          )}
          <div className="flex gap-1 mt-2">
            <Badge variant="secondary" className={cn("text-xs", URGENCY_COLORS[job.urgency])}>
              {job.urgency}
            </Badge>
            {!job.tenantConfirmed && job.scheduledStartAt && (
              <Badge variant="outline" className="text-xs">
                Pending
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({ id, date, jobs, teams, isToday }: {
  id: string;
  date: Date;
  jobs: ScheduledJob[];
  teams: Team[];
  isToday: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[400px] p-2 rounded-lg border transition-colors",
        "bg-card dark:bg-gray-800 border-border dark:border-gray-700",
        isToday && "border-primary dark:border-blue-500 border-2",
        isOver && "bg-primary/10 dark:bg-blue-900/20"
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
      <div className="space-y-2">
        {jobs.map(job => {
          const team = teams.find(t => t.id === job.teamId);
          return (
            <JobCard
              key={job.id}
              job={job}
              team={team}
            />
          );
        })}
      </div>
    </div>
  );
}
