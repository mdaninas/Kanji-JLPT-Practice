# Kanji App For JLPT

Web app sederhana buat belajar kanji JLPT. Pilih level, pilih kanji, ambil vocab, lalu generate soal reading pakai Claude.

**Live demo:** deployment saat ini tidak tersedia (404 per 14 Sep 2026). Jalankan lokal atau deploy ulang ke Vercel.

![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-API-E36002?style=flat-square)
![Anthropic](https://img.shields.io/badge/Claude-AI-191919?style=flat-square)

---

## Bahasa Indonesia

Awalnya saya bikin ini karena kesel — aplikasi belajar kanji yang ada biasanya cuma kasih daftar, atau quiz acak yang nggak nyambung sama kanji yang lagi dipelajari. Akhirnya saya bikin sendiri: pilih kanji sendiri, ambil vocab yang relevan, lalu Claude bantu bikin soal reading dari konteks kalimat.

Dataset: 2.211 kanji dari N5 sampai N1, sekitar 8.500 vocab per bahasa (Indonesia & English). Sekitar 443 kanji belum punya entri vocab di dataset saat ini.

### Apa yang bisa dilakukan

- Browse kanji N5–N1, search berdasarkan karakter/arti/reading
- Pilih sampai 10 kanji untuk satu deck belajar
- Ambil vocab random dari kanji yang dipilih (filter level JLPT)
- Generate 10 soal reading pakai Claude (Sonnet / Opus / Haiku — bisa pilih)
- Flashcard mode dengan audio Jepang
- Track progress per kanji (SRS sederhana), statistik harian, export/import progress JSON
- Stroke order animasi + breakdown radikal dari KanjiVG
- Dark/light mode, bilingual UI, PWA (bisa di-install)

### Pakai langsung

Demo live saat ini mati (404). Untuk pakai app, jalankan lokal atau deploy sendiri. Quota quiz dibatasi 10 per menit per IP biar budget Claude nggak jebol.

### Jalanin lokal

Butuh Node.js 20.19+ atau 22.12+.

```bash
npm install
```

Salin env contoh lalu isi API key:

```bash
cp .env.example .env
```

Isi minimal:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Buka dua terminal:

```bash
# Terminal 1 — API server
npm run api

# Terminal 2 — frontend
npm run dev
```

Buka `http://127.0.0.1:5173`. Selesai.

### Environment variables

| Nama | Wajib? | Default | Buat apa |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Ya | — | Bikin soal quiz |
| `ANTHROPIC_MODEL` | Tidak | `claude-sonnet-4-6` | Model default kalau user nggak pilih |
| `APP_ORIGIN` | Tidak | `http://127.0.0.1:5173` | CORS whitelist untuk frontend |
| `HOST` | Tidak | `127.0.0.1` | Host API server lokal |
| `PORT` | Tidak | `8787` | Port API server lokal |
| `UPSTASH_REDIS_REST_URL` | **Wajib di production** | — | Rate limit di production (Upstash Redis) |
| `UPSTASH_REDIS_REST_TOKEN` | **Wajib di production** | — | Token Upstash |
| `ALLOWED_MODELS` | Tidak | semua model didukung | Batasi model yang boleh dipilih klien (mis. `claude-sonnet-4-6,claude-haiku-4-5-20251001`) |

Di production (Vercel), set Upstash — limiter in-memory tidak efektif di serverless. Untuk dev lokal, fallback in-memory cukup.

### Arsitektur singkat

Browser (React) → API Hono (`/api/generate-reading-quiz`) → Anthropic Claude → respons divalidasi server sebelum dikirim ke klien. Dev lokal mem-proxy `/api` lewat Vite ke `npm run api`; quiz tidak bergantung pada `APP_ORIGIN` untuk same-origin.

### Stack

- **Frontend:** React 19, Vite 7, plain CSS dengan custom properties
- **API:** Hono, deploy sebagai Vercel Serverless Functions (lokal pakai `@hono/node-server`)
- **AI:** Anthropic SDK
- **Rate limit:** Upstash Redis di prod, in-memory di dev
- **Test:** Vitest
- **Data:** JSON kanji + CSV vocab, preprocessing pakai notebook Python (Conda env terpisah)

### Struktur folder

```
api/                 Entry point Vercel Serverless
server/              Server lokal + business logic (di-share dengan api/)
src/
  components/        Komponen React
    quiz/            Pecahan QuizModal
  hooks/             Custom hooks (progress, stats, persistence, dll)
  utils/             Utility functions
  styles/            Design tokens
Data/
  Kanji/             JSON kanji per level JLPT
  Vocabulary/        CSV vocab, per bahasa
Preprocessing/       Notebook preprocessing (opsional, butuh Conda)
```

### Test

```bash
npm test
```

### Troubleshooting

**Quiz gagal generate**
- Pastikan `npm run api` jalan dan `.env` punya API key valid.
- Cek tab Network di browser — kalau 429, kena rate limit, tunggu 1 menit.
- Dev lokal: Vite mem-proxy `/api` ke server lokal; `APP_ORIGIN` tidak memengaruhi quiz same-origin ini.
- Production: frontend dan API same-origin di Vercel; `APP_ORIGIN` hanya untuk klien cross-origin. Cek `ANTHROPIC_API_KEY`, Upstash, dan log Vercel.

**Vocab nggak ikut bahasa**
- Cek file CSV di `Data/Vocabulary/English/` dan `Data/Vocabulary/Indonesian/`.
- Parser memakai **posisi kolom** (kanji, reading, terjemahan), bukan nama header.

**Build error di Vercel**
- Biasanya path import case-sensitive. Windows nggak peka case, Linux peka. Cek import path.

---

## English

I built this because most kanji study apps either dump a long list at you or throw random quiz questions that don't connect to what you're currently studying. So I made one where you pick the kanji yourself, pull relevant vocab, and Claude generates reading questions from sentence context.

Dataset: 2,211 kanji from N5 to N1, about 8,500 vocab entries per language (Indonesian & English). Roughly 443 kanji currently have no vocab entries in the dataset.

### What it does

- Browse N5–N1 kanji, search by character / meaning / reading
- Pick up to 10 kanji for one study deck
- Pull random vocab from selected kanji (filtered by JLPT level)
- Generate 10 reading questions with Claude (Sonnet / Opus / Haiku — your pick)
- Flashcard mode with Japanese audio
- Track per-kanji progress (simple SRS), daily stats, export/import progress as JSON
- Stroke order animation + radical breakdown via KanjiVG
- Dark/light mode, bilingual UI, PWA installable

### Just use it

The live demo is currently unavailable (404 as of 14 Sep 2026). Run locally or redeploy. Quiz endpoint is capped at 10 requests per minute per IP so I don't blow my Claude budget.

### Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
```

Copy the example env file and fill in your API key:

```bash
cp .env.example .env
```

Minimum:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Two terminals:

```bash
# Terminal 1 — API server
npm run api

# Terminal 2 — frontend
npm run dev
```

Open `http://127.0.0.1:5173`. Done.

### Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Quiz generation |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Default model if user doesn't pick |
| `APP_ORIGIN` | No | `http://127.0.0.1:5173` | CORS whitelist |
| `HOST` | No | `127.0.0.1` | Local API host |
| `PORT` | No | `8787` | Local API port |
| `UPSTASH_REDIS_REST_URL` | **Required in production** | — | Production rate limiting (Upstash Redis) |
| `UPSTASH_REDIS_REST_TOKEN` | **Required in production** | — | Upstash token |
| `ALLOWED_MODELS` | No | all supported models | Restrict client-selectable models |

In production (Vercel), configure Upstash — in-memory limiting is ineffective on serverless. In-memory fallback is fine for local dev.

### Architecture (short)

Browser (React) → Hono API (`/api/generate-reading-quiz`) → Anthropic Claude → server validates the response before returning it to the client. Local dev proxies `/api` through Vite to `npm run api`; quizzes do not depend on `APP_ORIGIN` for same-origin use.

### Stack

- **Frontend:** React 19, Vite 7, plain CSS with custom properties
- **API:** Hono, deployed as Vercel Serverless Functions (local uses `@hono/node-server`)
- **AI:** Anthropic SDK
- **Rate limiting:** Upstash Redis in prod, in-memory in dev
- **Tests:** Vitest
- **Data:** JSON for kanji, CSV for vocab, preprocessed with a Python notebook (separate Conda env)

### Folder layout

```
api/                 Vercel Serverless entry point
server/              Local server + shared business logic
src/
  components/        React components
    quiz/            QuizModal split
  hooks/             Custom hooks (progress, stats, persistence, etc.)
  utils/             Utility functions
  styles/            Design tokens
Data/
  Kanji/             Kanji JSON per JLPT level
  Vocabulary/        Vocab CSV per language
Preprocessing/       Preprocessing notebooks (optional, needs Conda)
```

### Tests

```bash
npm test
```

### Troubleshooting

**Quiz generation fails**
- Make sure `npm run api` is running and `.env` has a valid API key.
- Check the Network tab — if it's 429, you hit the rate limit, wait a minute.
- Local dev: Vite proxies `/api` to the local server; `APP_ORIGIN` does not affect this same-origin quiz path.
- Production: frontend and API are same-origin on Vercel; `APP_ORIGIN` is only for cross-origin clients. Check `ANTHROPIC_API_KEY`, Upstash, and Vercel logs.

**Vocab not following selected language**
- Check `Data/Vocabulary/English/` and `Data/Vocabulary/Indonesian/`.
- The parser uses **column position** (kanji, reading, translation), not header names.

**Vercel build fails**
- Usually an import path case sensitivity issue. Windows is case-insensitive, Linux isn't.

---

## Author

Muhammad Dani Nasution

- LinkedIn: [muhammad-dani-nasution](https://www.linkedin.com/in/muhammad-dani-nasution)
- Instagram: [@danasty29](https://www.instagram.com/danasty29)
