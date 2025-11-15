import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerDropdownProps {
  date?: Date;
  setDate: (date: Date | undefined) => void;
  className?: string;
  disabled?: boolean;
}

export function TimePickerDropdown({ date, setDate, className, disabled }: TimePickerDropdownProps) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = ["00", "15", "30", "45"];
  const periods = ["AM", "PM"];

  // Normalize minutes to nearest 15-minute increment
  const normalizeMinutes = (mins: number): string => {
    const validMinutes = [0, 15, 30, 45];
    if (validMinutes.includes(mins)) {
      return mins.toString().padStart(2, "0");
    }
    // Round to nearest 15-minute increment
    const rounded = Math.round(mins / 15) * 15;
    return (rounded % 60).toString().padStart(2, "0");
  };

  const getCurrentHour = () => {
    if (!date) return "12";
    const hour = date.getHours();
    if (hour === 0) return "12";
    if (hour > 12) return String(hour - 12);
    return String(hour);
  };

  const getCurrentMinute = () => {
    if (!date) return "00";
    const minute = date.getMinutes();
    return normalizeMinutes(minute);
  };

  const getCurrentPeriod = () => {
    if (!date) return "AM";
    return date.getHours() >= 12 ? "PM" : "AM";
  };

  const updateTime = (hour?: string, minute?: string, period?: string) => {
    const currentDate = date || new Date();
    const currentHour = hour || getCurrentHour();
    const currentMinute = minute || getCurrentMinute();
    const currentPeriod = period || getCurrentPeriod();

    let hours24 = parseInt(currentHour);
    if (currentPeriod === "PM" && hours24 !== 12) hours24 += 12;
    if (currentPeriod === "AM" && hours24 === 12) hours24 = 0;

    const newDate = new Date(currentDate);
    newDate.setHours(hours24);
    newDate.setMinutes(parseInt(currentMinute));
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    setDate(newDate);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      
      {/* Hour Selector */}
      <Select
        value={getCurrentHour()}
        onValueChange={(value) => updateTime(value, undefined, undefined)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[70px]" data-testid="select-hour">
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent>
          {hours.map((hour) => (
            <SelectItem key={hour} value={String(hour)}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground">:</span>

      {/* Minute Selector */}
      <Select
        value={getCurrentMinute()}
        onValueChange={(value) => updateTime(undefined, value, undefined)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[70px]" data-testid="select-minute">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((minute) => (
            <SelectItem key={minute} value={minute}>
              {minute}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AM/PM Selector */}
      <Select
        value={getCurrentPeriod()}
        onValueChange={(value) => updateTime(undefined, undefined, value)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[70px]" data-testid="select-period">
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          {periods.map((period) => (
            <SelectItem key={period} value={period}>
              {period}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
