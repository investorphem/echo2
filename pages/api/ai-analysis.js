import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY missing" });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, action = 'analyze_sentiment' } = req.body;

    if (action === 'analyze_sentiment') {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analyze the sentiment and dominant viewpoint of this social media post. Return a JSON with: sentiment (positive/negative/neutral), dominant_view (brief description), confidence (0-1), and key_themes (array of 2-3 main topics)."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      let analysis;
      try {
        analysis = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        analysis = {
          sentiment: 'neutral',
          dominant_view: 'Unable to analyze',
          confidence: 0.5,
          key_themes: ['analysis_failed']
        };
      }
      return res.status(200).json(analysis);
    }

    if (action === 'find_counter_narratives') {
      const { posts } = req.body;
      
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Given these social media posts about a topic, identify which ones present counter-narratives or alternative viewpoints. Return JSON with: counter_posts (array of post indices that present different perspectives), main_narrative (dominant viewpoint), counter_themes (alternative viewpoints found)."
          },
          {
            role: "user",
            content: JSON.stringify(posts)
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      let analysis;
      try {
        analysis = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        analysis = {
          counter_posts: [],
          main_narrative: 'Unable to analyze',
          counter_themes: ['analysis_failed']
        };
      }
      return res.status(200).json(analysis);
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
}