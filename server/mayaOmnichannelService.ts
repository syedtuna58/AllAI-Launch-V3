import type { IStorage } from './storage';
import { IdentityMatchingService } from './identityMatching';
import { TwilioSmsService } from './twilioSmsService';
import { SendGridEmailService } from './sendgridEmailService';

/**
 * Maya Omnichannel Conversation Service
 * Handles intelligent AI responses across all communication channels
 */
export class MayaOmnichannelService {
  private identityService: IdentityMatchingService;
  private smsService: TwilioSmsService;
  private emailService: SendGridEmailService;

  constructor(private storage: IStorage) {
    this.identityService = new IdentityMatchingService(storage);
    this.smsService = new TwilioSmsService(storage);
    this.emailService = new SendGridEmailService(storage);
  }

  /**
   * Process incoming message and generate appropriate Maya response
   */
  async processMessage(params: {
    messageId: string;
    orgId: string;
  }): Promise<{ shouldRespond: boolean; response?: string; action?: string }> {
    const message = await this.storage.getChannelMessage(params.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Get channel settings for the organization
    const settings = await this.storage.getChannelSettings(params.orgId);
    
    // Check if auto-response is enabled
    if (!settings?.autoResponseEnabled) {
      return { shouldRespond: false };
    }

    // Check business hours if enabled
    if (settings.businessHoursOnly && !this.isBusinessHours(settings)) {
      return {
        shouldRespond: true,
        response: "Thank you for contacting us! We've received your message outside business hours. We'll get back to you first thing in the morning.",
      };
    }

    // Get identity information
    const identity = await this.identityService.identifyContact({
      phone: message.fromPhone,
      email: message.fromEmail,
      orgId: params.orgId,
    });

    // Check if verification is needed
    if (settings.requireIdentityVerification && identity.requiresVerification) {
      const verificationPrompt = this.identityService.generateVerificationPrompt(identity);
      return {
        shouldRespond: true,
        response: verificationPrompt,
      };
    }

    // Get approval policy for the organization
    const approvalPolicies = await this.storage.getApprovalPolicies(params.orgId);
    const activePolicy = approvalPolicies.find(p => p.isActive);

    // Generate AI response based on message content and context
    const aiResponse = await this.generateMayaResponse({
      message,
      identity,
      approvalPolicy: activePolicy,
      orgId: params.orgId,
    });

    return aiResponse;
  }

  /**
   * Generate Maya's AI response
   */
  private async generateMayaResponse(params: {
    message: any;
    identity: any;
    approvalPolicy: any;
    orgId: string;
  }): Promise<{ shouldRespond: boolean; response?: string; action?: string; caseId?: string }> {
    const { message, identity, approvalPolicy, orgId } = params;

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return { shouldRespond: false };
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Build context for Maya
    let contextInfo = '';
    if (identity.type === 'tenant' && identity.tenant) {
      const tenant = identity.tenant;
      contextInfo = `Tenant: ${tenant.firstName} ${tenant.lastName}`;
      if (tenant.unit) {
        contextInfo += `\nUnit: ${tenant.unit.label}`;
      }
      if (tenant.property) {
        contextInfo += `\nProperty: ${tenant.property.name}`;
      }
    } else if (identity.type === 'contractor' && identity.contractor) {
      contextInfo = `Contractor: ${identity.contractor.name}`;
    }

    // Determine involvement mode
    const involvementMode = approvalPolicy?.involvementMode || 'balanced';
    
    let systemPrompt = `You are Maya, a friendly and empathetic AI property management assistant. Your role is to help tenants and contractors communicate with property managers efficiently.

Context:
${contextInfo}

Involvement Mode: ${involvementMode}
- hands-off: Auto-approve most requests, create cases automatically
- balanced: Confirm details, then proceed with cases
- hands-on: Gather information but require admin approval for everything

Message Urgency: ${message.aiUrgencyScore || 'unknown'}/10
Message Category: ${message.aiCategory || 'unknown'}
Sentiment: ${message.aiSentiment || 'neutral'}

Guidelines:
1. Be warm, empathetic, and reassuring
2. If it's an emergency (urgency 8+), acknowledge urgency and escalate immediately
3. For maintenance issues, ask clarifying questions if needed (when did it start, is it getting worse, etc.)
4. Always end with reassurance that help is on the way or being coordinated
5. Use casual, conversational language - you're a helpful assistant, not a robot
6. If tenant seems frustrated, use de-escalation techniques
7. Keep responses concise (2-4 sentences max)

Respond in JSON format:
{
  "response": "Your friendly response to the tenant/contractor",
  "shouldCreateCase": boolean,
  "caseTitle": "Brief case title if creating case",
  "caseDescription": "Detailed case description if creating case",
  "requiresAdminApproval": boolean
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message.body },
        ],
        response_format: { type: 'json_object' },
      });

      const mayaResponse = JSON.parse(completion.choices[0].message.content || '{}');

      // Auto-create case if Maya determines it's needed
      let caseId: string | undefined;
      if (mayaResponse.shouldCreateCase && !mayaResponse.requiresAdminApproval) {
        const newCase = await this.storage.createSmartCase({
          orgId,
          title: mayaResponse.caseTitle || message.aiExtractedIssue || 'New Issue',
          description: mayaResponse.caseDescription || message.body,
          status: 'New',
          priority: message.aiUrgencyScore >= 8 ? 'Urgent' : message.aiUrgencyScore >= 6 ? 'High' : 'Medium',
          category: message.aiCategory,
          unitId: message.unitId,
          propertyId: message.propertyId,
        });
        caseId = newCase.id;

        // Link message to case
        await this.storage.updateChannelMessage(message.id, {
          caseId: newCase.id,
        });
      }

      // Update message with Maya's response
      await this.storage.updateChannelMessage(message.id, {
        mayaResponseBody: mayaResponse.response,
      });

      return {
        shouldRespond: true,
        response: mayaResponse.response,
        action: mayaResponse.shouldCreateCase ? 'case_created' : 'acknowledged',
        caseId,
      };
    } catch (error) {
      console.error('Error generating Maya response:', error);
      // Fallback response
      return {
        shouldRespond: true,
        response: "Thanks for reaching out! I've received your message and will make sure the property management team sees it right away. They'll get back to you soon!",
      };
    }
  }

  /**
   * Send Maya's response via appropriate channel
   */
  async sendResponse(params: {
    messageId: string;
    response: string;
    orgId: string;
  }): Promise<void> {
    const message = await this.storage.getChannelMessage(params.messageId);
    if (!message) return;

    const settings = await this.storage.getChannelSettings(params.orgId);

    try {
      if (message.channelType === 'sms' && settings?.smsEnabled) {
        await this.smsService.sendSms({
          to: message.fromPhone!,
          from: settings.twilioPhoneNumber || message.toPhone!,
          body: params.response,
          orgId: params.orgId,
          relatedMessageId: message.id,
        });
      } else if (message.channelType === 'email' && settings?.emailEnabled) {
        await this.emailService.sendEmail({
          to: message.fromEmail!,
          from: settings.inboundEmailAddress || message.toEmail!,
          subject: `Re: ${message.subject || 'Your inquiry'}`,
          text: params.response,
          orgId: params.orgId,
          relatedMessageId: message.id,
        });
      }

      // Mark response as sent
      await this.storage.updateChannelMessage(message.id, {
        mayaResponseSent: true,
        mayaResponseSentAt: new Date(),
      });
    } catch (error) {
      console.error('Error sending Maya response:', error);
      throw error;
    }
  }

  /**
   * Check if current time is within business hours
   */
  private isBusinessHours(settings: any): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = (settings.businessHoursStart || '09:00').split(':').map(Number);
    const [endHour, endMinute] = (settings.businessHoursEnd || '17:00').split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    return currentTime >= startTime && currentTime <= endTime;
  }
}
