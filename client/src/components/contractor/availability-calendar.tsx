import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Clock, CalendarOff, CalendarDays, CalendarClock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { ContractorAvailability, ContractorBlackout } from "@shared/schema";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const time = `${hour.toString().padStart(2, "0")}:${minute}`;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  return {
    value: time,
    label: `${displayHour}:${minute} ${ampm}`,
  };
});

const availabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
}).refine((data) => data.startTime < data.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

const blackoutSchema = z.object({
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  reason: z.string().optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});

interface AvailabilityCalendarProps {
  contractorId: string;
  onReviewCounterProposal?: (job: any) => void;
}

export default function AvailabilityCalendar({ contractorId, onReviewCounterProposal }: AvailabilityCalendarProps) {
  const { toast } = useToast();
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [isBlackoutDialogOpen, setIsBlackoutDialogOpen] = useState(false);

  // Fetch availability
  const { data: availability = [], isLoading: availabilityLoading } = useQuery<ContractorAvailability[]>({
    queryKey: ["/api/contractors", contractorId, "availability"],
  });

  // Fetch blackouts
  const { data: blackouts = [], isLoading: blackoutsLoading } = useQuery<ContractorBlackout[]>({
    queryKey: ["/api/contractors", contractorId, "blackouts"],
  });

  // Fetch scheduled jobs for this contractor
  const { data: scheduledJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/scheduled-jobs"],
    select: (jobs) => jobs.filter(job => job.contractorId === contractorId),
  });

  // Add availability mutation
  const addAvailabilityMutation = useMutation({
    mutationFn: async (data: z.infer<typeof availabilitySchema>) => {
      return await apiRequest("POST", `/api/contractors/${contractorId}/availability`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", contractorId, "availability"] });
      toast({ title: "Availability added" });
      setIsAvailabilityDialogOpen(false);
      availabilityForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add blackout mutation
  const addBlackoutMutation = useMutation({
    mutationFn: async (data: z.infer<typeof blackoutSchema>) => {
      return await apiRequest("POST", `/api/contractors/${contractorId}/blackouts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", contractorId, "blackouts"] });
      toast({ title: "Time off added" });
      setIsBlackoutDialogOpen(false);
      blackoutForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add time off",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete availability mutation
  const deleteAvailabilityMutation = useMutation({
    mutationFn: async (availabilityId: string) => {
      return await apiRequest("DELETE", `/api/contractors/${contractorId}/availability/${availabilityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", contractorId, "availability"] });
      toast({ title: "Availability removed" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete blackout mutation
  const deleteBlackoutMutation = useMutation({
    mutationFn: async (blackoutId: string) => {
      return await apiRequest("DELETE", `/api/contractors/${contractorId}/blackouts/${blackoutId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", contractorId, "blackouts"] });
      toast({ title: "Time off removed" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove time off",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const availabilityForm = useForm<z.infer<typeof availabilitySchema>>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
    },
  });

  const blackoutForm = useForm<z.infer<typeof blackoutSchema>>({
    resolver: zodResolver(blackoutSchema),
  });

  const onSubmitAvailability = (data: z.infer<typeof availabilitySchema>) => {
    addAvailabilityMutation.mutate(data);
  };

  const onSubmitBlackout = (data: z.infer<typeof blackoutSchema>) => {
    addBlackoutMutation.mutate(data);
  };

  // Group availability by day
  const availabilityByDay = availability.reduce((acc, avail) => {
    if (!acc[avail.dayOfWeek]) {
      acc[avail.dayOfWeek] = [];
    }
    acc[avail.dayOfWeek].push(avail);
    return acc;
  }, {} as Record<number, ContractorAvailability[]>);

  return (
    <div className="space-y-6" data-testid="availability-calendar">
      {/* Weekly Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Weekly Schedule
            </CardTitle>
            <CardDescription>Set your regular working hours</CardDescription>
          </div>
          <Dialog open={isAvailabilityDialogOpen} onOpenChange={setIsAvailabilityDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-availability">
                <Plus className="h-4 w-4 mr-1" />
                Add Hours
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-availability">
              <DialogHeader>
                <DialogTitle>Add Available Hours</DialogTitle>
              </DialogHeader>
              <Form {...availabilityForm}>
                <form onSubmit={availabilityForm.handleSubmit(onSubmitAvailability)} className="space-y-4">
                  <FormField
                    control={availabilityForm.control}
                    name="dayOfWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Week</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-day-of-week">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={availabilityForm.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-start-time">
                              <SelectValue placeholder="Select start time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {TIME_OPTIONS.map((time) => (
                              <SelectItem key={time.value} value={time.value}>
                                {time.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={availabilityForm.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-end-time">
                              <SelectValue placeholder="Select end time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {TIME_OPTIONS.map((time) => (
                              <SelectItem key={time.value} value={time.value}>
                                {time.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={addAvailabilityMutation.isPending}
                      data-testid="button-submit-availability"
                    >
                      {addAvailabilityMutation.isPending ? "Adding..." : "Add Hours"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {availabilityLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : availability.length === 0 ? (
            <p className="text-muted-foreground" data-testid="text-no-availability">
              No availability set. Click "Add Hours" to set your schedule.
            </p>
          ) : (
            <div className="space-y-2">
              {DAYS_OF_WEEK.map((day) => {
                const dayAvailability = availabilityByDay[day.value] || [];
                return (
                  <div
                    key={day.value}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`availability-day-${day.value}`}
                  >
                    <span className="font-medium w-24">{day.label}</span>
                    <div className="flex-1">
                      {dayAvailability.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Unavailable</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dayAvailability.map((avail) => (
                            <div
                              key={avail.id}
                              className="flex items-center gap-1 text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-2 py-1 rounded"
                              data-testid={`availability-slot-${avail.id}`}
                            >
                              <span>{avail.startTime} - {avail.endTime}</span>
                              <button
                                onClick={() => deleteAvailabilityMutation.mutate(avail.id)}
                                disabled={deleteAvailabilityMutation.isPending}
                                className="ml-1 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                data-testid={`button-delete-availability-${avail.id}`}
                                title="Remove this time slot"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Off / Blackouts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Time Off
            </CardTitle>
            <CardDescription>Block out vacation days or unavailable periods</CardDescription>
          </div>
          <Dialog open={isBlackoutDialogOpen} onOpenChange={setIsBlackoutDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-blackout">
                <Plus className="h-4 w-4 mr-1" />
                Add Time Off
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-blackout">
              <DialogHeader>
                <DialogTitle>Add Time Off</DialogTitle>
              </DialogHeader>
              <Form {...blackoutForm}>
                <form onSubmit={blackoutForm.handleSubmit(onSubmitBlackout)} className="space-y-4">
                  <FormField
                    control={blackoutForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          className="rounded-md border"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={blackoutForm.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date</FormLabel>
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          className="rounded-md border"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={blackoutForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Vacation, Personal time"
                            {...field}
                            data-testid="input-blackout-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={addBlackoutMutation.isPending}
                      data-testid="button-submit-blackout"
                    >
                      {addBlackoutMutation.isPending ? "Adding..." : "Add Time Off"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {blackoutsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : blackouts.length === 0 ? (
            <p className="text-muted-foreground" data-testid="text-no-blackouts">
              No time off scheduled.
            </p>
          ) : (
            <div className="space-y-2">
              {blackouts.map((blackout) => (
                <div
                  key={blackout.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-orange-50 dark:bg-orange-950"
                  data-testid={`blackout-${blackout.id}`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <div>
                      <p className="font-medium">
                        {format(new Date(blackout.startDate), "MMM d, yyyy")} - {format(new Date(blackout.endDate), "MMM d, yyyy")}
                      </p>
                      {blackout.reason && (
                        <p className="text-sm text-muted-foreground">{blackout.reason}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteBlackoutMutation.mutate(blackout.id)}
                    disabled={deleteBlackoutMutation.isPending}
                    data-testid={`button-delete-blackout-${blackout.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>Your upcoming scheduled maintenance jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {scheduledJobs.length === 0 ? (
            <p className="text-muted-foreground">No scheduled jobs.</p>
          ) : (
            <div className="space-y-2">
              {scheduledJobs
                .sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime())
                .map((job) => {
                  const needsReview = job.status === 'Needs Review';
                  return (
                    <div
                      key={job.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        needsReview 
                          ? 'bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700 animate-pulse' 
                          : 'bg-muted/50'
                      }`}
                      data-testid={`job-${job.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {needsReview ? (
                          <CalendarClock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        ) : (
                          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{job.title}</p>
                            {needsReview && (
                              <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                <AlertCircle className="h-3 w-3" />
                                Counter-Proposal
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {job.scheduledStartAt && format(new Date(job.scheduledStartAt), "MMM d, yyyy 'at' h:mm a")}
                            {job.scheduledEndAt && ` - ${format(new Date(job.scheduledEndAt), "h:mm a")}`}
                          </p>
                          {job.description && (
                            <p className="text-xs text-muted-foreground mt-1">{job.description}</p>
                          )}
                        </div>
                      </div>
                      {needsReview && onReviewCounterProposal && (
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700"
                          onClick={() => onReviewCounterProposal(job)}
                        >
                          Review
                        </Button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
