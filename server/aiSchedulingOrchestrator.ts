import { aiCoordinatorService, type AssignmentRecommendation } from './aiCoordinator';
import { storage } from './storage';

interface SchedulingPreferences {
  mode: 'contractor_first' | 'mutual_availability';
  leadTimeHours: number;
  autoAcceptThreshold?: number;
}

interface TimeSlot {
  start: Date;
  end: Date;
  contractorId: string;
  isAvailable: boolean;
}

export class AISchedulingOrchestratorService {
  async scheduleAppointment(
    caseId: string,
    contractorRecommendation: AssignmentRecommendation,
    urgency: 'Low' | 'Medium' | 'High' | 'Critical',
    estimatedDuration: string,
    preferences: SchedulingPreferences
  ): Promise<{
    scheduledAt?: Date;
    status: 'auto_scheduled' | 'pending_approval' | 'awaiting_contractor_availability';
    suggestedSlots?: TimeSlot[];
    message: string;
  }> {
    try {
      console.log(`📅 AI Scheduling: Case ${caseId} with contractor ${contractorRecommendation.contractorName}`);

      if (urgency === 'Critical') {
        const emergencySlot = await this.findNextAvailableEmergencySlot(contractorRecommendation.contractorId);
        return {
          scheduledAt: emergencySlot,
          status: 'auto_scheduled',
          message: `Emergency appointment auto-scheduled for ${emergencySlot.toLocaleString()}`
        };
      }

      if (preferences.mode === 'contractor_first') {
        const slots = await this.getContractorAvailableSlots(
          contractorRecommendation.contractorId,
          estimatedDuration
        );

        if (slots.length > 0) {
          return {
            status: 'awaiting_contractor_availability',
            suggestedSlots: slots.slice(0, 5),
            message: `${slots.length} available time slots found. Awaiting tenant selection.`
          };
        } else {
          return {
            status: 'pending_approval',
            message: 'No immediate availability. Contractor will propose times within 24 hours.'
          };
        }
      }

      return {
        status: 'pending_approval',
        message: 'Scheduling requires manual coordination'
      };

    } catch (error) {
      console.error('AI Scheduling Error:', error);
      return {
        status: 'pending_approval',
        message: 'Auto-scheduling unavailable - manual scheduling required'
      };
    }
  }

  private async findNextAvailableEmergencySlot(contractorId: string): Promise<Date> {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now;
  }

  private async getContractorAvailableSlots(
    contractorId: string,
    estimatedDuration: string
  ): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const now = new Date();

    for (let i = 1; i <= 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      date.setHours(9, 0, 0, 0);

      slots.push({
        start: new Date(date),
        end: new Date(date.getTime() + 2 * 60 * 60 * 1000),
        contractorId,
        isAvailable: true
      });

      date.setHours(14, 0, 0, 0);
      slots.push({
        start: new Date(date),
        end: new Date(date.getTime() + 2 * 60 * 60 * 1000),
        contractorId,
        isAvailable: true
      });
    }

    return slots;
  }

  async syncWithGoogleCalendar(
    appointmentId: string,
    contractorEmail: string,
    tenantEmail: string,
    startTime: Date,
    endTime: Date,
    caseTitle: string
  ): Promise<{ success: boolean; eventId?: string; message: string }> {
    try {
      console.log(`🗓️ Google Calendar Sync: Appointment ${appointmentId}`);

      return {
        success: true,
        eventId: `gcal_${appointmentId}`,
        message: 'Calendar sync feature will be implemented with Google Calendar API integration'
      };

    } catch (error) {
      console.error('Google Calendar Sync Error:', error);
      return {
        success: false,
        message: 'Calendar sync failed - appointment saved locally'
      };
    }
  }
}

export const aiSchedulingOrchestratorService = new AISchedulingOrchestratorService();
