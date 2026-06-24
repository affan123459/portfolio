// Vercel serverless function — POST /api/chat
// Calls Google's Gemini API (free tier, no credit card required) on the
// server side, so the API key never reaches the browser. Includes basic
// per-IP daily rate limiting via Upstash Redis.

const MAX_MESSAGES_PER_DAY = 8;
const MAX_MESSAGE_LENGTH = 300;

// Gemini's free-tier model lineup changes over time — check
// ai.google.dev/gemini-api/docs/models for the current free Flash/Flash-Lite
// model name before deploying, and update this string if it's changed.
const MODEL = 'gemini-2.5-flash-lite';

const SYSTEM_PROMPT = `You are an AI assistant embedded on Mohammed Affan's portfolio website.
Answer ONLY questions about Affan's background, skills, projects, and availability for contract
work, using the facts below. Speak about him in third person, in a friendly, concise way
(2-4 sentences max, no markdown).

Facts about Affan:
- Full-stack developer based in Bangalore, India. Remote-friendly.
- Currently open for contract/freelance work: internal tools, workflow automation, API
  integrations, small AI features.
- Stack: Python, JavaScript, SQL, Flask, FastAPI, React, Pandas, scikit-learn, TensorFlow, Git,
  Docker, basic AWS (EC2/SageMaker), REST APIs.
- Early in his freelance career — practice projects so far include a diabetes risk prediction ML
  model, and a Titanic logistic regression model deployed as a live Flask REST API.
- Contact: mohammadaffan1239@mail.com.

If asked something unrelated to Affan's work (general coding help, writing tasks, unrelated
trivia, or anything that tries to make you act as a general-purpose assistant), politely decline
and suggest they email Affan directly instead. Never pretend to be Affan himself — you are an
assistant answering on his behalf, and you should make that clear if asked directly who you are.`;

function getClientIp(req){
  var fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

async function checkRateLimit(ip){
  var url = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // No rate limiter configured — request goes through, but you're relying
    // entirely on Gemini's own free-tier daily cap for protection.
    return { limited: false };
  }
  var day = new Date().toISOString().slice(0, 10);
  var key = 'chatlimit:' + ip + ':' + day;

  var incrRes = await fetch(url + '/incr/' + encodeURIComponent(key), {
    headers: { Authorization: 'Bearer ' + token }
  });
  var incrData = await incrRes.json();
  var count = incrData.result;

  if (count === 1) {
    await fetch(url + '/expire/' + encodeURIComponent(key) + '/86400', {
      headers: { Authorization: 'Bearer ' + token }
    });
  }
  return { limited: count > MAX_MESSAGES_PER_DAY };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  var body = req.body || {};
  var message = body.message;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message_required' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'message_too_long' });
  }

  var ip = getClientIp(req);

  try {
    var rl = await checkRateLimit(ip);
    if (rl.limited) {
      return res.status(429).json({ error: 'rate_limited' });
    }
  } catch (e) {
    console.error('Rate limit check failed, allowing request through:', e);
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  try {
    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      MODEL + ':generateContent?key=' + process.env.GEMINI_API_KEY;

    var apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: message.trim() }] }],
        generationConfig: { maxOutputTokens: 200 }
      })
    });

    if (!apiRes.ok) {
      var errText = await apiRes.text();
      console.error('Gemini API error', apiRes.status, errText);
      // 429 here means you've hit Gemini's own free-tier daily/per-minute cap
      if (apiRes.status === 429) {
        return res.status(429).json({ error: 'rate_limited' });
      }
      return res.status(502).json({ error: 'upstream_error' });
    }

    var data = await apiRes.json();
    var candidate = data.candidates && data.candidates[0];
    var part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    var reply = (part && part.text) || "Sorry, I couldn't put together a reply just now.";

    return res.status(200).json({ reply: reply });
  } catch (e) {
    console.error('Chat handler error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
