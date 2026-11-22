# PulseIsle — Playful Open-Source GitHub Repo Tracker & 3D Lifecycle Explorer

PulseIsle turns raw GitHub repository activity into a cheerful, jargon-free community hub for non-technical stakeholders and open-source fans. Visitors paste any GitHub URL or `owner/repo` handle to explore live velocity charts, AI-translated commit and release briefings, an interactive 3D Floating Island Roadmap built with Three.js, live 60-second auto-sync with milestone push notifications, and a friendly AI guide they can chat with anytime.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The core product direction and visual choices below reflect your confirmed preferences from our initial Q&A. Please review the architectural plan and click **Proceed** to begin building, or share any adjustments you would like made first.

- **Confirmed — 3D Lifecycle Metaphor**: **Floating Island Roadmap** with procedural 3D milestone stations (releases as celebratory lighthouse towers, merged PRs as workshop pavilions, and recent commits as orbiting energy pods along a winding glowing pathway).
- **Confirmed — Visual Theme & Mood**: **Bright playful daylight canvas** with crisp off-white surfaces, vibrant coral (`#FF5A5F`) primary accents, and energetic teal (`#0D9488`) velocity highlights.
- **Confirmed — First-Load Experience**: **Clean search launcher** featuring an instant repository input (accepting full GitHub URLs or `owner/repo`) paired with curated open-source project cards ready to explore in one click.
- **Confirmed — Auto-Sync & Push Notifications**: **Automatic 60-second background sync** using conditional GitHub API checks (preserving rate limits) paired with native browser push notifications, playful in-app milestone banners, and a **Test Milestone Alert** trigger so stakeholders can preview alerts and 3D celebrations on demand.

---

## 1. Overview & Core Concept

- **What It Does**: Connects live to any public GitHub repository, fetches commits, recently merged pull requests, release notes, contributor leaderboards, and development velocity metrics, then uses Gemini AI (`gemini-4-hydrogen`) to translate cryptic engineering updates into upbeat, plain-English stories and actionable takeaways.
- **Target Audience / Persona**: Open-source community members, product stakeholders, donors, and non-technical followers who eagerly track a project's momentum without wanting to read diffs or decode developer jargon.
- **Key Value**: Bridges the gap between engineering execution and community excitement—combining automated real-time progress reporting, tactile animated charts, interactive 3D storytelling, and an always-ready AI explainer chat in one responsive workspace.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Launcher Arrival (Zero-State)**:
   - Visitors land on an airy, sunlit hero search screen with a single bold input accepting either `https://github.com/owner/repo` or `owner/repo`.
   - Directly below sit four curated open-source starter cards (e.g., `facebook/react`, `vercel/next.js`, `vitejs/vite`, `mrdoob/three.js`) displaying live-ready launch affordances so anyone can jump straight into a real repository in one click.
2. **Active Repository Dashboard**:
   - **Top Bar**: Clean three-zone navigation—brand wordmark on the left, concise section links (`Overview`, `3D Roadmap`, `Updates`, `Community`) in the center, and a single primary `Switch Repo` action on the right.
   - **Hero Briefing & Sync Strip**: Displays the repository identity, a cheerful AI-written "Community Pulse" headline and plain-English TL;DR, milestone progress bars (toward next release/velocity target), and a quiet sync toolbar with the 60-second auto-sync toggle, notification permission button, and **Test Milestone Alert** button.
   - **Interactive 3D Floating Island Roadmap**: A wide, unobstructed Three.js daylight viewport where visitors orbit, zoom, and click procedural 3D milestone stations representing releases, recent merged PR hubs, and orbiting commit pods. A sleek collapsible bottom dock lets users switch camera views (`Overview`, `Latest Release`, `Recent PRs`, `Contributors`), replay a milestone celebration burst, or toggle Zen Mode without side-panel clutter covering the island. Clicking any 3D station opens a concise floating caption card and lets the user "Ask AI about this milestone."
   - **Plain-English Activity Feed & Release Spotlight**: Side-by-side or stacked responsive layout showing:
     - **Latest Release Notes** translated into celebratory community takeaways with friendly emoji markers.
     - **Recent Commits & Merged PRs** with filter tabs (`All`, `Commits`, `Merged PRs`), where each item shows the AI's jargon-free translation ("What actually changed & why it matters") alongside a collapsible toggle to peek at the original technical commit title and author.
   - **Velocity Charts & Contributor Spotlight**: Animated interactive charts (commit cadence area/bar chart, PR merge momentum, and animated milestone progress bars) paired with a top-contributors leaderboard highlighting recent momentum and cheerful rank badges.
   - **Interactive Community AI Chat Drawer**: A responsive slide-over (desktop) / full-sheet (mobile) AI chat interface pre-seeded with friendly starter questions ("What's the biggest win this week?", "Explain the latest release simply", "Who's been busiest lately?") and grounded directly in the active repository's live GitHub data.

