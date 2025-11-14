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
  onDoubleClick?: () => void;
  onTeamChange?: (teamId: string) => void;
};

export default function CompactCalendarCard({
  workOrder,
  team,
  teams = [],
  tenantName,
  onDoubleClick,
  onTeamChange,
}: CompactCalendarCardProps) {
  const [teamPopoverOpen, setTeamPopoverOpen] = useState(false);

  // Get team color or default
  const teamColor = team?.color || "#6B7280";
  
  // Determine urgency styling
  const isUrgent = workOrder.priority === "Urgent";
  const isHigh = workOrder.priority === "High";
  
  let leftBorderClass = "";
  if (isUrgent) {
    leftBorderClass = "border-l-4 border-l-red-500";
  } else if (isHigh) {
    leftBorderClass = "border-l-4 border-l-orange-500";
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
            className={`relative rounded-md p-2 cursor-pointer shadow-sm hover:shadow-md transition-shadow ${leftBorderClass}`}
            style={{
              backgroundColor: teamColor,
              opacity: 0.95,
            }}
            onDoubleClick={onDoubleClick}
          >
            {/* Title with team icon */}
            <div className="flex items-start justify-between gap-1 mb-1">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-white truncate">
                  {workOrder.title}
                </h4>
              </div>
              {isUrgent && (
                <Badge className="bg-red-600 text-white text-[10px] px-1 py-0 h-4">
                  Urgent
                </Badge>
              )}
            </div>

            {/* Tenant name if available */}
            {tenantName && (
              <p className="text-[10px] text-white/90 truncate mb-1">
                {tenantName}
              </p>
            )}

            {/* Time display for scheduled items */}
            {workOrder.scheduledStartAt && (
              <p className="text-[10px] text-white/80 truncate">
                {format(new Date(workOrder.scheduledStartAt), "h:mm a")}
              </p>
            )}

            {/* Team selector circle in bottom right */}
            {onTeamChange && teams.length > 0 && (
              <Popover open={teamPopoverOpen} onOpenChange={setTeamPopoverOpen}>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: teamColor }}
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
