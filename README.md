# Deploying your portfolio with the live AI chat demo (free version)

This portfolio has two parts:
- `index.html` — the site itself (static, what visitors see)
- `api/chat.js` — a tiny backend function that talks to a real AI model on your behalf

**Important: this can no longer be hosted on GitHub Pages.** GitHub Pages only
serves static files — it can't run `api/chat.js`. You'll host on **Vercel**
instead, which is free for this and supports both static files and backend
functions in one project.

This version uses **Google's Gemini API**, which has a genuinely free tier —
no credit card required, ever (unlike Anthropic/OpenAI, which need a paid
credit balance from the start). Good enough to power a real, live demo at
zero cost.

---

## 1. Get a free Gemini API key

1. Go to **aistudio.google.com**, sign in with any Google account.
2. Click **Get API key → Create API key**. No billing setup needed.
3. Copy the key (starts with `AIza...`).
4. Free tier limits change occasionally — check
   **ai.google.dev/gemini-api/docs/models** to confirm `gemini-2.5-flash-lite`
   (or whatever the current free Flash-Lite model is called) is still free,
   and update the `MODEL` constant in `api/chat.js` if the name has changed.

## 2. Get a free Upstash Redis database (for rate limiting)

1. Go to **upstash.com** and sign up free.
2. Create a Redis database (any region close to you).
3. On the database page, find the **REST API** section. Copy the
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` values.

This step is optional but recommended — even on a free API, Google's own
daily cap is shared across *all* visitors combined, so one person spamming
the chat could use up everyone else's free quota for the day. The rate
limiter spreads it out fairly.

## 3. Push this folder to GitHub

Create a new repo (or reuse your existing `portfolio` repo) and push these
files, keeping the folder structure:

```
your-repo/
├── index.html
└── api/
    └── chat.js
```

## 4. Deploy on Vercel

1. Go to **vercel.com**, sign up free (you can use your GitHub account).
2. Click **Add New → Project**, import your GitHub repo.
3. Vercel auto-detects the `api/` folder — no extra config needed. Click
   **Deploy**.
4. Go to **Project → Settings → Environment Variables** and add:
   - `GEMINI_API_KEY`
   - `UPSTASH_REDIS_REST_URL` (if using rate limiting)
   - `UPSTASH_REDIS_REST_TOKEN` (if using rate limiting)
5. Go to **Deployments** and re-deploy (or push a small commit) so the new
   environment variables take effect.

You'll get a live URL like `affan-portfolio.vercel.app`. You can attach a
custom domain later for free under Project → Settings → Domains.

## 5. Test it

Open your live Vercel URL (not the local HTML file — the chat won't work
opened directly from disk, since there's no server to call). Try the chat
box and the suggested question chips.

---

## Tuning it

- **Rate limit:** change `MAX_MESSAGES_PER_DAY` at the top of `api/chat.js`.
- **Response length:** `maxOutputTokens` is capped at 200 — raise it if
  replies feel cut off.
- **What the assistant knows:** edit `SYSTEM_PROMPT` in `api/chat.js` as your
  real skills/projects/availability change. Keep it updated — an AI
  assistant that says outdated things about you undercuts the trust this is
  meant to build.

## A note on limits

Free tiers get adjusted by providers without much warning — Gemini's free
quotas have changed more than once in 2026. If the chat box suddenly starts
failing, check `ai.google.dev/gemini-api/docs/pricing` for the current free
model and rate limits, and update `MODEL` in `api/chat.js` accordingly. If
you later have $5-10 to spare and want a noticeably smarter assistant, you
can swap this same function over to the Anthropic API (the earlier version
of this file) — it's a small change since the architecture is identical.