### Visual Identity & Theme

- **Aesthetic Direction**: Playful, sunlit editorial dashboard—energetic and approachable like a modern community showcase, while keeping data legible, spacious, and disciplined (no heavy card-within-card nesting, no fake telemetry tickers, and no visual clutter).
- **Color Palette & Mood** (60-30-10 Daylight Distribution):
  - *60% Neutral Canvas*: Crisp daylight off-white (`--background: #F8FAFC`) and clean white elevated surfaces (`--surface: #FFFFFF`) with cool hairline borders (`#E2E8F0`).
  - *30% Structural Typography & Surfaces*: Deep ink slate (`#0F172A`) for headlines, slate (`#475569`) for prose, and soft mist tints (`#F1F5F9`) for segmented tabs and chart frames.
  - *10% Playful Accent Budget*: Vibrant Coral (`--primary: #FF5A5F`) for primary CTAs, milestone beacons, and active focus states; Energetic Teal (`--accent: #0D9488`) for velocity curves, sync progress, and merged PR highlights; Warm Marigold (`#F59E0B`) reserved for release celebrations and star counts.
- **Typography & Hierarchy**:
  - *Display & Headings*: `Bricolage Grotesque` (expressive, friendly geometric display character with `text-wrap: balance` to prevent orphan words).
  - *Body Prose*: `Plus Jakarta Sans` (warm, super-legible at 14px–16px for non-technical summaries and chat).
  - *Metrics & Counts*: `JetBrains Mono` with `tabular-nums` so commit counts, velocity figures, and sync countdowns never jitter.
- **Responsive Mobile & Desktop Optimization**:
  - Desktop (`1440px` baseline): Full-width breathable container (`max-w-7xl`) with 2-column balanced bento splits, wide 3D island stage, and slide-over AI chat drawer.
  - Mobile (`375px`–`768px`): Single-column stacked flow, touch-friendly targets (`>= 44px`), compact sticky top bar (staying well under the 15% mobile sticky height cap), horizontally scrollable filter tabs, touch-enabled 3D orbit controls, and full-height chat sheet.

### Interactive Feedback & Motion

- Smooth spring and settling transitions (`cubic-bezier(0.16, 1, 0.3, 1)`, `<= 200ms` for controls) on tab switches, progress bar fills, animated charts, and milestone toast notifications.
- Clear loading skeletons matching final card geometry while GitHub + Gemini summarize a freshly entered repository, plus friendly, actionable error recovery if a repo is private, misspelled, or hits a GitHub API rate limit.
- Zero arrival popups—browser push notification permissions are requested strictly when the user clicks "Enable Alerts."

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side GitHub Proxy with Conditional Caching (ETag)**
  - *Chosen Approach*: Route all GitHub REST API requests through a lightweight Express backend that caches responses briefly (45s) and sends `If-None-Match` ETags on every 60-second auto-sync check.
  - *Why*: Unauthenticated GitHub API requests are capped at 60/hour per IP, whereas conditional `304 Not Modified` responses do **not** count against the quota—enabling continuous real-time auto-sync without breaking. Also supports an optional `GITHUB_TOKEN` environment variable for higher volume.
  - *Alternatives Considered*: Direct browser-to-GitHub fetching—rejected because rapid auto-sync across multiple endpoints would quickly trigger 403 rate limits.

