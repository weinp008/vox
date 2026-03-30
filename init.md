**SONAR - LOCKED IN.** 🎯

Let me formalize the project brief:

---

# PROJECT SONAR
**Navigate code by voice**

## Mission Statement
Build the first truly accessible, audio-first coding environment that works on mobile. Primary use cases: blind/low-vision developers, mobile developers (running/commuting), and developers with RSI/carpal tunnel.

## Core Value Proposition
Claude Code, but you can use it while running, commuting, parenting, or without looking at a screen. Audio-only workflow with intelligent conversation routing and safety gates.

---

## Technical Architecture (v1)

### Stack
**Mobile:** React Native (Expo)
**Backend:** FastAPI (Python)
**Transcription:** Deepgram API
**LLM:** Anthropic Claude API (Sonnet 4)
**TTS:** ElevenLabs API (premium) / Piper (free tier)
**Database:** Postgres (session state, project context)
**Hosting:** Railway/Render (backend), Expo cloud (mobile)

### Core Flow
```
USER SPEAKS
    ↓
Mobile app records audio (React Native Audio)
    ↓
Upload to /prompt endpoint
    ↓
Deepgram transcribes (< 1 sec)
    ↓
Add project context (active files, recent commits)
    ↓
Send to Claude API with audio-optimized system prompt
    ↓
Parse response type (options | confirmation | freeform)
    ↓
Generate TTS (ElevenLabs)
    ↓
Return audio + metadata to mobile
    ↓
Play TTS response
    ↓
If awaiting_input: wait for user response
    ↓
USER RESPONDS (numeric | "speak to discuss" | "send")
    ↓
Loop until "send" command → execute changes
```

---

## MVP Feature Set (Weekend Build)

### Mobile App
- [ ] Single "Record" button (push-to-talk)
- [ ] Project selection screen (manual list)
- [ ] Audio playback for TTS responses
- [ ] Simple state: recording | listening | awaiting_response
- [ ] "Speak to discuss" and "Send" keyword detection

### Backend API
- [ ] `POST /prompt` - Initial voice prompt
- [ ] `POST /respond` - User response to Claude's question
- [ ] `POST /session/start` - Initialize project context
- [ ] Deepgram integration
- [ ] Anthropic API integration
- [ ] ElevenLabs TTS integration
- [ ] Response parsing (structured format detection)

### Audio-Optimized System Prompt
```
You are Sonar, an audio-first coding assistant.

CRITICAL RULES:
1. Present options as numbered lists (max 4 options)
2. Keep responses under 200 words for TTS readability
3. Always confirm file modifications before executing
4. Use format markers: OPTION_START, CONFIRM_START, etc.

Current project: {project_name}
Files in context: {file_list}
Recent commits: {git_summary}

User prompt: {transcript}
```

### Core Commands (keyword detection)
- **Numeric responses**: "one", "two", "three", "1", "2", "3"
- **Freeform mode**: "speak to discuss", "let me explain"
- **Commit gate**: "send", "execute", "commit", "go ahead"
- **Abort**: "cancel", "stop", "never mind"
- **Read back**: "read the changes", "what files", "show me the diff"

---

## MVP Scope Boundaries

### IN SCOPE (v1)
- ✅ Single project context per session
- ✅ Manual project selection
- ✅ Basic file awareness (list of files in repo)
- ✅ Git commit history (last 5 commits)
- ✅ Numeric option selection
- ✅ "Speak to discuss" escape hatch
- ✅ "Send" commit gate
- ✅ Audio-only workflow (no screen required)

### OUT OF SCOPE (defer to v2+)
- ❌ Multi-project context switching
- ❌ Semantic file search (embedding-based)
- ❌ Real-time file watching
- ❌ Team collaboration features
- ❌ Custom wake words
- ❌ Offline mode (local Whisper)
- ❌ Visual UI for reviewing diffs
- ❌ Git branch management
- ❌ Automated testing integration

---

## Go-To-Market Strategy

### Phase 1: Accessibility Community (Months 1-3)
**Target:** Blind/low-vision developers

**Channels:**
- Reach out to a11y communities (Blind Software Engineers group, accessibility-focused bootcamps)
- Partner with screen reader companies (NVDA, JAWS)
- Sponsor accessibility-focused hackathons
- Guest post on accessibility blogs

