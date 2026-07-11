import fs from "fs";
import path from "path";

// Define TypeScript interfaces for our database records
export interface User {
  username: string;
  passwordHash: string;
  salt: string;
}

export interface Score {
  username: string;
  time: number; // completed in seconds
  difficulty: "easy" | "medium" | "hard";
  date: string; // ISO string
}

export interface LiveStatus {
  soundToPlay: string | null;
  soundTimestamp: number;
  announcement: string | null;
  announcementTimestamp: number;
}

interface DbSchema {
  users: Record<string, User>;
  scores: Record<string, Score[]>;
  liveStatus: LiveStatus;
}

const DB_FILE = path.join(process.cwd(), "db.json");

// Helper to check if Vercel KV is configured
const isKvConfigured = () => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

// Vercel KV Fetch Client (raw REST API calls to avoid package installation overhead)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function kvFetch(command: string[]): Promise<any> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Vercel KV is not configured");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`KV API Error: ${response.statusText} - ${errText}`);
  }

  const data = await response.json();
  return data.result;
}

const INITIAL_STATUS: LiveStatus = {
  soundToPlay: null,
  soundTimestamp: 0,
  announcement: null,
  announcementTimestamp: 0,
};

// Local File DB Helper
function readLocalDb(): DbSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initial: DbSchema = { users: {}, scores: { easy: [], medium: [], hard: [] }, liveStatus: INITIAL_STATUS };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    
    // Ensure liveStatus is initialized
    if (!parsed.liveStatus) {
      parsed.liveStatus = INITIAL_STATUS;
    }
    return parsed;
  } catch (error) {
    console.error("Error reading local db, resetting it", error);
    const initial: DbSchema = { users: {}, scores: { easy: [], medium: [], hard: [] }, liveStatus: INITIAL_STATUS };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

// Safe write utility to make sure the data folder/file exists
function writeLocalDb(data: DbSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Core DB operations
export async function getUser(username: string): Promise<User | null> {
  const normUsername = username.toLowerCase().trim();
  if (isKvConfigured()) {
    try {
      const userData = await kvFetch(["GET", `user:${normUsername}`]);
      if (!userData) return null;
      return typeof userData === "string" ? JSON.parse(userData) : userData;
    } catch (e) {
      console.error("KV error in getUser, falling back to local:", e);
      const db = readLocalDb();
      return db.users[normUsername] || null;
    }
  } else {
    const db = readLocalDb();
    return db.users[normUsername] || null;
  }
}

export async function createUser(user: User): Promise<void> {
  const normUsername = user.username.toLowerCase().trim();
  if (isKvConfigured()) {
    try {
      await kvFetch(["SET", `user:${normUsername}`, JSON.stringify(user)]);
    } catch (e) {
      console.error("KV error in createUser, falling back to local:", e);
      const db = readLocalDb();
      db.users[normUsername] = user;
      writeLocalDb(db);
    }
  } else {
    const db = readLocalDb();
    db.users[normUsername] = user;
    writeLocalDb(db);
  }
}

export async function getScores(difficulty: "easy" | "medium" | "hard"): Promise<Score[]> {
  if (isKvConfigured()) {
    try {
      const scoresData = await kvFetch(["GET", `scores:${difficulty}`]);
      if (!scoresData) return [];
      const list = typeof scoresData === "string" ? JSON.parse(scoresData) : scoresData;
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.error("KV error in getScores, falling back to local:", e);
      const db = readLocalDb();
      return db.scores[difficulty] || [];
    }
  } else {
    const db = readLocalDb();
    return db.scores[difficulty] || [];
  }
}

export async function addScore(score: Score): Promise<void> {
  const { difficulty } = score;
  if (isKvConfigured()) {
    try {
      const current = await getScores(difficulty);
      current.push(score);
      current.sort((a, b) => a.time - b.time);
      const top100 = current.slice(0, 100);
      await kvFetch(["SET", `scores:${difficulty}`, JSON.stringify(top100)]);
    } catch (e) {
      console.error("KV error in addScore, falling back to local:", e);
      const db = readLocalDb();
      if (!db.scores[difficulty]) {
        db.scores[difficulty] = [];
      }
      db.scores[difficulty].push(score);
      db.scores[difficulty].sort((a, b) => a.time - b.time);
      db.scores[difficulty] = db.scores[difficulty].slice(0, 100);
      writeLocalDb(db);
    }
  } else {
    const db = readLocalDb();
    if (!db.scores[difficulty]) {
      db.scores[difficulty] = [];
    }
    db.scores[difficulty].push(score);
    db.scores[difficulty].sort((a, b) => a.time - b.time);
    db.scores[difficulty] = db.scores[difficulty].slice(0, 100);
    writeLocalDb(db);
  }
}

// Live Status endpoints (Developer soundboard / announcements)
export async function getLiveStatus(): Promise<LiveStatus> {
  if (isKvConfigured()) {
    try {
      const statusData = await kvFetch(["GET", "dev:live-status"]);
      if (!statusData) return INITIAL_STATUS;
      return typeof statusData === "string" ? JSON.parse(statusData) : statusData;
    } catch (e) {
      console.error("KV error in getLiveStatus, falling back to local:", e);
      const db = readLocalDb();
      return db.liveStatus || INITIAL_STATUS;
    }
  } else {
    const db = readLocalDb();
    return db.liveStatus || INITIAL_STATUS;
  }
}

export async function updateLiveStatus(newStatus: Partial<LiveStatus>): Promise<void> {
  if (isKvConfigured()) {
    try {
      const current = await getLiveStatus();
      const updated = { ...current, ...newStatus };
      await kvFetch(["SET", "dev:live-status", JSON.stringify(updated)]);
    } catch (e) {
      console.error("KV error in updateLiveStatus, falling back to local:", e);
      const db = readLocalDb();
      db.liveStatus = { ...db.liveStatus, ...newStatus };
      writeLocalDb(db);
    }
  } else {
    const db = readLocalDb();
    db.liveStatus = { ...db.liveStatus, ...newStatus };
    writeLocalDb(db);
  }
}
