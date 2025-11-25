import OpenAI from "openai";
import { config } from "./config";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface TriageResult {
  category: string;
  subcategory: string;
  urgency: "Low" | "Medium" | "High" | "Critical";
  estimatedComplexity: "Simple" | "Moderate" | "Complex";
  requiredExpertise: string[];
  estimatedDuration: string;
  preliminaryDiagnosis: string;
  troubleshootingSteps: string[];
  contractorType: string;
  specialEquipment: string[];
  safetyRisk: "None" | "Low" | "Medium" | "High";
  reasoning: string;
  // AI appointment scheduling suggestions
  suggestedTimeWindow?: string; // e.g., "morning", "afternoon", "evening", "next_business_day"
  estimatedDurationMinutes?: number; // Estimated job duration in minutes
  timeConfidence?: number; // 0-1 confidence score for time suggestion
  timeReasoningNotes?: string; // Why Maya suggested this time window
  analysisCompletedAt?: string;
  version?: string;
}

export interface MaintenanceRequest {
  title: string;
  description: string;
  category?: string;
  priority?: string;
  photos?: string[];
  unitId?: string;
  propertyId?: string;
  orgId?: string;
}

export class AITriageService {
  async analyzeMaintenanceRequest(request: MaintenanceRequest): Promise<TriageResult> {
    try {
      console.log(`🤖 AI Triage: Analyzing "${request.title}"`);

      let photoAnalysis = '';
      if (request.photos && request.photos.length > 0) {
        console.log(`🤖 Analyzing ${request.photos.length} photos`);
        photoAnalysis = await this.analyzeMaintenancePhotos(request.photos);
      }

      const prompt = this.buildTriagePrompt(request, photoAnalysis);

      const response = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert maintenance triage specialist for property management. Analyze maintenance requests and provide detailed triage information to help prioritize, route, and resolve issues efficiently."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" }
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI analysis timeout")), 15000)
        )
      ]) as any;

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No content received from AI analysis");
      }
      const result = JSON.parse(content);
      const triageResult = this.validateTriageResult(result);

      triageResult.analysisCompletedAt = new Date().toISOString();
      triageResult.version = "1.0";

      console.log(`🤖 Triage Complete: ${triageResult.urgency} urgency, ${triageResult.category} category`);
      return triageResult;
    } catch (error) {
      console.error("AI Triage Analysis Error:", error);
      return this.getFallbackTriage(request);
    }
  }

  private buildTriagePrompt(request: MaintenanceRequest, photoAnalysis?: string): string {
    return `
Analyze this property maintenance request and provide a comprehensive triage assessment:

MAINTENANCE REQUEST:
Title: ${request.title}
Description: ${request.description}
${request.category ? `Category: ${request.category}` : ''}
${request.priority ? `Priority: ${request.priority}` : ''}
${photoAnalysis ? `\nPHOTO ANALYSIS:\n${photoAnalysis}\n` : ''}

Please analyze and respond with JSON in this exact format:
{
  "category": "Primary category (Plumbing, Electrical, HVAC, Appliances, Structural, General Maintenance, Security, etc.)",
  "subcategory": "Specific subcategory (e.g., 'Leaky Faucet', 'Outlet Not Working', 'Heat Not Working', etc.)",
  "urgency": "Low|Medium|High|Critical (Critical=safety hazard/major disruption, High=significant impact, Medium=moderate inconvenience, Low=minor issue)",
  "estimatedComplexity": "Simple|Moderate|Complex (Simple=<1hr, Moderate=1-4hrs, Complex=>4hrs or multiple visits)",
  "requiredExpertise": ["List of required skills: plumber, electrician, HVAC technician, general maintenance, appliance repair, etc."],
  "estimatedDuration": "Estimated time to complete (e.g., '30 minutes', '2-3 hours', '1-2 days')",
  "preliminaryDiagnosis": "Brief diagnosis of likely cause and solution approach",
  "troubleshootingSteps": ["List of 3-5 initial troubleshooting steps that could be tried before contractor arrives"],
  "contractorType": "Primary contractor type needed (Plumber, Electrician, HVAC, General Maintenance, Appliance Repair, etc.)",
  "specialEquipment": ["List any special tools/equipment that may be needed"],
  "safetyRisk": "None|Low|Medium|High (High=immediate danger, Medium=potential hazard, Low=minor safety concern, None=no safety issues)",
  "reasoning": "Brief explanation of urgency and complexity assessment",
  "suggestedTimeWindow": "Best time window for this repair: 'same_day' (urgent), 'next_business_day', 'morning' (8am-12pm), 'afternoon' (12pm-5pm), 'evening' (5pm-8pm), or 'flexible'",
  "estimatedDurationMinutes": "Estimated job duration in minutes (e.g., 30, 60, 120, 180, 240)",
  "timeConfidence": "Confidence in time estimate as decimal 0.0-1.0 (e.g., 0.9 for high confidence, 0.6 for moderate, 0.3 for low)",
  "timeReasoningNotes": "Brief explanation of why this time window is recommended (consider urgency, typical repair patterns, tenant convenience, contractor efficiency)"
}`;
  }

  private async analyzeMaintenancePhotos(photos: string[]): Promise<string> {
    try {
      const firstPhoto = photos[0];
      const base64Data = firstPhoto.includes(',') ? firstPhoto.split(',')[1] : firstPhoto;

      const response = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this maintenance issue photo. Describe what you see, identify the problem, assess severity, note safety concerns, and provide actionable insights for maintenance coordination."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`
                }
              }
            ],
          }],
          max_completion_tokens: 500,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Photo analysis timeout")), 10000)
        )
      ]) as any;

      const analysis = response.choices[0].message.content || 'Unable to analyze image';
      console.log(`🤖 Photo Analysis: Completed successfully`);
      return analysis;

    } catch (error) {
      console.error('🚨 Photo Analysis Error:', error instanceof Error ? error.message : 'Unknown error');
      return 'Photo analysis unavailable - proceeding with text-based triage';
    }
  }

  private validateTriageResult(result: any): TriageResult {
    const validUrgencies = ["Low", "Medium", "High", "Critical"];
    if (!validUrgencies.includes(result.urgency)) {
      result.urgency = "Medium";
    }

    const validComplexities = ["Simple", "Moderate", "Complex"];
    if (!validComplexities.includes(result.estimatedComplexity)) {
      result.estimatedComplexity = "Moderate";
    }

    const validSafetyRisks = ["None", "Low", "Medium", "High"];
    if (!validSafetyRisks.includes(result.safetyRisk)) {
      result.safetyRisk = "None";
    }

    result.requiredExpertise = Array.isArray(result.requiredExpertise) ? result.requiredExpertise : [];
    result.troubleshootingSteps = Array.isArray(result.troubleshootingSteps) ? result.troubleshootingSteps : [];
    result.specialEquipment = Array.isArray(result.specialEquipment) ? result.specialEquipment : [];

    return result as TriageResult;
  }

  private getFallbackTriage(request: MaintenanceRequest): TriageResult {
    return {
      category: request.category || "General Maintenance",
      subcategory: "Unspecified Issue",
      urgency: "Medium",
      estimatedComplexity: "Moderate",
      requiredExpertise: ["General Maintenance"],
      estimatedDuration: "2-4 hours",
      preliminaryDiagnosis: "Issue requires assessment by maintenance professional",
      troubleshootingSteps: ["Document the issue with photos", "Note when the problem started", "Check if issue affects other areas"],
      contractorType: "General Maintenance",
      specialEquipment: [],
      safetyRisk: "None",
      reasoning: "AI analysis unavailable - using default triage values",
      suggestedTimeWindow: "flexible",
      estimatedDurationMinutes: 120,
      timeConfidence: 0.5,
      timeReasoningNotes: "Default estimate - AI analysis unavailable",
      analysisCompletedAt: new Date().toISOString(),
      version: "1.0-fallback"
    };
  }
}

export const aiTriageService = new AITriageService();
