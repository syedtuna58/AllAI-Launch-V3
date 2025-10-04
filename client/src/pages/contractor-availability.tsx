import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Plus, Trash2, Wrench } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function ContractorAvailabilityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBlackoutDialog, setShowBlackoutDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [editingBlackout, setEditingBlackout] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");

  const { data: contractor, isLoading: loadingContractor } = useQuery<any>({
    queryKey: ['/api/contractors/me'],
  });

  const contractorId = contractor?.id;

  const { data: availability = [], isLoading: loadingAvailability } = useQuery<any[]>({
    queryKey: ['/api/contractors', contractorId, 'availability'],
    enabled: !!contractorId,
  });

  const { data: blackouts = [], isLoading: loadingBlackouts } = useQuery<any[]>({
    queryKey: ['/api/contractors', contractorId, 'blackouts'],
    enabled: !!contractorId,
  });

  const createAvailabilityMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/contractors/${contractorId}/availability`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractors', contractorId, 'availability'] });
      toast({ title: "Availability added successfully" });
      setShowAddDialog(false);
      setEditingSlot(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add availability", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      return apiRequest('PATCH', `/api/contractors/${contractorId}/availability/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractors', contractorId, 'availability'] });
      toast({ title: "Availability updated successfully" });
      setShowAddDialog(false);
      setEditingSlot(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update availability", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteAvailabilityMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/contractors/${contractorId}/availability/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractors', contractorId, 'availability'] });
      toast({ title: "Availability deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete availability", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const createBlackoutMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/contractors/${contractorId}/blackouts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractors', contractorId, 'blackouts'] });
      toast({ title: "Blackout date added successfully" });
      setShowBlackoutDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add blackout date", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateBlackoutMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      return apiRequest('PATCH', `/api/contractors/${contractorId}/blackouts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractors', contractorId, 'blackouts'] });
      toast({ title: "Blackout date updated successfully" });
      setShowBlackoutDialog(false);
      setEditingBlackout(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update blackout date", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteBlackoutMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/contractors/${contractorId}/blackouts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractors', contractorId, 'blackouts'] });
      toast({ title: "Blackout date removed successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to remove blackout date", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSaveAvailability = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      dayOfWeek: parseInt(selectedDay),
      startTime: formData.get('startTime') as string,
      endTime: formData.get('endTime') as string,
    };

    if (isNaN(data.dayOfWeek)) {
      toast({ 
        title: "Please select a day", 
        variant: "destructive" 
      });
      return;
    }

    if (editingSlot) {
      updateAvailabilityMutation.mutate({ id: editingSlot.id, data });
    } else {
      createAvailabilityMutation.mutate(data);
    }
  };

  const handleSaveBlackout = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      reason: formData.get('reason') as string || null,
    };

    if (editingBlackout) {
      updateBlackoutMutation.mutate({ id: editingBlackout.id, data });
    } else {
      createBlackoutMutation.mutate(data);
    }
  };

  const handleEditBlackout = (blackout: any) => {
    setEditingBlackout(blackout);
    setShowBlackoutDialog(true);
  };

  const handleAddBlackout = () => {
    setEditingBlackout(null);
    setShowBlackoutDialog(true);
  };

  const handleEditSlot = (slot: any) => {
    setEditingSlot(slot);
    setSelectedDay(slot.dayOfWeek.toString());
    setShowAddDialog(true);
  };

  const handleAddNew = () => {
    setEditingSlot(null);
    setSelectedDay("");
    setShowAddDialog(true);
  };

  const getAvailabilityByDay = (day: number) => {
    return availability.filter((slot: any) => slot.dayOfWeek === day);
  };

  if (loadingContractor) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Availability Management" />
          <main className="flex-1 overflow-auto p-6">
            <div className="text-center">Loading...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Availability Management" />
          <main className="flex-1 overflow-auto p-6">
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>You don't have a contractor profile.</p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Availability Management" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <Card data-testid="card-contractor-info">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    <span className="font-medium">{contractor.name}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-weekly-availability">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Weekly Availability
                    </CardTitle>
                    <CardDescription>Set your regular working hours</CardDescription>
                  </div>
                  <Dialog open={showAddDialog} onOpenChange={(open) => {
                    setShowAddDialog(open);
                    if (!open) {
                      setEditingSlot(null);
                      setSelectedDay("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={handleAddNew} data-testid="button-add-availability">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Time Slot
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="dialog-availability">
                      <DialogHeader>
                        <DialogTitle>
                          {editingSlot ? "Edit Time Slot" : "Add Time Slot"}
                        </DialogTitle>
                        <DialogDescription>
                          Set your available hours for a specific day
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSaveAvailability} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="dayOfWeek">Day of Week</Label>
                          <Select 
                            value={selectedDay}
                            onValueChange={setSelectedDay}
                            required
                          >
                            <SelectTrigger data-testid="select-day">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map((day) => (
                                <SelectItem key={day.value} value={day.value.toString()}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input
                              id="startTime"
                              name="startTime"
                              type="time"
                              defaultValue={editingSlot?.startTime || "09:00"}
                              required
                              data-testid="input-start-time"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="endTime">End Time</Label>
                            <Input
                              id="endTime"
                              name="endTime"
                              type="time"
                              defaultValue={editingSlot?.endTime || "17:00"}
                              required
                              data-testid="input-end-time"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowAddDialog(false);
                              setEditingSlot(null);
                            }}
                            data-testid="button-cancel"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createAvailabilityMutation.isPending || updateAvailabilityMutation.isPending}
                            data-testid="button-save-availability"
                          >
                            {editingSlot ? "Update" : "Add"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAvailability ? (
                  <p className="text-muted-foreground text-center py-4">Loading availability...</p>
                ) : availability.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4" data-testid="text-no-availability">
                    No availability set. Click "Add Time Slot" to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {DAYS.map((day) => {
                      const slots = getAvailabilityByDay(day.value);
                      return (
                        <div key={day.value} className="border rounded-lg p-3" data-testid={`availability-day-${day.value}`}>
                          <div className="font-medium mb-2">{day.label}</div>
                          {slots.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Not available</p>
                          ) : (
                            <div className="space-y-2">
                              {slots.map((slot: any) => (
                                <div 
                                  key={slot.id} 
                                  className="flex items-center justify-between bg-muted/50 rounded p-2"
                                  data-testid={`slot-${slot.id}`}
                                >
                                  <span className="text-sm">
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditSlot(slot)}
                                      data-testid={`button-edit-${slot.id}`}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deleteAvailabilityMutation.mutate(slot.id)}
                                      disabled={deleteAvailabilityMutation.isPending}
                                      data-testid={`button-delete-${slot.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-blackout-dates">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Blackout Dates
                    </CardTitle>
                    <CardDescription>Mark dates when you're unavailable (vacation, etc.)</CardDescription>
                  </div>
                  <Dialog open={showBlackoutDialog} onOpenChange={(open) => {
                    setShowBlackoutDialog(open);
                    if (!open) setEditingBlackout(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={handleAddBlackout} data-testid="button-add-blackout">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Blackout
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="dialog-blackout">
                      <DialogHeader>
                        <DialogTitle>{editingBlackout ? "Edit Blackout Date" : "Add Blackout Date"}</DialogTitle>
                        <DialogDescription>
                          Specify a date range when you'll be unavailable
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSaveBlackout} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="startDate">Start Date</Label>
                          <Input
                            id="startDate"
                            name="startDate"
                            type="date"
                            defaultValue={editingBlackout?.startDate?.split('T')[0] || ''}
                            required
                            data-testid="input-blackout-start"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endDate">End Date</Label>
                          <Input
                            id="endDate"
                            name="endDate"
                            type="date"
                            defaultValue={editingBlackout?.endDate?.split('T')[0] || ''}
                            required
                            data-testid="input-blackout-end"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reason">Reason (Optional)</Label>
                          <Input
                            id="reason"
                            name="reason"
                            defaultValue={editingBlackout?.reason || ''}
                            placeholder="e.g., Vacation, Conference"
                            data-testid="input-blackout-reason"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowBlackoutDialog(false);
                              setEditingBlackout(null);
                            }}
                            data-testid="button-cancel-blackout"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createBlackoutMutation.isPending || updateBlackoutMutation.isPending}
                            data-testid="button-save-blackout"
                          >
                            {editingBlackout ? "Update" : "Add"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBlackouts ? (
                  <p className="text-muted-foreground text-center py-4">Loading blackout dates...</p>
                ) : blackouts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4" data-testid="text-no-blackouts">
                    No blackout dates set.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {blackouts.map((blackout: any) => (
                      <div 
                        key={blackout.id} 
                        className="flex items-center justify-between border rounded-lg p-3"
                        data-testid={`blackout-${blackout.id}`}
                      >
                        <div>
                          <div className="font-medium">
                            {new Date(blackout.startDate).toLocaleDateString()} - {new Date(blackout.endDate).toLocaleDateString()}
                          </div>
                          {blackout.reason && (
                            <div className="text-sm text-muted-foreground">{blackout.reason}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditBlackout(blackout)}
                            data-testid={`button-edit-blackout-${blackout.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteBlackoutMutation.mutate(blackout.id)}
                            disabled={deleteBlackoutMutation.isPending}
                            data-testid={`button-delete-blackout-${blackout.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
