import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface NotificationData {
  id: string;
  type: 'case_created' | 'contractor_assigned' | 'case_updated' | 'emergency_alert' | 'case_scheduled' | 'case_completed';
  subject: string;
  message: string;
  caseId?: string;
  caseNumber?: string;
  urgencyLevel?: string;
  timestamp: Date;
  metadata?: any;
}

interface LiveNotificationProps {
  userRole: 'admin' | 'contractor' | 'tenant';
  userId: string;
}

export function LiveNotification({ userRole, userId }: LiveNotificationProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('🔗 WebSocket connected for live notifications');
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'notification') {
            const notification: NotificationData = {
              ...data.data,
              id: Date.now().toString(),
              timestamp: new Date()
            };

            setNotifications(prev => [notification, ...prev.slice(0, 9)]);

            toast({
              title: notification.subject,
              description: notification.message.substring(0, 100) + (notification.message.length > 100 ? '...' : ''),
              duration: 5000
            });
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      websocket.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setWs(null);
      };

      return () => {
        websocket.close();
      };
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
    }
  }, [userId, userRole, toast]);

  const getNotificationIcon = (type: string, urgencyLevel?: string) => {
    if (urgencyLevel === 'emergency') return <AlertTriangle className="h-5 w-5 text-red-500" />;
    if (type === 'case_created') return <Bell className="h-5 w-5 text-blue-500" />;
    if (type === 'contractor_assigned') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (type === 'case_scheduled') return <Clock className="h-5 w-5 text-purple-500" />;
    if (type === 'case_completed') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    return <Clock className="h-5 w-5 text-orange-500" />;
  };

  const getUrgencyColor = (urgencyLevel?: string) => {
    switch (urgencyLevel?.toLowerCase()) {
      case 'emergency':
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.3 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.5 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full shadow-lg border-l-4 border-l-blue-500 dark:bg-gray-800" data-testid={`notification-${notification.id}`}>
              <CardHeader className="pb-2" data-testid={`notification-header-${notification.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getNotificationIcon(notification.type, notification.urgencyLevel)}
                    <CardTitle className="text-sm font-medium">
                      {notification.subject}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {notification.urgencyLevel && (
                      <Badge variant={getUrgencyColor(notification.urgencyLevel)} className="text-xs" data-testid={`badge-urgency-${notification.id}`}>
                        {notification.urgencyLevel}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotification(notification.id)}
                      className="h-6 w-6 p-0"
                      data-testid={`button-dismiss-${notification.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3" data-testid={`text-message-${notification.id}`}>
                  {notification.message.length > 150
                    ? notification.message.substring(0, 150) + '...'
                    : notification.message}
                </p>

                {notification.caseNumber && (
                  <Badge variant="outline" className="mb-3 text-xs" data-testid={`text-case-number-${notification.caseNumber}`}>
                    Case: {notification.caseNumber}
                  </Badge>
                )}

                <div className="text-xs text-gray-400 mt-2">
                  {notification.timestamp.toLocaleTimeString()}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="text-xs text-center text-gray-500">
        {ws ? (
          <span className="text-green-500">🔗 Live notifications active</span>
        ) : (
          <span className="text-red-500">🔌 Connecting...</span>
        )}
      </div>
    </div>
  );
}
