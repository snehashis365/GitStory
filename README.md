# 📖 GitStory

> **Turn raw GitHub repository activity into plain-English stories, live interactive lifecycle pipelines, and community intelligence.**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 What is GitStory?

Open-source repositories move fast, but deciphering what actually happened in a week of pull requests, squash-merges, rebases, and release tags is painful for non-technical stakeholders, product managers, community members, and donors.

**GitStory** bridges the gap between raw Git commits and human understanding. It ingests any public repository (e.g. `facebook/react`, `vercel/next.js`, or custom GitHub URLs) and transforms its engineering momentum into:
1. **AI Progress Story Chapters & Jargon Decoder** — Plain-English summaries of features, refactors, bug fixes, and breaking changes.
2. **Interactive 2D Project Lifecycle Pipeline** — An animated Motion flow tracing work from *Active Coding* $\to$ *Review & PR Merges* $\to$ *Community Velocity* $\to$ *Shipped Releases*.
3. **Interactive AI Chat Guide** — Context-aware conversational assistant rendering GitHub-Flavored Markdown (tables, code blocks, checklists) to answer questions about any milestone or commit.
4. **Smart Adaptive Auto-Sync** — Dynamically calculates repo cadence (detecting mass merge/rebase clusters vs. separated cadence) to sync intelligently without spamming rate limits or running redundant LLM generations.
5. **Universal Multi-Provider AI Support** — Bring your own API key or local model (Gemini, OpenAI, Anthropic Claude, NVIDIA NIM, or Local Ollama/LM Studio) with instant model auto-population.

---

## 🚀 Key Features

### 1. 🤖 Universal AI Provider Hub
Configure your favorite LLM provider right from the top navigation bar or AI Chat Drawer:
- **Google Gemini** (Gemini 2.5 Flash, 2.5 Pro, 2.0 Flash)
- **OpenAI** (GPT-4o, GPT-4o-mini, o1, o3-mini)
- **Anthropic Claude** (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku)
- **NVIDIA NIM** (Meta Llama 3.3 70B, Llama 3.1 405B, Mistral Large, etc.)
- **Local Endpoint / Self-Hosted** (Ollama, LM Studio, vLLM, LocalAI)
- **Auto-Populating Model Lists**: Entering an API key debounces a query to `/api/ai/models` to discover all models available on your account or local host.

### 2. ⚡ Motion-Powered Lifecycle Pipeline Flow
- Replaces heavy, opaque 3D with an ultra-responsive, accessible **2D Motion Pipeline Flow**.
- Four animated pipeline stages:
  - 🔨 **Active Coding** (Commit pulse, author counts, branch energy)
  - 🔀 **Review & PR Merges** (Code review velocity, merged PR throughput, review ratios)
  - ⚡ **Community Velocity** (Star momentum, forks, active issues, contributors)
  - 🚀 **Shipped Releases** (Latest release tags, semantic versioning milestones, release notes)
- Interactive inspect drawer: Click any stage to inspect real metrics and trigger instant AI deep-dives.

### 3. 📝 GitHub-Flavored Markdown AI Chat Drawer
- Integrated streaming chat with a knowledgeable community tour guide.
- Powered by `react-markdown` + `remark-gfm` with full styling:
  - Headers, bold text, and blockquotes
  - Syntax-highlighted code blocks with copyable snippets
  - Rich data tables and task lists
  - One-click follow-up prompt chips

### 4. 🧠 Activity Fingerprint & Digest Caching
- Generates a unique activity fingerprint based on `[latest_commit_sha + latest_merged_pr + release_tag + ai_provider + model]`.
- Cached digests persist across page reloads in `localStorage` and memory.
- If the repository has not changed, GitStory displays cached analyses instantly with **zero redundant LLM calls**.
- Manual **"Regenerate Analysis"** button allows forced refresh on demand.

### 5. ⏱️ Smart Adaptive Auto-Sync
- Replaces rigid 60-second polling with an intelligent cadence analyzer:
  - Measures inter-commit intervals over the latest commits.
  - Gracefully detects **mass merges & automated rebases** (sub-2-minute bursts) and clusters them to prevent skewing the cadence.
  - Dynamically scales background sync from 2 minutes (hyperactive repositories) to 30 minutes (quiet repositories).
  - Pauses background sync while an AI generation is actively running to prevent race conditions.

