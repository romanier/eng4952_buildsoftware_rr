# Streaks: Habit Tracker

A simple web app for tracking daily habits. Create an account, add habits, and tick off each day of the week. Each habit shows its current streak.

**Live app:** (https://rainbow-baklava-d725b7.netlify.app/)
**Demo video:** https://youtu.be/YOUR-VIDEO-ID

## What the app does

- Register, log in, and log out (Supabase Auth)
- **Create** habits
- **Read** your habits and a week-by-week grid of completed days, plus a running streak
- **Update** a habit's name, and tick or untick any past day
- **Delete** a habit and its history
- Each user only sees their own data (Row Level Security in the database)

## Technologies used

- HTML, CSS, and vanilla JavaScript (no build step)
- [Supabase](https://supabase.com): Postgres database and authentication
- Built with AI assistance (Claude)
- GitHub for version control, Netlify for hosting

## Project structure

```
index.html   page markup (login screen + app screen)
style.css    styling
app.js       auth, CRUD calls to Supabase, rendering
config.js    Supabase URL and public anon key
schema.sql   database tables and security policies
```

## Setup instructions

1. **Create a Supabase project** at supabase.com (free tier).
2. Open **SQL Editor**, paste the contents of `schema.sql`, and run it.
3. (Optional, easier testing) Go to **Authentication > Providers > Email** and turn off "Confirm email".
4. Go to **Project Settings > API**, copy the **Project URL** and **anon public key**, and paste them into `config.js`.
5. Open `index.html` in a browser, or run a local server: `python3 -m http.server 8000` and visit http://localhost:8000.
6. To deploy: push this folder to GitHub, then on Netlify choose **Add new site > Import from Git** (no build command, publish directory `/`). Or drag the folder onto app.netlify.com/drop.
7. In Supabase go to **Authentication > URL Configuration** and add your Netlify URL as the Site URL.

## Database

| Table | Columns |
|---|---|
| `habits` | id, user_id, name, created_at |
| `habit_logs` | id, habit_id, user_id, log_date (unique per habit and day) |
