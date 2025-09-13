import { useEffect, useState } from "react";

export default function Home() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalMode, setGlobalMode] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [counterNarratives, setCounterNarratives] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState('trends'); // 'trends', 'echoes', 'topic', 'premium', 'earnings', 'faq'
  const [userTier, setUserTier] = useState('free'); // 'free', 'premium', 'pro'
  const [userEchoes, setUserEchoes] = useState(null);

  useEffect(() => {
    loadTrends();
    checkWalletConnection();
  }, [globalMode]);

  const checkWalletConnection = async () => {
    // Check if user has wallet connected via Farcaster or Web3
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
          await checkUSDCBalance(accounts[0]);
          await loadUserSubscription(accounts[0]);
        }
      } catch (error) {
        console.error('Wallet connection check failed:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
          await checkUSDCBalance(accounts[0]);
          await loadUserSubscription(accounts[0]);
        }
      } catch (error) {
        alert('❌ Failed to connect wallet: ' + error.message);
      }
    } else {
      alert('Please install a Web3 wallet like MetaMask or use Farcaster app!');
    }
  };

  const checkUSDCBalance = async (address) => {
    try {
      // In production, query USDC contract on Base
      // For demo, simulate balance check
      const balance = Math.floor(Math.random() * 100) + 10; // 10-110 USDC
      setUsdcBalance(balance);
    } catch (error) {
      console.error('USDC balance check failed:', error);
      setUsdcBalance(0);
    }
  };

  const loadUserSubscription = async (address) => {
    try {
      const resp = await fetch('/api/user-subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: address,
          action: 'get_subscription'
        })
      });
      const data = await resp.json();
      if (data.user) {
        setUserTier(data.user.tier);
      }
    } catch (error) {
      console.error('Failed to load user subscription:', error);
    }
  };

  const loadTrends = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/trending");
      const data = await resp.json();
      const trendsData = data.casts || [];
      
      // Add AI sentiment analysis to each trend
      const enrichedTrends = await Promise.all(
        trendsData.slice(0, 10).map(async (trend) => {
          try {
            const aiResp = await fetch('/api/ai-analysis', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ 
                text: trend.text || trend.body || '',
                action: 'analyze_sentiment'
              })
            });
            const sentiment = await aiResp.json();
            return { ...trend, ai_analysis: sentiment };
          } catch {
            return { ...trend, ai_analysis: { sentiment: 'neutral', confidence: 0.5 } };
          }
        })
      );
      
      setTrends(enrichedTrends);
    } catch (error) {
      console.error('Error loading trends:', error);
      setTrends([]);
    }
    setLoading(false);
  };

  const loadTopicDetails = async (topic) => {
    setSelectedTopic(topic);
    setActiveView('topic');
    
    if (globalMode) {
      try {
        // Fetch cross-platform content
        const [twitterResp, newsResp] = await Promise.all([
          fetch('/api/cross-platform', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ topic: topic.text || topic.body, source: 'twitter' })
          }),
          fetch('/api/cross-platform', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ topic: topic.text || topic.body, source: 'news' })
          })
        ]);
        
        const twitterData = await twitterResp.json();
        const newsData = await newsResp.json();
        
        const allPosts = [
          ...(twitterData.posts || []),
          ...(newsData.posts || [])
        ];
        
        // Use AI to find counter-narratives
        const counterResp = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ 
            posts: allPosts,
            action: 'find_counter_narratives'
          })
        });
        
        const counterData = await counterResp.json();
        const counterPosts = counterData.counter_posts?.map(index => allPosts[index]) || [];
        
        setCounterNarratives(counterPosts);
      } catch (error) {
        console.error('Error loading cross-platform data:', error);
        setCounterNarratives([]);
      }
    }
  };

  const loadUserEchoes = async () => {
    try {
      const response = await fetch('/api/user-echoes?userAddress=demo_wallet_address');
      const data = await response.json();
      setUserEchoes(data);
    } catch (error) {
      console.error('Error loading user echoes:', error);
      setUserEchoes({ echoes: [], nfts: [], stats: { total_echoes: 0, counter_narratives: 0, nfts_minted: 0 } });
    }
  };

  const mintInsightToken = async (narrative) => {
    if (!walletConnected) {
      alert('Please connect your wallet to mint Insight Tokens!');
      return;
    }
    
    try {
      // Call the mint NFT API
      const response = await fetch('/api/mint-nft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          narrative,
          userAddress: 'demo_wallet_address', // In production, get from wallet
          rarity: narrative.source === 'twitter' ? 'rare' : 'common'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`🎉 Insight Token minted! 
        
Token ID: ${result.token.id}
Transaction: ${result.transaction_hash.slice(0, 10)}...
Rarity: ${result.token.rarity}

This counter-narrative is now part of your collection!`);
      } else {
        alert('❌ Minting failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Minting error:', error);
      alert('❌ Error minting token: ' + error.message);
    }
  };

  const handleEcho = async (cast, isCounterNarrative = false) => {
    try {
      const resp = await fetch("/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ castId: cast.hash || cast.id }),
      });
      const result = await resp.json();
      
      if (result.ok) {
        const badge = isCounterNarrative ? ' 🌟 Diverse Echo' : '';
        alert(`✅ Echoed!${badge}`);
      } else {
        alert("❌ Error: " + (result.error || ""));
      }
    } catch (error) {
      alert("❌ Error echoing: " + error.message);
    }
  };

  const getSentimentColor = (sentiment, confidence) => {
    if (confidence < 0.6) return '#999';
    switch(sentiment) {
      case 'positive': return '#4ade80';
      case 'negative': return '#f87171';
      default: return '#a78bfa';
    }
  };

  const getSentimentGauge = (sentiment, confidence) => {
    const width = Math.round(confidence * 100);
    const color = getSentimentColor(sentiment, confidence);
    return (
      <div style={{ 
        background: '#1f2937', 
        borderRadius: 8, 
        padding: 4, 
        marginTop: 8 
      }}>
        <div style={{
          background: color,
          height: 6,
          borderRadius: 3,
          width: `${width}%`,
          transition: 'width 0.3s ease'
        }} />
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
          {sentiment} ({Math.round(confidence * 100)}%)
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center',
        background: '#111827',
        color: '#f9fafb',
        minHeight: '100vh'
      }}>
        <div style={{ fontSize: 18, marginBottom: 10 }}>🔄 Loading...</div>
        <div style={{ color: '#9ca3af' }}>Discovering trending conversations...</div>
      </div>
    );
  }

  if (activeView === 'topic' && selectedTopic) {
    return (
      <div style={{ 
        maxWidth: 720, 
        margin: "20px auto", 
        padding: 12,
        background: '#111827',
        color: '#f9fafb',
        minHeight: '100vh'
      }}>
        <div style={{ marginBottom: 20 }}>
          <button 
            onClick={() => setActiveView('trends')}
            style={{
              background: 'none',
              border: '1px solid #374151',
              color: '#9ca3af',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            ← Back to Trends
          </button>
        </div>
        
        <h2 style={{ marginBottom: 16 }}>🎯 Topic Deep Dive</h2>
        
        <div style={{
          background: '#1f2937',
          border: '1px solid #374151',
          padding: 16,
          borderRadius: 12,
          marginBottom: 20
        }}>
          <div style={{ fontSize: 16, marginBottom: 12 }}>
            {selectedTopic.text || selectedTopic.body || "No text"}
          </div>
          {selectedTopic.ai_analysis && getSentimentGauge(
            selectedTopic.ai_analysis.sentiment, 
            selectedTopic.ai_analysis.confidence
          )}
        </div>
        
        {globalMode && counterNarratives.length > 0 && (
          <div>
            <h3 style={{ marginBottom: 16, color: '#60a5fa' }}>🌐 Counter-Narratives Found</h3>
            {counterNarratives.map((narrative, i) => (
              <div key={i} style={{
                background: '#1f2937',
                border: '1px solid #3b82f6',
                padding: 16,
                borderRadius: 12,
                marginBottom: 12
              }}>
                <div style={{ fontSize: 14, marginBottom: 12 }}>
                  {narrative.text}
                </div>
                <div style={{ 
                  fontSize: 12, 
                  color: '#9ca3af', 
                  marginBottom: 12 
                }}>
                  Source: {narrative.source} {narrative.author && `• ${narrative.author}`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleEcho(narrative, true)}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    🌟 Echo Counter-View
                  </button>
                  <button
                    onClick={() => mintInsightToken(narrative)}
                    style={{
                      background: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    🎨 Mint Insight Token
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: 720, 
      margin: "20px auto", 
      padding: 12,
      background: '#111827',
      color: '#f9fafb',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 20 
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🔥 EchoEcho</h1>
          <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: 14 }}>
            AI-powered echo chamber breaker
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            background: userTier === 'free' ? '#374151' : userTier === 'premium' ? '#7c3aed' : '#fbbf24',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: '600'
          }}>
            {userTier === 'free' ? '🆓 Free' : userTier === 'premium' ? '💎 Premium' : '👑 Pro'}
          </div>
          <button
            onClick={() => setActiveView('premium')}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            💰 Upgrade
          </button>
          <button
            onClick={walletConnected ? null : connectWallet}
            style={{ 
              background: walletConnected ? '#059669' : '#374151',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              border: 'none',
              cursor: walletConnected ? 'default' : 'pointer'
            }}
          >
            {walletConnected ? `🟢 ${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}` : '🔴 Connect Wallet'}
          </button>
          {walletConnected && (
            <div style={{
              background: '#1e40af',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12
            }}>
              💰 {usdcBalance} USDC
            </div>
          )}
        </div>
      </div>
      
      {/* Search and Toggle */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="🔍 Search trends or topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 8,
            color: '#f9fafb',
            fontSize: 14,
            marginBottom: 12
          }}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={globalMode}
              onChange={(e) => setGlobalMode(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14 }}>
              🌐 Global Echoes {globalMode ? '(X + News)' : '(Farcaster Only)'}
            </span>
          </label>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <div style={{
        display: 'flex',
        background: '#1f2937',
        borderRadius: 8,
        padding: 4,
        marginBottom: 20
      }}>
        {['trends', 'echoes', 'faq'].map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            style={{
              flex: 1,
              background: activeView === view ? '#3b82f6' : 'transparent',
              color: activeView === view ? 'white' : '#9ca3af',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              textTransform: 'capitalize'
            }}
          >
            {view === 'trends' ? '🔥 Trends' : view === 'echoes' ? '📜 My Echoes' : '❓ FAQ'}
          </button>
        ))}
      </div>
      
      {/* Content */}
      {activeView === 'trends' && (
        <div>
          {trends
            .filter(trend => !searchQuery || 
              (trend.text || trend.body || '').toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((trend, i) => (
            <div
              key={i}
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                padding: 16,
                marginBottom: 16,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => loadTopicDetails(trend)}
            >
              <div style={{ 
                fontSize: 16, 
                marginBottom: 12,
                lineHeight: 1.4
              }}>
                {trend.text || trend.body || "No text"}
              </div>
              
              {trend.ai_analysis && getSentimentGauge(
                trend.ai_analysis.sentiment, 
                trend.ai_analysis.confidence
              )}
              
              <div style={{ 
                display: "flex", 
                gap: 8, 
                marginTop: 12,
                alignItems: 'center'
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEcho(trend);
                  }}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  🔄 Echo It
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.share?.({ text: trend.text || "Check this out!" });
                  }}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  📤 Share
                </button>
                
                <div style={{
                  background: '#374151',
                  color: '#9ca3af',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  marginLeft: 'auto'
                }}>
                  Click for details →
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {activeView === 'echoes' && (
        <div>
          <h2 style={{ marginBottom: 20 }}>📜 Your Echo History</h2>
          
          {userEchoes === null ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <button
                onClick={loadUserEchoes}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 16
                }}
              >
                📊 Load My Echoes
              </button>
            </div>
          ) : (
            <div>
              {/* Stats Overview */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 24
              }}>
                <div style={{
                  background: '#1f2937',
                  border: '1px solid #374151',
                  padding: 16,
                  borderRadius: 12,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔄</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>{userEchoes.stats?.total_echoes || 0}</div>
                  <div style={{ color: '#9ca3af', fontSize: 14 }}>Total Echoes</div>
                </div>
                <div style={{
                  background: '#1f2937',
                  border: '1px solid #374151',
                  padding: 16,
                  borderRadius: 12,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🌟</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>{userEchoes.stats?.counter_narratives || 0}</div>
                  <div style={{ color: '#9ca3af', fontSize: 14 }}>Counter-Narratives</div>
                </div>
                <div style={{
                  background: '#1f2937',
                  border: '1px solid #374151',
                  padding: 16,
                  borderRadius: 12,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🎨</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>{userEchoes.stats?.nfts_minted || 0}</div>
                  <div style={{ color: '#9ca3af', fontSize: 14 }}>NFTs Minted</div>
                </div>
              </div>

              {/* Recent Echoes */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ marginBottom: 16, color: '#60a5fa' }}>🔄 Recent Echoes</h3>
                {userEchoes.echoes?.length > 0 ? (
                  userEchoes.echoes.map((echo, i) => (
                    <div key={i} style={{
                      background: '#1f2937',
                      border: '1px solid #374151',
                      padding: 16,
                      borderRadius: 12,
                      marginBottom: 12
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 8 }}>
                        {echo.original_cast}
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        color: '#9ca3af',
                        fontSize: 12
                      }}>
                        <span>
                          {echo.type === 'counter_narrative' ? '🌟 Counter-Narrative' : '🔄 Standard Echo'}
                          {echo.source && ` • ${echo.source}`}
                        </span>
                        <span>{new Date(echo.echoed_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    background: '#1f2937',
                    border: '1px dashed #374151',
                    padding: 20,
                    borderRadius: 12,
                    color: '#9ca3af',
                    textAlign: 'center'
                  }}>
                    No echoes yet. Start echoing to build your history!
                  </div>
                )}
              </div>

              {/* NFT Collection */}
              <div>
                <h3 style={{ marginBottom: 16, color: '#7c3aed' }}>🎨 Your Insight Token Collection</h3>
                {userEchoes.nfts?.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: 16
                  }}>
                    {userEchoes.nfts.map((nft, i) => (
                      <div key={i} style={{
                        background: '#1f2937',
                        border: '1px solid #7c3aed',
                        borderRadius: 12,
                        overflow: 'hidden'
                      }}>
                        <img 
                          src={nft.image} 
                          alt={nft.title}
                          style={{ 
                            width: '100%', 
                            height: 200, 
                            objectFit: 'cover',
                            background: '#374151'
                          }}
                        />
                        <div style={{ padding: 16 }}>
                          <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
                            {nft.title}
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            fontSize: 12,
                            color: '#9ca3af'
                          }}>
                            <span>Rarity: {nft.rarity}</span>
                            <span>{new Date(nft.minted_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: '#1f2937',
                    border: '1px dashed #374151',
                    padding: 20,
                    borderRadius: 12,
                    color: '#9ca3af',
                    textAlign: 'center'
                  }}>
                    No Insight Tokens yet. Discover and mint counter-narratives to start your collection!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeView === 'premium' && (
        <PremiumView 
          userTier={userTier} 
          setUserTier={setUserTier} 
          walletConnected={walletConnected}
          walletAddress={walletAddress}
          usdcBalance={usdcBalance}
          checkUSDCBalance={checkUSDCBalance}
        />
      )}
      
      {activeView === 'faq' && (
        <FAQView />
      )}
    </div>
  );
}

// Premium subscription component
const PremiumView = ({ userTier, setUserTier, walletConnected, walletAddress, usdcBalance, checkUSDCBalance }) => {
  const [selectedTier, setSelectedTier] = useState('premium');
  const [paymentStatus, setPaymentStatus] = useState('none'); // 'none', 'pending', 'success'

  const handleUSDCPayment = async (tier) => {
    if (!walletConnected || !walletAddress) {
      alert('Please connect your Base wallet first!');
      return;
    }

    const pricing = { premium: 7, pro: 25 };
    const amount = pricing[tier];

    // Check if user has enough USDC
    if (usdcBalance < amount) {
      alert(`❌ Insufficient USDC Balance!\n\nRequired: ${amount} USDC\nYour Balance: ${usdcBalance} USDC\n\nPlease add more USDC to your wallet on Base network.`);
      return;
    }

    try {
      setPaymentStatus('pending');
      
      // Request USDC transfer via wallet
      if (typeof window !== 'undefined' && window.ethereum) {
        // Switch to Base network
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // Base network chain ID
          });
        } catch (switchError) {
          // If Base network is not added, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
              }]
            });
          }
        }

        // USDC transfer transaction
        const usdcContract = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const subscriptionWallet = '0xEchoEchoSubscriptions...';
        
        // Create USDC transfer transaction
        const transferData = `0xa9059cbb000000000000000000000000${subscriptionWallet.slice(2)}${'0'.repeat(64 - (amount * 1000000).toString(16).length)}${(amount * 1000000).toString(16)}`;
        
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: usdcContract,
            data: transferData,
            value: '0x0'
          }]
        });

        // Create subscription with transaction hash
        const subscriptionResp = await fetch('/api/user-subscription', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            action: 'create_subscription',
            tier,
            transactionHash: txHash
          })
        });

        const result = await subscriptionResp.json();
        
        if (result.success) {
          setUserTier(tier);
          setPaymentStatus('success');
          alert(`🎉 ${result.message}\n\n💰 ${amount} USDC paid successfully!\n🔗 Transaction: ${txHash.slice(0, 10)}...`);
          
          // Refresh USDC balance
          await checkUSDCBalance(walletAddress);
        } else {
          throw new Error(result.error || 'Subscription creation failed');
        }
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('none');
      
      if (error.code === 4001) {
        alert('❌ Transaction cancelled by user');
      } else {
        alert('❌ Payment failed: ' + error.message);
      }
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, textAlign: 'center' }}>💎 EchoEcho Premium Subscriptions</h2>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24,
        marginBottom: 32
      }}>
        {/* Premium Tier */}
        <div style={{
          background: selectedTier === 'premium' ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : '#1f2937',
          border: selectedTier === 'premium' ? '2px solid #a855f7' : '1px solid #374151',
          borderRadius: 16,
          padding: 24,
          cursor: 'pointer',
          transform: selectedTier === 'premium' ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.3s ease'
        }}
        onClick={() => setSelectedTier('premium')}>
          <h3 style={{ color: '#a855f7', marginBottom: 12 }}>💎 Echo Breaker</h3>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>$7 USDC</div>
          <div style={{ color: '#9ca3af', marginBottom: 16 }}>per month</div>
          
          <div style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Unlimited echoes</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Cross-platform global echoes</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Premium NFT rarities (rare, epic)</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Advanced AI analysis</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Echo analytics dashboard</div>
          </div>
          
          {userTier === 'premium' ? (
            <div style={{
              background: '#10b981',
              color: 'white',
              padding: '12px',
              borderRadius: 8,
              textAlign: 'center'
            }}>
              ✅ Current Plan
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUSDCPayment('premium');
              }}
              style={{
                width: '100%',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: '600'
              }}
            >
              📱 Pay 7 USDC on Base
            </button>
          )}
        </div>

        {/* Pro Tier */}
        <div style={{
          background: selectedTier === 'pro' ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : '#1f2937',
          border: selectedTier === 'pro' ? '2px solid #f59e0b' : '1px solid #374151',
          borderRadius: 16,
          padding: 24,
          cursor: 'pointer',
          transform: selectedTier === 'pro' ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.3s ease'
        }}
        onClick={() => setSelectedTier('pro')}>
          <h3 style={{ color: '#f59e0b', marginBottom: 12 }}>👑 Echo Master</h3>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>$25 USDC</div>
          <div style={{ color: '#9ca3af', marginBottom: 16 }}>per month</div>
          
          <div style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ All Premium features</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Legendary NFT access</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ API access for developers</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Revenue sharing (15%)</div>
            <div style={{ marginBottom: 8, color: '#10b981' }}>✅ Priority support</div>
          </div>
          
          {userTier === 'pro' ? (
            <div style={{
              background: '#10b981',
              color: 'white',
              padding: '12px',
              borderRadius: 8,
              textAlign: 'center'
            }}>
              ✅ Current Plan
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUSDCPayment('pro');
              }}
              style={{
                width: '100%',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: '600'
              }}
            >
              📱 Pay 25 USDC on Base
            </button>
          )}
        </div>
      </div>
      
      {paymentStatus === 'pending' && (
        <div style={{
          background: '#fbbf24',
          color: '#92400e',
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
          textAlign: 'center'
        }}>
          ⏳ Payment pending... Please send USDC and verify your transaction.
        </div>
      )}
      
      <div style={{
        background: '#1e40af',
        color: 'white',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>
        <h4 style={{ marginBottom: 12 }}>🔗 Why USDC on Base?</h4>
        <div style={{ marginLeft: 16 }}>
          <div>⚡ Ultra-low fees (under $0.01)</div>
          <div>🚀 Fast transactions (2-3 seconds)</div>
          <div>🔒 Ethereum security</div>
          <div>🎨 Same network as your NFTs</div>
        </div>
      </div>
    </div>
  );
};

