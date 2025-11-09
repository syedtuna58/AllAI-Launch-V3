import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Calendar, Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Reminder } from "@shared/schema";

interface RemindersWidgetProps {
  onCreateReminder?: () => void;
}

export default function RemindersWidget({ onCreateReminder }: RemindersWidgetProps) {
  const [, setLocation] = useLocation();
  const { data: reminders, isLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
    retry: false,
  });

  const now = new Date();
  const upcomingReminders = reminders?.filter(r => 
    r.dueAt && new Date(r.dueAt) > now && !r.completedAt
  ) || [];
  
  const overdueReminders = reminders?.filter(r => 
    r.dueAt && new Date(r.dueAt) <= now && !r.completedAt
  ) || [];

  const sortedReminders = [...overdueReminders, ...upcomingReminders].sort((a, b) => {
    const dateA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
    const dateB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
    return dateA - dateB;
  }).slice(0, 5);

  const isOverdue = (reminder: Reminder) => {
    if (!reminder.dueAt) return false;
    return new Date(reminder.dueAt) <= now && !reminder.completedAt;
  };

  return (
    <Card data-testid="widget-reminders" className="flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => setLocation('/reminders')}
          >
            <Clock className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Reminders</CardTitle>
            {overdueReminders.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {overdueReminders.length} overdue
              </Badge>
            )}
          </div>
          {onCreateReminder && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={onCreateReminder}
              data-testid="button-create-reminder-widget"
            >
              <Plus className="h-3 w-3" />
              New
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3 flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : sortedReminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No reminders</p>
              {onCreateReminder && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={onCreateReminder}
                  data-testid="button-create-first-reminder-widget"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Reminder
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`
                    p-3 rounded-lg border transition-all cursor-pointer active:scale-[0.98]
                    ${isOverdue(reminder)
                      ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20' 
                      : 'bg-muted/50 border-border hover:bg-accent'
                    }
                  `}
                  data-testid={`reminder-widget-${reminder.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setLocation('/reminders');
                  }}
                >
                  <div className="flex gap-2">
                    <Clock className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isOverdue(reminder) ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isOverdue(reminder) ? 'text-destructive' : 'text-foreground'}`}>
                        {reminder.title}
                      </p>
                      {reminder.dueAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {isOverdue(reminder) 
                            ? formatDistanceToNow(new Date(reminder.dueAt), { addSuffix: true })
                            : `Due ${formatDistanceToNow(new Date(reminder.dueAt), { addSuffix: true })}`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
