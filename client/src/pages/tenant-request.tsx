import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User as UserIcon, Loader2, CheckCircle, AlertTriangle, Send, Building, Home } from "lucide-react";
import { useLocation } from "wouter";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  data?: any;
}

interface PropertyMatch {
  id: string;
  name: string;
  address: string;
  confidence: number;
  unitId?: string;
  unitNumber?: string;
}

export default function TenantRequestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm Maya, your AI maintenance assistant. 👋\n\nTell me what's going on, and I'll help you get it fixed. What maintenance issue are you experiencing?",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<"initial" | "property_matching" | "confirming" | "creating">("initial");
  const [propertyMatches, setPropertyMatches] = useState<PropertyMatch[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyMatch | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [triageData, setTriageData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsProcessing(true);

    try {
      if (conversationState === "initial") {
        setIssueDescription(content);
        
        const res = await apiRequest('POST', '/api/triage/chat', {
          message: content,
          step: "analyze_issue"
        });
        const data = await res.json();

        setTriageData(data.triage);
        setPropertyMatches(data.propertyMatches || []);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          data: {
            triage: data.triage,
            properties: data.propertyMatches
          }
        };

        setMessages(prev => [...prev, assistantMessage]);
        setConversationState("property_matching");

      } else if (conversationState === "confirming") {
        if (content.toLowerCase().includes("yes") || content.toLowerCase().includes("confirm") || content.toLowerCase().includes("submit")) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Great! Creating your maintenance request now...",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          setConversationState("creating");

          const caseRes = await apiRequest('POST', '/api/cases', {
            title: triageData?.suggestedTitle || "Maintenance Request",
            description: issueDescription,
            status: "New",
            type: "maintenance",
            priority: triageData?.urgency?.toLowerCase() || "medium",
            category: triageData?.category || "general",
            propertyId: selectedProperty?.id,
            unitId: selectedProperty?.unitId,
            aiTriageJson: triageData,
          });

          if (caseRes.ok) {
            const newCase = await caseRes.json();
            
            const successMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: "assistant",
              content: `✅ **Request submitted successfully!**\n\nYour case number is **${newCase.caseNumber}**.\n\nWe'll review it and assign a contractor shortly. You'll receive notifications when there are updates.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, successMessage]);

            toast({
              title: "Request submitted",
              description: `Case ${newCase.caseNumber} has been created`,
            });

            queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });

            setTimeout(() => {
              navigate("/tenant-dashboard");
            }, 3000);
          }
        } else {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "No problem! What would you like to change? You can start over by describing the issue again.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          setConversationState("initial");
          setPropertyMatches([]);
          setSelectedProperty(null);
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, something went wrong. Could you try again?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handlePropertySelect = (property: PropertyMatch) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `${property.unitNumber ? `Unit ${property.unitNumber} - ` : ""}${property.name}`,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setSelectedProperty(property);
    setIsProcessing(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `Perfect! I'll create a maintenance request for ${property.unitNumber ? `Unit ${property.unitNumber} at ` : ""}${property.name}.\n\n📋 **Summary:**\n- **Issue:** ${triageData?.summary || issueDescription}\n- **Category:** ${triageData?.category || "General Maintenance"}\n- **Priority:** ${triageData?.urgency || "Medium"}\n- **Property:** ${property.name}\n\nShall I submit this request?`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setConversationState("confirming");
    setIsProcessing(false);
  };

  return (
    <div data-testid="page-tenant-request" className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Maya AI Assistant" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <Card className="flex-1 flex flex-col" data-testid="card-chat">
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Maya AI Assistant</CardTitle>
                    <CardDescription>Smart maintenance request triage</CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${message.role}`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      
                      {message.data?.properties && message.data.properties.length > 0 && (
                        <div className="w-full space-y-2 mt-2">
                          {message.data.properties.map((property: PropertyMatch) => (
                            <Button
                              key={property.id}
                              variant="outline"
                              className="w-full justify-start text-left h-auto py-3"
                              onClick={() => handlePropertySelect(property)}
                              disabled={isProcessing}
                              data-testid={`button-property-${property.id}`}
                            >
                              <div className="flex items-start gap-3 w-full">
                                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  {property.unitNumber ? (
                                    <Home className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Building className="h-5 w-5 text-primary" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm">
                                    {property.unitNumber && `Unit ${property.unitNumber} - `}
                                    {property.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {property.address}
                                  </div>
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {Math.round(property.confidence * 100)}% match
                                  </Badge>
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="flex gap-3" data-testid="indicator-processing">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </CardContent>
              
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Textarea
                    data-testid="input-message"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      conversationState === "confirming"
                        ? "Type 'yes' to confirm or 'no' to cancel..."
                        : "Describe your maintenance issue..."
                    }
                    rows={2}
                    className="resize-none"
                    disabled={isProcessing || conversationState === "creating"}
                  />
                  <Button
                    data-testid="button-send"
                    onClick={() => sendMessage(inputValue)}
                    disabled={isProcessing || !inputValue.trim() || conversationState === "creating"}
                    size="icon"
                    className="h-auto"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
