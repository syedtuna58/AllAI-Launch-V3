import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, Plus, Users } from 'lucide-react';
import type { MessageThread, ChatMessage, User } from '@shared/schema';
import { format } from 'date-fns';

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newThreadRecipient, setNewThreadRecipient] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');

  const { data: threads = [] } = useQuery<MessageThread[]>({
    queryKey: ['/api/messages/threads'],
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/messages/threads', selectedThread?.id],
    enabled: !!selectedThread,
  });

  const { data: orgUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { threadId: string; body: string }) => {
      const response = await apiRequest('POST', '/api/messages', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads', selectedThread?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      setNewMessage('');
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: { participantIds: string[]; subject?: string }) => {
      const response = await apiRequest('POST', '/api/messages/threads', data);
      return response.json();
    },
    onSuccess: (newThread) => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/threads'] });
      setSelectedThread(newThread);
      setShowNewThreadDialog(false);
      setNewThreadRecipient('');
      // Send the first message
      if (newThreadMessage.trim()) {
        sendMessageMutation.mutate({ threadId: newThread.id, body: newThreadMessage });
        setNewThreadMessage('');
      }
    },
  });

  const handleSendMessage = () => {
    if (!selectedThread || !newMessage.trim()) return;
    sendMessageMutation.mutate({ threadId: selectedThread.id, body: newMessage });
  };

  const handleCreateThread = () => {
    if (!newThreadRecipient || !user) return;
    createThreadMutation.mutate({
      participantIds: [user.id, newThreadRecipient],
    });
  };

  const getUserInitials = (u: User) => {
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || u.email[0].toUpperCase();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Messages" />
        <main className="flex-1 overflow-hidden p-6">
          <div className="h-full grid grid-cols-3 gap-6">
            {/* Thread List */}
            <Card className="col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Conversations</CardTitle>
                  <Button size="sm" onClick={() => setShowNewThreadDialog(true)} data-testid="button-new-message">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-250px)]">
                  <div className="space-y-2">
                    {threads.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                      </div>
                    ) : (
                      threads.map((thread) => (
                        <div
                          key={thread.id}
                          onClick={() => setSelectedThread(thread)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedThread?.id === thread.id
                              ? 'bg-accent'
                              : 'hover:bg-accent/50'
                          }`}
                          data-testid={`thread-${thread.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                <Users className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{thread.subject || 'Direct Message'}</p>
                              {thread.lastMessageAt && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(thread.lastMessageAt), 'MMM d, h:mm a')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{selectedThread?.subject || 'Select a conversation'}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedThread ? (
                  <div className="space-y-4">
                    <ScrollArea className="h-[calc(100vh-350px)]">
                      <div className="space-y-4">
                        {messages.map((message) => {
                          const sender = orgUsers.find(u => u.id === message.senderId);
                          const isMe = message.senderId === user?.id;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                              data-testid={`message-${message.id}`}
                            >
                              <div className={`flex gap-2 max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {sender ? getUserInitials(sender) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className={`rounded-lg p-3 ${
                                    isMe ? 'bg-primary text-primary-foreground' : 'bg-accent'
                                  }`}>
                                    <p className="text-sm">{message.body}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(message.createdAt!), 'h:mm a')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        data-testid="input-message"
                      />
                      <Button onClick={handleSendMessage} data-testid="button-send">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-[calc(100vh-300px)] flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Select a conversation to start messaging</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* New Thread Dialog */}
          <Dialog open={showNewThreadDialog} onOpenChange={setShowNewThreadDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Recipient</Label>
                  <Select value={newThreadRecipient} onValueChange={setNewThreadRecipient}>
                    <SelectTrigger data-testid="select-recipient">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgUsers
                        .filter(u => u.id !== user?.id)
                        .map(u => (
                          <SelectItem key={u.id} value={u.id} data-testid={`recipient-${u.id}`}>
                            {u.firstName} {u.lastName} ({u.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={newThreadMessage}
                    onChange={(e) => setNewThreadMessage(e.target.value)}
                    placeholder="Type your message..."
                    data-testid="input-new-message"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewThreadDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateThread} data-testid="button-create-thread">
                    Send
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
