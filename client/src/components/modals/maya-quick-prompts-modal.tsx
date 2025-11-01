import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, Wrench, MessageSquare, Clock } from "lucide-react";
import { useLocation } from "wouter";

interface MayaQuickPromptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_PROMPTS = [
  {
    id: 'equipment-replacement',
    title: "Equipment Replacement",
    prompt: "What equipment will need to be replaced soon?",
    description: "Get insights on upcoming equipment maintenance needs",
    icon: Wrench,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  {
    id: 'messages-reply',
    title: "Messages Needing Reply",
    prompt: "What messages need reply?",
    description: "See which communications require your attention",
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    id: 'due-reminders',
    title: "Due Reminders",
    prompt: "What reminders are due soon?",
    description: "Check upcoming and overdue tasks",
    icon: Clock,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
];

export default function MayaQuickPromptsModal({ open, onOpenChange }: MayaQuickPromptsModalProps) {
  const [, setLocation] = useLocation();

  const handlePromptClick = (prompt: string) => {
    onOpenChange(false);
    setLocation(`/maya-tester?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="modal-maya-prompts">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <DialogTitle>Ask Maya</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Choose a quick prompt or ask your own question
          </p>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {QUICK_PROMPTS.map((prompt) => {
            const Icon = prompt.icon;
            return (
              <Button
                key={prompt.id}
                variant="ghost"
                className="w-full h-auto flex items-start gap-4 p-4 border border-border hover:bg-muted/50 text-left"
                onClick={() => handlePromptClick(prompt.prompt)}
                data-testid={`button-prompt-${prompt.id}`}
              >
                <div className={`w-10 h-10 ${prompt.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${prompt.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{prompt.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{prompt.description}</div>
                </div>
              </Button>
            );
          })}
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              setLocation('/maya-tester');
            }}
            data-testid="button-custom-question"
          >
            <Bot className="h-4 w-4 mr-2" />
            Ask a custom question
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
