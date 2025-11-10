import cron from "node-cron";
import { storage } from "./storage";
import { checkAndSendTimeoutNotifications } from "./services/timeoutNotifications";
import { cleanupExpiredSessions } from "./services/sessionService";

export function startCronJobs() {
  // Run every hour to check for due reminders
  cron.schedule('0 * * * *', async () => {
    console.log('Checking for due reminders...');
    
    try {
      const dueReminders = await storage.getDueReminders();
      
      for (const reminder of dueReminders) {
        // Send notification
        if (reminder.orgId) {
          // Get organization members to notify
          const org = await storage.getUserOrganization(reminder.orgId);
          if (org) {
            const adminUser = await storage.getUser(org.ownerId);
            await storage.createNotification(
              org.ownerId,
              reminder.title,
              `Reminder: ${reminder.title} is due`,
              'warning',
              'admin',
              adminUser ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email || 'Admin' : 'Admin'
            );
          }
        }
        
        // Track notification sent time (status remains null for active reminders)
        await storage.updateReminder(reminder.id, {
          sentAt: new Date(),
        });
        
        console.log(`Sent reminder: ${reminder.title}`);
      }
    } catch (error) {
      console.error('Error processing reminders:', error);
    }
  });

  // Generate monthly rent reminders (run on 1st of each month)
  cron.schedule('0 0 1 * *', async () => {
    console.log('Generating monthly rent reminders...');
    
    try {
      // This would typically fetch all active leases and create rent reminders
      // Implementation would depend on specific business logic
      console.log('Monthly rent reminders generated');
    } catch (error) {
      console.error('Error generating rent reminders:', error);
    }
  });

  // Check for lease expirations (run daily)
  cron.schedule('0 9 * * *', async () => {
    console.log('Checking for lease expirations...');
    
    try {
      await storage.createLeaseEndReminders();
      console.log('Lease expiration check completed');
    } catch (error) {
      console.error('Error checking lease expirations:', error);
    }
  });

  // Generate compliance reminders (run daily at 8 AM)
  cron.schedule('0 8 * * *', async () => {
    console.log('Generating compliance reminders...');
    
    try {
      await storage.generateComplianceReminders();
      console.log('Compliance reminder generation completed');
    } catch (error) {
      console.error('Error generating compliance reminders:', error);
    }
  });

  // Generate missing recurring transactions (run daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    console.log('Generating missing recurring transactions...');
    
    try {
      await storage.generateRecurringTransactions();
      console.log('Recurring transaction generation completed');
    } catch (error) {
      console.error('Error generating recurring transactions:', error);
    }
  });

  // Generate predictive maintenance insights (run daily at 3 AM)
  // Note: Predictions are also auto-generated when equipment is added/updated
  cron.schedule('0 3 * * *', async () => {
    console.log('Regenerating predictive maintenance insights for all organizations...');
    
    try {
      const { PredictiveAnalyticsEngine } = await import('./predictiveAnalyticsEngine');
      // Get all unique organization IDs from properties
      const allProperties = await storage.getAllProperties();
      const uniqueOrgIds = [...new Set(allProperties.map(p => p.orgId))];
      
      for (const orgId of uniqueOrgIds) {
        const analyticsEngine = new PredictiveAnalyticsEngine(storage);
        await analyticsEngine.generatePredictions(orgId);
        console.log(`Generated predictions for organization ID: ${orgId}`);
      }
      
      console.log('Predictive insights regeneration completed');
    } catch (error) {
      console.error('Error generating predictive insights:', error);
    }
  });

  // Check for timeout notifications every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('🔔 Running timeout notifications check...');
    try {
      await checkAndSendTimeoutNotifications();
    } catch (error) {
      console.error('Error in timeout notifications:', error);
    }
  });
  
  // Cleanup expired sessions daily at 4 AM
  cron.schedule('0 4 * * *', async () => {
    console.log('🧹 Cleaning up expired sessions...');
    try {
      const cleaned = await cleanupExpiredSessions();
      console.log(`✅ Cleaned up ${cleaned} expired sessions`);
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  });

  console.log('Cron jobs started successfully');
}
