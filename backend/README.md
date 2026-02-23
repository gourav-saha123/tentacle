# Tentacle Backend (Express + MongoDB + Mistral)

## Setup

1. Copy env:
   - `cp .env.example .env`
2. Fill:
   - `MONGODB_URL`
   - `SECRET_KEY`
   - `MISTRAL_API_KEY`
3. Install and run:
   - `npm install`
   - `npm run dev`

Server: `http://localhost:4000`

## Auth

- `POST /api/auth/register` `{ name, email, password }`
  - Creates user + auto-creates the `Tentacle` assistant
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Auth: `Authorization: Bearer <token>` or `token` cookie.

## Chat (Tentacle assistant)

- `GET /api/chat/assistant`
- `POST /api/chat/sessions` `{ title? }`
  - Creates a new session and returns the first assistant question
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:sessionId`
- `POST /api/chat/sessions/:sessionId/messages` `{ content }`
  - Auto-closes when `CHAT_MAX_MESSAGES` reached
- `POST /api/chat/sessions/:sessionId/close`
  - Extracts 1–3 topics and stores semantic memory

## Memory

- `GET /api/memory/topics`
  - Lists your extracted long-term topics (`title`, `description`)

## Groups / Posts / Comments / Likes

- `GET /api/groups`
- `POST /api/groups` `{ name, description? }`
- `GET /api/groups/recommended`
  - Matches your memory topics against group embeddings (cosine similarity)
- `POST /api/groups/:groupId/join`
- `POST /api/groups/:groupId/leave`
- `GET /api/groups/:groupId/posts`
- `POST /api/groups/:groupId/posts` `{ title?, content }`
- `POST /api/groups/:groupId/posts/:postId/like`
- `GET /api/groups/:groupId/posts/:postId/comments`
- `POST /api/groups/:groupId/posts/:postId/comments` `{ content, parentCommentId? }`
- `POST /api/groups/:groupId/posts/:postId/comments/:commentId/like`

## Feed

- `GET /api/feed`
- `GET /api/feed/groups`
- `GET /api/feed/posts/:postId`

## Matching

- `GET /api/match/users?limit=20`
  - Recommends similar users based on aggregated topic vectors

