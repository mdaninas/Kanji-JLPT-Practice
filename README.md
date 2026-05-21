# JLPT Kanji Question Generator

A local web app for studying JLPT kanji, drawing vocabulary, and generating kanji reading quizzes. The app supports English and Indonesian, and the vocabulary data follows the language selected on the page.

## English

### Features

- Browse JLPT kanji from N5 to N1.
- Select up to 10 kanji for a focused study deck.
- Draw random vocabulary from the selected kanji.
- Switch between English and Indonesian vocabulary meanings.
- Generate kanji reading quiz questions with Anthropic Claude.
- Run the frontend and API server locally.

### Tech Stack

- React
- Vite
- Node.js HTTP server
- Anthropic SDK
- Local CSV and JSON data files

### Requirements

- Node.js `20.19.0` or newer, or Node.js `22.12.0` or newer.
- npm.
- An Anthropic API key for quiz generation.

### Setup

Install JavaScript dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Do not commit your `.env` file. It contains a private API key.

### Environment Variables

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | None | API key used by the local quiz API server. |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Default Claude model. Must be one of: `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5-20251001`. |
| `HOST` | No | `127.0.0.1` | Host for the local API server. |
| `PORT` | No | `8787` | Port for the local API server. |
| `APP_ORIGIN` | No | `http://127.0.0.1:5173` | Frontend origin allowed by the API server. |

The quiz modal has a **Model** picker so you can override the default per request — choose Sonnet 4.6 (balanced), Opus 4.7 (best quality), or Haiku 4.5 (fastest). Your choice is saved to `localStorage` and reused next time. `GET /api/health` returns the active default model and, when an API key is configured, the list of supported models.

### Running Locally

Open two terminals from the project folder.

Terminal 1: start the API server.

```bash
npm run api
```

The API runs at:

```text
http://127.0.0.1:8787
```

Terminal 2: start the frontend.

```bash
npm run dev
```

Open the app in your browser:

```text
http://127.0.0.1:5173
```

The Vite dev server proxies `/api` requests to `http://127.0.0.1:8787`.

### Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Optional Python Notebook Environment

The main app uses Node.js. The Conda environment is only for preprocessing notebooks, such as files inside `Preprocessing/`.

Create the Conda environment:

```bash
conda env create -f environment.yml
conda activate kanji-app
```

Then open and run the notebook manually.

### Project Structure

```text
Data/
  Kanji/                 JLPT kanji JSON data
  Vocabulary/            Vocabulary CSV data
    English/             English vocabulary meanings
    Indonesian/          Indonesian vocabulary meanings
Preprocessing/           Data preprocessing notebooks
server/                  Local quiz generation API server
src/                     React frontend
dist/                    Production build output
```

### Troubleshooting

If quiz generation fails:

- Make sure `npm run api` is running.
- Make sure `.env` contains a valid `ANTHROPIC_API_KEY`.
- Make sure the frontend is opened from `http://127.0.0.1:5173`.
- If you changed `PORT`, update the proxy target in `vite.config.js`.

If vocabulary does not match the selected language:

- Check `Data/Vocabulary/English/`.
- Check `Data/Vocabulary/Indonesian/`.
- Make sure the CSV files contain `Kanji`, `Reading`, and the translation column.

## Bahasa Indonesia

### Fitur

- Melihat data kanji JLPT dari N5 sampai N1.
- Memilih maksimal 10 kanji untuk deck belajar yang fokus.
- Mengambil vocabulary random dari kanji yang dipilih.
- Mengganti arti vocabulary antara Bahasa Inggris dan Bahasa Indonesia.
- Generate soal latihan membaca kanji menggunakan Anthropic Claude.
- Menjalankan frontend dan API server secara lokal.

### Teknologi

- React
- Vite
- Node.js HTTP server
- Anthropic SDK
- Data lokal dari file CSV dan JSON

### Kebutuhan

- Node.js `20.19.0` atau lebih baru, atau Node.js `22.12.0` atau lebih baru.
- npm.
- Anthropic API key untuk fitur generate quiz.

### Setup

Install dependency JavaScript:

```bash
npm install
```

Buat file `.env` di root project:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Jangan commit file `.env` karena file ini berisi API key pribadi.

### Environment Variables

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Ya | Tidak ada | API key untuk server quiz lokal. |
| `ANTHROPIC_MODEL` | Tidak | `claude-sonnet-4-6` | Model Claude default. Harus salah satu dari: `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5-20251001`. |
| `HOST` | Tidak | `127.0.0.1` | Host untuk API server lokal. |
| `PORT` | Tidak | `8787` | Port untuk API server lokal. |
| `APP_ORIGIN` | Tidak | `http://127.0.0.1:5173` | Origin frontend yang diizinkan oleh API server. |

Di modal quiz tersedia pilihan **Model** sehingga kamu bisa override default per-request — pilih Sonnet 4.6 (balanced), Opus 4.7 (best quality), atau Haiku 4.5 (fastest). Pilihan disimpan ke `localStorage` dan dipakai lagi nanti. `GET /api/health` mengembalikan model default aktif dan, jika API key sudah dikonfigurasi, daftar model yang didukung.

### Cara Menjalankan

Buka dua terminal dari folder project.

Terminal 1: jalankan API server.

```bash
npm run api
```

API berjalan di:

```text
http://127.0.0.1:8787
```

Terminal 2: jalankan frontend.

```bash
npm run dev
```

Buka app di browser:

```text
http://127.0.0.1:5173
```

Vite akan meneruskan request `/api` ke `http://127.0.0.1:8787`.

### Build

Buat production build:

```bash
npm run build
```

Preview production build secara lokal:

```bash
npm run preview
```

### Environment Conda Opsional untuk Notebook

App utama menggunakan Node.js. Environment Conda hanya untuk notebook preprocessing, misalnya file di dalam folder `Preprocessing/`.

Buat environment Conda:

```bash
conda env create -f environment.yml
conda activate kanji-app
```

Setelah itu, buka dan jalankan notebook secara manual.

### Struktur Project

```text
Data/
  Kanji/                 Data kanji JLPT dalam format JSON
  Vocabulary/            Data vocabulary dalam format CSV
    English/             Arti vocabulary Bahasa Inggris
    Indonesian/          Arti vocabulary Bahasa Indonesia
Preprocessing/           Notebook untuk preprocessing data
server/                  API server lokal untuk generate quiz
src/                     Frontend React
dist/                    Output production build
```

### Troubleshooting

Jika generate quiz gagal:

- Pastikan `npm run api` sedang berjalan.
- Pastikan `.env` berisi `ANTHROPIC_API_KEY` yang valid.
- Pastikan frontend dibuka dari `http://127.0.0.1:5173`.
- Jika `PORT` diubah, sesuaikan juga proxy di `vite.config.js`.

Jika vocabulary tidak mengikuti bahasa yang dipilih:

- Cek folder `Data/Vocabulary/English/`.
- Cek folder `Data/Vocabulary/Indonesian/`.
- Pastikan file CSV memiliki kolom `Kanji`, `Reading`, dan kolom terjemahan.

## Author

Muhammad Dani Nasution

- LinkedIn: [muhammad-dani-nasution](https://www.linkedin.com/in/muhammad-dani-nasution)
- Instagram: [@danasty29](https://www.instagram.com/danasty29)
