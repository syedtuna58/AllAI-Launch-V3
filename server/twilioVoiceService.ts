import type { IStorage } from './storage';
import type { InsertChannelMessage } from '@shared/schema';
import { IdentityMatchingService } from './identityMatching';

/**
 * Twilio Voice Service
 * Handles inbound voice calls and transcription
 */
export class TwilioVoiceService {
  private identityService: IdentityMatchingService;

  constructor(private storage: IStorage) {
    this.identityService = new IdentityMatchingService(storage);
  }

  /**
   * Process inbound voice call webhook from Twilio
   */
  async processInboundCall(params: {
    From: string;
    To: string;
    CallSid: string;
    RecordingUrl?: string;
    TranscriptionText?: string;
    CallDuration?: string;
    orgId: string;
  }): Promise<any> {
    const { From, To, CallSid, RecordingUrl, TranscriptionText, CallDuration, orgId } = params;

    // Identify who called
    const identity = await this.identityService.identifyContact({
      phone: From,
      orgId,
    });

    // Create channel message record
    const messageData: InsertChannelMessage = {
      orgId,
      channelType: 'voice',
      direction: 'inbound',
      status: TranscriptionText ? 'processed' : 'received',
      fromPhone: From,
      toPhone: To,
      body: TranscriptionText || 'Call received - transcription pending',
      externalId: CallSid,
      tenantId: identity.type === 'tenant' ? identity.tenant?.id : undefined,
      contractorId: identity.type === 'contractor' ? identity.contractor?.id : undefined,
      unitId: identity.type === 'tenant' ? identity.tenant?.unit?.id : undefined,
      propertyId: identity.type === 'tenant' ? identity.tenant?.property?.id : undefined,
      recordingUrl: RecordingUrl,
      callDuration: CallDuration ? parseInt(CallDuration) : undefined,
      rawData: params,
    };

    // Save to database
    const message = await this.storage.createChannelMessage(messageData);

    return message;
  }

  /**
   * Process transcription webhook from Twilio
   */
  async processTranscription(params: {
    CallSid: string;
    TranscriptionText: string;
    TranscriptionUrl: string;
  }): Promise<void> {
    const { CallSid, TranscriptionText, TranscriptionUrl } = params;

    // Find the message by externalId (CallSid)
    const messages = await this.storage.getChannelMessages('', { externalId: CallSid });
    const message = messages[0];

    if (message) {
      // Update with transcription
      await this.storage.updateChannelMessage(message.id, {
        body: TranscriptionText,
        transcriptionUrl: TranscriptionUrl,
        status: 'processed',
        processedAt: new Date(),
      });

      // Analyze transcription with AI
      this.analyzeTranscriptionAsync(message.id).catch(err =>
        console.error('Error analyzing transcription:', err)
      );
    } else {
      console.error(`No channel message found for CallSid: ${CallSid}`);
    }
  }

  /**
   * Generate TwiML response for inbound calls
   */
  generateCallResponse(identity: any): string {
    const greeting = identity.type === 'tenant' && identity.tenant
      ? `Hello ${identity.tenant.firstName}! This is Maya, your property assistant.`
      : "Hello! This is Maya, your property assistant.";

    const instructions = "Please leave a detailed message after the beep, and I'll make sure your property manager gets it right away.";

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greeting} ${instructions}</Say>
  <Record 
    transcribe="true" 
    transcribeCallback="/api/twilio/voice/transcription"
    maxLength="120"
  />
  <Say voice="Polly.Joanna">Thank you for your message. We'll get back to you soon. Goodbye!</Say>
</Response>`;
  }

  /**
   * Analyze call transcription with AI
   */
  private async analyzeTranscriptionAsync(messageId: string): Promise<void> {
    try {
      const message = await this.storage.getChannelMessage(messageId);
      if (!message) return;

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) return;

      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });

      const analysisPrompt = `Analyze this phone call transcription from a tenant/contractor:

"${message.body}"

Provide:
1. Sentiment (positive/neutral/negative/frustrated/urgent)
2. Urgency score (1-10, where 10 is emergency)
3. Category (maintenance/complaint/inquiry/emergency/other)
4. Brief summary (1 sentence)
5. Extracted issue (specific problem mentioned)

Respond in JSON format.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an AI analyzing property management calls. Provide JSON analysis.' },
          { role: 'user', content: analysisPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      await this.storage.updateChannelMessage(messageId, {
        aiSentiment: analysis.sentiment,
        aiUrgencyScore: analysis.urgencyScore,
        aiCategory: analysis.category,
        aiSummary: analysis.summary,
        aiExtractedIssue: analysis.extractedIssue,
      });
    } catch (error) {
      console.error('Error analyzing transcription:', error);
    }
  }
}
