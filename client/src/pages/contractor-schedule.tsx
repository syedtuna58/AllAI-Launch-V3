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
  allDay: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  tenantConfirmed: boolean;
  orgId: string;
  createdAt: string;
  updatedAt: string;
};

const URGENCY_COLORS = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  emergency: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export default function ContractorSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [jobFormData, setJobFormData] = useState({
    title: '',
    description: '',
    teamId: '',
    urgency: 'medium' as const,
    propertyId: null,
  });
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    specialty: 'general' as const,
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
      setTeamFormData({ name: '', specialty: 'general', color: '#3b82f6' });
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
        urgency: 'medium',
        propertyId: null,
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

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

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
        // New job being scheduled - set to span the full day (start to end)
        newStartDate = startOfDay(targetDate);
        newEndDate = endOfDay(targetDate);
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
          allDay: job.allDay ?? true,
          status: 'scheduled',
          tenantConfirmed: false, // Manual moves require tenant confirmation
        },
      });
    }

    setActiveId(null);
  };

  const handleCreateJob = () => {
    createJobMutation.mutate({
      ...jobFormData,
      status: 'scheduled',
      allDay: false,
      tenantConfirmed: false,
    });
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
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="handyman">Handyman</SelectItem>
                          <SelectItem value="hvac">HVAC</SelectItem>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="team-color">Team Color</Label>
                      <Input
                        id="team-color"
                        type="color"
                        value={teamFormData.color}
                        onChange={(e) => setTeamFormData({ ...teamFormData, color: e.target.value })}
                        data-testid="input-team-color"
                      />
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
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
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
            <div className="grid grid-cols-[300px_1fr] gap-6">
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
                      <Button
                        variant="outline"
                        onClick={() => setCurrentWeekStart(startOfWeek(new Date()))}
                        data-testid="button-today"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Today
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-2">
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
