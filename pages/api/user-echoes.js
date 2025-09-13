// API to track user's echo history and minted NFTs
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get user's echo history
    const { userAddress } = req.query;
    
    // In production, this would query a database
    // For now, return mock data
    const mockEchoes = [
      {
        id: 'echo_1',
        original_cast: 'Bitcoin ETF approval is revolutionary!',
        echoed_at: new Date(Date.now() - 86400000).toISOString(),
        type: 'standard',
        engagement: { likes: 12, recasts: 5 }
      },
      {
        id: 'echo_2',
        original_cast: 'Counter-view: ETF approval might centralize Bitcoin',
        echoed_at: new Date(Date.now() - 172800000).toISOString(),
        type: 'counter_narrative',
        source: 'twitter',
        insight_token_id: 'insight_123',
        engagement: { likes: 24, recasts: 8 }
      }
    ];

    const mockNFTs = [
      {
        id: 'insight_123',
        title: 'Bitcoin ETF Counter-Narrative',
        rarity: 'rare',
        minted_at: new Date(Date.now() - 172800000).toISOString(),
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=btc_counter'
      }
    ];

    return res.status(200).json({
      echoes: mockEchoes,
      nfts: mockNFTs,
      stats: {
        total_echoes: mockEchoes.length,
        counter_narratives: mockEchoes.filter(e => e.type === 'counter_narrative').length,
        nfts_minted: mockNFTs.length
      }
    });
  }

  if (req.method === 'POST') {
    // Record a new echo
    const { castId, userAddress, type = 'standard', source = 'farcaster' } = req.body;
    
    // In production, this would save to database
    const newEcho = {
      id: `echo_${Date.now()}`,
      cast_id: castId,
      user_address: userAddress,
      type,
      source,
      echoed_at: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      echo: newEcho
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}