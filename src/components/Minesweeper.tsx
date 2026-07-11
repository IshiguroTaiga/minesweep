"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { audioEngine } from "./AudioEngine";
import styles from "./Minesweeper.module.css";

interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

type Difficulty = "easy" | "medium" | "hard";

const CONFIGS = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
};

interface MinesweeperProps {
  user: { username: string } | null;
  onScoreSubmitted: () => void;
  onAuthRequired: () => void;
}

// Pure helper function to generate initial blank board (defined outside component to prevent re-creation and hooks warnings)
function createInitialBoard(rows: number, cols: number): Cell[][] {
  const initialBoard: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowCells: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      rowCells.push({
        row: r,
        col: c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
      });
    }
    initialBoard.push(rowCells);
  }
  return initialBoard;
}

// Impure helper function to place mines randomly (defined outside component to resolve hook-purity rules)
function placeMinesRandomly(
  startRow: number,
  startCol: number,
  rows: number,
  cols: number,
  mines: number,
  currentBoard: Cell[][]
) {
  let minesPlaced = 0;
  while (minesPlaced < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);

    // Check if candidate cell is same as start cell or its direct 8 neighbors
    const isStartArea = Math.abs(r - startRow) <= 1 && Math.abs(c - startCol) <= 1;

    if (!currentBoard[r][c].isMine && !isStartArea) {
      currentBoard[r][c].isMine = true;
      minesPlaced++;
    }
  }

  // Compute Neighbors count
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (currentBoard[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && currentBoard[nr][nc].isMine) {
            count++;
          }
        }
      }
      currentBoard[r][c].neighborMines = count;
    }
  }
}

