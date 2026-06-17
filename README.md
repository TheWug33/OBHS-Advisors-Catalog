# OBHS Class Advisor Catalog

A living resource catalog for Old Bridge High School Class Advisors. Data is pulled live from Google Sheets — update the sheet, refresh the site.

## Setup

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
3. Vercel auto-detects Vite — just click **Deploy**
4. Done! You'll get a live URL like `obhs-advisor-catalog.vercel.app`

## Updating Content

All content lives in the Google Sheet. To add or edit tasks:
1. Open the Google Sheet
2. Edit any row (month, title, description, notes)
3. Changes appear on the site within a minute — no code needed

## Sheet Format

Each tab (Freshmen, Sophomores, Juniors, Seniors) needs these columns in Row 1:
```
id | month | title | description | notes
```
