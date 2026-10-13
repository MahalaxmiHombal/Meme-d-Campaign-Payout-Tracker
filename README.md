# Meme'd — Campaign Payout Tracker

> A creator marketplace where brands run milestone-based campaigns and creators earn through their posts.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Deployed-brightgreen)](https://memed-payout.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup Guide](#setup-guide)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Payout Logic & Design Decisions](#payout-logic--design-decisions)
- [Testing](#testing)
- [Docker](#docker)
- [Deployment](#deployment)
- [Scalability Notes (10,000 Creators)](#scalability-notes-10000-creators)
- [Assumptions & Edge Cases](#assumptions--edge-cases)

---

## Overview

Meme'd lets **brands** create campaigns with a milestone ladder (e.g. 10K views → ₹500, 50K views → ₹2,000) and **creators** submit their posts to those campaigns. As views grow, creators unlock higher payouts, always capped by the campaign's remaining budget.

**Stack:**
- **Backend:** Node.js + TypeScript + Express + MongoDB (Mongoose)
- **Frontend:** Next.js 14 + TypeScript
- **Cache:** Redis (optional, graceful degradation)
- **Auth:** JWT (Bearer token)
- **Tests:** Jest + ts-jest

---

## Architecture

```
/
├── backend/          # Express API
│   ├── src/
│   │   ├── config/   # DB & Redis setup
│   │   ├── middleware/  # Auth, error handler
│   │   ├── models/   # User, Campaign, Submission
│   │   ├── routes/   # auth, campaigns, submissions
│   │   ├── services/ # payoutService (pure functions)
│   │   └── __tests__/  # Jest unit tests
│   └── Dockerfile
├── frontend/         # Next.js app
│   ├── src/
│   │   ├── app/      # Pages (login, signup, brand, creator)
│   │   ├── components/ # Navbar
│   │   ├── context/  # AuthContext
│   │   ├── lib/      # Axios API client
│   │   └── types/    # Shared TypeScript types
│   └── Dockerfile
└── docker-compose.yml
```

---

## Setup Guide

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (local or Atlas)
- Redis (optional, for caching)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/memed-payout-tracker.git
cd memed-payout-tracker
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in your MONGO_URI and JWT_SECRET in .env
npm install
npm run dev
```

The backend starts at `http://localhost:5000`.

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm install
npm run dev
```

The frontend starts at `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key for JWT signing | `a_long_random_string` |
| `JWT_EXPIRES_IN` | JWT expiry duration | `7d` |
| `NODE_ENV` | Environment | `development` |
| `REDIS_URL` | Redis connection URL (optional) | `redis://localhost:6379` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000/api` |

---

## API Reference

### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/signup` | Register (brand or creator) | None |
| POST | `/api/auth/login` | Login | None |
| GET | `/api/auth/me` | Get current user | Bearer token |

### Campaigns

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/campaigns` | List all active campaigns | Any role |
| POST | `/api/campaigns` | Create a campaign | Brand only |
| GET | `/api/campaigns/brand` | Brand's own campaigns with budget info | Brand only |
| GET | `/api/campaigns/:id` | Get single campaign | Any role |

### Submissions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/submissions` | Submit a post to a campaign | Creator only |
| GET | `/api/submissions/my` | Creator's submissions + total earnings | Creator only |
| PATCH | `/api/submissions/:id/views` | Update view count | No role check |
| GET | `/api/submissions/campaign/:campaignId` | All submissions for a campaign | Brand only |

---

## Payout Logic & Design Decisions

### Milestone Model: Highest Tier Wins

A creator earns the **payout of the highest milestone they cross**, not the sum of all milestones crossed.

**Example:** Milestones: `[10K→₹500, 50K→₹2000, 100K→₹5000]`
- 5K views → ₹0
- 15K views → ₹500
- 60K views → ₹2,000 (jumped from 10K to 50K tier in one update → gets ₹2000, not ₹2500)
- 120K views → ₹5,000

**Rationale:** The spec says "payout is the amount of the highest milestone crossed," and the ladder example implies tiers (like a level system), not cumulative stacking.

### No Double-Pay (Delta Tracking)

Each submission tracks `currentPayout` — the total already credited. On each view update, we compute the **delta** (`newPayout - currentPayout`) and only charge that delta to the campaign budget. This means:

- Repeated PATCH with same view count → ₹0 additional cost ✅
- View count goes backward → ₹0 additional (no refunds) ✅
- View count grows to next tier → only the difference is charged ✅

### Budget Cap

If the remaining budget can't cover the full payout delta, the creator receives a **partial payout** capped to whatever budget remains. The campaign is then deactivated.

**Example:** Budget remaining ₹1,000, milestone payout due ₹2,000 → creator gets ₹1,000.

**Rationale:** Better to pay partially than to overpay or silently drop the payout. Brands accept this implicitly when setting a budget smaller than potential payouts.

### Race Condition Prevention (Stretch Goal)

View updates use **MongoDB transactions** (`session.withTransaction`). Both the submission and campaign are locked within the same transaction, so two simultaneous updates cannot both pass the budget check and overspend. The second transaction will see the updated `budgetSpent` and correctly compute a smaller delta.

### View Spike Detection (Bonus)

A submission is flagged when, within the last 1 hour:
1. Views more than **doubled** (growth rate > 100%), AND
2. Absolute increase exceeds **10,000 views**

Both conditions must hold to reduce false positives on small accounts naturally going viral.

---

## Testing

```bash
cd backend
npm test
# or with coverage
npm test -- --coverage
```

Tests cover:
- `calculatePayout`: 0 milestones, single milestone, multiple milestones, unsorted input, exact threshold
- `calculatePayoutDelta`: initial payout, tier upgrades, no double-pay, negative delta prevention, budget cap
- `detectViewSpike`: empty history, gradual growth, spike detection, small absolute increase, stale history

---

## Docker

### Run everything with Docker Compose

```bash
cp backend/.env.example backend/.env
# Set JWT_SECRET in backend/.env

docker-compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`

---

## Deployment

The app is deployed using:
- **Backend:** Render (free tier) — `https://memed-api.onrender.com`
- **Frontend:** Vercel — `https://memed-payout.vercel.app`
- **Database:** MongoDB Atlas (free tier M0)

### Deploy Backend to Render

1. Create a new Web Service on Render
2. Connect your GitHub repo, set root to `/backend`
3. Build command: `npm install && npm run build`
4. Start command: `node dist/index.js`
5. Add environment variables from `.env.example`

### Deploy Frontend to Vercel

1. Import the GitHub repo into Vercel
2. Set root directory to `frontend`
3. Set environment variable: `NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com/api`

---

## Scalability Notes (10,000 Creators)

**Where will things break at scale?**

### 1. Database Bottleneck — View Update Transactions

The PATCH `/submissions/:id/views` uses MongoDB transactions which are single-shard. At 10K creators each updating views frequently, this creates write contention.

**Solution:** Use **optimistic concurrency** with version fields (`__v`) on campaigns. Read → compute → conditional write (`findOneAndUpdate` with `{ budgetSpent: { $lte: currentBudget } }`). Retry on conflict. This is lock-free and horizontally scales.

### 2. Campaign List Cache Invalidation

Currently Redis caches the full campaign list for 60s. At 10K creators hitting this concurrently, the cache miss storm (thundering herd) when a new campaign is created could overload MongoDB.

**Solution:** Use a cache-aside pattern with a distributed lock (Redis `SETNX`) so only one request rebuilds the cache during invalidation.

### 3. Real-Time Views (No Polling)

View counts currently require manual PATCH calls. At scale, you'd integrate with Instagram/YouTube webhooks (or a platform data service) feeding into a **message queue** (Redis Streams or Kafka). A pool of workers processes updates asynchronously, preventing the API from becoming a bottleneck.

### 4. Horizontal Scaling

With stateless JWT auth and Redis for shared state, backend nodes can be horizontally scaled behind a load balancer. MongoDB Atlas supports replica sets and sharding. The main constraint is the transaction isolation for budget updates — but with optimistic locking, this becomes lock-free.

### 5. Read/Write Separation

Separate creator read-heavy paths (campaign browse) from brand write paths (budget updates) via read replicas. Campaign browse is ideal for CDN/edge caching since it changes infrequently.

---

## Assumptions & Edge Cases

| Scenario | Decision |
|----------|----------|
| Creator crosses multiple milestones in one update | Gets the **highest milestone payout only** (not cumulative) |
| Budget runs out mid-payout | Creator receives partial payout up to remaining budget; campaign deactivated |
| View count decreases on re-update | No change — `currentPayout` stays the same (no refunds) |
| Same post link submitted twice to same campaign | Rejected with 409 (unique index on campaign+postLink) |
| Creator submits to same campaign twice | Prevented — UI shows "Submitted" badge; API enforces uniqueness |
| Campaign with 0 budget remaining | New submissions can be made but earn ₹0 payout |
| Redis unavailable | App continues without caching (graceful degradation) |
| JWT expired | 401 returned; frontend redirects to login |

---

## Git Commit Conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — new feature
- `fix:` — bug fix
- `test:` — adding/updating tests
- `docs:` — documentation
- `refactor:` — code improvement without new features
- `chore:` — configuration, deps

---

*Built for the Meme'd take-home assignment. Questions? Reach out at hiring@wldd.in*
