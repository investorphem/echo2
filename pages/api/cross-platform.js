import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';

// Initialize Twitter client with bearer token for app-only auth
const twitterClient = new TwitterApi(process.env.X_BEARER_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { topic, source = 'twitter' } = req.body;

    if (source === 'twitter') {
      if (!process.env.X_BEARER_TOKEN) {
        return res.status(500).json({ error: "X API credentials missing" });
      }

      try {
        const tweets = await twitterClient.v2.search(topic, {
          max_results: 10,
          'tweet.fields': ['author_id', 'created_at', 'public_metrics', 'text']
        });

        const formattedTweets = tweets.data?.map(tweet => ({
          id: tweet.id,
          text: tweet.text,
          author_id: tweet.author_id,
          created_at: tweet.created_at,
          metrics: tweet.public_metrics,
          source: 'twitter'
        })) || [];

        return res.status(200).json({ posts: formattedTweets });
      } catch (twitterError) {
        console.error('Twitter API error:', twitterError);
        return res.status(500).json({ error: 'Twitter API error', details: twitterError.message });
      }
    }

    if (source === 'news') {
      if (!process.env.NEWS_API_KEY) {
        return res.status(500).json({ error: "NEWS_API_KEY missing" });
      }

      const newsResponse = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&sortBy=relevancy&apiKey=${process.env.NEWS_API_KEY}&pageSize=10`
      );

      if (!newsResponse.ok) {
        throw new Error(`News API error: ${newsResponse.status}`);
      }

      const newsData = await newsResponse.json();
      
      const formattedNews = newsData.articles?.map(article => ({
        id: article.url,
        text: article.title + (article.description ? ': ' + article.description : ''),
        author: article.source.name,
        created_at: article.publishedAt,
        url: article.url,
        source: 'news'
      })) || [];

      return res.status(200).json({ posts: formattedNews });
    }

    res.status(400).json({ error: 'Invalid source' });
  } catch (error) {
    console.error('Cross-platform fetch error:', error);
    res.status(500).json({ error: error.message });
  }
}