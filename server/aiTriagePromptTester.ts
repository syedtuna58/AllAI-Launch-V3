import OpenAI from "openai";
import type { TriageResult, MaintenanceRequest } from "./aiTriage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PropertyContext {
  propertyName: string;
  propertyType: string;
  yearBuilt?: number;
  location?: string;
  climate?: string;
  previousIssues?: string[];
}

export interface UnitContext {
  unitNumber?: string;
  unitType?: string;
  floorLevel?: string;
  knownIssues?: string[];
}

export interface SeasonalContext {
  season: string;
  temperature?: string;
  weatherConditions?: string;
  upcomingEvents?: string[];
}

export interface EnhancedMaintenanceRequest extends MaintenanceRequest {
  propertyContext?: PropertyContext;
  unitContext?: UnitContext;
  seasonalContext?: SeasonalContext;
  tenantFrustrationLevel?: "calm" | "concerned" | "frustrated" | "very_frustrated";
}

export interface PromptTestResult {
  promptName: string;
  promptType: "property_expert" | "safety_first" | "cost_conscious" | "efficiency_optimizer";
  result: TriageResult;
  executionTime: number;
  promptUsed: string;
}

export class AITriagePromptTester {
  private readonly TIMEOUT = 20000;

  async testAllPrompts(request: EnhancedMaintenanceRequest): Promise<PromptTestResult[]> {
    const startTime = Date.now();
    console.log(`🧪 Testing all 4 prompt variations for: "${request.title}"`);

    const prompts = [
      { type: "property_expert" as const, name: "Property Expert" },
      { type: "safety_first" as const, name: "Safety First" },
      { type: "cost_conscious" as const, name: "Cost-Conscious" },
      { type: "efficiency_optimizer" as const, name: "Efficiency Optimizer" }
    ];

    const results = await Promise.all(
      prompts.map(async ({ type, name }) => {
        const promptStart = Date.now();
        const prompt = this.buildPrompt(type, request);
        const systemPrompt = this.getSystemPrompt(type);
        
        try {
          const result = await this.runPrompt(systemPrompt, prompt);
          return {
            promptName: name,
            promptType: type,
            result,
            executionTime: Date.now() - promptStart,
            promptUsed: prompt
          };
        } catch (error) {
          console.error(`❌ ${name} prompt failed:`, error);
          return {
            promptName: name,
            promptType: type,
            result: this.getFallbackResult(request),
            executionTime: Date.now() - promptStart,
            promptUsed: prompt
          };
        }
      })
    );

    console.log(`✅ All prompts tested in ${Date.now() - startTime}ms`);
    return results;
  }

  private getSystemPrompt(type: "property_expert" | "safety_first" | "cost_conscious" | "efficiency_optimizer"): string {
    const prompts = {
      property_expert: `You are a senior property maintenance expert with 20+ years of experience managing diverse residential properties. You have deep knowledge of building systems, common failure patterns, and historical maintenance data. Your analysis prioritizes accurate diagnosis based on property characteristics, historical patterns, and similar past cases. You excel at identifying root causes and preventing recurring issues.`,
      
      safety_first: `You are a safety-focused property management specialist with expertise in risk assessment, tenant welfare, and legal liability. Your primary concern is identifying safety hazards, preventing injuries, and ensuring regulatory compliance. You prioritize tenant well-being and err on the side of caution when safety is involved. You're trained in OSHA standards, building codes, and emergency response protocols.`,
      
      cost_conscious: `You are a budget-savvy property manager who balances quality repairs with cost-effectiveness. You have extensive knowledge of repair costs, DIY solutions, and preventing small issues from becoming expensive emergencies. You consider ROI, long-term value, and smart resource allocation. You know when to repair vs. replace, and how to maximize contractor efficiency to minimize costs.`,
      
      efficiency_optimizer: `You are an operations optimization expert for property management. You excel at scheduling, resource allocation, and workflow efficiency. You consider contractor availability, tenant convenience, batch opportunities (grouping similar repairs), and seasonal timing. Your goal is to maximize productivity, minimize disruption, and create smooth operational workflows.`
    };
    
    return prompts[type];
  }

