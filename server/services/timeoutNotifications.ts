import { db } from '../db';
import { smartCases, organizationMembers, users } from '@shared/schema';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { sendEmail } from './emailService';

const TIMEOUT_HOURS = 4;

export async function checkAndSendTimeoutNotifications(): Promise<number> {
  let notificationsSent = 0;
  
  try {
    // Find non-urgent, unassigned cases that are past timeout and haven't been notified
    const cutoffTime = new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000);
    
    const casesNeedingNotification = await db.query.smartCases.findMany({
      where: and(
        eq(smartCases.isUrgent, false), // Non-urgent only
        isNull(smartCases.assignedContractorId), // Unassigned
        eq(smartCases.timeoutNotificationSent, false), // Not already notified
        lt(smartCases.postedAt, cutoffTime) // Posted > 4 hours ago
      ),
      with: {
        property: true,
      },
    });
    
    for (const caseItem of casesNeedingNotification) {
      try {
        // Get org admins
        const orgAdmins = await db.query.organizationMembers.findMany({
          where: and(
            eq(organizationMembers.orgId, caseItem.orgId),
            eq(organizationMembers.orgRole, 'org_admin'),
            eq(organizationMembers.membershipStatus, 'active')
          ),
        });
        
        // Send notification to each admin
        for (const admin of orgAdmins) {
          const adminUser = await db.query.users.findFirst({
            where: eq(users.id, admin.userId),
          });
          
          if (adminUser?.email) {
            await sendNotificationEmail(adminUser.email, caseItem, admin.userId);
          }
        }
        
        // Mark as notified
        await db.update(smartCases)
          .set({ timeoutNotificationSent: true })
          .where(eq(smartCases.id, caseItem.id));
        
        notificationsSent++;
      } catch (error) {
        console.error(`Error sending timeout notification for case ${caseItem.id}:`, error);
      }
    }
    
    if (notificationsSent > 0) {
      console.log(`✅ Sent ${notificationsSent} timeout notifications`);
    }
    
    return notificationsSent;
  } catch (error) {
    console.error('Error in timeout notifications check:', error);
    return 0;
  }
}

async function sendNotificationEmail(email: string, caseItem: any, adminUserId: string): Promise<void> {
  const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : 'http://localhost:5000';
  
  const caseUrl = `${BASE_URL}/cases/${caseItem.id}`;
  const propertyName = caseItem.property?.name || caseItem.property?.street || 'Unknown Property';
  
  const html = `
    <h2>Action Required: Case Needs Attention</h2>
    <p>A non-urgent maintenance case has been waiting for ${TIMEOUT_HOURS} hours without being assigned to a contractor.</p>
    
    <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <h3>${caseItem.title || 'Untitled Case'}</h3>
      <p><strong>Property:</strong> ${propertyName}</p>
      <p><strong>Priority:</strong> ${caseItem.priority || 'Normal'}</p>
      <p><strong>Posted:</strong> ${caseItem.postedAt ? new Date(caseItem.postedAt).toLocaleString() : 'Unknown'}</p>
    </div>
    
    <p>Please review this case and take action:</p>
    <ul>
      <li>Assign it to a contractor manually</li>
      <li>Change job settings to make it visible to more contractors</li>
      <li>Mark it as urgent if it needs immediate attention</li>
    </ul>
    
    <p><a href="${caseUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Case</a></p>
  `;
  
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@propertymanagement.com';
  
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid not configured. Timeout notification would be sent to:', email);
    console.log(html);
    return;
  }
  
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(SENDGRID_API_KEY);
    
    await sgMail.send({
      to: email,
      from: SENDGRID_FROM_EMAIL,
      subject: `⏰ Case Timeout Alert: ${caseItem.title || 'Maintenance Request'}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send timeout notification email:', error);
  }
}
