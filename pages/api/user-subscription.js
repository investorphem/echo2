// User subscription management based on wallet address
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { 
  getUser, 
  createUser, 
  updateUserTier, 
  createSubscription,
  getUserSubscription,
  reconcileUserStatus,
  recordPayment
} from '../../lib/storage.js';

const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

// USDC contract on Base
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SUBSCRIPTION_WALLET = '0x4f9B9C40345258684cfe23F02FDb2B88F1d2eA62'; // Your subscription receiving wallet

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { walletAddress, action } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const userKey = walletAddress.toLowerCase();

    if (action === 'get_subscription') {
      try {
        // Reconcile user status and check for expired subscriptions
        const { tier, subscription } = await reconcileUserStatus(userKey);
        
        let user = await getUser(userKey);
        if (!user) {
          user = await createUser(userKey, { tier });
        }

        return res.status(200).json({
          user: {
            ...user,
            tier,
            walletAddress: userKey
          },
          subscription
        });
      } catch (error) {
        console.error('Error getting subscription:', error);
        return res.status(500).json({ error: 'Failed to get subscription' });
      }
    }

    if (action === 'create_subscription') {
      const { tier, transactionHash } = req.body;
      
      if (!['premium', 'pro'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid subscription tier' });
      }

      // Verify the transaction (in production, verify on-chain)
      // For demo, simulate transaction verification
      const isValidTransaction = transactionHash && transactionHash.startsWith('0x');
      
      if (!isValidTransaction) {
        return res.status(400).json({ error: 'Invalid transaction hash' });
      }

      try {
        const pricing = { premium: 7, pro: 25 };
        
        // Ensure user exists
        let user = await getUser(userKey);
        if (!user) {
          user = await createUser(userKey);
        }

        // Create subscription with persistence
        const subscription = await createSubscription(userKey, tier, transactionHash);
        
        // Record payment
        await recordPayment(userKey, transactionHash, pricing[tier], tier);

        return res.status(200).json({
          success: true,
          subscription,
          message: `🎉 Successfully upgraded to ${tier}! Welcome to EchoEcho ${tier}!`
        });
      } catch (error) {
        console.error('Error creating subscription:', error);
        return res.status(500).json({ error: 'Failed to create subscription' });
      }
    }

    if (action === 'check_usdc_balance') {
      try {
        // In production, query USDC contract on Base
        // For demo, simulate balance check
        const mockBalance = Math.floor(Math.random() * 100) + 10;
        
        return res.status(200).json({
          balance: mockBalance,
          formatted: `${mockBalance} USDC`,
          network: 'base',
          contract: USDC_CONTRACT
        });
      } catch (error) {
        return res.status(500).json({ 
          error: 'Failed to check USDC balance: ' + error.message 
        });
      }
    }
  }

  if (req.method === 'GET') {
    // Get subscription pricing and info
    return res.status(200).json({
      pricing: {
        premium: 7,
        pro: 25
      },
      features: {
        free: {
          daily_echoes: 5,
          cross_platform: false,
          nft_rarities: ['common'],
          analytics: false
        },
        premium: {
          daily_echoes: 'unlimited',
          cross_platform: true,
          nft_rarities: ['common', 'rare', 'epic'],
          analytics: true
        },
        pro: {
          daily_echoes: 'unlimited',
          cross_platform: true,
          nft_rarities: ['common', 'rare', 'epic', 'legendary'],
          analytics: true,
          api_access: true,
          revenue_sharing: true
        }
      },
      payment_info: {
        network: 'base',
        usdc_contract: USDC_CONTRACT,
        subscription_wallet: SUBSCRIPTION_WALLET
      }
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}