**Goal:** 50 active blind developer users, get testimonials

### Phase 2: Mobile-First Developers (Months 4-6)
**Target:** Developers who code outside traditional desk setups

**Channels:**
- Running/fitness dev communities (r/running, Strava clubs)
- Digital nomad groups
- Parent developer communities
- RSI/carpal tunnel support groups

**Goal:** 500 active users, validate "eyes-busy" use cases

### Phase 3: General Mobile Coding (Months 7-12)
**Target:** Anyone who wants Claude Code on mobile

**Channels:**
- Product Hunt launch
- Hacker News Show HN
- Tech Twitter/X
- Developer podcasts

**Goal:** 5,000 active users, $50K MRR

---

## Monetization

### Free Tier
- 10 voice sessions/month
- Slower transcription (Whisper local)
- Basic TTS (Piper)
- Single project support

### Pro Tier ($15/mo)
- Unlimited voice sessions
- Fast transcription (Deepgram)
- Premium TTS (ElevenLabs, multiple voices)
- Multi-project support
- Git integration
- Session history

### Team Tier ($50/seat/mo)
- Everything in Pro
- Shared project contexts
- Team session analytics
- SSO/SAML
- Custom voice models (trained on codebase terminology)
- Priority support

---

## Success Metrics

### Product Metrics
- **Activation:** % of users who complete first successful code change via voice
- **Retention:** % of users who return within 7 days
- **Session duration:** Average time per voice coding session
- **Commit rate:** % of sessions that end with "send" (vs abandoned)

### Accessibility Impact
- **WCAG compliance:** Meet AAA standard for audio interfaces
- **Blind developer adoption:** # of verified blind/low-vision users
- **Testimonials:** Qualitative feedback from a11y community

### Business Metrics
- **MRR:** Monthly recurring revenue
- **CAC:** Cost to acquire paying customer
- **LTV:CAC ratio:** Target 3:1
- **Churn:** Target < 5% monthly

---

## Weekend Build Plan

### Saturday (Backend)
**Morning (4 hours):**
- [ ] FastAPI skeleton (`/prompt`, `/respond`, `/session/start`)
- [ ] Deepgram integration (transcription)
- [ ] Anthropic API integration (basic prompt)

**Afternoon (4 hours):**
- [ ] ElevenLabs TTS integration
- [ ] Response parsing (detect options vs confirmation)
- [ ] Keyword detection (numeric, "speak to discuss", "send")

**Evening (2 hours):**
- [ ] Deploy to Railway
- [ ] Test end-to-end with cURL

### Sunday (Mobile App)
**Morning (4 hours):**
- [ ] React Native Expo setup
- [ ] Record button + audio upload
- [ ] Project selection UI

**Afternoon (4 hours):**
- [ ] TTS playback
- [ ] State management (recording | listening | awaiting_response)
- [ ] Connect to backend

**Evening (2 hours):**
- [ ] Test full flow: record → transcribe → Claude → TTS → respond → commit
- [ ] Fix bugs, polish UX

---

## Open Questions (to resolve before build)

1. **Project context source:** Where do projects live? GitHub repos? Local clone? Both?
2. **Authentication:** Email/password? OAuth? Magic link?
3. **File execution:** Does Sonar actually write files, or just generate diffs for user to apply?
4. **Safety model:** What's the undo mechanism if bad code gets committed?
5. **iOS vs Android:** Build for both simultaneously, or iOS-first?

---

## Brand Assets (to create)

- [ ] Logo (concentric circles / sound waves)
- [ ] Color palette (deep blue #1a365d + cyan #00d4ff)
- [ ] Landing page copy
- [ ] Demo video (30 seconds, showing voice→code flow)
- [ ] Twitter/X account (@projectsonar or @sonarcode)

---

## Next Immediate Steps

1. **Domain:** Register sonar.dev ($12/year)
2. **Repo:** Create GitHub repo `sonar` (private initially)
3. **API Keys:** Get Deepgram, Anthropic, ElevenLabs API keys
4. **Decide:** iOS-first or Android-first? (Recommendation: iOS, you're on iOS)
5. **Timebox:** Commit to weekend build (April 5-6?) or next available weekend

---

**PROJECT SONAR IS OFFICIALLY LIVE.** 

Want me to start writing the FastAPI backend skeleton right now, or do you want to tackle those open questions first?