- **Decision 2: Server-Side Gemini AI (`gemini-4-hydrogen`) with Structured Schemas & Streaming Chat**
  - *Chosen Approach*: Use `gemini-4-hydrogen` via `@google/genai` on the Express server: one structured JSON endpoint for playful plain-English commit/PR/release translations, and one Server-Sent Events (SSE) streaming endpoint for the interactive community Q&A chat.
  - *Why*: `gemini-4-hydrogen` delivers low-latency, witty, accurate natural-language summaries with strict schema guarantees so every commit card renders cleanly without broken formatting, and streaming chat feels conversational and immediate.
  - *Alternatives Considered*: Heavier reasoning models—unnecessary for fast summarization and would add noticeable wait time when switching repositories.

- **Decision 3: Procedural 3D Floating Island Diorama with Software-WebGL Safety**
  - *Chosen Approach*: Build the Floating Island Roadmap 100% procedurally in Three.js using multi-part composite `THREE.Group` models (layered rock & sunlit meadow island terrain, beacon lighthouses for releases, workshop pavilions for merged PR clusters, instanced foliage/clouds, and orbiting glowing commit pods) illuminated with `RoomEnvironment` PBR reflections, warm sunlight key light, and cool sky hemisphere fill. Include automatic software-WebGL detection (`isSoftwareGl`) for smooth frame pacing across all devices.
  - *Why*: Zero external 3D asset 404s, instant loading, rich tactile daylight aesthetic matching the coral-and-teal UI, and smooth camera damping on both desktop GPUs and constrained mobile/headless environments.

- **Decision 4: Dual-Layer Real-Time Push Notifications**
  - *Chosen Approach*: Combine the browser Web Notifications API (opt-in via toolbar button) with animated in-app milestone toast banners and a visual 3D firework/confetti pulse on the Floating Island whenever auto-sync detects a new commit, merged PR, or release—plus a one-click **Test Milestone Alert** button.
  - *Why*: Ensures users inside embedded previews or browsers with blocked OS permissions still receive immediate, delightful real-time milestone feedback while granting full native push alerts whenever enabled.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT (React + Vite)                       │
│                                                                            │
│  ┌─────────────────────────┐    ┌────────────────────────────────────────┐ │
│  │  Repo Launcher View     │    │      Active Dashboard Workspace        │ │
│  │  - URL / user/repo form │───▶│  ┌──────────────────────────────────┐  │ │
│  │  - Curated Repo Cards   │    │  │ Top Bar + Auto-Sync / Alert Bar  │  │ │
│  └─────────────────────────┘    │  └──────────────────────────────────┘  │ │
│                                 │  ┌──────────────────────────────────┐  │ │
│  ┌─────────────────────────┐    │  │ AI Community Briefing & Progress │  │ │
│  │ Notification Manager    │◀──▶│  └──────────────────────────────────┘  │ │
│  │ - Web Notifications API │    │  ┌──────────────────────────────────┐  │ │
│  │ - In-App Milestone Toast│    │  │ Three.js Floating Island Roadmap │  │ │
│  │ - 60s Polling Diff Hook │    │  │ + Raycast Station Inspector      │  │ │
│  └─────────────────────────┘    │  │ + Collapsible Bottom Camera Dock │  │ │
│                                 │  └──────────────────────────────────┘  │ │
│  ┌─────────────────────────┐    │  ┌─────────────────┬────────────────┐  │ │
│  │ AI Community Chat Drawer│◀──▶│  │ Velocity Charts │ Jargon-Free    │  │ │
│  │ - Context-grounded Q&A  │    │  │ & Contributors  │ Commits & PRs  │  │ │
│  │ - Streaming SSE Replies │    │  └─────────────────┴────────────────┘  │ │
│  └─────────────────────────┘    └────────────────────────────────────────┘ │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ HTTP / JSON / SSE
                                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER (Full-Stack API)                       │
