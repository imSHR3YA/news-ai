require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const RSSParser = require('rss-parser');

const app = express();
const parser = new RSSParser();
const PORT = process.env.PORT || 5001;
const hasAnthropicKey = () => process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_key_here';

app.use(cors());
app.use(express.json());

function cleanText(value = '', maxLength = 280) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/if\s*\(typeof[\s\S]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesTerm(text, term) {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text);
}

function fallbackSummary(title = '', text = '') {
  const body = cleanText(text || title, 360);
  return `• ${cleanText(title || 'This article covers a current news story.', 140)}\n• ${body || 'The story includes limited details from the source feed.'}\n• Open the full article for complete context and updates.`;
}

function fallbackCredibility(source = '', title = '', text = '') {
  const knownSource = /bbc|times of india|ndtv|techcrunch|reuters|ap|guardian|cnn|nytimes/i.test(source);
  const hasDetails = `${title} ${text}`.length > 120;
  const score = knownSource && hasDetails ? 78 : knownSource ? 70 : 62;
  return {
    score,
    label: score >= 75 ? 'High' : 'Medium',
    reason: `${source || 'The source'} appears to be a ${knownSource ? 'recognized' : 'feed-provided'} publisher; verify important claims with the full article and another source.`,
  };
}

function fallbackSentiment(text = '') {
  const value = String(text).toLowerCase();
  const positive = ['win', 'growth', 'boost', 'success', 'improve', 'record', 'profit'].some((w) => value.includes(w));
  const negative = ['war', 'crash', 'death', 'attack', 'crisis', 'fall', 'loss', 'risk'].some((w) => value.includes(w));
  if (positive && !negative) return { sentiment: 'positive', score: 68, emoji: '😊' };
  if (negative && !positive) return { sentiment: 'negative', score: 72, emoji: '😢' };
  return { sentiment: 'neutral', score: 50, emoji: '😐' };
}

function fallbackBias(title = '', text = '') {
  const value = `${title} ${text}`.toLowerCase();
  const political = /election|government|minister|president|congress|bjp|democrat|republican|policy|tariff/.test(value);
  return {
    bias: 'Center',
    confidence: political ? 58 : 42,
    note: political ? 'Demo analysis found political terms but no clear partisan framing in the short feed text.' : 'Demo analysis found no obvious political framing in the available feed text.',
  };
}

function fallbackEli5(title = '', text = '') {
  const simple = cleanText(text || title, 220);
  return `This story is about ${cleanText(title || 'a news event', 120)}. ${simple || 'The feed only gives a short preview.'} It may affect people, companies, or places mentioned in the article. Read the full story to understand all details.`;
}

function fallbackTranslation(text = '', language = 'Hindi') {
  return `[Demo ${language} translation] ${cleanText(text, 500)}`;
}

const LANGUAGE_CODES = {
  Hindi: 'hi',
  Tamil: 'ta',
  Telugu: 'te',
  Bengali: 'bn',
  Marathi: 'mr',
  Kannada: 'kn',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Arabic: 'ar',
  Chinese: 'zh-CN',
  Japanese: 'ja',
};

async function translateWithFallbackService(text = '', language = 'Hindi') {
  const target = LANGUAGE_CODES[language] || 'hi';
  const sourceText = cleanText(text, 500);
  const r = await axios.get('https://api.mymemory.translated.net/get', {
    params: { q: sourceText, langpair: `en|${target}` },
    timeout: 6000,
  });
  return cleanText(r.data?.responseData?.translatedText || '', 700) || fallbackTranslation(sourceText, language);
}

function searchTerms(query = '') {
  const stop = new Set(['news', 'about', 'latest', 'today', 'show', 'me', 'please', 'for', 'on', 'the', 'a', 'an', 'ji']);
  return String(query)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((term) => term && !stop.has(term));
}

