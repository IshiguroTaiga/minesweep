"use client";

import { useEffect, useState } from "react";
import Minesweeper from "@/components/Minesweeper";
import Leaderboard from "@/components/Leaderboard";
import AuthModal from "@/components/AuthModal";
import { audioEngine } from "@/components/AudioEngine";
import styles from "./page.module.css";

interface User {
  username: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Live Broadcast States
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null);
  const [devText, setDevText] = useState("");
  const [devStatus, setDevStatus] = useState("");

  // Check user session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser({ username: data.user.username });
          }
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  // Poll for Developer Broadcasts (Every 2.5s)
  useEffect(() => {
    let isFirstFetch = true;
    let lastSndTime = 0;
    let lastAnnTime = 0;
    let annTimeout: ReturnType<typeof setTimeout> | null = null;

    const triggerLocalSound = (sound: string) => {
      audioEngine.init();
      switch (sound) {
        case "laser":
          audioEngine.playLaser();
          break;
        case "coin":
          audioEngine.playCoin();
          break;
        case "airhorn":
          audioEngine.playAirhorn();
          break;
        case "alert":
          audioEngine.playAlert();
          break;
      }
    };

    const showAnnouncement = (text: string) => {
      if (annTimeout) clearTimeout(annTimeout);
      setActiveAnnouncement(text);
      
      // Auto-dismiss after 10 seconds (slides back up)
      annTimeout = setTimeout(() => {
        setActiveAnnouncement(null);
      }, 10000);
    };

    const pollLiveStatus = async () => {
      try {
        const res = await fetch("/api/dev/live-status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.status) {
          const { soundToPlay, soundTimestamp, announcement, announcementTimestamp } = data.status;

          // Prevent historical triggers on page mount
          if (isFirstFetch) {
            lastSndTime = soundTimestamp;
            lastAnnTime = announcementTimestamp;
            isFirstFetch = false;
            if (announcement) {
              showAnnouncement(announcement);
            }
            return;
          }

          // Check for new soundboards
          if (soundTimestamp > lastSndTime) {
            lastSndTime = soundTimestamp;
            if (soundToPlay) {
              triggerLocalSound(soundToPlay);
            }
          }

          // Check for new announcements
          if (announcementTimestamp > lastAnnTime) {
            lastAnnTime = announcementTimestamp;
            if (announcement) {
              showAnnouncement(announcement);
            } else {
              setActiveAnnouncement(null);
            }
          }
        }
      } catch (e) {
        console.error("Live Status Polling Error:", e);
      }
    };

    // Begin Polling Loop
    pollLiveStatus();
    const interval = setInterval(pollLiveStatus, 2500);

    return () => {
      clearInterval(interval);
      if (annTimeout) clearTimeout(annTimeout);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setUser(null);
        setLeaderboardRefresh((prev) => prev + 1);
      }
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const handleAuthSuccess = (username: string) => {
    setUser({ username });
    setLeaderboardRefresh((prev) => prev + 1);
  };

  const triggerLeaderboardRefresh = () => {
    setLeaderboardRefresh((prev) => prev + 1);
  };

  // Developer Control Console functions
  const sendDevTrigger = async (type: "sound" | "announcement" | "clear", value: string) => {
    setDevStatus("Broadcasting...");
    try {
      const res = await fetch("/api/dev/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDevStatus(`Successfully broadcasted: ${type} ${value ? `"${value}"` : ""}`);
        if (type === "announcement") setDevText("");
      } else {
        setDevStatus(`Broadcast failed: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      setDevStatus("Network error broadcasting.");
    } finally {
      setTimeout(() => setDevStatus(""), 4000);
    }
  };

  const isDevUser = user?.username?.toLowerCase() === "ishi";

  return (
    <div className={styles.appContainer}>
      {/* Sliding Broadcast Banner */}
      <div
        className={`${styles.announcementBanner} ${
          activeAnnouncement ? styles.announcementBannerVisible : ""
        }`}
      >
        <span className={styles.announcementIcon}>📢 BROADCAST:</span>
        <span className={styles.announcementText}>{activeAnnouncement || ""}</span>
      </div>

      {/* Navbar Header */}
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <span className={styles.gameIcon}>💣</span>
          <h1 className={styles.logoText}>MINESWEEPER</h1>
        </div>

        <div className={styles.userSection}>
          {checkingAuth ? (
            <span className={styles.checkingText}>Checking session...</span>
          ) : user ? (
            <div className={styles.userInfo}>
              <span className={styles.welcomeText}>
                Player: <strong className={styles.username}>{user.username}</strong>
              </span>
              <button className={styles.logoutBtn} onClick={handleLogout}>
                Log Out
              </button>
            </div>
          ) : (
            <button className={styles.loginBtn} onClick={() => setIsAuthOpen(true)}>
              Sign In / Sign Up
            </button>
          )}
        </div>
      </header>

      {/* Main Content Grid */}
      <main className={styles.mainContent}>
        <div className={styles.gameColumn}>
          <Minesweeper
            user={user}
            onScoreSubmitted={triggerLeaderboardRefresh}
            onAuthRequired={() => setIsAuthOpen(true)}
          />
        </div>

        <div className={styles.leaderboardColumn}>
          <Leaderboard refreshTrigger={leaderboardRefresh} />
        </div>

        {/* Developer Console (Visible only to user 'Ishi') */}
        {isDevUser && (
          <div className={styles.devPanel}>
            <div className={styles.devHeader}>
              <div className={styles.devIndicator} />
              <h3>DEVELOPER LIVE BROADCAST CONSOLE</h3>
            </div>
            
            <div className={styles.devGrid}>
              {/* Soundboard Trigger section */}
              <div className={styles.devSection}>
                <span className={styles.devLabel}>🔊 Global Soundboard (All clients hear)</span>
                <div className={styles.soundboard}>
                  <button className={styles.soundBtn} onClick={() => sendDevTrigger("sound", "laser")}>
                    <span>⚡</span> Laser
                  </button>
                  <button className={styles.soundBtn} onClick={() => sendDevTrigger("sound", "coin")}>
                    <span>🪙</span> Coin
                  </button>
                  <button className={styles.soundBtn} onClick={() => sendDevTrigger("sound", "airhorn")}>
                    <span>📯</span> Airhorn
                  </button>
                  <button className={styles.soundBtn} onClick={() => sendDevTrigger("sound", "alert")}>
                    <span>🚨</span> Alert
                  </button>
                </div>
              </div>

              {/* Announcement Trigger section */}
              <div className={styles.devSection}>
                <span className={styles.devLabel}>📢 Glide Announcement Banner</span>
                <div className={styles.announcementInputGroup}>
                  <input
                    type="text"
                    placeholder="Broadcast message to all players..."
                    value={devText}
                    onChange={(e) => setDevText(e.target.value)}
                    className={styles.announcementInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && devText.trim()) {
                        sendDevTrigger("announcement", devText);
                      }
                    }}
                  />
                  <button
                    className={styles.broadcastBtn}
                    onClick={() => {
                      if (devText.trim()) sendDevTrigger("announcement", devText);
                    }}
                  >
                    Broadcast
                  </button>
                  <button className={styles.clearAnnBtn} onClick={() => sendDevTrigger("clear", "")}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {devStatus && <div className={styles.devStatusMsg}>{devStatus}</div>}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className={styles.footer}>
        <p>Built by ur boi Ishi.</p>
        <p className={styles.mobileInstruction}>Mobile tip: Long press to flag cells, or toggle Flag Mode.</p>
      </footer>

      {/* Auth Popup Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
