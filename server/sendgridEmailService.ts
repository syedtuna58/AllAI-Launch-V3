import type { IStorage } from './storage';
import type { InsertChannelMessage } from '@shared/schema';
import { IdentityMatchingService } from './identityMatching';

/**
 * SendGrid Email Service
 * Handles inbound emails and outbound email responses
 */
export class SendGridEmailService {
  private identityService: IdentityMatchingService;

  constructor(private storage: IStorage) {
    this.identityService = new IdentityMatchingService(storage);
  }

  /**
   * Process inbound email webhook from SendGrid
   */
  async processInboundEmail(params: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    attachments?: string[];
    orgId: string;
  }): Promise<any> {
    const { from, to, subject, text, html, attachments, orgId } = params;

    // Extract email address from "Name <email@domain.com>" format
    const emailMatch = from.match(/<(.+)>/);
    const fromEmail = emailMatch ? emailMatch[1] : from;

    // Identify who sent the email
    const identity = await this.identityService.identifyContact({
      email: fromEmail,
      orgId,
    });

    // Create channel message record
    const messageData: InsertChannelMessage = {
      orgId,
      channelType: 'email',
      direction: 'inbound',
      status: 'received',
      fromEmail: fromEmail,
      toEmail: to,
      subject,
      body: text,
      tenantId: identity.type === 'tenant' ? identity.tenant?.id : undefined,
      contractorId: identity.type === 'contractor' ? identity.contractor?.id : undefined,
      unitId: identity.type === 'tenant' ? identity.tenant?.unit?.id : undefined,
      propertyId: identity.type === 'tenant' ? identity.tenant?.property?.id : undefined,
      attachments: attachments || [],
      rawData: params,
    };

    // Save to database
    const message = await this.storage.createChannelMessage(messageData);

    // Analyze message with AI
    this.analyzeEmailAsync(message.id).catch(err =>
      console.error('Error analyzing email:', err)
    );

    return message;
  }

  /**
   * Send email via SendGrid
   */
  async sendEmail(params: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
    orgId: string;
    relatedMessageId?: string;
  }): Promise<{ success: boolean }> {
    const { to, from, subject, text, html, orgId, relatedMessageId } = params;

    try {
      const { config } = await import('./config');
      const sendgridApiKey = config.sendgridApiKey;
      if (!sendgridApiKey) {
        throw new Error('SendGrid API key not configured');
      }

      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(sendgridApiKey);

      await sgMail.default.send({
        to,
        from,
        subject,
        text,
        html: html || text,
      });

      // Record outbound email
      const outboundData: InsertChannelMessage = {
        orgId,
        channelType: 'email',
        direction: 'outbound',
        status: 'processed',
        fromEmail: from,
        toEmail: to,
        subject,
        body: text,
        conversationThreadId: relatedMessageId,
        mayaResponseSent: true,
        mayaResponseSentAt: new Date(),
      };

      await this.storage.createChannelMessage(outboundData);

      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Analyze email with AI
   */
  private async analyzeEmailAsync(messageId: string): Promise<void> {
    try {
      const message = await this.storage.getChannelMessage(messageId);
      if (!message) return;

      const openaiApiKey = config.openaiApiKey;
      if (!openaiApiKey) return;

      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });

      const analysisPrompt = `Analyze this email from a tenant/contractor:

Subject: ${message.subject}
Body: ${message.body}

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
          { role: 'system', content: 'You are an AI analyzing property management emails. Provide JSON analysis.' },
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
        status: 'processed',
        processedAt: new Date(),
      });
    } catch (error) {
      console.error('Error analyzing email:', error);
    }
  }
}
