import { WebSocket } from 'ws';

interface NotificationData {
  id?: string;
  to?: string;
  subject?: string;
  message: string;
  type: 'case_created' | 'contractor_assigned' | 'case_updated' | 'emergency_alert' | 'case_assigned' | 'case_available' | 'case_accepted' | 'case_declined' | 'case_urgent' | 'maintenance_test' | 'case_scheduled' | 'case_completed';
  title?: string;
  timestamp?: string;
  orgId?: string;
  caseId?: string;
  caseNumber?: string;
  urgencyLevel?: string;
  metadata?: any;
}

interface WebSocketConnection {
  ws: WebSocket;
  userId: string;
  role: string;
  orgId: string;
}

class NotificationService {
  private wsConnections: WebSocketConnection[] = [];

  constructor() {
    this.initializeNotificationAPIs();
  }

  private initializeNotificationAPIs() {
    try {
      if (process.env.SENDGRID_API_KEY) {
        console.log('✅ SendGrid API key found - email notifications enabled');
      } else {
        console.warn('⚠️ SENDGRID_API_KEY not found - email notifications will be disabled');
      }

      if (process.env.BREVO_API_KEY) {
        console.log('✅ Brevo API key found - SMS notifications enabled');
      } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        console.log('✅ Twilio API keys found - SMS notifications enabled');
      } else {
        console.warn('⚠️ BREVO_API_KEY or TWILIO credentials not found - SMS notifications will be disabled');
      }
    } catch (error) {
      console.error('❌ Failed to initialize notification APIs:', error);
    }
  }

  addWebSocketConnection(ws: WebSocket, userContext: {userId: string, role: string, orgId: string}) {
    this.wsConnections.push({ ws, ...userContext });
    console.log(`🔗 WebSocket connected: ${userContext.userId} (${userContext.role}) in org ${userContext.orgId}`);
  }

  removeWebSocketConnection(ws: WebSocket) {
    const index = this.wsConnections.findIndex(conn => conn.ws === ws);
    if (index !== -1) {
      const conn = this.wsConnections[index];
      this.wsConnections.splice(index, 1);
      console.log(`🔌 WebSocket disconnected: ${conn.userId} (${conn.role}) from org ${conn.orgId || 'unknown'}`);
    }
  }

  private sendWebSocketNotification(targetUserId: string, notification: NotificationData, targetOrgId?: string) {
    const connections = this.wsConnections.filter(conn => {
      if (conn.userId !== targetUserId || conn.ws.readyState !== WebSocket.OPEN) return false;
      if (targetOrgId && conn.orgId && conn.orgId !== targetOrgId) return false;
      return true;
    });

    connections.forEach(conn => {
      try {
        conn.ws.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        console.log(`📱 Real-time notification sent to ${targetUserId} (${conn.role})`);
      } catch (error) {
        console.error(`❌ Failed to send WebSocket notification to ${targetUserId}:`, error);
      }
    });
  }

  async sendEmailNotification(notification: NotificationData, recipientEmail: string): Promise<boolean> {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('📧 SendGrid API key not found - skipping email notification');
        return false;
      }

      const emailContent = this.generateEmailContent(notification);

      const payload = {
        personalizations: [{
          to: [{ email: recipientEmail }],
          subject: notification.subject
        }],
        from: {
          email: 'notifications@allai.property',
          name: 'AllAI Property Management'
        },
        content: [
          {
            type: 'text/plain',
            value: emailContent.text
          },
          {
            type: 'text/html',
            value: emailContent.html
          }
        ]
      };

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`📧 Email sent to ${recipientEmail}`);
        return true;
      } else {
        const errorText = await response.text();
        console.error(`❌ SendGrid error (${response.status}): ${errorText}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to send email to ${recipientEmail}:`, error);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 11 && cleanPhone.startsWith('1')) {
      return '+' + cleanPhone;
    }
    if (cleanPhone.length === 10) {
      return '+1' + cleanPhone;
    }
    if (phone.startsWith('+')) {
      return phone;
    }
    return '+1' + cleanPhone;
  }

  async sendSMSNotification(notification: NotificationData, recipientPhone: string): Promise<boolean> {
    const formattedPhone = this.formatPhoneNumber(recipientPhone);

    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(
                `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
              ).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: formattedPhone,
              From: process.env.TWILIO_PHONE_NUMBER,
              Body: this.generateSMSContent(notification)
            })
          }
        );

        if (response.ok) {
          console.log(`📱 SMS sent to ${formattedPhone}`);
          return true;
        }
      } else {
        console.warn('📱 SMS API not configured - skipping SMS notification');
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${formattedPhone}:`, error);
      return false;
    }
    return false;
  }

  async notifyAdmins(notification: NotificationData, orgId: string): Promise<void> {
    try {
      const storage = (await import('./storage.js')).storage;

      console.log(`🔍 Looking up admin for org ${orgId} for ${notification.type} notification`);

      const org = await storage.getOrganization(orgId);
      if (!org?.ownerId) {
        console.warn(`⚠️ No owner found for org ${orgId}`);
        return;
      }

      const adminUser = await storage.getUser(org.ownerId);
      if (!adminUser || !adminUser.email) {
        console.warn(`⚠️ No admin user or email found for org ${orgId}`);
        return;
      }

      const promises = [];

      if (adminUser.email) {
        promises.push(this.sendEmailNotification(notification, adminUser.email));
      }

      if (adminUser.phone) {
        promises.push(this.sendSMSNotification(notification, adminUser.phone));
      }

      // Save notification to database for bell icon history
      promises.push(
        storage.createNotification(
          adminUser.id,
          notification.title || notification.subject || 'Notification',
          notification.message,
          notification.type,
          'admin',
          `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email
        )
      );

      this.sendWebSocketNotification(adminUser.id, notification, orgId);

      await Promise.allSettled(promises);
      console.log(`✅ Admin notifications dispatched for ${notification.type}`);
    } catch (error) {
      console.error('❌ Failed to notify admins:', error);
    }
  }

  async notifyContractor(notification: NotificationData, contractorId: string, orgId?: string): Promise<void> {
    try {
      const storage = (await import('./storage.js')).storage;

      // contractorId is actually a vendor ID, need to look up the vendor first
      const vendor = await storage.getContractor(contractorId);
      if (!vendor || !vendor.userId) {
        console.error(`❌ Contractor vendor ${contractorId} not found or has no userId`);
        return;
      }

      const contractor = await storage.getUser(vendor.userId);
      if (!contractor) {
        console.error(`❌ Contractor user ${vendor.userId} not found`);
        return;
      }

      const promises = [];

      if (contractor.email) {
        promises.push(this.sendEmailNotification(notification, contractor.email));
      }

      if (contractor.phone) {
        promises.push(this.sendSMSNotification(notification, contractor.phone));
      }

      // Save notification to database for bell icon history
      promises.push(
        storage.createNotification(
          vendor.userId,
          notification.title || notification.subject || 'Notification',
          notification.message,
          notification.type,
          'contractor',
          vendor.name || contractor.email || 'Contractor'
        )
      );

      this.sendWebSocketNotification(vendor.userId, notification, orgId);

      await Promise.allSettled(promises);
      console.log(`✅ Contractor notifications dispatched for ${notification.type}`);
    } catch (error) {
      console.error('❌ Failed to notify contractor:', error);
    }
  }

  async notifyTenant(notification: NotificationData, tenantEmail: string, tenantUserId?: string, orgId?: string): Promise<void> {
    try {
      console.log(`📧 Sending tenant notification to ${tenantEmail}: ${notification.subject}`);

      const storage = (await import('./storage.js')).storage;
      const promises = [];
      promises.push(this.sendEmailNotification(notification, tenantEmail));

      if (tenantUserId) {
        // Save notification to database for bell icon history
        promises.push(
          storage.createNotification(
            tenantUserId,
            notification.title || notification.subject || 'Notification',
            notification.message,
            notification.type,
            'tenant',
            tenantEmail
          )
        );
        this.sendWebSocketNotification(tenantUserId, notification, orgId);
      }

      await Promise.allSettled(promises);
      console.log(`✅ Tenant notifications dispatched for ${notification.type}`);
    } catch (error) {
      console.error('❌ Failed to notify tenant:', error);
    }
  }

  private generateEmailContent(notification: NotificationData): { html: string; text: string } {
    const { type, subject, message, caseNumber, urgencyLevel } = notification;

    let html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2c3e50; margin: 0;">AllAI Property Management</h2>
            </div>
    `;

    switch (type) {
      case 'case_created':
        html += `
          <h3 style="color: #e74c3c;">🚨 New Maintenance Case Created</h3>
          <p><strong>Case Number:</strong> ${caseNumber}</p>
          <p><strong>Urgency Level:</strong> <span style="color: ${this.getUrgencyColor(urgencyLevel)}">${urgencyLevel}</span></p>
          <p><strong>Description:</strong> ${message}</p>
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Action Required:</strong> Please review and assign a contractor to this case.</p>
          </div>
        `;
        break;

      case 'contractor_assigned':
        html += `
          <h3 style="color: #27ae60;">👷 New Assignment</h3>
          <p><strong>Case Number:</strong> ${caseNumber}</p>
          <p><strong>Urgency Level:</strong> <span style="color: ${this.getUrgencyColor(urgencyLevel)}">${urgencyLevel}</span></p>
          <p><strong>Details:</strong> ${message}</p>
          <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Next Step:</strong> Please review and schedule this maintenance request.</p>
          </div>
        `;
        break;

      case 'case_scheduled':
        html += `
          <h3 style="color: #3498db;">📅 Maintenance Scheduled</h3>
          <p><strong>Case Number:</strong> ${caseNumber}</p>
          <p><strong>Details:</strong> ${message}</p>
        `;
        break;

      case 'case_updated':
        html += `
          <h3 style="color: #3498db;">📝 Case Update</h3>
          <p><strong>Case Number:</strong> ${caseNumber}</p>
          <p><strong>Update:</strong> ${message}</p>
        `;
        break;

      case 'case_completed':
        html += `
          <h3 style="color: #27ae60;">✅ Case Completed</h3>
          <p><strong>Case Number:</strong> ${caseNumber}</p>
          <p><strong>Details:</strong> ${message}</p>
        `;
        break;

      case 'emergency_alert':
        html += `
          <h3 style="color: #e74c3c;">🚨 EMERGENCY ALERT</h3>
          <p><strong>Case Number:</strong> ${caseNumber}</p>
          <p><strong>URGENT:</strong> ${message}</p>
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0;"><strong>IMMEDIATE ACTION REQUIRED</strong></p>
          </div>
        `;
        break;

      default:
        html += `
          <h3>${subject || 'Notification'}</h3>
          <p>${message}</p>
        `;
    }

    html += `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
              <p>This is an automated notification from AllAI Property Management.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
AllAI Property Management
${subject || type}

${message}

${caseNumber ? `Case Number: ${caseNumber}` : ''}
${urgencyLevel ? `Urgency: ${urgencyLevel}` : ''}

---
This is an automated notification from AllAI Property Management.
    `.trim();

    return { html, text };
  }

  private generateSMSContent(notification: NotificationData): string {
    const { type, message, caseNumber, urgencyLevel } = notification;
    
    let smsText = '';
    
    if (urgencyLevel === 'emergency') {
      smsText = `🚨 EMERGENCY - `;
    }
    
    smsText += `AllAI Property: ${message}`;
    
    if (caseNumber) {
      smsText += ` Case: ${caseNumber}`;
    }
    
    return smsText.substring(0, 160);
  }

  private getUrgencyColor(urgencyLevel?: string): string {
    switch (urgencyLevel?.toLowerCase()) {
      case 'emergency':
      case 'urgent':
        return '#e74c3c';
      case 'high':
        return '#e67e22';
      case 'medium':
        return '#f39c12';
      default:
        return '#27ae60';
    }
  }
}

export const notificationService = new NotificationService();
