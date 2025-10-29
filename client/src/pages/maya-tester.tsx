import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Heart, Briefcase, Shield, Smile, Send, RotateCcw, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MayaResponse {
  tldr: string;
  bullets: string[];
  actions: Array<{
    label: string;
    due?: string;
  }>;
}

interface ConversationTestResult {
  strategyName: string;
  strategyType: string;
  response: MayaResponse;
  executionTime: number;
  conversationHistory: ConversationMessage[];
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  initialMessages: string[];
  context: string;
  icon: any;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'frustrated',
    name: "Frustrated Tenant",
    description: "Tenant upset about delayed maintenance",
    icon: AlertTriangle,
    context: "Tenant has been waiting for a repair and is getting frustrated",
    initialMessages: [
      "I've been waiting 3 days for someone to fix my broken heater and nobody has shown up!",
    ]
  },
  {
    id: 'urgent',
    name: "Urgent Emergency",
    description: "Late night water leak emergency",
    icon: Shield,
    context: "2AM emergency with water leak causing property damage",
    initialMessages: [
      "Help! There's water pouring from the ceiling in my bedroom! It's 2AM and I don't know what to do!",
    ]
  },
  {
    id: 'confused',
    name: "Confused & Unsure",
    description: "Tenant unsure how to report issue",
    icon: Heart,
    context: "Elderly tenant not tech-savvy, needs gentle guidance",
    initialMessages: [
      "Hi... I'm not sure if this is the right place, but there's something wrong with my toilet. It keeps making a noise. Should I call someone?",
    ]
  },
  {
    id: 'ai-hesitant',
    name: "AI-Hesitant Tenant",
    description: "Tenant uncomfortable talking to AI",
    icon: Smile,
    context: "Tenant skeptical about AI, wants human interaction",
    initialMessages: [
      "Wait, am I talking to a computer? I'd really prefer to speak with a real person about this...",
    ]
  },
  {
    id: 'multi-turn',
    name: "Multi-Turn Conversation",
    description: "Extended back-and-forth to test context",
    icon: Briefcase,
    context: "Test how well strategies maintain context over multiple exchanges",
    initialMessages: [
      "My dishwasher stopped working",
      "Unit 3B",
      "It just stopped mid-cycle and won't turn on at all",
      "I haven't tried anything, I'm not sure what to do"
    ]
  },
  {
    id: 'custom',
    name: "Custom Scenario",
    description: "Start a fresh conversation with your own message",
    icon: Send,
    context: "Custom test case",
    initialMessages: []
  }
];

