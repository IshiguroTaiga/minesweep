# Minesweeper :>

A modern, responsive, full-stack web-based Minesweeper game built with a glassmorphic cyberpunk aesthetic, in-browser procedural audio synthesis, secure user authentication, and real-time difficulty-specific leaderboards.

---

## ✨ Features

* **Glassmorphic Cyberpunk Visuals**: A gorgeous dark-light purple neon theme featuring animated glowing cell hovers, retro-digital LED displays, and custom-designed menus.
* **Rainbow GameOver Flash**: A rapid, full-screen color-shifting rainbow flash triggers immediately when a mine explodes, mimicking classic retro arcade cabinet designs.
* **In-Browser Audio Engine**: Synthesizes all background music and sound effects (clicks, flags, explosions, victory chimes, and ambient loops) dynamically in the browser using Web Audio API oscillators, filters, and noise buffers.
* **Responsive Multi-Platform Gameplay**: 
  * Optimizations for both desktop (mouse/right-clicks) and mobile screens (touch gestures).
  * Supports long-press touch haptic flagging, quick-action mode toggles (Dig vs. Flag), and double-tap chording.
* **Global Leaderboards**: Stores and displays the top 100 times for Easy, Medium, and Hard difficulties, complete with custom placement badges (🥇🥈🥉).
* **Real-Time Developer Broadcasts**: Incorporates an exclusive administrative capability to trigger global audio cues and glide text announcements down the screens of all active players simultaneously.

---

## 🎮 How to Play

1. **Dig**: Click (or tap in Dig Mode) to reveal a cell. Your first click is guaranteed to be mine-free and will open a starting safe area.
2. **Flag**: Right-click (or long-press / tap in Flag Mode) to mark suspected mines with a flag.
3. **Chord**: Double-click or double-tap on a revealed number cell to quickly clear all surrounding non-flagged cells once you have placed the matching number of flags.
4. **Win**: Dig all safe cells to successfully complete the game. Log in to register your completion time on the global leaderboard!

---

## 🛠️ Technical Stack

* **Framework**: Next.js (App Router)
* **Frontend**: React, TypeScript, CSS Modules
* **Audio Synthesis**: HTML5 Web Audio API
* **Database & Auth**: Serverless Key-Value (Vercel KV), timing-safe HMAC signatures, and PBKDF2 cryptography.
