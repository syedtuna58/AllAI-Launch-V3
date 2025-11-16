import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { useState } from "react";

export default function NotificationsWidget() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    retry: false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/mark-all-read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const clearReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/notifications/clear-read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setClearDialogOpen(false);
    },
  });

  const sortedNotifications = [...(notifications || [])].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  }).slice(0, 5);

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;
  const readCount = notifications?.filter(n => n.isRead).length || 0;

  const getNotificationIcon = (type?: string | null) => {
    return <Bell className="h-4 w-4 text-blue-600" />;
  };

  return (
    <Card data-testid="widget-notifications" className="flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-base">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={() => markAllAsReadMutation.mutate()}
                data-testid="button-mark-all-read-widget"
              >
                <CheckCheck className="h-3 w-3" />
                Mark All
              </Button>
            )}
            {readCount > 0 && (
              <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1"
                    data-testid="button-clear-read-widget"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear Read
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear read notifications?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {readCount} read notification{readCount !== 1 ? 's' : ''} from your account. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-clear-notifications">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearReadMutation.mutate()}
                      data-testid="button-confirm-clear-notifications"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear {readCount} Read
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
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
          ) : sortedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                    p-3 rounded-lg border transition-colors cursor-pointer
                    ${!notification.isRead
                      ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' 
                      : 'bg-muted/30 border-border'
                    }
                  `}
                  onClick={() => {
                    if (!notification.isRead && notification.id) {
                      markAsReadMutation.mutate(notification.id);
                    }
                  }}
                  data-testid={`notification-widget-${notification.id}`}
                >
                  <div className="flex gap-2">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {notification.message}
                      </p>
                      {notification.createdAt && (
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                    )}
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
