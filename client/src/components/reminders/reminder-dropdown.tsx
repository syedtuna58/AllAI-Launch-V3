import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Reminder } from "@shared/schema";

interface ReminderDropdownProps {
  onCreateReminder: () => void;
}

export default function ReminderDropdown({ onCreateReminder }: ReminderDropdownProps) {
  const [open, setOpen] = useState(false);

  const { data: reminders } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
    retry: false,
  });

  const now = new Date();
  const upcomingReminders = reminders?.filter(r => 
    r.scheduledFor && new Date(r.scheduledFor) > now
  ) || [];
  
  const overdueReminders = reminders?.filter(r => 
    r.scheduledFor && new Date(r.scheduledFor) <= now && !r.completedAt
  ) || [];

  const sortedReminders = [...upcomingReminders, ...overdueReminders].sort((a, b) => {
    const dateA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
    const dateB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
    return dateA - dateB;
  });

  const overdueCount = overdueReminders.length;

  const isOverdue = (reminder: Reminder) => {
    if (!reminder.scheduledFor) return false;
    return new Date(reminder.scheduledFor) <= now && !reminder.completedAt;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-reminders"
        >
          <Calendar className="h-5 w-5" />
          {overdueCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              variant="destructive"
              data-testid="badge-overdue-count"
            >
              {overdueCount > 9 ? '9+' : overdueCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-semibold text-sm">Reminders</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => {
              setOpen(false);
              onCreateReminder();
            }}
            data-testid="button-create-reminder"
          >
            <Plus className="h-3 w-3" />
            New
          </Button>
        </div>
        <Separator />
        <ScrollArea className="h-[400px]">
          {sortedReminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No upcoming reminders</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setOpen(false);
                  onCreateReminder();
                }}
                data-testid="button-create-first-reminder"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Reminder
              </Button>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {sortedReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`
                    relative p-3 rounded-lg border transition-colors cursor-pointer
                    ${isOverdue(reminder)
                      ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20' 
                      : 'bg-background hover:bg-muted/50'
                    }
                  `}
                  data-testid={`reminder-${reminder.id}`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <Clock className={`h-4 w-4 ${isOverdue(reminder) ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${isOverdue(reminder) ? 'text-destructive' : 'text-foreground'}`}>
                          {reminder.title}
                        </p>
                        {isOverdue(reminder) && (
                          <Badge variant="destructive" className="text-xs" data-testid="badge-overdue">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      {reminder.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {reminder.description}
                        </p>
                      )}
                      {reminder.scheduledFor && (
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-muted-foreground/60">
                            {isOverdue(reminder) 
                              ? formatDistanceToNow(new Date(reminder.scheduledFor), { addSuffix: true })
                              : `Due ${formatDistanceToNow(new Date(reminder.scheduledFor), { addSuffix: true })}`
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
