# Curiodromia

A Q&A learning platform (Aiming to be a Social Media Platform) where answers rise or fall on their own merit, plus a **classrooms** feature for live group learning. Built with Node.js, Express, Socket.IO and SQLite.

## Features

**Onboarding**
- Accounts are just a username + password (10-20 alphanumeric characters, no email)
- After signup you're asked: *"What do you want to learn?"* or *"Just exploring"*
  - **Learning path** → matched to a category → shown curated free resources for that topic, plus any classrooms already running in it
  - **Explore path** → straight to the homepage

**Q&A homepage**
- Trending questions, ranked most → least rated, with a **Today** / **All time** / **Newest** toggle (Today gracefully falls back to all-time trending if nothing's been posted yet today)
- Filter by category
- Ask a question, answer any question, upvote/downvote (you can't vote on your own post)
- The best answers naturally sort to the top of each question's answer list

**Classrooms**
- Anyone can start a classroom. The title you give it is the **intro** — the topic/question you want to explore — and that's what others see before clicking **Join**
- Classrooms are searchable by title and filterable by category
- Once joined, you're in the **content section**: a live chat-style room (Socket.IO) where anyone present can post questions or answer existing ones in real time
- Questions inside a classroom are ranked most → least rated in a sidebar
- The **top 3 highest-rated answers** in the room are pinned as **milestones**
- Only the creator can **end** the classroom. Ending it asks for a conclusion — a **manual text box** that works today, plus an **"Generate with AI" button that's intentionally disabled and labeled "Coming soon"**, per the brief: AI conclusion generation is a feature under development, not a working requirement

**Profiles & reputation**
- Upload a profile photo
- Reputation = the net votes your **questions** have earned, shown with a tier badge (Newcomer → Contributor → Voice → Luminary)
- Your profile lists every question you've asked, best-rated first

## Tech stack

| Layer     | Choice |
|-----------|--------|
| Server    | Node.js, Express, Socket.IO |
| Database  | SQLite via `better-sqlite3` (schema in [`db/schema.sql`](db/schema.sql)) |
| Frontend  | Plain HTML/CSS/JS, one page per view — no build step, no framework |

## Running it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/<your-username>/agora.git
cd agora
npm install
npm start
```

Open **http://localhost:4000**. A demo account is seeded automatically so you can try it immediately:

```
username: demo
password: DemoPass123
```

The seed also adds a couple of sample questions, resources for every category, and one open classroom, so the app doesn't look empty on a fresh clone. Register a second account in another browser/incognito window to try voting, answering, and joining a classroom as two different people at once.

## Live demo

This app needs a persistent server (SQLite + WebSockets), so it can't run as a static GitHub Pages site. To get a real working link here:

**Demo:** https://curiodromia-production.up.railway.app/
## Project structure

```
agora/
├── server.js              # Express routes + Socket.IO realtime for classrooms
├── db/
│   ├── schema.sql          # SQLite schema
│   ├── init.js             # Opens the DB, applies schema, seeds demo data
│   └── queries.js          # Shared reputation/scoring helpers
└── public/
    ├── index.html           # Login / register
    ├── onboarding.html       # "Learn" vs "Explore"
    ├── resources.html        # Curated links for the chosen category
    ├── home.html              # Trending questions feed
    ├── question.html          # Question detail + ranked answers
    ├── classrooms.html        # Search/browse/start classrooms
    ├── classroom.html         # The live classroom room
    ├── profile.html           # Avatar, reputation, question history
    ├── css/style.css
    └── js/common.js           # Shared API helper, nav bar, auth guard
```

## Known limitations (next steps)

- AI-generated classroom conclusions are a deliberate stub (`501 Not Implemented` + a disabled "Coming soon" button) — manual conclusions are the working path today. Wiring this up to a real summarization call (e.g. the Anthropic or OpenAI API) over the classroom's questions/answers would be the natural next step.
- Sessions are stored in memory, so restarting the server logs everyone out.
- Classroom chat is refetched on each event rather than patched incrementally — simple and correct, but not the most bandwidth-efficient approach at large scale.
- No pagination yet on the homepage or classroom search — fine for a demo dataset, would need it in production.
