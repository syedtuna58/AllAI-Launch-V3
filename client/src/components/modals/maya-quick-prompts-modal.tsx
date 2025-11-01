import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Lightbulb, Send } from "lucide-react";
import { useLocation } from "wouter";

interface MayaQuickPromptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGGESTED_PROMPTS = [
  "What maintenance is overdue or urgent?",
  "Which property needs the most attention?",
  "Any recurring maintenance patterns I should address?",
  "What repairs are costing me the most?",
];

export default function MayaQuickPromptsModal({ open, onOpenChange }: MayaQuickPromptsModalProps) {
  const [, setLocation] = useLocation();
  const [customPrompt, setCustomPrompt] = useState("");

  const handlePromptClick = (prompt: string) => {
    onOpenChange(false);
    setLocation(`/maya-tester?prompt=${encodeURIComponent(prompt)}`);
    setCustomPrompt("");
  };

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      handlePromptClick(customPrompt);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0" data-testid="modal-maya-prompts">
        <div className="bg-muted/30 dark:bg-muted/20 rounded-t-lg p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Maya</h2>
              <p className="text-sm text-muted-foreground">Enjoy the Power of your Personal AI Assistant</p>
            </div>
          </div>
        </div>

        <div className="p-8 pt-6">
          <div className="relative mb-6">
            <Input
              type="text"
              placeholder="Ask about your properties, leases, expenses, tenants..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pr-12 h-12 text-base"
              data-testid="input-maya-prompt"
              autoFocus
            />
            <Button
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              onClick={handleCustomSubmit}
              disabled={!customPrompt.trim()}
              data-testid="button-send-prompt"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Lightbulb className="h-4 w-4" />
              <span>Try these:</span>
            </div>
            
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm"
                  data-testid={`button-suggested-prompt-${index}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