// FAQ component with inline content
const FAQView = () => {
  const [openSections, setOpenSections] = useState({});

  const toggleSection = (index) => {
    setOpenSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const faqData = [
    {
      question: "🌟 What is EchoEcho?",
      answer: "EchoEcho is an AI-powered Farcaster miniapp that breaks echo chambers by discovering counter-narratives from multiple platforms (Farcaster, X, News). When you discover valuable counter-narratives, you earn Insight Token NFTs on Base blockchain!"
    },
    {
      question: "💰 How do I earn money as a user?",
      answer: "Multiple ways to earn: $0.01 per echo, NFT trading on OpenSea ($2-200+), rarity bonuses, referral income (10%), viral bonuses, and Pro revenue sharing (15%). Estimated earnings: Active user $10-50/month, Engaged user $50-200/month, Power user $200-1000+/month."
    },
    {
      question: "🔄 What are the subscription tiers?",
      answer: "🆓 FREE ($0): 5 echoes/day, basic features, common NFTs only. 💎 PREMIUM ($7 USDC): Unlimited echoes, cross-platform, rare/epic NFTs, advanced AI. 👑 PRO ($25 USDC): All premium + legendary NFTs, API access, revenue sharing."
    },
    {
      question: "💳 How do USDC payments work?",
      answer: "Connect your Base wallet, click upgrade tier, confirm USDC transaction automatically. Fast (2-3 seconds), cheap (under $0.01), secure. No manual sending required!"
    },
    {
      question: "🎨 What are Insight Token NFTs?",
      answer: "NFTs earned for discovering counter-narratives. Rarities: Common ($2-5), Rare ($8-15), Epic ($20-40), Legendary ($50-200+). Trade on OpenSea, proof of diverse thinking, collector status."
    },
    {
      question: "🔓 What premium features do I get?",
      answer: "Premium: Cross-platform echoes (X + News), unlimited usage, advanced AI, premium NFTs, analytics. Pro: Everything + legendary NFTs, API access, revenue sharing, priority support."
    },
    {
      question: "❓ How do I get started?",
      answer: "1️⃣ Connect your Base wallet, 2️⃣ Start exploring with 5 free echoes daily, 3️⃣ Upgrade with USDC for unlimited power. Focus on quality counter-narratives for better NFT rarities!"
    }
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, marginBottom: 12 }}>❓ Frequently Asked Questions</h2>
        <p style={{ color: '#9ca3af' }}>Everything you need to know about EchoEcho</p>
      </div>
      
      <div>
        {faqData.map((faq, index) => (
          <div key={index} style={{
            border: '1px solid #374151',
            borderRadius: '8px',
            marginBottom: '12px',
            backgroundColor: '#1f2937'
          }}>
            <button
              onClick={() => toggleSection(index)}
              style={{
                width: '100%',
                padding: '16px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              {faq.question}
              <span style={{ fontSize: '20px' }}>{openSections[index] ? '−' : '+'}</span>
            </button>
            {openSections[index] && (
              <div style={{
                padding: '0 16px 16px',
                color: '#d1d5db',
                lineHeight: '1.6'
              }}>
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};