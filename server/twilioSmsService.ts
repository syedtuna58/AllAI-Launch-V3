import type { IStorage } from './storage';
import type { InsertChannelMessage, ChannelMessage } from '@shared/schema';
import { IdentityMatchingService } from './identityMatching';

/**
 * Twilio SMS Service
 * Handles inbound SMS messages and outbound SMS responses
 */
export class TwilioSmsService {
  private identityService: IdentityMatchingService;

  constructor(private storage: IStorage) {
    this.identityService = new IdentityMatchingService(storage);
  }

  /**
   * Process inbound SMS webhook from Twilio
   */
  async processInboundSms(params: {
    From: string;
    To: string;
    Body: string;
    MessageSid: string;
    orgId: string;
  }): Promise<ChannelMessage> {
    const { From, To, Body, MessageSid, orgId } = params;

    // Identify who sent the message
    const identity = await this.identityService.identifyContact({
      phone: From,
      orgId,
    });

    // Create channel message record
    const messageData: InsertChannelMessage = {
      orgId,
      channelType: 'sms',
      direction: 'inbound',
      status: 'received',
      fromPhone: From,
      toPhone: To,
      body: Body,
      externalId: MessageSid,
      tenantId: identity.type === 'tenant' ? identity.tenant?.id : undefined,
      contractorId: identity.type === 'contractor' ? identity.contractor?.id : undefined,
      unitId: identity.type === 'tenant' ? identity.tenant?.unit?.id : undefined,
      propertyId: identity.type === 'tenant' ? identity.tenant?.property?.id : undefined,
      rawData: params,
    };

    // Save to database
    const message = await this.storage.createChannelMessage(messageData);

    // Analyze message with AI (async - don't block response)
    this.analyzeMessageAsync(message.id).catch(err => 
      console.error('Error analyzing message:', err)
    );

    return message;
  }

  /**
   * Send SMS via Twilio
   */
  async sendSms(params: {
    to: string;
    from: string;
    body: string;
    orgId: string;
    relatedMessageId?: string;
  }): Promise<{ sid: string; success: boolean }> {
    const { to, from, body, orgId, relatedMessageId } = params;

    try {
      // Get Twilio credentials from environment
      const { config } = await import('./config');
      const accountSid = config.twilioAccountSid;
      const authToken = config.twilioAuthToken;

      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
      }

      // Send SMS using Twilio REST API
      const twilioClient = await import('twilio');
      const client = twilioClient.default(accountSid, authToken);

      const message = await client.messages.create({
        body,
        from,
        to,
      });

      // Record outbound message
      const outboundData: InsertChannelMessage = {
        orgId,
        channelType: 'sms',
        direction: 'outbound',
        status: 'processed',
        fromPhone: from,
        toPhone: to,
        body,
        externalId: message.sid,
        conversationThreadId: relatedMessageId,
        mayaResponseSent: true,
        mayaResponseSentAt: new Date(),
      };

      await this.storage.createChannelMessage(outboundData);

      return { sid: message.sid, success: true };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Analyze message with AI (sentiment, urgency, category)
   */
  private async analyzeMessageAsync(messageId: string): Promise<void> {
    try {
      const message = await this.storage.getChannelMessage(messageId);
      if (!message) return;

      const openaiApiKey = config.openaiApiKey;
      if (!openaiApiKey) {
        console.warn('OpenAI API key not configured, skipping AI analysis');
        return;
      }

      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });

      const analysisPrompt = `Analyze this property management message:

"${message.body}"

Provide:
1. Sentiment (positive/neutral/negative/frustrated/urgent)
2. Urgency score (1-10, where 10 is emergency)
3. Category (maintenance/complaint/inquiry/emergency/other)
4. Brief summary (1 sentence)
5. Extracted issue (specific problem mentioned)

Respond in JSON format:
{
  "sentiment": "string",
  "urgencyScore": number,
  "category": "string",
  "summary": "string",
  "extractedIssue": "string"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant analyzing property management communications. Provide structured analysis in JSON format.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      // Update message with AI analysis
      await this.storage.updateChannelMessage(messageId, {
        aiSentiment: analysis.sentiment,
        aiUrgencyScore: analysis.urgencyScore,
        aiCategory: analysis.category,
        aiSummary: analysis.summary,
        aiExtractedIssue: analysis.extractedIssue,
        status: 'processed',
        processedAt: new Date(),
      });
    } catch (error) {
      console.error('Error analyzing message:', error);
    }
  }
}