function dedupeArticles(articles = []) {
  const seen = new Set();
  return articles.filter((article) => {
    const key = String(article.url || article.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── RSS FEEDS ────────────────────────────────────────────────
const RSS_FEEDS = {
  general:       ['https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://feeds.feedburner.com/ndtvnews-top-stories'],
  world:         'https://feeds.bbci.co.uk/news/world/rss.xml',
  technology:    'https://feeds.feedburner.com/TechCrunch',
  business:      'https://feeds.bbci.co.uk/news/business/rss.xml',
  health:        'https://feeds.feedburner.com/ndtvnews-health',
  sports:        ['https://feeds.bbci.co.uk/sport/rss.xml', 'https://feeds.feedburner.com/ndtvsports-latest'],
  entertainment: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
  india:         'https://feeds.feedburner.com/ndtvnews-top-stories',
};

async function fetchRSS(url, category = 'general') {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.slice(0, 20).map((item, i) => ({
      id: `rss-${Date.now()}-${i}`,
      title: cleanText(item.title || '', 180),
      description: cleanText(item.contentSnippet || item.summary || item.content || ''),
      url: item.link || '',
      source: feed.title || 'NewsAI',
      publishedAt: item.pubDate || new Date().toISOString(),
      image: item.enclosure?.url || item['media:content']?.['$']?.url || null,
      category,
    }));
  } catch (err) {
    console.error('RSS error:', err.message);
    return [];
  }
}

async function fetchCategoryRSS(category = 'general') {
  const urls = RSS_FEEDS[category] || RSS_FEEDS.general;
  const list = Array.isArray(urls) ? urls : [urls];
  const feeds = await Promise.all(list.map((url) => fetchRSS(url, category)));
  return dedupeArticles(feeds.flat());
}

async function searchRSSFeeds(query, category = '') {
  const terms = searchTerms(query);
  if (!terms.length) return fetchCategoryRSS(category || 'general');
  const phrase = terms.join(' ');
  const selectedCategories = Object.keys(RSS_FEEDS);
  const feeds = await Promise.all(
    selectedCategories.map(async (cat) => fetchCategoryRSS(cat))
  );
  const seen = new Set();
  return feeds
    .flat()
    .map((article) => {
      const title = String(article.title || '').toLowerCase();
      const description = String(article.description || '').toLowerCase();
      const source = String(article.source || '').toLowerCase();
      const category = String(article.category || '').toLowerCase();
      const compact = `${title} ${description} ${source} ${category}`;
      const phraseMatch = phrase && compact.includes(phrase);
      const score =
        (title.includes(phrase) ? 8 : 0) +
        (description.includes(phrase) ? 4 : 0) +
        terms.reduce((sum, term) => sum + (includesTerm(title, term) ? 3 : 0) + (includesTerm(description, term) ? 1 : 0) + (includesTerm(category, term) ? 2 : 0) + (includesTerm(source, term) ? 1 : 0), 0);
      return { article, compact, phraseMatch, score };
    })
    .filter(({ compact, phraseMatch, score }) => score > 0 && (phraseMatch || terms.every((term) => includesTerm(compact, term))))
    .sort((a, b) => b.score - a.score)
    .map(({ article }) => article)
    .filter((article) => {
      const key = article.url || article.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

// ── NEWS ─────────────────────────────────────────────────────
app.get('/api/news', async (req, res) => {
  const { category = 'general', q = '', page = 1 } = req.query;
  try {
    let articles = [];
    if (process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your_newsapi_key_here') {
      const params = { apiKey: process.env.NEWS_API_KEY, pageSize: 20, page, language: 'en' };
      if (q) { params.q = q; }
      else if (category !== 'general') { params.category = category; params.country = 'in'; }
      else { params.sources = 'bbc-news,the-times-of-india,ndtv,techcrunch'; }
      const endpoint = q ? 'everything' : 'top-headlines';
      const response = await axios.get(`https://newsapi.org/v2/${endpoint}`, { params });
      articles = response.data.articles.map((a, i) => ({
        id: `na-${Date.now()}-${i}`,
        title: a.title || '',
        description: a.description || '',
        url: a.url,
        image: a.urlToImage,
        source: a.source?.name || 'Unknown',
        publishedAt: a.publishedAt,
        author: a.author,
        category,
        content: a.content,
      })).filter(a => a.title && a.title !== '[Removed]');
    } else {
      articles = q
        ? await searchRSSFeeds(q, category)
        : await fetchCategoryRSS(category);
    }
    articles = dedupeArticles(articles);
    res.json({ status: 'ok', totalResults: articles.length, articles });
  } catch (err) {
    // Fallback to RSS
    try {
      const articles = await fetchCategoryRSS(category);
      res.json({ status: 'ok', totalResults: articles.length, articles });
    } catch {
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  }
});

// ── WEATHER ──────────────────────────────────────────────────
app.get('/api/weather', async (req, res) => {
  const { city = 'Mumbai', lat, lon } = req.query;
  try {
    if (!process.env.WEATHER_API_KEY || process.env.WEATHER_API_KEY === 'your_openweather_key_here') {
      throw new Error('No key');
    }
    const params = { appid: process.env.WEATHER_API_KEY, units: 'metric' };
    if (lat && lon) { params.lat = lat; params.lon = lon; }
    else params.q = city;
    const r = await axios.get('https://api.openweathermap.org/data/2.5/weather', { params });
    res.json({ city: r.data.name, country: r.data.sys.country, temp: Math.round(r.data.main.temp), feels_like: Math.round(r.data.main.feels_like), description: r.data.weather[0].description, icon: r.data.weather[0].icon, humidity: r.data.main.humidity, wind: r.data.wind.speed });
  } catch {
    res.json({ city: city || 'Mumbai', temp: 29, description: 'partly cloudy', icon: '02d', humidity: 68, wind: 14 });
  }
});

// ── ON THIS DAY ───────────────────────────────────────────────
app.get('/api/onthisday', async (req, res) => {
  try {
    const d = new Date();
    const r = await axios.get(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${d.getMonth()+1}/${d.getDate()}`);
    res.json({ events: (r.data.events || []).slice(0, 5).map(e => ({ year: e.year, text: e.text })) });
  } catch {
    res.json({ events: [{ year: 1969, text: 'Apollo 11 launched toward the Moon.' }, { year: 1945, text: 'World War II ended in Europe.' }, { year: 1994, text: 'The Channel Tunnel between England and France opened.' }] });
  }
});

// ── AI: SUMMARIZE ─────────────────────────────────────────────
app.post('/api/ai/summarize', async (req, res) => {
  const { text, title } = req.body;
  try {
    if (!hasAnthropicKey()) return res.json({ summary: fallbackSummary(title, text) });
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 250,
      messages: [{ role: 'user', content: `Summarize this news article in exactly 3 bullet points. Be concise and informative.\n\nTitle: ${title}\nContent: ${text}` }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    res.json({ summary: r.data.content[0].text });
  } catch { res.json({ summary: fallbackSummary(title, text) }); }
});

// ── AI: SENTIMENT ─────────────────────────────────────────────
app.post('/api/ai/sentiment', async (req, res) => {
  const { text } = req.body;
  try {
    if (!hasAnthropicKey()) return res.json(fallbackSentiment(text));
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 60,
      messages: [{ role: 'user', content: `Analyze the sentiment of this news. Reply ONLY with valid JSON, no extra text: {"sentiment":"positive","score":75,"emoji":"😊"}\nOptions for sentiment: positive, negative, neutral. Score 0-100.\n\n${text}` }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    const raw = r.data.content[0].text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(raw));
  } catch { res.json({ sentiment: 'neutral', score: 50, emoji: '😐' }); }
});

// ── AI: CREDIBILITY ───────────────────────────────────────────
app.post('/api/ai/credibility', async (req, res) => {
  const { title, text, source } = req.body;
  try {
    if (!hasAnthropicKey()) return res.json(fallbackCredibility(source, title, text));
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 120,
      messages: [{ role: 'user', content: `Rate this news article's credibility. Reply ONLY with valid JSON: {"score":80,"label":"High","reason":"Brief one-sentence reason"}\nLabel options: High, Medium, Low\n\nSource: ${source}\nTitle: ${title}\nContent: ${(text||'').slice(0,400)}` }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    const raw = r.data.content[0].text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(raw));
  } catch { res.json(fallbackCredibility(source, title, text)); }
});

// ── AI: ELI5 ─────────────────────────────────────────────────
app.post('/api/ai/eli5', async (req, res) => {
  const { text, title } = req.body;
  try {
    if (!hasAnthropicKey()) return res.json({ explanation: fallbackEli5(title, text) });
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 220,
      messages: [{ role: 'user', content: `Explain this news in very simple language a 10-year-old can understand. Use short sentences and simple words. Max 4 sentences.\n\nTitle: ${title}\nContent: ${(text||'').slice(0,500)}` }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    res.json({ explanation: r.data.content[0].text });
  } catch { res.json({ explanation: fallbackEli5(title, text) }); }
});

// ── AI: TAGS ──────────────────────────────────────────────────
app.post('/api/ai/tags', async (req, res) => {
  const { title, text } = req.body;
  try {
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 80,
      messages: [{ role: 'user', content: `Generate exactly 4 short tags for this news article. Reply ONLY with a JSON array: ["tag1","tag2","tag3","tag4"]\n\nTitle: ${title}\n${(text||'').slice(0,300)}` }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    const raw = r.data.content[0].text.replace(/```json|```/g, '').trim();
    res.json({ tags: JSON.parse(raw) });
  } catch { res.json({ tags: ['news', 'breaking', 'today', 'trending'] }); }
});

// ── AI: TRANSLATE ─────────────────────────────────────────────
app.post('/api/ai/translate', async (req, res) => {
  const { text, language } = req.body;
  try {
    if (!hasAnthropicKey()) return res.json({ translated: await translateWithFallbackService(text, language) });
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 600,
      messages: [{ role: 'user', content: `Translate the following news text to ${language}. Reply with only the translated text, no preamble.\n\n${text}` }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    res.json({ translated: r.data.content[0].text });
  } catch { res.json({ translated: fallbackTranslation(text, language) }); }
});

// ── AI: BIAS DETECTOR ─────────────────────────────────────────
app.post('/api/ai/bias', async (req, res) => {
  const { text, title } = req.body;
  try {
    if (!hasAnthropicKey()) return res.json(fallbackBias(title, text));
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 100,
      messages: [{ role: 'user', content: `Detect political bias in this news article. Reply ONLY with JSON: {"bias":"Left"|"Center-Left"|"Center"|"Center-Right"|"Right","confidence":80,"note":"one sentence"}\n\nTitle: ${title}\nContent: ${(text||'').slice(0,400)}` }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    const raw = r.data.content[0].text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(raw));
  } catch { res.json(fallbackBias(title, text)); }
});

// ── AI: CHATBOT ───────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  try {
    if (!hasAnthropicKey()) {
      const text = String(message || '').toLowerCase();
      let reply = 'I can help you explore headlines, search topics, and summarize what is visible in the app. Add an Anthropic API key later for deeper live AI answers.';
      if (text.includes('stock') || text.includes('market')) {
        reply = 'For stock-market news, use the search button and try "stock market", "Sensex", "Nifty", or "business". I will show matching RSS headlines from the available feeds.';
      } else if (text.includes('ai') || text.includes('technology')) {
        reply = 'Try searching "AI technology" or selecting the Technology tab. The app will pull matching technology headlines from the RSS fallback feeds.';
      } else if (text.includes('sport') || text.includes('ipl')) {
        reply = 'Open the Sports tab or search "IPL" for sports headlines. Without a NewsAPI key, the app uses RSS feeds, so results depend on what those feeds currently publish.';
      } else if (text.includes('weather')) {
        reply = 'Weather is running in fallback mode until you add an OpenWeather key, so the widget shows demo Mumbai weather.';
      } else if (text.includes('summar') || text.includes('translate') || text.includes('bias')) {
        reply = 'AI tools are available in demo fallback mode. Add your Anthropic key in .env to make summaries, translations, bias, and chat fully intelligent.';
      }
      return res.json({ reply });
    }

    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 350,
      system: 'You are a helpful AI news assistant for NewsAI, a smart news aggregator. Help users understand news, current events, and find information. Be concise, friendly, and informative. If asked about very recent events, acknowledge your knowledge may not be fully current.',
      messages: [...history.slice(-6), { role: 'user', content: message }],
    }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
    res.json({ reply: r.data.content[0].text });
  } catch { res.json({ reply: 'Chatbot unavailable. Add your Anthropic API key in the .env file and restart the server.' }); }
});

app.listen(PORT, () => {
  console.log(`\n🚀 NewsAI Server → http://localhost:${PORT}`);
  console.log(`📰 News API: ${process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your_newsapi_key_here' ? '✅ Connected' : '⚠️  Using RSS fallback'}`);
  console.log(`🌤️  Weather: ${process.env.WEATHER_API_KEY && process.env.WEATHER_API_KEY !== 'your_openweather_key_here' ? '✅ Connected' : '⚠️  Using mock data'}`);
  console.log(`🤖 Claude AI: ${process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_key_here' ? '✅ Connected' : '⚠️  Add key for AI features'}\n`);
});