export default function MayaTester() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [conversations, setConversations] = useState<Record<string, ConversationMessage[]>>({
    empathetic: [],
    professional: [],
    deescalating: [],
    casual: []
  });
  const scrollRefs = {
    empathetic: useRef<HTMLDivElement>(null),
    professional: useRef<HTMLDivElement>(null),
    deescalating: useRef<HTMLDivElement>(null),
    casual: useRef<HTMLDivElement>(null),
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    Object.values(scrollRefs).forEach(ref => {
      if (ref.current) {
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    });
  }, [conversations]);

  const testMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/test-maya-conversation", {
        userMessage: message,
        conversationHistories: conversations // Send all conversation histories
      });
      return response.json();
    },
    onSuccess: (data: { results: ConversationTestResult[] }) => {
      // Update all conversation histories with the responses
      const newConversations: Record<string, ConversationMessage[]> = {};
      
      data.results.forEach(result => {
        newConversations[result.strategyType] = result.conversationHistory;
      });
      
      setConversations(newConversations);
      setUserMessage("");
    }
  });

  const handleSendMessage = () => {
    if (!userMessage.trim() || testMutation.isPending) return;
    
    // Add user message to all conversations
    const updatedConversations = { ...conversations };
    Object.keys(updatedConversations).forEach(key => {
      updatedConversations[key] = [
        ...updatedConversations[key],
        { role: 'user' as const, content: userMessage }
      ];
    });
    setConversations(updatedConversations);
    
    testMutation.mutate(userMessage);
  };

  const handleLoadScenario = (scenarioId: string) => {
    const scenario = TEST_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    setSelectedScenario(scenarioId);
    
    if (scenario.initialMessages.length === 0) {
      // Custom scenario - just reset
      resetConversations();
    } else {
      // Load pre-defined scenario messages one by one
      resetConversations();
      
      // Track conversations locally to avoid closure issues
      let localConversations = {
        empathetic: [] as ConversationMessage[],
        professional: [] as ConversationMessage[],
        deescalating: [] as ConversationMessage[],
        casual: [] as ConversationMessage[]
      };
      
      // Send messages in sequence
      let currentIndex = 0;
      const sendNext = () => {
        if (currentIndex < scenario.initialMessages.length) {
          const message = scenario.initialMessages[currentIndex];
          
          // Add user message to all conversations
          Object.keys(localConversations).forEach(key => {
            localConversations[key as keyof typeof localConversations] = [
              ...localConversations[key as keyof typeof localConversations],
              { role: 'user' as const, content: message }
            ];
          });
          setConversations({ ...localConversations });
          
          // Prepare histories without the just-added user message
          const historiesForAPI = {
            empathetic: localConversations.empathetic.slice(0, -1),
            professional: localConversations.professional.slice(0, -1),
            deescalating: localConversations.deescalating.slice(0, -1),
            casual: localConversations.casual.slice(0, -1)
          };
          
          // Send to API
          apiRequest("POST", "/api/test-maya-conversation", {
            userMessage: message,
            conversationHistories: historiesForAPI
          })
            .then(res => res.json())
            .then((data: { results: ConversationTestResult[] }) => {
              // Update local conversations with AI responses
              data.results.forEach(result => {
                localConversations[result.strategyType as keyof typeof localConversations] = result.conversationHistory;
              });
              
              setConversations({ ...localConversations });
              currentIndex++;
              
              // Continue with next message after a brief delay
              if (currentIndex < scenario.initialMessages.length) {
                setTimeout(sendNext, 1000);
              }
            });
        }
      };
      
      sendNext();
    }
  };

  const resetConversations = () => {
    setConversations({
      empathetic: [],
      professional: [],
      deescalating: [],
      casual: []
    });
    setUserMessage("");
    setSelectedScenario(null);
  };

  const getStrategyIcon = (type: string) => {
    switch (type) {
      case 'empathetic': return <Heart className="h-4 w-4" />;
      case 'professional': return <Briefcase className="h-4 w-4" />;
      case 'deescalating': return <Shield className="h-4 w-4" />;
      case 'casual': return <Smile className="h-4 w-4" />;
      default: return null;
    }
  };

  const getStrategyColor = (type: string) => {
    switch (type) {
      case 'empathetic': return 'text-pink-600 dark:text-pink-400';
      case 'professional': return 'text-blue-600 dark:text-blue-400';
      case 'deescalating': return 'text-green-600 dark:text-green-400';
      case 'casual': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const renderChatWindow = (strategyType: string, strategyName: string, messages: ConversationMessage[]) => {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className={getStrategyColor(strategyType)}>
              {getStrategyIcon(strategyType)}
            </div>
            <CardTitle className="text-lg">{strategyName}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0">
          <ScrollArea className="flex-1 pr-4" ref={scrollRefs[strategyType as keyof typeof scrollRefs]}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Select a scenario or send a message to start testing
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${strategyType}-${idx}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {testMutation.isPending && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Maya Conversation Tester</h1>
        <p className="text-muted-foreground">
          Test how different conversational strategies handle various tenant situations. Compare empathy, professionalism, de-escalation, and casual approaches side-by-side.
        </p>
      </div>

      {/* Scenario Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Test Scenarios</CardTitle>
          <CardDescription>
            Choose a pre-configured scenario or start a custom conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {TEST_SCENARIOS.map(scenario => {
              const Icon = scenario.icon;
              return (
                <Button
                  key={scenario.id}
                  variant={selectedScenario === scenario.id ? "default" : "outline"}
                  className="h-auto flex-col items-start p-4 gap-2"
                  onClick={() => handleLoadScenario(scenario.id)}
                  disabled={testMutation.isPending}
                  data-testid={`button-scenario-${scenario.id}`}
                >
                  <Icon className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium text-sm">{scenario.name}</div>
                    <div className="text-xs text-muted-foreground font-normal mt-1">
                      {scenario.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Message Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Type a message to send to all strategies..."
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={testMutation.isPending}
              data-testid="input-message"
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSendMessage}
                disabled={!userMessage.trim() || testMutation.isPending}
                data-testid="button-send"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={resetConversations}
                disabled={testMutation.isPending}
                data-testid="button-reset"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </CardContent>
      </Card>

      {testMutation.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to send message: {(testMutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {/* Chat Windows Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" style={{ height: '600px' }}>
        {renderChatWindow('empathetic', 'Empathetic & Supportive', conversations.empathetic)}
        {renderChatWindow('professional', 'Professional & Efficient', conversations.professional)}
        {renderChatWindow('deescalating', 'De-escalating Specialist', conversations.deescalating)}
        {renderChatWindow('casual', 'Friendly & Casual', conversations.casual)}
      </div>
    </div>
  );
}
