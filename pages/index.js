import { useEffect, useState } from "react";

export default function Home() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalMode, setGlobalMode] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [counterNarratives, setCounterNarratives] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState('trends'); // 'trends', 'echoes', 'topic'
  const [userEchoes, setUserEchoes] = useState(null);

  useEffect(() => {
    loadTrends();
    checkWalletConnection();
  }, [globalMode]);

  const checkWalletConnection = () => {
    // Check if user has wallet connected via Farcaster
    if (typeof window !== 'undefined' && window.ethereum) {
      setWalletConnected(true);
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
        
        <div style={{ 
          background: walletConnected ? '#059669' : '#374151',
          color: 'white',
          padding: '6px 12px',
          borderRadius: 20,
          fontSize: 12
        }}>
          {walletConnected ? '🟢 Connected' : '🔴 Not Connected'}
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
        {['trends', 'echoes'].map(view => (
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
            {view === 'trends' ? '🔥 Trends' : '📜 My Echoes'}
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
    </div>
  );
}