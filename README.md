# Curiodromia

A social media app **in progress** aimed ultimately at being a place where people can ask questions and figure things out with the help of a community of other users — where merit and recognition is allocated fundamentally based on the quality of your questions and answers.

Built with Node.js, Express, Socket.IO and SQLite. The frontend is pure HTML/CSS/JS matching a clean, minimal dark aesthetic focused on curiosity, learning, and community ranking.

**Demo:** https://curiodromia-production.up.railway.app/

## Vision

Curiodromia is designed as a social platform centered on genuine inquiry. Instead of likes on photos or status updates, the core currency is the quality of the questions you pose and the answers you contribute. Good questions surface insight; good answers earn recognition. Over time the community ranks what matters most through collective judgment of substance rather than popularity contests.

## Features

**Login (no separate signup)**
- Single screen: username + password only
- First time a username is used, an account is created and you are sent to setup
- Returning users go straight to the homepage feed
- Passwords are hashed and stored in SQLite; profile assets live in `public/uploads/users/{username}/`

**Onboarding / setup**
- After first login you’re asked what you want to learn or whether you’re just exploring
  - Learning path → matched to a category → curated free resources + relevant classes
  - Explore path → straight to the feed

**Home / Feed**
- Category sidebar + ranked feed of questions (Most / Least / Recommendations)
- Ask a question with optional image/video/audio controls (UI ready)
- **Upvote / downvote directly from the feed** so quality rises immediately
- Best answers sort to the top of each thread

**Classes**
- Browse or create live group learning rooms
- Each class has a topic/intro that others see before joining
- Inside: real-time discussion via Socket.IO, ranked questions, and pinned milestone answers
- Creator can end the class and leave a conclusion (AI generation coming soon)

**Profiles**
- Avatar (stored in the user’s named folder), username, questions asked, and classes
- Reputation derived from the net quality of your questions and answers

## Tech stack

| Layer     | Choice |
|-----------|--------|
| Server    | Node.js, Express, Socket.IO |
| Database  | SQLite via `better-sqlite3` |
| Frontend  | Plain HTML/CSS/JS — no build step, no framework |

## Running locally

Requires Node.js 18+.

```bash
git clone https://github.com/Invenitur42/Curiodromia.git
cd Curiodromia
npm install
npm start
```

Open **http://localhost:4000**. Demo account (seeded automatically):

```
username: demo
password: DemoPass123
```

Or just type any new username + password on the login screen to create an account.

## Project structure

```
Curiodromia/
├── server.js
├── db/
│   ├── schema.sql
│   ├── init.js
│   └── queries.js
└── public/
    ├── index.html          # Login (unified — no signup)
    ├── onboarding.html     # First-login setup
    ├── resources.html
    ├── home.html           # Main feed with live voting
    ├── question.html
    ├── classrooms.html
    ├── classroom.html
    ├── profile.html
    ├── uploads/users/      # Per-username profile folders
    ├── css/style.css
    └── js/common.js
```

## Known limitations / next steps

- AI class conclusions remain a stub (“Coming soon”)
- Sessions are in-memory
- No pagination yet on large feeds
- Media upload for questions is UI-present; full backend support can be expanded

This is an active social product in progress. The ranking of questions and answers by community merit is the foundation everything else builds on.
