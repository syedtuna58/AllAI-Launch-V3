import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string; // HH:MM format (e.g., "14:30")
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

// Generate 15-minute interval time slots
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const hourStr = hour.toString().padStart(2, "0");
      const minStr = minute.toString().padStart(2, "0");
      slots.push(`${hourStr}:${minStr}`);
    }
  }
  return slots;
}

// Format time for display (e.g., "14:30" → "2:30 PM")
function formatTime(time: string): string {
  if (!time || !time.includes(":")) return "";
  const [hourStr, minStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, "0");
  
  return `${displayHour}:${displayMinute} ${period}`;
}

export function TimePicker15Min({ value, onChange, className, disabled }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const timeSlots = generateTimeSlots();
  
  const handleSelect = (time: string) => {
    onChange(time);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          data-testid="button-select-time"
        >
          <Clock className="mr-2 h-4 w-4" />
          {value ? formatTime(value) : "Pick a time"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <ScrollArea className="h-[300px]">
          <div className="grid grid-cols-2 gap-1 p-2">
            {timeSlots.map((time) => {
              const isSelected = time === value;
              return (
                <Button
                  key={time}
                  variant={isSelected ? "default" : "ghost"}
                  className={cn(
                    "justify-start font-normal",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => handleSelect(time)}
                  data-testid={`time-option-${time}`}
                >
                  {formatTime(time)}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
