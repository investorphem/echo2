// Premium access verification middleware
export default async function handler(req, res) {
  const { userTier, feature } = req.body;

  const permissions = {
    free: {
      daily_echoes: 5,
      cross_platform: false,
      ai_analysis: 10,
      nft_mints: 2,
      nft_rarities: ['common'],
      api_access: false,
      analytics: false
    },
    premium: {
      daily_echoes: 'unlimited',
      cross_platform: true,
      ai_analysis: 'unlimited',
      nft_mints: 50,
      nft_rarities: ['common', 'rare', 'epic'],
      api_access: false,
      analytics: true
    },
    pro: {
      daily_echoes: 'unlimited',
      cross_platform: true,
      ai_analysis: 'unlimited',
      nft_mints: 'unlimited',
      nft_rarities: ['common', 'rare', 'epic', 'legendary'],
      api_access: true,
      analytics: true,
      revenue_sharing: true
    }
  };

  const userPermissions = permissions[userTier] || permissions.free;
  
  // Check specific feature access
  if (feature) {
    const hasAccess = userPermissions[feature] !== false && userPermissions[feature] !== 0;
    return res.status(200).json({
      hasAccess,
      userTier,
      feature,
      limit: userPermissions[feature],
      upgradeRequired: !hasAccess
    });
  }

  // Return all permissions
  return res.status(200).json({
    userTier,
    permissions: userPermissions,
    isPremium: userTier !== 'free'
  });
}