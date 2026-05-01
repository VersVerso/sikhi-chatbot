# Sikhi Learning Chatbot (MVP)

MVP web chatbot for Sikhi learning with RAG over SGGS (Gurmukhi) PDF.

## Features

- **Chat UI** (Next.js)
  - Mode toggle: **Quick** / **Deep**
  - Language selector: **Deutsch** / **English**
  - Optional YouTube-source toggle (disabled by default)
- **Backend RAG API** (`/api/chat`)
  - Uses only SGGS PDF chunks by default
  - Retrieves top-k chunks, expands context with neighboring chunks/pages, and tries to include whole-passage context via shabad heuristics
  - Returns answer with mandatory citations (`page` + original `gurmukhiExcerpt`)
  - Low confidence handling (asks for clarification)
- **Prompting behavior**
  - No literal word-for-word translation
  - Uses **Erläuterung/Interpretation** framing
- **Ops**
  - `.env.example`
  - `docker-compose.yml` for Qdrant vector DB
  - Ingest script for PDF download/local path support
- **Basic abuse prevention**
  - In-memory rate limiting on chat endpoint

## Tech Stack

- Next.js (App Router, TypeScript)
- OpenAI API (embeddings + generation)
- Qdrant (vector DB)

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

```bash
cp .env.example .env.local
```

Fill at least:

- `OPENAI_API_KEY`
- (optional) `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`
- (optional) `ALLOW_YOUTUBE_SOURCES=false` (default)

### 3) Start Qdrant

```bash
docker compose up -d
```

### 4) Ingest SGGS PDF

By default, ingest downloads:
`https://www.sikhnet.com/files/ereader/SGGS%20%5BGurmukhi%5D.pdf`

```bash
npm run ingest:sggs
```

Optional local PDF path:

```bash
node scripts/ingest-sggs.mjs --pdf /absolute/path/to/SGGS.pdf
```

Optional page range:

```bash
node scripts/ingest-sggs.mjs --from 1 --to 250
```

### 5) Run the app

```bash
npm run dev
```

Open http://localhost:3000

## API

### `POST /api/chat`

Request body:

```json
{
  "question": "What is the deeper meaning of Naam?",
  "mode": "deep",
  "language": "de",
  "allowYouTube": false
}
```

Response body:

```json
{
  "answer": "Erläuterung/Interpretation: ...",
  "citations": [
    {
      "page": 123,
      "gurmukhiExcerpt": "...",
      "source": "SGGS_PDF"
    }
  ],
  "confidence": 0.71
}
```

## Quality / Validation

- Lint: `npm run lint`
- Build: `npm run build`
- Focused tests: `npm test`

## Deployment Notes

- Works on standard Next.js deployment targets (e.g., Vercel, Node host).
- Ensure runtime can access Qdrant (`QDRANT_URL`) and OpenAI API.
- Keep `ALLOW_YOUTUBE_SOURCES=false` unless implementing/admin-configuring whitelist support.

## Important Behavior Guarantees

- No fabricated SGGS citations should be produced.
- If retrieval confidence is low, endpoint asks for clarification instead of pretending certainty.
- Output is explanation/interpretation-focused, not literal translation.
