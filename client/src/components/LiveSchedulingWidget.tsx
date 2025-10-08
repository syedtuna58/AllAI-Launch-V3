import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format, addDays, startOfDay, endOfDay } from "date-fns";

interface TimeSlot {
  start: Date;
  end: Date;
}

interface LiveSchedulingWidgetProps {
  durationMinutes: number;
  onSlotSelect: (slot: TimeSlot) => void;
  selectedSlots?: TimeSlot[];
  maxSlots?: number;
  title?: string;
}

export function LiveSchedulingWidget({
  durationMinutes,
  onSlotSelect,
  selectedSlots = [],
  maxSlots = 3,
  title = "Select Available Time Slots"
}: LiveSchedulingWidgetProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  // Fetch available slots for the selected date range
  const { data: slots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: [`/api/availability/slots?startDate=${startOfDay(selectedDate).toISOString()}&endDate=${endOfDay(addDays(selectedDate, 7)).toISOString()}&durationMinutes=${durationMinutes}`],
    enabled: !!durationMinutes,
  });

  useEffect(() => {
    if (slots) {
      const parsedSlots = slots.map(slot => ({
        start: new Date(slot.start),
        end: new Date(slot.end)
      }));
      setAvailableSlots(parsedSlots);
    }
  }, [slots]);

  // Filter slots for selected date
  const slotsForSelectedDate = availableSlots.filter(slot => {
    const slotDate = new Date(slot.start);
    return (
      slotDate.getDate() === selectedDate.getDate() &&
      slotDate.getMonth() === selectedDate.getMonth() &&
      slotDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  const isSlotSelected = (slot: TimeSlot) => {
    return selectedSlots.some(
      s => new Date(s.start).getTime() === new Date(slot.start).getTime()
    );
  };

  const canSelectMore = selectedSlots.length < maxSlots;

  const handleSlotClick = (slot: TimeSlot) => {
    // Always allow deselection by clicking on selected slots
    if (isSlotSelected(slot) || canSelectMore) {
      onSlotSelect(slot);
    }
  };

  // Get dates with available slots for calendar highlighting
  const datesWithSlots = Array.from(
    new Set(availableSlots.map(slot => {
      const d = new Date(slot.start);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }))
  ).map(dateStr => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month, day);
  });

  return (
    <div className="space-y-4" data-testid="live-scheduling-widget">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Calendar Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < new Date()}
              modifiers={{
                available: datesWithSlots
              }}
              modifiersStyles={{
                available: { 
                  fontWeight: 'bold',
                  textDecoration: 'underline'
                }
              }}
              className="rounded-md border"
              data-testid="calendar-slot-picker"
            />
            <div className="mt-4 text-xs text-muted-foreground">
              <p>• Underlined dates have available slots</p>
              <p>• Duration: {durationMinutes} minutes</p>
            </div>
          </CardContent>
        </Card>

        {/* Time Slots Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Available Times - {format(selectedDate, 'MMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : slotsForSelectedDate.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No available slots for this date</p>
                <p className="text-xs mt-1">Try selecting a different date</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {slotsForSelectedDate.map((slot, index) => {
                  const selected = isSlotSelected(slot);
                  const disabled = !selected && !canSelectMore;

                  return (
                    <Button
                      key={index}
                      variant={selected ? "default" : "outline"}
                      className="w-full justify-between"
                      onClick={() => handleSlotClick(slot)}
                      disabled={disabled}
                      data-testid={`button-timeslot-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {format(new Date(slot.start), 'h:mm a')} - {format(new Date(slot.end), 'h:mm a')}
                        </span>
                      </div>
                      {selected && <CheckCircle2 className="h-4 w-4" />}
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selected Slots Summary */}
      {selectedSlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Selected Time Slots ({selectedSlots.length}/{maxSlots})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedSlots.map((slot, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-primary/5 rounded border border-primary/20"
                  data-testid={`selected-slot-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {format(new Date(slot.start), 'MMM d, yyyy')} at {format(new Date(slot.start), 'h:mm a')}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {durationMinutes} min
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
