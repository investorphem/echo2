// Cron endpoint for automated subscription management
import { 
  getExpiringSubscriptions, 
  markReminderSent, 
  expireSubscription,
  reconcileUserStatus
} from '../../../lib/storage.js';

// Secret token for cron endpoint protection
const CRON_SECRET = process.env.CRON_SECRET || 'echo_cron_secret_2024';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = {
      reminders_3d: 0,
      reminders_1d: 0,
      downgrades: 0,
      errors: []
    };

    // Process 3-day reminders
    try {
      const expiring3d = await getExpiringSubscriptions(3);
      
      for (const subscription of expiring3d) {
        if (!subscription.last_reminder_3d_at) {
          await markReminderSent(subscription.id, '3d');
          results.reminders_3d++;
          
          // Log reminder (in production, send actual notification)
          console.log(`📅 3-day reminder sent for subscription ${subscription.id} (${subscription.wallet_address})`);
        }
      }
    } catch (error) {
      results.errors.push(`3-day reminders error: ${error.message}`);
    }

    // Process 1-day reminders
    try {
      const expiring1d = await getExpiringSubscriptions(1);
      
      for (const subscription of expiring1d) {
        if (!subscription.last_reminder_1d_at) {
          await markReminderSent(subscription.id, '1d');
          results.reminders_1d++;
          
          // Log reminder (in production, send actual notification)
          console.log(`⚠️ 1-day reminder sent for subscription ${subscription.id} (${subscription.wallet_address})`);
        }
      }
    } catch (error) {
      results.errors.push(`1-day reminders error: ${error.message}`);
    }

    // Process expired subscriptions (downgrade)
    try {
      const expiredToday = await getExpiringSubscriptions(0);
      const now = new Date();
      
      for (const subscription of expiredToday) {
        const expiryDate = new Date(subscription.expires_at);
        
        if (now > expiryDate && subscription.status === 'active') {
          await expireSubscription(subscription.id);
          results.downgrades++;
          
          console.log(`⬇️ User downgraded: ${subscription.wallet_address} (subscription ${subscription.id})`);
        }
      }
    } catch (error) {
      results.errors.push(`Downgrade processing error: ${error.message}`);
    }

    console.log('Cron job completed:', results);
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    return res.status(500).json({ 
      error: 'Cron job failed',
      message: error.message 
    });
  }
}

// Helper function to get days until expiration
export const getDaysUntilExpiration = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};