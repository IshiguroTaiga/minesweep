"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./Leaderboard.module.css";

interface Score {
  username: string;
  time: number;
  difficulty: "easy" | "medium" | "hard";
  date: string;
}

interface LeaderboardProps {
  refreshTrigger: number; // Trigger reload when this changes
}

export default function Leaderboard({ refreshTrigger }: LeaderboardProps) {
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/leaderboard?difficulty=${difficulty}`);
      if (!response.ok) {
        throw new Error("Failed to load leaderboard");
      }
      const data = await response.json();
      if (data.success) {
        setScores(data.scores);
      } else {
        throw new Error(data.error || "Failed to load leaderboard");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [difficulty]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchScores();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchScores, refreshTrigger]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <span className={`${styles.badge} ${styles.gold}`}>🥇</span>;
    if (index === 1) return <span className={`${styles.badge} ${styles.silver}`}>🥈</span>;
    if (index === 2) return <span className={`${styles.badge} ${styles.bronze}`}>🥉</span>;
    return <span className={styles.rankNum}>{index + 1}</span>;
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Leaderboard</h2>
      
      <div className={styles.tabs}>
        {(["easy", "medium", "hard"] as const).map((diff) => (
          <button
            key={diff}
            className={`${styles.tab} ${difficulty === diff ? styles.activeTab : ""}`}
            onClick={() => setDifficulty(diff)}
          >
            {diff.charAt(0).toUpperCase() + diff.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.message}>Loading scores...</div>
        ) : error ? (
          <div className={`${styles.message} ${styles.error}`}>{error}</div>
        ) : scores.length === 0 ? (
          <div className={styles.message}>No records yet. Be the first!</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Time</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score, index) => (
                <tr key={`${score.username}-${score.date}-${index}`} className={styles.row}>
                  <td>{getRankBadge(index)}</td>
                  <td className={styles.username}>{score.username}</td>
                  <td className={styles.time}>{score.time.toFixed(2)}s</td>
                  <td className={styles.date}>{formatDate(score.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
