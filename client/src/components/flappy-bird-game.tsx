import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trophy, List } from "lucide-react";

// Oyun interfeysləri və sabitləri
interface FlappyBirdGameProps {
  onBack: () => void;
}

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
}

// Updated Constants for 800x600 Resolution
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const BIRD_X_POSITION = 100; // Moved slightly right
const BIRD_WIDTH = 45; // Scaled up
const BIRD_HEIGHT = 32; // Scaled up
const GRAVITY = 1.0; // Increased gravity for larger height
const JUMP_FORCE = -12; // Stronger jump
const GAME_SPEED = 4; // Faster speed
const PIPE_WIDTH = 80; // Wider pipes
const PIPE_GAP_INITIAL = 220; // Larger gap
const PIPE_GAP_MINIMUM = 140;
const PIPE_GAP_DECREASE = 10;
const PIPE_SPAWN_RATE = 110;

export default function FlappyBirdGame({ onBack }: FlappyBirdGameProps) {
  // === React State-ləri (UI-ı idarə etmək üçün) ===
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [birdY, setBirdY] = useState(GAME_HEIGHT / 2);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [showScoreSubmit, setShowScoreSubmit] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [gameStats, setGameStats] = useState({
    totalFlaps: 0,
    gameTime: 0,
    pipesPassed: 0,
    startTime: 0
  });

  // Scale state for responsive design
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // === Ref-lər (Oyun məntiqini idarə etmək üçün, re-render yaratmır) ===
  const gameLoopRef = useRef<number | null>(null);
  const birdYRef = useRef(GAME_HEIGHT / 2);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const frameCountRef = useRef(0);
  const scoreRef = useRef(0);

  const queryClient = useQueryClient();

  // Handle resizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        // Calculate scale, leaving a small margin (e.g. 32px padding)
        const newScale = Math.min(1, (containerWidth - 32) / GAME_WIDTH);
        setScale(newScale);
      }
    };

    // Initial calc
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // === Data Fetching (TanStack Query) ===
  const { data: topScores = [] } = useQuery<{ score: number }[]>({
    queryKey: ["flappy-scores"],
    queryFn: async () => {
      const response = await fetch("/api/games/flappy/scores");
      if (!response.ok) throw new Error("Failed to fetch scores");
      return response.json();
    },
  });

  const { data: allScores = [] } = useQuery<any[]>({
    queryKey: ["flappy-all-scores"],
    queryFn: async () => {
      const response = await fetch("/api/games/flappy/scores?limit=50");
      if (!response.ok) throw new Error("Failed to fetch all scores");
      return response.json();
    },
  });



  const submitScoreMutation = useMutation({
    mutationFn: async (scoreData: { playerName: string; score: number }) => {
      const res = await apiRequest("POST", "/api/games/scores", {
        ...scoreData,
        gameType: "flappy",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flappy-scores"] });
      queryClient.invalidateQueries({ queryKey: ["flappy-all-scores"] });
      setShowScoreSubmit(false);
      setPlayerName("");
    },
  });

  // === Oyun Funksiyaları ===

  const resetGame = useCallback(() => {
    setIsPlaying(false);
    setIsGameOver(false);
    setShowScoreSubmit(false);
    setShowResults(false);
    setIsNewRecord(false);
    setPlayerName("");
    setScore(0);
    setBirdY(GAME_HEIGHT / 2);
    setPipes([]);
    setBirdVelocity(0);
    setGameStats({
      totalFlaps: 0,
      gameTime: 0,
      pipesPassed: 0,
      startTime: Date.now()
    });

    birdYRef.current = GAME_HEIGHT / 2;
    birdVelocityRef.current = 0;
    pipesRef.current = [];
    scoreRef.current = 0;
    frameCountRef.current = 0;

    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  }, []);

  const endGame = useCallback(() => {
    setIsPlaying(false);
    setIsGameOver(true);
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }

    const endTime = Date.now();
    const gameTime = Math.round((endTime - gameStats.startTime) / 1000);
    setGameStats(prev => ({
      ...prev,
      gameTime,
      pipesPassed: scoreRef.current
    }));

    const finalScore = scoreRef.current;
    const isRecord =
      topScores.length === 0 || finalScore > (topScores[0]?.score || 0);
    if (isRecord && finalScore > 0) {
      setIsNewRecord(true);
      setShowScoreSubmit(true);
    }
  }, [topScores, gameStats.startTime]);

  const flap = useCallback(() => {
    if (isPlaying && !isGameOver) {
      birdVelocityRef.current = JUMP_FORCE;
      setGameStats(prev => ({
        ...prev,
        totalFlaps: prev.totalFlaps + 1
      }));
    }
  }, [isPlaying, isGameOver]);

  const startGame = () => {
    resetGame();
    setIsPlaying(true);
    setGameStats(prev => ({
      ...prev,
      startTime: Date.now()
    }));
    flap();
  };

  const gameLoop = useCallback(() => {
    if (!isPlaying || isGameOver) return;

    birdVelocityRef.current += GRAVITY;
    birdYRef.current += birdVelocityRef.current;

    if (birdYRef.current + BIRD_HEIGHT > GAME_HEIGHT || birdYRef.current < 0) {
      endGame();
      return;
    }

    frameCountRef.current += 1;
    let newPipes = pipesRef.current.map((pipe) => ({
      ...pipe,
      x: pipe.x - GAME_SPEED,
    }));

    newPipes = newPipes.filter((pipe) => pipe.x > -PIPE_WIDTH);

    if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
      const currentScore = scoreRef.current;
      const gapReduction = Math.floor(currentScore / 5) * PIPE_GAP_DECREASE;
      const currentGap = Math.max(PIPE_GAP_MINIMUM, PIPE_GAP_INITIAL - gapReduction);

      const gapStart = 50 + Math.random() * (GAME_HEIGHT - currentGap - 100);
      newPipes.push({
        x: GAME_WIDTH,
        topHeight: gapStart,
        bottomHeight: GAME_HEIGHT - gapStart - currentGap,
        passed: false,
      });
    }

    let scoreIncreased = false;
    for (const pipe of newPipes) {
      const birdRect = {
        x: BIRD_X_POSITION,
        y: birdYRef.current,
        width: BIRD_WIDTH,
        height: BIRD_HEIGHT,
      };
      const pipeTopRect = {
        x: pipe.x,
        y: 0,
        width: PIPE_WIDTH,
        height: pipe.topHeight,
      };
      const pipeBottomRect = {
        x: pipe.x,
        y: pipe.bottomHeight ? GAME_HEIGHT - pipe.bottomHeight : pipe.topHeight + PIPE_GAP_INITIAL,
        width: PIPE_WIDTH,
        height: pipe.bottomHeight || GAME_HEIGHT,
      };

      if (
        birdRect.x < pipeTopRect.x + pipeTopRect.width &&
        birdRect.x + birdRect.width > pipeTopRect.x &&
        (birdRect.y < pipeTopRect.y + pipeTopRect.height ||
          birdRect.y + birdRect.height > pipeBottomRect.y)
      ) {
        endGame();
        return;
      }

      if (!pipe.passed && birdRect.x > pipe.x + PIPE_WIDTH) {
        pipe.passed = true;
        scoreRef.current += 1;
        scoreIncreased = true;
      }
    }

    pipesRef.current = newPipes;

    setBirdY(birdYRef.current);
    setBirdVelocity(birdVelocityRef.current);
    setPipes([...pipesRef.current]);
    if (scoreIncreased) {
      setScore(scoreRef.current);
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, isGameOver, endGame, flap]);

  useEffect(() => {
    if (isPlaying && !isGameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [isPlaying, isGameOver, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (!isPlaying && !isGameOver) {
          startGame();
        } else if (isPlaying) {
          flap();
        }
      }
    };

    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (isPlaying && !target.closest('button') && !target.closest('input') && !target.closest('[role="dialog"]')) {
        flap();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleClick);
    };
  }, [isPlaying, isGameOver, flap, startGame]);

  const handleScoreSubmit = async () => {
    if (playerName.trim()) {
      await submitScoreMutation.mutateAsync({
        playerName: playerName.trim(),
        score,
      });
    }
  };

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center space-y-4">
      {/* Header Controls - similar to Sudoku/Tetris */}
      <div className="w-full max-w-3xl px-4 flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack} size="sm" className="gap-2">
            ← <span className="hidden sm:inline">Back</span>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Results</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Flappy Bird Leaderboard
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 mt-4">
                {allScores.length > 0 ? (
                  allScores.map((score: any, index: number) => (
                    <div key={score.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`font-mono w-6 ${index < 3 ? "text-yellow-600 font-bold" : "text-muted-foreground"}`}>#{index + 1}</div>
                        <div className="font-bold">{score.playerName}</div>
                      </div>
                      <div className="font-mono font-bold text-lg">{score.score}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No scores yet. Be the first!
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-full border">
          <span className="font-medium text-muted-foreground uppercase text-xs tracking-wider">Score</span>
          <span className="text-2xl font-black text-primary font-mono">{score}</span>
        </div>
      </div>

      {/* Game Container Wrapper */}
      <div
        className="relative bg-card rounded-lg overflow-hidden shadow-2xl select-none origin-top border-4 border-muted"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          transform: `scale(${scale})`,
          marginBottom: -(GAME_HEIGHT * (1 - scale)) // Fix layout spacing after scaling
        }}
      >
        {/* Internal Overlay Removed */}

        {/* Game Area */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-sky-400 to-sky-600 dark:from-sky-800 dark:to-sky-900"
        >
          <div className="absolute inset-0 overflow-hidden">
            {pipes.map((pipe, index) => (
              <div key={index}>
                <div
                  className="absolute bg-green-600 dark:bg-green-700 border-2 border-green-800 dark:border-green-500 rounded-t-md"
                  style={{
                    left: pipe.x,
                    top: 0,
                    width: PIPE_WIDTH,
                    height: pipe.topHeight,
                  }}
                />
                <div
                  className="absolute bg-green-600 dark:bg-green-700 border-2 border-green-800 dark:border-green-500 rounded-b-md"
                  style={{
                    left: pipe.x,
                    bottom: 0,
                    width: PIPE_WIDTH,
                    height: pipe.bottomHeight || (GAME_HEIGHT - pipe.topHeight - PIPE_GAP_INITIAL),
                  }}
                />
              </div>
            ))}

            <div
              className="absolute flex items-center justify-center text-4xl"
              style={{
                left: BIRD_X_POSITION,
                top: birdY,
                width: BIRD_WIDTH,
                height: BIRD_HEIGHT,
                transform: `rotate(${Math.min(Math.max(birdVelocity * 2, -45), 30)}deg) scaleX(-1)`,
                transition: "transform 100ms",
              }}
            >
              🐦
            </div>

            {/* Start Screen */}
            {!isPlaying && !isGameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white z-10">
                <div className="text-center p-8 rounded-2xl bg-black/60 backdrop-blur-sm border border-white/10">
                  <h3 className="text-4xl font-bold mb-4">Get Ready!</h3>
                  <div className="text-6xl mb-6">👆</div>
                  <p className="text-xl mb-2">Press SPACE or <br />Click to Start</p>
                </div>
              </div>
            )}

            {/* Game Over Screen */}
            {isGameOver && !showScoreSubmit && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 z-10">
                <div className="bg-gray-900 border-2 border-red-500 rounded-lg p-6 w-full max-w-md text-center shadow-2xl">
                  <div className="text-6xl mb-4">💥</div>
                  <h2 className="text-3xl font-bold mb-2 text-white">Game Over!</h2>
                  <p className="text-2xl mb-6 text-yellow-400 font-bold">Score: {score}</p>

                  <div className="mb-6">
                    <p className="text-gray-400 mb-2">Enter your name:</p>
                    <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg p-3">
                      <span className="text-white text-xl">👤</span>
                      <input
                        type="text"
                        placeholder="Your name..."
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder-gray-500"
                        maxLength={20}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={handleScoreSubmit}
                      disabled={!playerName.trim() || submitScoreMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-bold"
                    >
                      {submitScoreMutation.isPending ? "Saving..." : "Save Score"}
                    </Button>
                    <Button
                      onClick={startGame}
                      variant="secondary"
                      className="w-full h-12 text-lg"
                    >
                      Play Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* New Record Modal */}
            {showScoreSubmit && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="bg-card rounded-xl p-8 w-full max-w-md shadow-2xl border-2 border-yellow-500 animate-in fade-in zoom-in duration-300">
                  <div className="text-center mb-6">
                    <div className="text-6xl mb-2">👑</div>
                    <h3 className="text-3xl font-bold text-yellow-500">
                      NEW RECORD!
                    </h3>
                    <p className="text-muted-foreground mt-2 text-lg">
                      Great Score: <span className="text-primary font-bold">{score}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Enter your name..."
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full px-4 py-3 bg-background border-2 border-primary/20 focus:border-primary rounded-lg text-lg outline-none transition-colors"
                      maxLength={20}
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => setShowScoreSubmit(false)}
                        className="h-12 text-lg"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleScoreSubmit}
                        disabled={!playerName.trim() || submitScoreMutation.isPending}
                        className="h-12 text-lg font-bold"
                      >
                        {submitScoreMutation.isPending ? "..." : "Save Score"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Buttons Area - Outside the scaled game logic but inside the main container */}
      <div className="w-full max-w-lg mt-6 px-4">
        <Button
          className={`w-full h-20 text-3xl font-black rounded-2xl shadow-xl transition-all active:scale-95 active:shadow-none
             ${isGameOver
              ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/30"
              : isPlaying
                ? "bg-primary hover:bg-primary/90 shadow-primary/30"
                : "bg-green-500 hover:bg-green-600 text-white shadow-green-500/30"
            }`}
          onClick={(e) => {
            e.preventDefault();
            if (isGameOver || !isPlaying) {
              startGame();
            } else {
              flap();
            }
          }}
        >
          {isGameOver ? "PLAY AGAIN 🔄" : isPlaying ? "JUMP 🦘" : "START 🚀"}
        </Button>
        <p className="text-center text-muted-foreground mt-4 text-sm">
          PC players can use SPACE key
        </p>
      </div>
    </div>
  );
}
