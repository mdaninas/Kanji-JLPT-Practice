# Kanji App for JLPT

Kanji Study is a web app for practicing JLPT kanji. Choose the characters you want to study, draw relevant vocabulary, and use Claude to generate reading questions in sentence context.

![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-API-E36002?style=flat-square)
![Anthropic](https://img.shields.io/badge/Claude-AI-191919?style=flat-square)

The app loads 2,211 kanji from JLPT N5 to N1 and 7,307 vocabulary entries per language. Vocabulary is available for 1,768 of those characters.

## Features

- Browse up to 18 kanji per page and search by character, meaning, or reading.
- Filter the collection by JLPT level and build a study deck of up to 10 kanji.
- Draw random vocabulary from your deck, with optional JLPT level preferences.
- Generate up to 10 reading questions with Claude Sonnet, Opus, or Haiku.
- Practice with flashcards and Japanese audio.
- Explore stroke order animations and radical breakdowns from KanjiVG.
- Review kanji with spaced repetition, check daily statistics, and export or import progress as JSON.
- Choose English or Indonesian, switch between light and dark themes, and install the app as a progressive web app.

## Run locally

Use Node.js 20.19 or later in the 20.x series, or Node.js 22.12 or later.

Install the dependencies and copy the environment template.

```bash
npm install
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` in `.env` to enable quiz generation.

Start the API and frontend in separate terminals.

```bash
# Terminal 1
npm run api

# Terminal 2
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | For quiz generation | — | Authenticates requests to Claude |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Default model for quiz requests |
| `APP_ORIGIN` | No | `http://127.0.0.1:5173` | Allowed origin for cross-origin API requests |
| `HOST` | No | `127.0.0.1` | Local API host |
| `PORT` | No | `8787` | Local API port |
| `UPSTASH_REDIS_REST_URL` | On Vercel | — | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | On Vercel | — | Upstash Redis access token |
| `QUIZ_DAILY_LIMIT` | No | `300` | Global daily quiz request limit when using Upstash |
| `ALLOWED_MODELS` | No | All supported models | Comma-separated list of models clients can select |

The quiz API allows 10 requests per minute per IP. Local development can use an in-memory limiter. For a Vercel deployment, configure Upstash Redis in the project environment variables.

## Architecture

The React frontend sends vocabulary to the Hono API at `/api/generate-reading-quiz`. The API calls Claude and validates the generated questions before returning them. During local development, Vite proxies `/api` to `http://127.0.0.1:8787`. On Vercel, the frontend and API share an origin.

## Stack

- React 19, Vite 7, and CSS custom properties for the frontend.
- Hono and `@hono/node-server` for the local API, with a Vercel serverless entry point for deployment.
- Anthropic SDK for reading quizzes and Upstash Redis for production rate limiting.
- Vitest for tests.
- JSON for kanji data and CSV for vocabulary, prepared with a Python notebook in a separate Conda environment.

## Folder layout

```text
api/                 Vercel serverless entry point
server/              Local server and shared API logic
public/              App icons, image assets, and service worker
src/
  components/        React components, including quiz views
  hooks/             Progress, statistics, and persistence hooks
  utils/             Utility functions
  styles/            Design tokens and styles
Data/
  Kanji/             Kanji JSON files by JLPT level
  Vocabulary/        Vocabulary CSV files by language
Preprocessing/       Optional data preparation notebook
```

## Tests

```bash
npm test
```

## Troubleshooting

### Quiz generation fails

- When running locally, check that `npm run api` is running and that `.env` contains a valid Anthropic API key.
- For an HTTP 429 response, wait for the time indicated by the `Retry-After` header.
- On Vercel, check the Anthropic and Upstash environment variables and review the function logs.

### Vocabulary appears in the wrong language

Check the files in `Data/Vocabulary/English/` and `Data/Vocabulary/Indonesian/`. The CSV parser reads columns by position, so keep the kanji, reading, and translation columns in that order.

### The Vercel build fails

Check that import paths match the exact capitalization of their filenames. The Vercel build runs on a case-sensitive filesystem.

## Author

Muhammad Dani Nasution

- [LinkedIn](https://www.linkedin.com/in/muhammad-dani-nasution)
- [Instagram (@danasty29)](https://www.instagram.com/danasty29)
