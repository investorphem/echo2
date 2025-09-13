// Persistent storage for subscription data using JSON files
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize storage file if it doesn't exist
if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify({
    users: {},
    subscriptions: {},
    payments: {}
  }, null, 2));
}

// Thread-safe file operations with simple mutex
let fileLock = false;

const waitForLock = async () => {
  while (fileLock) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

const readData = async () => {
  await waitForLock();
  try {
    const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading subscription data:', error);
    return { users: {}, subscriptions: {}, payments: {} };
  }
};

const writeData = async (data) => {
  await waitForLock();
  fileLock = true;
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing subscription data:', error);
  } finally {
    fileLock = false;
  }
};

// User management
export const getUser = async (walletAddress) => {
  const data = await readData();
  const userKey = walletAddress.toLowerCase();
  return data.users[userKey] || null;
};

export const createUser = async (walletAddress, userInfo = {}) => {
  const data = await readData();
  const userKey = walletAddress.toLowerCase();
  
  const user = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    wallet_address: userKey,
    farcaster_fid: userInfo.farcaster_fid || null,
    email: userInfo.email || null,
    tier: 'free',
    created_at: new Date().toISOString(),
    ...userInfo
  };
  
  data.users[userKey] = user;
  await writeData(data);
  return user;
};

export const updateUserTier = async (walletAddress, tier) => {
  const data = await readData();
  const userKey = walletAddress.toLowerCase();
  
  if (data.users[userKey]) {
    data.users[userKey].tier = tier;
    data.users[userKey].updated_at = new Date().toISOString();
    await writeData(data);
    return data.users[userKey];
  }
  return null;
};

// Subscription management
export const createSubscription = async (walletAddress, tier, transactionHash) => {
  const data = await readData();
  const userKey = walletAddress.toLowerCase();
  
  // Ensure user exists
  if (!data.users[userKey]) {
    await createUser(walletAddress);
    // Re-read data after creating user
    const updatedData = await readData();
    data.users = updatedData.users;
  }
  
  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const subscription = {
    id: subscriptionId,
    user_id: data.users[userKey].id,
    wallet_address: userKey,
    tier,
    status: 'active',
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    next_billing_at: expiresAt.toISOString(),
    auto_renew: true,
    last_reminder_3d_at: null,
    last_reminder_1d_at: null,
    transaction_hash: transactionHash
  };
  
  // Update user tier
  data.users[userKey].tier = tier;
  data.users[userKey].updated_at = now.toISOString();
  
  // Store subscription
  data.subscriptions[subscriptionId] = subscription;
  
  await writeData(data);
  return subscription;
};

export const getUserSubscription = async (walletAddress) => {
  const data = await readData();
  const userKey = walletAddress.toLowerCase();
  
  // Find active subscription for user
  const userSubscriptions = Object.values(data.subscriptions).filter(
    sub => sub.wallet_address === userKey && sub.status === 'active'
  );
  
  return userSubscriptions.length > 0 ? userSubscriptions[0] : null;
};

export const getExpiringSubscriptions = async (daysAhead) => {
  const data = await readData();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);
  
  return Object.values(data.subscriptions).filter(sub => {
    if (sub.status !== 'active') return false;
    
    const expiryDate = new Date(sub.expires_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(23, 59, 59, 999);
    
    return expiryDate >= today && expiryDate <= targetDate;
  });
};

export const markReminderSent = async (subscriptionId, reminderType) => {
  const data = await readData();
  
  if (data.subscriptions[subscriptionId]) {
    const field = reminderType === '3d' ? 'last_reminder_3d_at' : 'last_reminder_1d_at';
    data.subscriptions[subscriptionId][field] = new Date().toISOString();
    await writeData(data);
  }
};

export const expireSubscription = async (subscriptionId) => {
  const data = await readData();
  
  if (data.subscriptions[subscriptionId]) {
    const subscription = data.subscriptions[subscriptionId];
    subscription.status = 'expired';
    
    // Downgrade user tier to free
    const userKey = subscription.wallet_address;
    if (data.users[userKey]) {
      data.users[userKey].tier = 'free';
      data.users[userKey].updated_at = new Date().toISOString();
    }
    
    await writeData(data);
    return subscription;
  }
  return null;
};

export const reconcileUserStatus = async (walletAddress) => {
  const subscription = await getUserSubscription(walletAddress);
  
  if (subscription) {
    const now = new Date();
    const expiryDate = new Date(subscription.expires_at);
    
    if (now > expiryDate) {
      // Subscription has expired, downgrade user
      await expireSubscription(subscription.id);
      await updateUserTier(walletAddress, 'free');
      return { tier: 'free', subscription: null };
    }
    
    const user = await getUser(walletAddress);
    return { tier: user?.tier || 'free', subscription };
  }
  
  const user = await getUser(walletAddress);
  return { tier: user?.tier || 'free', subscription: null };
};

// Payment tracking
export const getAllActiveSubscriptions = async () => {
  const data = await readData();
  return Object.values(data.subscriptions).filter(sub => sub.status === 'active');
};

export const recordPayment = async (walletAddress, transactionHash, amountUsdc, tier) => {
  const data = await readData();
  const userKey = walletAddress.toLowerCase();
  
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const payment = {
    id: paymentId,
    wallet_address: userKey,
    tx_hash: transactionHash,
    amount_usdc: amountUsdc,
    tier,
    confirmed_at: new Date().toISOString()
  };
  
  data.payments[paymentId] = payment;
  await writeData(data);
  return payment;
};