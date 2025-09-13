import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

// USDC contract on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAYMENT_ADDRESS = '0xEchoEchoUSDCPayments...'; // Your payment receiving address

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, transactionHash, userAddress, tier } = req.body;

    if (action === 'verify_payment') {
      try {
        // Verify USDC payment on Base
        const receipt = await publicClient.getTransactionReceipt({
          hash: transactionHash
        });

        if (!receipt || !receipt.status) {
          return res.status(400).json({ 
            error: 'Transaction not found or failed',
            verified: false 
          });
        }

        // Check if transaction was to our payment address
        // In production, you'd parse the logs to verify USDC transfer amount
        const expectedAmounts = { premium: 7, pro: 25 };
        const expectedAmount = expectedAmounts[tier];

        if (!expectedAmount) {
          return res.status(400).json({ error: 'Invalid tier' });
        }

        // Simulate payment verification
        const isValidPayment = receipt.to?.toLowerCase() === PAYMENT_ADDRESS.toLowerCase();
        
        if (isValidPayment) {
          // Update user subscription status
          const subscription = {
            id: `sub_${Date.now()}`,
            user_address: userAddress,
            tier,
            status: 'active',
            usdc_amount: expectedAmount,
            transaction_hash: transactionHash,
            activated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            payment_method: 'usdc_base'
          };

          return res.status(200).json({
            success: true,
            verified: true,
            subscription,
            message: `🎉 Payment verified! Your ${tier} subscription is now active!`
          });
        } else {
          return res.status(400).json({
            error: 'Payment verification failed',
            verified: false
          });
        }

      } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({ 
          error: 'Payment verification failed: ' + error.message,
          verified: false 
        });
      }
    }

    if (action === 'check_subscription') {
      // Check if user has active subscription
      const userTier = req.body.userTier || 'free';
      const hasActiveSubscription = ['premium', 'pro'].includes(userTier);
      
      return res.status(200).json({
        tier: userTier,
        active: hasActiveSubscription,
        features: {
          unlimited_echoes: hasActiveSubscription,
          cross_platform: hasActiveSubscription,
          premium_nfts: userTier === 'pro' || userTier === 'premium',
          legendary_nfts: userTier === 'pro',
          api_access: userTier === 'pro',
          revenue_sharing: userTier === 'pro'
        }
      });
    }
  }

  if (req.method === 'GET') {
    // Get USDC payment information
    return res.status(200).json({
      usdc_contract: USDC_CONTRACT,
      payment_address: PAYMENT_ADDRESS,
      network: 'base',
      pricing: {
        premium: 7,  // 7 USDC per month
        pro: 25      // 25 USDC per month
      },
      instructions: {
        premium: 'Send 7 USDC to the payment address on Base network',
        pro: 'Send 25 USDC to the payment address on Base network'
      }
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}