import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, CheckCircle, Clock, DollarSign, FileText, Wrench, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Reminder } from "@shared/schema";

interface ReminderDetailDialogProps {
  reminder: Reminder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (reminder: Reminder) => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "financial":
      return <DollarSign className="h-5 w-5 text-green-600" />;
    case "lease":
      return <FileText className="h-5 w-5 text-blue-600" />;
    case "maintenance":
      return <Wrench className="h-5 w-5 text-orange-600" />;
    case "compliance":
      return <Shield className="h-5 w-5 text-purple-600" />;
    default:
      return <Clock className="h-5 w-5 text-gray-600" />;
  }
};

const getEffectiveStatus = (reminder: Reminder) => {
  if (reminder.status) return reminder.status;
  if (!reminder.dueAt) return null;
  return new Date(reminder.dueAt) < new Date() ? 'Overdue' : null;
};

export default function ReminderDetailDialog({
  reminder,
  open,
  onOpenChange,
  onEdit,
}: ReminderDetailDialogProps) {
  const { toast } = useToast();

  const completeReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, { status: 'Completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      toast({ title: "Reminder marked as completed" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to complete reminder", variant: "destructive" });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/reminders/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      toast({ title: "Reminder deleted" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to delete reminder", variant: "destructive" });
    },
  });

  if (!reminder) return null;

  const effectiveStatus = getEffectiveStatus(reminder);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reminder Details</DialogTitle>
          <DialogDescription>
            View and manage this reminder
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                {getTypeIcon(reminder.type)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground">
                  {reminder.title}
                </h3>
                {reminder.dueAt && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Due {formatDistanceToNow(new Date(reminder.dueAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
            {effectiveStatus && (
              <Badge
                className={
                  effectiveStatus === 'Overdue' ? "bg-red-100 text-red-800" :
                  effectiveStatus === 'Completed' ? "bg-green-100 text-green-800" :
                  "bg-gray-100 text-gray-800"
                }
              >
                {effectiveStatus}
              </Badge>
            )}
          </div>

          {/* Type Badge */}
          <div>
            <Badge variant="outline" className="capitalize">
              {reminder.type}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-yellow-200 dark:border-yellow-900/30">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(reminder);
                  onOpenChange(false);
                }}
                data-testid="button-edit-reminder"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {effectiveStatus !== 'Completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => completeReminderMutation.mutate(reminder.id)}
                disabled={completeReminderMutation.isPending}
                data-testid="button-complete-reminder"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteReminderMutation.mutate(reminder.id)}
              disabled={deleteReminderMutation.isPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid="button-delete-reminder"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