│                                                                            │
│  ┌────────────────────────────────┐   ┌──────────────────────────────────┐ │
│  │ GitHub Aggregator & ETag Cache │   │ Gemini AI Engine (@google/genai) │ │
│  │ GET /api/github/repo           │   │ POST /api/ai/summarize           │ │
│  │ - Parses URL or owner/repo     │   │  -> Structured JSON summaries    │ │
│  │ - Repo meta, commits, merged   │   │ POST /api/ai/chat                │ │
│  │   PRs, releases, contributors  │   │  -> Streaming SSE Q&A grounded   │ │
│  │ - ETag 304 delta sync check    │   │     in live repository snapshot  │ │
│  └───────────────┬────────────────┘   └─────────────────┬────────────────┘ │
└──────────────────┼──────────────────────────────────────┼──────────────────┘
                   ▼                                      ▼
       ┌──────────────────────┐               ┌────────────────────────┐
       │  GitHub REST API v3  │               │  Gemini 4 Hydrogen API │
       └──────────────────────┘               └────────────────────────┘
```

### Data Model & State

- **Repository Snapshot**: Core metadata (`owner`, `name`, `description`, `stars`, `forks`, `openIssues`, `language`, `pushedAt`, `htmlUrl`), `latestRelease` (tag, name, published date, raw notes), `recentReleases` (up to 4 for 3D milestone towers), `commits` (latest 15 commits with SHA, message, author, avatar, timestamp), `mergedPRs` (latest 10 merged pull requests), `contributors` (top 8 contributors with avatar and contribution count), and `velocitySeries` (14-day / weekly commit & PR momentum buckets for animated charts).
- **AI Community Digest**: Structured response returned by Gemini containing `headline`, `playfulSummary`, `momentumMood`, `releaseHighlights` (plain-English bullet list), `commitTranslations` (keyed by SHA with `emoji`, `plainTitle`, `whyItMatters`, `category`), and `prTranslations` (keyed by PR number).
- **Live Sync & Milestone State**: Tracks `lastSyncedAt`, `nextSyncSeconds` (60s countdown), `isSyncing`, `autoSyncEnabled`, `notificationPermission`, `lastSeenCommitSha`, `lastSeenReleaseTag`, and a queue of celebratory milestone alerts.
- **3D Island Lifecycle State**: Maps real repository data onto the Floating Island:
  - Releases → Multi-part Lighthouse Towers along the winding island road.
  - Merged PRs → Coastal Workshop Pavilions with glowing banners.
  - Recent Commits → Orbiting Energy Pods circling the active frontier station.
  - Selected Station → Smoothly glides camera via exponential damping and opens an interactive inspector card with a one-click "Ask AI to explain this" action.

### Interactive Component & State Mapping

- **Repo Input & Validation**: Normalizes `https://github.com/facebook/react/`, `github.com/facebook/react`, or `facebook/react` into `owner/repo`, validates format inline, triggers fetch + AI summary pipeline, and saves recently viewed repos to `localStorage` for quick switching.
- **Auto-Sync & Milestone Diffing**: Every 60 seconds (when enabled), polls `/api/github/repo?repo=...&sync=1`; if a newer commit SHA, merged PR, or release tag arrives, automatically refreshes the AI summary, increments metrics, triggers a 3D celebration burst on the island, and dispatches both a native browser notification (if granted) and an in-app celebratory banner. Clicking **Test Milestone Alert** exercises the exact same notification + 3D celebration flow safely without mutating real GitHub data.
- **Interactive Feed Filtering & Jargon Toggle**: Filter buttons (`All`, `Commits`, `Merged PRs`) dynamically filter the activity stream; each entry toggles between the playful plain-English view and the original technical commit/PR details, plus a quick "Ask AI" trigger that opens the chat pre-loaded with context on that exact item.
- **3D Camera Dock & Raycasting**: Bottom dock controls switch camera presets (`Island Overview`, `Release Towers`, `PR Harbor`, `Commit Orbit`), toggle island auto-orbit, and collapse/expand the dock cleanly; hovering/clicking any 3D station highlights it and synchronizes with the station inspector panel.
- **Streaming Community AI Chat**: Maintains conversation history per repository, streams live tokens from `/api/ai/chat`, and resets gracefully when switching repositories while handling API errors with clear retry buttons.
