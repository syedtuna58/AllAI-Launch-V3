import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import Messages from "@/pages/messages";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MessageSquare, Globe, AlertCircle, CheckCircle, Clock, Users } from "lucide-react";
import { format } from "date-fns";

// Omnichannel component (external communications)
function OmnichannelView() {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['/api/inbox'],
  });

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'voice': return <Phone className="h-4 w-4" />;
      case 'web': return <Globe className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getUrgencyColor = (score?: number) => {
    if (!score) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    if (score >= 8) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    if (score >= 6) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    if (score >= 4) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'urgent': return "destructive";
      case 'frustrated': return "destructive";
      case 'negative': return "destructive";
      case 'positive': return "default";
      default: return "secondary";
    }
  };

  const MessageCard = ({ message }: { message: any }) => (
    <Card className="hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`message-card-${message.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getChannelIcon(message.channelType)}
            <div>
              <CardTitle className="text-sm font-medium">
                {message.tenant ? `${message.tenant.firstName} ${message.tenant.lastName}` : 
                 message.contractor ? message.contractor.name : 
                 message.fromPhone || message.fromEmail}
              </CardTitle>
              <CardDescription className="text-xs">
                {message.unit?.label && `Unit ${message.unit.label} • `}
                {message.property?.name}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">
              {message.createdAt && format(new Date(message.createdAt), 'MMM d, h:mm a')}
            </span>
            {message.aiUrgencyScore && (
              <Badge variant="outline" className={`text-xs ${getUrgencyColor(message.aiUrgencyScore)}`} data-testid={`urgency-${message.id}`}>
                Urgency: {message.aiUrgencyScore}/10
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {message.subject && (
            <p className="text-sm font-medium">{message.subject}</p>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {message.body}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {message.aiSentiment && (
              <Badge variant={getSentimentColor(message.aiSentiment)} data-testid={`sentiment-${message.id}`}>
                {message.aiSentiment}
              </Badge>
            )}
            {message.aiCategory && (
              <Badge variant="outline" data-testid={`category-${message.id}`}>{message.aiCategory}</Badge>
            )}
            {message.mayaResponseSent && (
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950" data-testid={`responded-${message.id}`}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Responded
              </Badge>
            )}
            {message.case && (
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950" data-testid={`case-linked-${message.id}`}>
                Case Created
              </Badge>
            )}
          </div>
          {message.aiSummary && (
            <p className="text-xs text-muted-foreground italic mt-2">
              AI Summary: {message.aiSummary}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const filterByChannel = (channelType?: string) => {
    if (!channelType) return messages;
    return messages.filter((m: any) => m.channelType === channelType);
  };

  const filterByStatus = (status: string) => {
    if (status === 'all') return messages;
    if (status === 'unresponded') return messages.filter((m: any) => !m.mayaResponseSent);
    if (status === 'responded') return messages.filter((m: any) => m.mayaResponseSent);
    return messages;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">📬 AI Command Center</h2>
          <p className="text-muted-foreground">
            Unified communications inbox - All channels in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950" data-testid="total-messages">
            {messages.length} Total Messages
          </Badge>
          <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950" data-testid="unreplied-count">
            {messages.filter((m: any) => !m.mayaResponseSent).length} Need Response
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="sms" data-testid="tab-sms">
            <MessageSquare className="h-4 w-4 mr-1" />
            SMS ({filterByChannel('sms').length})
          </TabsTrigger>
          <TabsTrigger value="email" data-testid="tab-email">
            <Mail className="h-4 w-4 mr-1" />
            Email ({filterByChannel('email').length})
          </TabsTrigger>
          <TabsTrigger value="voice" data-testid="tab-voice">
            <Phone className="h-4 w-4 mr-1" />
            Voice ({filterByChannel('voice').length})
          </TabsTrigger>
          <TabsTrigger value="unresponded" data-testid="tab-unresponded">
            <AlertCircle className="h-4 w-4 mr-1" />
            Needs Reply ({filterByStatus('unresponded').length})
          </TabsTrigger>
          <TabsTrigger value="responded" data-testid="tab-responded">
            <CheckCircle className="h-4 w-4 mr-1" />
            Handled ({filterByStatus('responded').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet. When tenants or contractors reach out via SMS, email, or phone, they'll appear here!</p>
                  </CardContent>
                </Card>
              ) : (
                messages.map((message: any) => (
                  <MessageCard key={message.id} message={message} />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {['sms', 'email', 'voice'].map(channel => (
          <TabsContent key={channel} value={channel} className="mt-4">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filterByChannel(channel).length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <p>No {channel.toUpperCase()} messages yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  filterByChannel(channel).map((message: any) => (
                    <MessageCard key={message.id} message={message} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}

        {['unresponded', 'responded'].map(status => (
          <TabsContent key={status} value={status} className="mt-4">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filterByStatus(status).map((message: any) => (
                  <MessageCard key={message.id} message={message} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Main Inbox page with External/Internal tabs
export default function Inbox() {
  const { user } = useAuth();
  
  // Check if user is admin or manager (can see Internal/External tabs)
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  
  return (
    <div className="flex h-screen bg-background" data-testid="page-inbox">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Inbox" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {isAdminOrManager ? (
            <Tabs defaultValue="external" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="external" data-testid="tab-external">
                  <Globe className="h-4 w-4 mr-2" />
                  External (Omnichannel)
                </TabsTrigger>
                <TabsTrigger value="internal" data-testid="tab-internal">
                  <Users className="h-4 w-4 mr-2" />
                  Internal (Team)
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="external" className="mt-0">
                <OmnichannelView />
              </TabsContent>
              
              <TabsContent value="internal" className="mt-0">
                <Messages embedded />
              </TabsContent>
            </Tabs>
          ) : (
            <OmnichannelView />
          )}
        </main>
      </div>
    </div>
  );
}