### 6. 🎨 Polished Vector Design System
- Crisp, clean icons via `lucide-react` and custom SVG provider badges.
- Accessible color scheme: Energetic Coral (`#FF5A5F`), Deep Navy (`#0F172A`), Teal (`#0D9488`), and Indigo accents.
- Responsive design tailored for mobile phones, tablets, and wide desktop displays.

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Animation**: [Motion](https://motion.dev/) (Framer Motion v12)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Markdown**: [react-markdown](https://github.com/remarkjs/react-markdown), [remark-gfm](https://github.com/remarkjs/remark-gfm)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend / Proxy**: [Express.js](https://expressjs.com/), [dotenv](https://github.com/motdotla/dotenv)
- **AI SDKs**: Official `@google/genai` SDK + native REST adapters for OpenAI, Anthropic, NVIDIA, and Ollama.

---

## 🏁 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` or `pnpm` / `yarn`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/snehashis365/GitStory.git
   cd GitStory
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **(Optional) Configure environment variables:**
   You can provide a default Gemini key or GitHub personal access token in `.env.local`:
   ```bash
   # .env.local
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional: higher GitHub rate limits (5,000 req/hr vs 60 req/hr)
   GITHUB_TOKEN=your_github_token_here
   ```
   > *Note: GitStory also includes an in-app AI Provider Modal, so you and your users can paste API keys directly into the UI without needing server env files!*

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

### 🌐 Deploying to GitHub Pages

GitStory is 100% static and serverless-ready! To deploy to GitHub Pages:

1. **Automatic via GitHub Actions (Recommended)**:
   - Push your code to the `main` branch.
   - Go to your repository **Settings** → **Pages** → **Build and deployment**.
   - Select **Source: GitHub Actions**.
   - The included [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) workflow will automatically build and publish your site!

2. **Manual deployment via CLI**:
   ```bash
   npm run deploy
   ```

---

## 🧭 How to Use

1. **Launch a Repository**:
   - Paste any GitHub URL (e.g. `https://github.com/facebook/react`) or shorthand identifier (`tailwindlabs/tailwindcss`) into the search bar.
   - Or click any of the featured open-source badges (React, Next.js, VS Code, Tailwind, Vite).

2. **Configure Your AI Engine**:
   - Click **"AI Provider"** in the top navigation bar.
   - Choose your provider: **Gemini**, **OpenAI**, **Anthropic**, **NVIDIA**, or **Local Endpoint**.
   - Enter your API key (stored safely in your browser's `localStorage`).
   - Pick your preferred model from the auto-populated list.

3. **Explore the Lifecycle**:
   - Review the **AI Progress Story Chapters** (Key Milestones, What Changed, Jargon Decoder).
   - Click any stage in the **2D Project Lifecycle Pipeline Flow** to inspect health metrics and ask the AI guide for an explanation.
   - Click **"Ask AI Guide"** at any time to open the GitHub-Flavored Markdown chat assistant.

---

## 📂 Project Structure

```
├── .github/
│   └── workflows/
│       └── deploy.yml           # Automated GitHub Pages CI/CD workflow
├── public/
│   └── favicon.svg              # SVG brand favicon
├── src/
│   ├── App.tsx                  # Main orchestration container & repository state management
│   ├── services/
│   │   ├── githubService.ts     # Client-side GitHub REST aggregator, ETag caching & velocity builder
│   │   └── aiService.ts         # Direct browser AI generation, streaming chat & model discovery
│   ├── components/
│   │   ├── AIProviderModal.tsx  # Multi-provider selection, API key configuration & model fetcher
│   │   ├── ActivityFeed.tsx     # Plain-English AI progress digest & story chapter cards
│   │   ├── CommunityChatDrawer.tsx # GFM-rendered conversational AI guide drawer
│   │   ├── NotificationCenter.tsx # Milestone alerts & browser push notifications
│   │   ├── ProjectLifecyclePipeline.tsx # Animated Motion 2D lifecycle pipeline
│   │   ├── RepoLauncher.tsx     # Hero search screen & featured repository cards
│   │   ├── StoryGenerationProgress.tsx # Multi-stage animated progress bar & stepper
│   │   └── VelocityAndContributors.tsx # Commit velocity metrics & top contributors
│   ├── utils/
│   │   ├── cadence.ts           # Smart commit interval & rebase/merge clustering cadence calculator
│   │   └── digestCache.ts       # Activity fingerprinting & client localStorage digest caching
│   ├── types.ts                 # TypeScript interfaces for snapshots, digests & provider configs
│   ├── index.css                # Tailwind CSS v4 styling & theme setup
│   └── main.tsx                 # React DOM client entry point
├── package.json
└── README.md
```

---

## 🤝 Contributing

Contributions, feedback, and issue reports are very welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
