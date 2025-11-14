import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState } from "react";
import type { SmartCase } from "@shared/schema";

type Team = {
  id: string;
  name: string;
  color: string;
  specialty?: string;
};

type CompactCalendarCardProps = {
  workOrder: SmartCase;
  team?: Team;
  teams?: Team[];
  tenantName?: string;
  propertyStreet?: string;
  onDoubleClick?: () => void;
  onTeamChange?: (teamId: string) => void;
};

// Convert hex to pastel by lightening it
function hexToPastel(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten by mixing with white (increase brightness)
  const lighten = 0.75; // Higher = lighter
  const newR = Math.round(r + (255 - r) * lighten);
  const newG = Math.round(g + (255 - g) * lighten);
  const newB = Math.round(b + (255 - b) * lighten);
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

export default function CompactCalendarCard({
  workOrder,
  team,
  teams = [],
  tenantName,
  propertyStreet,
  onDoubleClick,
  onTeamChange,
}: CompactCalendarCardProps) {
  const [teamPopoverOpen, setTeamPopoverOpen] = useState(false);

  // Get team color or default, then convert to pastel
  const originalColor = team?.color || "#6B7280";
  const pastelColor = hexToPastel(originalColor);
  
  // Determine urgency styling
  const isUrgent = workOrder.priority === "Urgent";
  const isHigh = workOrder.priority === "High";
  
  let leftBorderClass = "";
  if (isUrgent) {
    leftBorderClass = "border-l-4 border-l-red-400";
  } else if (isHigh) {
    leftBorderClass = "border-l-4 border-l-orange-400";
  }

  // Create tooltip content with full details
  const tooltipContent = (
    <div className="space-y-2 text-sm">
      <div>
        <strong>Title:</strong> {workOrder.title}
      </div>
      {workOrder.description && (
        <div>
          <strong>Description:</strong> {workOrder.description}
        </div>
      )}
      {tenantName && (
        <div>
          <strong>Tenant:</strong> {tenantName}
        </div>
      )}
      <div>
        <strong>Priority:</strong> {workOrder.priority || "Standard"}
      </div>
      <div>
        <strong>Status:</strong> {workOrder.status || "New"}
      </div>
      {team && (
        <div>
          <strong>Team:</strong> {team.name}
        </div>
      )}
      {workOrder.scheduledStartAt && (
        <div>
          <strong>Scheduled:</strong> {format(new Date(workOrder.scheduledStartAt), "MMM d, h:mm a")}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={`group relative h-full w-full p-1.5 cursor-pointer hover:brightness-95 transition-all ${leftBorderClass}`}
            style={{
              backgroundColor: pastelColor,
            }}
            onDoubleClick={onDoubleClick}
          >
            {/* Title with urgency badge */}
            <div className="flex items-start justify-between gap-1 mb-0.5">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-900 truncate leading-tight">
                  {workOrder.title}
                </h4>
              </div>
              {isUrgent && (
                <Badge className="bg-red-500 text-white text-[10px] px-1 py-0 h-4">
                  Urgent
                </Badge>
              )}
            </div>

            {/* Tenant name if available */}
            {tenantName && (
              <p className="text-[10px] text-gray-700 dark:text-gray-800 truncate mb-0.5 leading-tight">
                {tenantName}
              </p>
            )}

            {/* Property street address if available */}
            {propertyStreet && (
              <p className="text-[10px] text-gray-600 dark:text-gray-700 truncate mb-0.5 leading-tight">
                {propertyStreet}
              </p>
            )}

            {/* Time display for scheduled items */}
            {workOrder.scheduledStartAt && (
              <p className="text-[10px] text-gray-600 dark:text-gray-700 truncate leading-tight">
                {format(new Date(workOrder.scheduledStartAt), "h:mm a")}
              </p>
            )}

            {/* Team selector circle in bottom right - subtle, visible on hover */}
            {onTeamChange && teams.length > 0 && (
              <Popover open={teamPopoverOpen} onOpenChange={setTeamPopoverOpen}>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-gray-400 opacity-20 group-hover:opacity-60 hover:!opacity-100 hover:scale-125 transition-all"
                    style={{ backgroundColor: originalColor }}
                    data-testid={`button-team-selector-${workOrder.id}`}
                  />
                </PopoverTrigger>
                <PopoverContent 
                  className="w-48 p-2" 
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold mb-2">Assign Team</p>
                    {teams.map((t) => (
                      <Button
                        key={t.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => {
                          onTeamChange(t.id);
                          setTeamPopoverOpen(false);
                        }}
                        data-testid={`button-select-team-${t.id}`}
                      >
                        <div
                          className="w-3 h-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="text-xs">{t.name}</span>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
