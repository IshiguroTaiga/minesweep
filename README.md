# 💣 Neon Minesweeper - Full Stack Web Game

A full-stack, responsive Minesweeper game built with Next.js (App Router) and TypeScript. It features a modern dark-light purple cyberpunk theme, in-browser procedural audio synthesis, secure user authentication, and multi-difficulty leaderboards.

---

## 🌟 Core Features

* **Glassmorphic Purple UI**: Sleek dark-light purple glowing grid systems optimized for both desktop and mobile tapping.
* **Rainbow GameOver Flash**: Screen-shaking retro arcade flashes immediately upon hitting a mine.
* **Hybrid Audio Engine**:
  * **Static Files Support**: Drop custom sound files in the assets directory to play your own soundtracks.
  * **Procedural Synthesis Fallback**: If custom audio is missing or fails to load, the game dynamically synthesizes ambient chord loops, click pops, flag sweeps, lowpass explosions, and victory fanfares in-browser using the Web Audio API.
* **Developer Control Panel**: Exclusive controls for the developer account **`Ishi`** to broadcast announcements (which glide slowly from the top of all players' screens) and play soundboard alerts in real-time.
* **Difficulty Leaderboards**: High-score tracking for Easy (9x9), Medium (16x16), and Hard (30x16) completed games, sorted by fastest completion times.

---

## 🚀 How to Deploy on Vercel

Since this project is built for direct cloud deployment using Next.js and Vercel serverless adapters, follow these steps to deploy:

### Step 1: Create a Vercel KV Database
1. Go to the [Vercel Dashboard](https://vercel.com) and navigate to the **Storage** tab.
2. Select **KV (Redis)** and click **Create** to launch a free serverless Redis database.

### Step 2: Link the Repository
1. Import your GitHub repository (`IshiguroTaiga/minesweep`) into a new Vercel project.
2. Under your project's **Storage** settings, click **Link** and select the KV database you created in Step 1. Vercel will automatically inject the following environment variables:
   * `KV_REST_API_URL`
   * `KV_REST_API_TOKEN`

### Step 3: Add Session Secret
1. Go to your project's **Settings ➔ Environment Variables**.
2. Add a new variable:
   * **Key**: `SESSION_SECRET`
   * **Value**: *[Any long random string of your choice]*
3. Click **Add**.

### Step 4: Deploy
1. Click **Deploy**. Vercel will automatically build the project, optimize the routes, and launch your game.
2. The production URL (e.g. `minesweep.vercel.app`) will automatically update with every future commit pushed to your GitHub `main` branch.

---

## 🎵 Custom Sound Assets
To play custom background music or sounds, simply upload your audio files into the `public/audio` folder. The engine will play them automatically if they are named exactly as shown:

* `bgm.mp3` — Background gameplay music loop
* `victory.mp3` — Sound played upon successfully completing a game
* `explode.mp3` — Sound played upon hitting a mine (Game Over)
* `click.mp3` — Subtle tick sound when digging safe cells
* `flag.mp3` — Double-chirp sound when placing a flag

---

## 🛡️ Developer Control Credentials
As the game developer, you can log in with:
* **Username**: `Ishi`
* **Password**: `Ishi123`

Logging in automatically exposes the **Developer Broadcast Console** at the bottom of the page, allowing you to trigger real-time sound effects and glide messages down from the top of the screens of all active players.
