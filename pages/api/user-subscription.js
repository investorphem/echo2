// User subscription management based on wallet address
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

// USDC contract on Base
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SUBSCRIPTION_WALLET = '0x4f9B9C40345258684cfe23F02FDb2B88F1d2eA62'; // Your subscription receiving wallet

// In-memory user database (in production, use real database)
const users = new Map();

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { walletAddress, action } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const userKey = walletAddress.toLowerCase();

    if (action === 'get_subscription') {
      // Get user subscription status
      const user = users.get(userKey) || {
        walletAddress: userKey,
        tier: 'free',
        subscription: null,
        joinedAt: new Date().toISOString()
      };

      return res.status(200).json({
        user,
        subscription: user.subscription
      });
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

      const pricing = { premium: 7, pro: 25 };
      const user = users.get(userKey) || {
        walletAddress: userKey,
        tier: 'free',
        subscription: null,
        joinedAt: new Date().toISOString()
      };

      // Create subscription
      const subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tier,
        status: 'active',
        amount_usdc: pricing[tier],
        transaction_hash: transactionHash,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        auto_renew: true
      };

      user.tier = tier;
      user.subscription = subscription;
      users.set(userKey, user);

      return res.status(200).json({
        success: true,
        subscription,
        message: `🎉 Successfully upgraded to ${tier}! Welcome to EchoEcho ${tier}!`
      });
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