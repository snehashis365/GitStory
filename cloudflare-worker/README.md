# GitStory AI Edge Gateway (Cloudflare Worker)

This Cloudflare Worker serves as a secure, rate-limited reverse proxy for **Groq Cloud** using OpenAI's `openai/gpt-oss-120b` model.

It allows visitors on your GitHub Pages deployment to experience live GitStory AI summaries and chat **without exposing your Groq API key** to the browser.

---

## Quick Setup (Option A: Cloudflare Dashboard — 2 Minutes, No CLI Required)

1. Log into your free [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left sidebar, click **Compute (Workers & Pages)** → **Create application** → **Create Worker**.
3. Give it a name (e.g. `gitstory-ai-proxy`) and click **Deploy**.
4. Click **Edit code**:
   - Delete the starter code.
   - Copy and paste the entire contents of [`worker.js`](worker.js).
   - Click **Deploy** in the top right.
5. Add your Secrets:
   - Go to your Worker's **Settings** tab → **Variables and Secrets**.
   - Under **Secrets**, click **Add**:
     - **Name**: `GROQ_API_KEY`
     - **Value**: your Groq API key (from [console.groq.com/keys](https://console.groq.com/keys)).
   - Click **Add** again for GitHub Token (optional but recommended):
     - **Name**: `GITHUB_TOKEN`
     - **Value**: your Fine-Grained GitHub PAT (read-only on public repos).
   - Click **Save and Deploy**.
6. Note your Worker URL (e.g. `https://gitstory-ai-proxy.<your-subdomain>.workers.dev`).
7. (Optional) Set `VITE_DEMO_AI_PROXY_URL=https://gitstory-ai-proxy.<your-subdomain>.workers.dev` in GitHub Repository Secrets/Variables or `.env`.

---

## Quick Setup (Option B: Wrangler CLI)

If you prefer terminal deployment:

```bash
cd cloudflare-worker

# 1. Login to Cloudflare
npx wrangler login

# 2. Add your secret key
npx wrangler secret put GROQ_API_KEY
# (paste your Groq API key when prompted)

# 3. Deploy
npx wrangler deploy
```

---

## Features

- **Key Security:** `GROQ_API_KEY` remains strictly at Cloudflare edge; the browser never sees it.
- **Default Model:** `openai/gpt-oss-120b` on Groq LPU hardware (~500 tokens/sec).
- **IP Rate Limiting:** In-memory sliding window allows up to 6 requests/minute per client IP.
- **CORS Support:** Handles `OPTIONS` preflight and browser cross-origin requests cleanly.
- **BYOK Prompt:** When rate limits are reached, sends HTTP 429 with a friendly error telling the visitor to add their own free key.