export default function Minesweeper({ user, onScoreSubmitted, onAuthRequired }: MinesweeperProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  
  // Initialize state with lazy initializers to avoid hydration issues and sync-setState errors
  const [board, setBoard] = useState<Cell[][]>(() => createInitialBoard(CONFIGS.easy.rows, CONFIGS.easy.cols));
  const [status, setStatus] = useState<"idle" | "playing" | "won" | "lost">("idle");
  const [timer, setTimer] = useState(0);
  const [minesLeft, setMinesLeft] = useState(CONFIGS.easy.mines);
  
  const [isMobileFlagMode, setIsMobileFlagMode] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreMessage, setScoreMessage] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchActiveRef = useRef(false);

  const { rows, cols, mines } = CONFIGS[difficulty];

  // Initialize the Audio Settings asynchronously on mount to prevent SSR mismatch and sync-setState warnings
  useEffect(() => {
    const handle = setTimeout(() => {
      setBgmEnabled(audioEngine.isBgmEnabled());
      setSfxEnabled(audioEngine.isSfxEnabled());
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  // Initialize Board Function
  const initBoard = useCallback((diff: Difficulty) => {
    const config = CONFIGS[diff];
    const initialBoard = createInitialBoard(config.rows, config.cols);

    setBoard(initialBoard);
    setStatus("idle");
    setTimer(0);
    setMinesLeft(config.mines);
    setScoreMessage("");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Handle Timer ticking
  useEffect(() => {
    if (status === "playing") {
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Submit score to API
  const submitScore = async (finalTime: number) => {
    if (!user) return;
    setSubmittingScore(true);
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: finalTime, difficulty }),
      });
      const data = await response.json();
      if (response.ok) {
        setScoreMessage("Score saved to leaderboard!");
        onScoreSubmitted();
      } else {
        setScoreMessage(`Failed to save: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      setScoreMessage("Network error saving score.");
    } finally {
      setSubmittingScore(false);
    }
  };

  // Check Win Condition
  const checkWin = (currentBoard: Cell[][]) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = currentBoard[r][c];
        if (!cell.isMine && !cell.isRevealed) {
          return false;
        }
      }
    }
    return true;
  };

  // Recursive Flood Fill Reveal
  const floodReveal = (r: number, c: number, currentBoard: Cell[][]) => {
    const queue: [number, number][] = [[r, c]];
    currentBoard[r][c].isRevealed = true;

    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      if (currentBoard[cr][cc].neighborMines > 0) continue;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighbor = currentBoard[nr][nc];
            if (!neighbor.isMine && !neighbor.isRevealed && !neighbor.isFlagged) {
              neighbor.isRevealed = true;
              queue.push([nr, nc]);
            }
          }
        }
      }
    }
  };

  // Reveal Cell Core Logic
  const handleReveal = (r: number, c: number) => {
    if (status === "lost" || status === "won") return;

    const currentBoard = [...board.map((row) => [...row])];
    let cell = currentBoard[r][c];

    if (cell.isRevealed || cell.isFlagged) return;

    // First Click: Initialize mines
    if (status === "idle") {
      audioEngine.init();
      if (bgmEnabled) audioEngine.startBgm();
      placeMinesRandomly(r, c, rows, cols, mines, currentBoard);
      setStatus("playing");
      cell = currentBoard[r][c];
    }

    if (cell.isMine) {
      // Game Over
      cell.isRevealed = true;
      setStatus("lost");
      audioEngine.playExplode();
      
      // Reveal all mines
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (currentBoard[row][col].isMine) {
            currentBoard[row][col].isRevealed = true;
          }
        }
      }
      setBoard(currentBoard);
      return;
    }

    // Play reveal sound
    audioEngine.playClick();

    // Reveal cells
    floodReveal(r, c, currentBoard);

    // Check Win
    if (checkWin(currentBoard)) {
      setStatus("won");
      audioEngine.playWin();
      // Auto-flag remaining mines
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (currentBoard[row][col].isMine) {
            currentBoard[row][col].isFlagged = true;
          }
        }
      }
      setMinesLeft(0);
      setBoard(currentBoard);
      submitScore(timer);
      return;
    }

    setBoard(currentBoard);
  };

  // Flag/Unflag Cell Core Logic
  const handleFlag = (r: number, c: number) => {
    if (status === "lost" || status === "won") return;
    if (status === "idle") {
      audioEngine.init();
      if (bgmEnabled) audioEngine.startBgm();
      setStatus("playing");
    }

    const currentBoard = [...board.map((row) => [...row])];
    const cell = currentBoard[r][c];

    if (cell.isRevealed) return;

    audioEngine.playFlag();
    cell.isFlagged = !cell.isFlagged;
    setMinesLeft((prev) => (cell.isFlagged ? prev - 1 : prev + 1));
    setBoard(currentBoard);
  };

  // Chord/Middle-Click Logic (Quick reveal neighbors of revealed cell if flags match count)
  const handleChord = (r: number, c: number) => {
    if (status !== "playing") return;

    const currentBoard = [...board.map((row) => [...row])];
    const cell = currentBoard[r][c];

    if (!cell.isRevealed || cell.neighborMines === 0) return;

    // Count adjacent flags
    let flagCount = 0;
    const neighbors: Cell[] = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = currentBoard[nr][nc];
          if (neighbor.isFlagged) {
            flagCount++;
          } else if (!neighbor.isRevealed) {
            neighbors.push(neighbor);
          }
        }
      }
    }

    // If flag count matches mine count, reveal neighbors
    if (flagCount === cell.neighborMines && neighbors.length > 0) {
      audioEngine.playClick();
      let hitMine = false;

      for (const n of neighbors) {
        if (n.isMine) {
          hitMine = true;
          n.isRevealed = true;
        } else {
          floodReveal(n.row, n.col, currentBoard);
        }
      }

      if (hitMine) {
        setStatus("lost");
        audioEngine.playExplode();
        // Reveal all mines
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (currentBoard[row][col].isMine) {
              currentBoard[row][col].isRevealed = true;
            }
          }
        }
      } else if (checkWin(currentBoard)) {
        setStatus("won");
        audioEngine.playWin();
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (currentBoard[row][col].isMine) {
              currentBoard[row][col].isFlagged = true;
            }
          }
        }
        setMinesLeft(0);
        submitScore(timer);
      }

      setBoard(currentBoard);
    }
  };

  // --- DEVICE INTERACTIONS ---

  // Handle Cell Click (Standard Left-Click / Tap)
  const onCellClick = (r: number, c: number) => {
    if (isMobileFlagMode) {
      handleFlag(r, c);
    } else {
      handleReveal(r, c);
    }
  };

  // Right-Click (Desktop only)
  const onCellContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    handleFlag(r, c);
  };

  // Mobile Long-Press / Touch handlers
  const onCellTouchStart = (r: number, c: number) => {
    isTouchActiveRef.current = true;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    // Set a timer for 450ms: if user holds touch, flag it!
    touchTimerRef.current = setTimeout(() => {
      if (isTouchActiveRef.current) {
        handleFlag(r, c);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(40);
        }
        isTouchActiveRef.current = false;
      }
    }, 450);
  };

  const onCellTouchEnd = (e: React.TouchEvent, r: number, c: number) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    // If touch was short (i.e. released before 450ms), process it as a regular reveal/flag click
    if (isTouchActiveRef.current) {
      isTouchActiveRef.current = false;
      e.preventDefault(); // Prevent ghost click
      onCellClick(r, c);
    }
  };

  const onCellTouchCancel = () => {
    isTouchActiveRef.current = false;
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Audio Toggle Handlers
  const toggleBgm = () => {
    const nextState = !bgmEnabled;
    setBgmEnabled(nextState);
    audioEngine.setBgmEnabled(nextState);
    if (nextState && status === "playing") {
      audioEngine.startBgm();
    } else {
      audioEngine.stopBgm();
    }
  };

  const toggleSfx = () => {
    const nextState = !sfxEnabled;
    setSfxEnabled(nextState);
    audioEngine.setSfxEnabled(nextState);
  };

  // Format digital numbers for timer/mines
  const formatNumber = (num: number) => {
    const absolute = Math.min(Math.max(Math.abs(num), 0), 999);
    const sign = num < 0 ? "-" : "";
    const str = String(absolute).padStart(3, "0");
    return `${sign}${str}`;
  };

  const getFaceEmoji = () => {
    if (status === "lost") return "😵";
    if (status === "won") return "😎";
    if (status === "playing") return "😐";
    return "😊";
  };

  return (
    <div className={styles.gameContainer}>
      {/* Control Panel: Difficulty & Sound */}
      <div className={styles.controlsRow}>
        <div className={styles.difficultyGroup}>
          {(["easy", "medium", "hard"] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => {
                setDifficulty(diff);
                initBoard(diff);
              }}
              className={`${styles.controlBtn} ${difficulty === diff ? styles.activeDiff : ""}`}
            >
              {diff.charAt(0).toUpperCase() + diff.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.audioGroup}>
          <button
            onClick={toggleBgm}
            className={`${styles.audioBtn} ${bgmEnabled ? styles.audioOn : ""}`}
            title="Toggle Ambient Music"
            aria-label="Toggle Ambient Music"
          >
            🎵 {bgmEnabled ? "On" : "Off"}
          </button>
          <button
            onClick={toggleSfx}
            className={`${styles.audioBtn} ${sfxEnabled ? styles.audioOn : ""}`}
            title="Toggle Sound Effects"
            aria-label="Toggle Sound Effects"
          >
            🔊 {sfxEnabled ? "On" : "Off"}
          </button>
        </div>
      </div>

      {/* Retro HUD */}
      <div className={styles.hudContainer}>
        <div className={styles.hudDisplay}>{formatNumber(minesLeft)}</div>
        <button
          className={styles.resetFace}
          onClick={() => initBoard(difficulty)}
          aria-label="Reset board"
        >
          {getFaceEmoji()}
        </button>
        <div className={styles.hudDisplay}>{formatNumber(timer)}</div>
      </div>

      {/* Mobile Toggle helper */}
      <div className={styles.mobileActions}>
        <button
          onClick={() => setIsMobileFlagMode(false)}
          className={`${styles.mobileActionBtn} ${!isMobileFlagMode ? styles.mobileActionActive : ""}`}
        >
          👆 Dig Mode
        </button>
        <button
          onClick={() => setIsMobileFlagMode(true)}
          className={`${styles.mobileActionBtn} ${isMobileFlagMode ? styles.mobileActionActive : ""}`}
        >
          🚩 Flag Mode
        </button>
      </div>

      {/* Board Scroll Window */}
      <div className={styles.boardWrapper}>
        <div
          className={styles.board}
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
          }}
        >
          {board.map((rowCells, rIndex) =>
            rowCells.map((cell, cIndex) => {
              let cellClass = styles.cell;
              let content = "";

              if (cell.isRevealed) {
                cellClass += ` ${styles.revealed}`;
                if (cell.isMine) {
                  cellClass += ` ${styles.mine}`;
                  content = "💣";
                } else if (cell.neighborMines > 0) {
                  cellClass += ` ${styles[`mines${cell.neighborMines}`]}`;
                  content = String(cell.neighborMines);
                }
              } else if (cell.isFlagged) {
                cellClass += ` ${styles.flagged}`;
                content = "🚩";
              }

              return (
                <button
                  key={`${rIndex}-${cIndex}`}
                  className={cellClass}
                  onClick={() => onCellClick(rIndex, cIndex)}
                  onContextMenu={(e) => onCellContextMenu(e, rIndex, cIndex)}
                  onDoubleClick={() => handleChord(rIndex, cIndex)}
                  onTouchStart={() => onCellTouchStart(rIndex, cIndex)}
                  onTouchEnd={(e) => onCellTouchEnd(e, rIndex, cIndex)}
                  onTouchCancel={onCellTouchCancel}
                  aria-label={`Cell at row ${rIndex + 1}, column ${cIndex + 1}`}
                >
                  {content}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Overlay Status Message */}
      {status === "won" && (
        <div className={`${styles.statusOverlay} ${styles.winBanner}`}>
          <h3>🏆 Victory! 🏆</h3>
          <p>Completed in {timer} seconds!</p>
          {user ? (
            <p className={styles.subText}>
              {submittingScore ? "Submitting score..." : scoreMessage || "Score saved!"}
            </p>
          ) : (
            <div>
              <p className={styles.subText}>Want to save this score?</p>
              <button className={styles.authPromptBtn} onClick={onAuthRequired}>
                Log In to Save Score
              </button>
            </div>
          )}
        </div>
      )}

      {status === "lost" && <div className={styles.flashOverlay} />}

      {status === "lost" && (
        <div className={`${styles.statusOverlay} ${styles.loseBanner}`}>
          <h3>💥 Boom! Game Over 💥</h3>
          <button className={styles.restartBtn} onClick={() => initBoard(difficulty)}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