  private buildPrompt(
    type: "property_expert" | "safety_first" | "cost_conscious" | "efficiency_optimizer",
    request: EnhancedMaintenanceRequest
  ): string {
    const baseInfo = `
MAINTENANCE REQUEST:
Title: ${request.title}
Description: ${request.description}
${request.category ? `Category: ${request.category}` : ''}
${request.priority ? `Priority: ${request.priority}` : ''}
${request.tenantFrustrationLevel ? `Tenant Frustration Level: ${request.tenantFrustrationLevel}` : ''}
`;

    const propertyContext = request.propertyContext ? `
PROPERTY CONTEXT:
- Property: ${request.propertyContext.propertyName}
- Type: ${request.propertyContext.propertyType}
${request.propertyContext.yearBuilt ? `- Year Built: ${request.propertyContext.yearBuilt} (${new Date().getFullYear() - request.propertyContext.yearBuilt} years old)` : ''}
${request.propertyContext.location ? `- Location: ${request.propertyContext.location}` : ''}
${request.propertyContext.climate ? `- Climate: ${request.propertyContext.climate}` : ''}
${request.propertyContext.previousIssues?.length ? `- Previous Issues: ${request.propertyContext.previousIssues.join(', ')}` : ''}
` : '';

    const unitContext = request.unitContext ? `
UNIT CONTEXT:
${request.unitContext.unitNumber ? `- Unit: ${request.unitContext.unitNumber}` : ''}
${request.unitContext.unitType ? `- Type: ${request.unitContext.unitType}` : ''}
${request.unitContext.floorLevel ? `- Floor: ${request.unitContext.floorLevel}` : ''}
${request.unitContext.knownIssues?.length ? `- Known Issues: ${request.unitContext.knownIssues.join(', ')}` : ''}
` : '';

    const seasonalContext = request.seasonalContext ? `
SEASONAL/TIMING CONTEXT:
- Season: ${request.seasonalContext.season}
${request.seasonalContext.temperature ? `- Current Temperature: ${request.seasonalContext.temperature}` : ''}
${request.seasonalContext.weatherConditions ? `- Weather: ${request.seasonalContext.weatherConditions}` : ''}
${request.seasonalContext.upcomingEvents?.length ? `- Upcoming: ${request.seasonalContext.upcomingEvents.join(', ')}` : ''}
` : '';

    const specificGuidance = this.getSpecificGuidance(type);

    return `${baseInfo}${propertyContext}${unitContext}${seasonalContext}

${specificGuidance}

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
  "reasoning": "Brief explanation of urgency and complexity assessment from your perspective",
  "suggestedTimeWindow": "Best time window for this repair: 'same_day' (urgent), 'next_business_day', 'morning' (8am-12pm), 'afternoon' (12pm-5pm), 'evening' (5pm-8pm), or 'flexible'",
  "estimatedDurationMinutes": "Estimated job duration in minutes (e.g., 30, 60, 120, 180, 240)",
  "timeConfidence": "Confidence in time estimate as decimal 0.0-1.0 (e.g., 0.9 for high confidence, 0.6 for moderate, 0.3 for low)",
  "timeReasoningNotes": "Brief explanation of why this time window is recommended"
}`;
  }

  private getSpecificGuidance(type: "property_expert" | "safety_first" | "cost_conscious" | "efficiency_optimizer"): string {
    const guidance = {
      property_expert: `ANALYSIS FOCUS:
- Consider the property age and how it affects likely causes
- Think about similar issues you've seen at this property or similar properties
- Look for patterns in the description that match known failure modes
- Factor in climate and seasonal impacts on building systems
- Consider whether this is a symptom of a larger underlying issue
- Use historical data to inform your diagnosis and timeline estimates`,

      safety_first: `ANALYSIS FOCUS:
- First assess: Is anyone in immediate danger?
- Identify all potential safety hazards (electrical, structural, fire, water damage, mold, air quality)
- Consider tenant vulnerability (elderly, children, disabilities)
- Evaluate secondary risks (could this cause other dangerous situations?)
- Check for code violations or liability concerns
- Factor in tenant frustration level - could delay cause escalation?
- When in doubt about safety, escalate urgency
- Consider emergency vs. urgent vs. standard response requirements`,

      cost_conscious: `ANALYSIS FOCUS:
- Estimate repair costs and compare to replacement costs
- Identify opportunities for DIY or quick tenant fixes to avoid service calls
- Consider if delaying could lead to more expensive damage
- Evaluate warranty coverage or existing service contracts
- Think about preventive measures to avoid recurrence
- Look for batch opportunities - are there other similar repairs needed?
- Balance immediate costs vs. long-term value
- Consider seasonal pricing (HVAC costs more in peak seasons)`,

      efficiency_optimizer: `ANALYSIS FOCUS:
- Optimal scheduling window based on urgency and contractor availability
- Tenant convenience (minimize disruption to their schedule)
- Batch potential - could this be combined with other repairs?
- Seasonal timing - is this better done at a specific time?
- Resource coordination - what prep work can be done in advance?
- Access requirements - how to minimize multiple visits
- Communication plan - keeping all parties informed efficiently
- Follow-up needs - what monitoring or verification is needed?`
    };

    return guidance[type];
  }

  private async runPrompt(systemPrompt: string, userPrompt: string): Promise<TriageResult> {
    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI analysis timeout")), this.TIMEOUT)
      )
    ]) as any;

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from AI analysis");
    }

    const result = JSON.parse(content);
    return this.validateTriageResult(result);
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

  private getFallbackResult(request: EnhancedMaintenanceRequest): TriageResult {
    return {
      category: request.category || "General Maintenance",
      subcategory: "Analysis Failed",
      urgency: "Medium",
      estimatedComplexity: "Moderate",
      requiredExpertise: ["General Maintenance"],
      estimatedDuration: "2-4 hours",
      preliminaryDiagnosis: "AI analysis failed - requires manual assessment",
      troubleshootingSteps: ["Contact maintenance coordinator for assessment"],
      contractorType: "General Maintenance",
      specialEquipment: [],
      safetyRisk: "None",
      reasoning: "AI analysis unavailable",
      suggestedTimeWindow: "flexible",
      estimatedDurationMinutes: 120,
      timeConfidence: 0.3,
      timeReasoningNotes: "Default estimate - analysis failed"
    };
  }
}

export const aiTriagePromptTester = new AITriagePromptTester();
