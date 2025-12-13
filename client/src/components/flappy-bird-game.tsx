import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

const GAME_WIDTH = 360;
const GAME_HEIGHT = 280;
const BIRD_X_POSITION = 60;
const BIRD_WIDTH = 34;
const BIRD_HEIGHT = 24;
const GRAVITY = 0.6;
const JUMP_FORCE = -8;
const GAME_SPEED = 2.5;
const PIPE_WIDTH = 60;
const PIPE_GAP_INITIAL = 160; // Starting gap size
const PIPE_GAP_MINIMUM = 100; // Minimum gap size
const PIPE_GAP_DECREASE = 8; // Gap decrease amount every 5 points
const PIPE_SPAWN_RATE = 100; // Boruların yaranma tezliyi (kadr sayı ilə)

export default function FlappyBirdGame({ onBack }: FlappyBirdGameProps) {
  // === React State-ləri (UI-ı idarə etmək üçün) ===
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [birdY, setBirdY] = useState(GAME_HEIGHT / 2);
  const [birdVelocity, setBirdVelocity] = useState(0); // Yalnız quşun fırlanması üçün istifadə edilir
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

  // === Ref-lər (Oyun məntiqini idarə etmək üçün, re-render yaratmır) ===
  const gameLoopRef = useRef<number | null>(null);
  const birdYRef = useRef(GAME_HEIGHT / 2);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const frameCountRef = useRef(0);
  const scoreRef = useRef(0);

  const queryClient = useQueryClient();

  // === Data Fetching (TanStack Query) ===
  // Xalları gətirmək üçün sorğu
  const { data: topScores = [] } = useQuery<{ score: number }[]>({
    // DÜZƏLİŞ: queryKey üçün string yerinə array istifadə etmək daha yaxşı praktikadır
    queryKey: ["flappy-scores"],
    queryFn: async () => {
      const response = await fetch("/api/games/flappy/scores");
      if (!response.ok) throw new Error("Failed to fetch scores");
      return response.json();
    },
  });

  // All scores for Results dialog
  const { data: allScores = [] } = useQuery<any[]>({
    queryKey: ["flappy-all-scores"],
    queryFn: async () => {
      const response = await fetch("/api/games/flappy/scores?limit=50");
      if (!response.ok) throw new Error("Failed to fetch all scores");
      return response.json();
    },
  });

  // Xalı yaddaşa vermək üçün mutasiya
  const submitScoreMutation = useMutation({
    mutationFn: async (scoreData: { playerName: string; score: number }) => {
      const response = await fetch("/api/games/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scoreData, gameType: "flappy" }),
      });
      if (!response.ok) throw new Error("Failed to submit score");
      return response.json();
    },
    onSuccess: () => {
      // DÜZƏLİŞ: invalidateQueries-də də eyni array formatlı key-ləri istifadə edirik
      queryClient.invalidateQueries({ queryKey: ["flappy-scores"] });
      queryClient.invalidateQueries({ queryKey: ["flappy-all-scores"] });
      setShowScoreSubmit(false);
      setPlayerName("");
    },
  });

  // === Oyun Funksiyaları ===

  // Oyunun bütün dəyərlərini sıfırlayan funksiya
  const resetGame = useCallback(() => {
    // State-ləri sıfırla
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

    // Ref-ləri sıfırla
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

  // Oyunu bitirən funksiya
  // DÜZƏLİŞ: Oyunun bitmə məntiqi təkrarlanmaması üçün mərkəzi bir funksiyaya yığıldı
  const endGame = useCallback(() => {
    setIsPlaying(false);
    setIsGameOver(true);
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }

    // Oyun statistikalarını yenilə
    const endTime = Date.now();
    const gameTime = Math.round((endTime - gameStats.startTime) / 1000);
    setGameStats(prev => ({
      ...prev,
      gameTime,
      pipesPassed: scoreRef.current
    }));

    const finalScore = scoreRef.current;
    // Yeni rekord olub-olmadığını yoxla
    const isRecord =
      topScores.length === 0 || finalScore > (topScores[0]?.score || 0);
    if (isRecord && finalScore > 0) {
      setIsNewRecord(true);
      setShowScoreSubmit(true);
    }
  }, [topScores, gameStats.startTime]);

  // Quşun yuxarı atılması (flap)
  const flap = useCallback(() => {
    if (isPlaying && !isGameOver) {
      birdVelocityRef.current = JUMP_FORCE;
      // Flap sayını artır
      setGameStats(prev => ({
        ...prev,
        totalFlaps: prev.totalFlaps + 1
      }));
    }
  }, [isPlaying, isGameOver]);

  // Oyunu başlatan funksiya
  const startGame = () => {
    resetGame();
    setIsPlaying(true);
    setGameStats(prev => ({
      ...prev,
      startTime: Date.now()
    }));
    // İlk atılmanı etmək üçün kiçik bir impuls veririk
    flap();
  };

  // Əsas oyun döngüsü (game loop)
  // DÜZƏLİŞ: Bu funksiya artıq state-lərdən asılı deyil, ref-lərlə işləyir.
  // Bu, onun hər kadrda yenidən yaranmasının qarşısını alır və performansı artırır.
  const gameLoop = useCallback(() => {
    if (!isPlaying || isGameOver) return;

    // 1. Quşun fizikasını yenilə (ref-lərlə)
    birdVelocityRef.current += GRAVITY;
    birdYRef.current += birdVelocityRef.current;

    // 2. Sərhəd yoxlaması (yerə və ya tavana dəymə)
    if (birdYRef.current + BIRD_HEIGHT > GAME_HEIGHT || birdYRef.current < 0) {
      endGame();
      return;
    }

    // 3. Boruları yenilə
    frameCountRef.current += 1;
    let newPipes = pipesRef.current.map((pipe) => ({
      ...pipe,
      x: pipe.x - GAME_SPEED,
    }));

    // Ekrandan çıxan boruları sil
    newPipes = newPipes.filter((pipe) => pipe.x > -PIPE_WIDTH);

    // 4. Yeni boru yarat
    // DÜZƏLİŞ: Boru yaratmaq üçün kadr sayından istifadə daha stabildir
    if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
      // Xal əsasında gap ölçüsünü hesabla - hər 5 xalda azal
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

    // 5. Toqquşma yoxlaması və xal artımı
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

      // Toqquşma yoxlaması
      if (
        birdRect.x < pipeTopRect.x + pipeTopRect.width &&
        birdRect.x + birdRect.width > pipeTopRect.x &&
        (birdRect.y < pipeTopRect.y + pipeTopRect.height ||
          birdRect.y + birdRect.height > pipeBottomRect.y)
      ) {
        endGame();
        return;
      }

      // Xal artımı
      if (!pipe.passed && birdRect.x > pipe.x + PIPE_WIDTH) {
        pipe.passed = true;
        scoreRef.current += 1;
        scoreIncreased = true;
      }
    }

    // Ref-ləri yenilə
    pipesRef.current = newPipes;

    // 6. UI-ı yeniləmək üçün state-ləri dəyişdir
    setBirdY(birdYRef.current);
    setBirdVelocity(birdVelocityRef.current);
    setPipes([...pipesRef.current]); // Yeni array yaradaraq re-render-i tətikləyirik
    if (scoreIncreased) {
      setScore(scoreRef.current);
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, isGameOver, endGame, flap]);

  // Oyun döngüsünü başladan/dayandıran useEffect
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

  // Klaviaturadan və kliklə idarəetmə
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only prevent default for space key and only when not in an input field
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
      // Only allow click/touch to flap when game is running, not to start
      // Also don't interfere with UI elements
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
    <div className="w-full max-w-sm mx-auto bg-card rounded-lg overflow-hidden shadow-lg select-none">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Geri
        </Button>
        <h2 className="text-lg font-semibold">Flappy Bird</h2>
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-primary">Xal: {score}</div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <List className="h-3 w-3 mr-1" />
                Results
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Flappy Bird - All Results
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {allScores.length > 0 ? (
                  <div className="space-y-2">
                    {allScores.map((score: any, index: number) => (
                      <div key={score.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/30 border">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${index < 3 ?
                            index === 0 ? "text-yellow-500" :
                              index === 1 ? "text-gray-400" :
                                "text-orange-500"
                            : "text-muted-foreground"
                            }`}>
                            #{index + 1}
                          </span>
                          <span className="font-medium">{score.playerName}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold">{score.score}</div>
                          <div className="text-xs text-muted-foreground">{new Date(score.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No scores recorded yet</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div
        className="relative bg-gradient-to-b from-sky-400 to-sky-600 dark:from-sky-800 dark:to-sky-900"
        style={{ height: GAME_HEIGHT, width: GAME_WIDTH }}
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
            className="absolute flex items-center justify-center text-2xl"
            style={{
              left: BIRD_X_POSITION,
              top: birdY,
              width: BIRD_WIDTH,
              height: BIRD_HEIGHT,
              transform: `rotate(${Math.min(Math.max(birdVelocity * 3, -45), 30)}deg) scaleX(-1)`,
              transition: "transform 150ms",
            }}
          >
            🐦
          </div>

          {/* Oyun başlamamış göstərilən təlimat */}
          {!isPlaying && !isGameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <div className="text-center p-4 rounded-lg bg-black/60">
                <h3 className="text-2xl font-bold mb-2">Başlamağa Hazırsan?</h3>
                <p className="text-lg mb-2">🎮 SPACE tuşuna basın</p>
                <p className="text-sm">Oyun başladıqdan sonra klik və ya SPACE ilə uçun</p>
              </div>
            </div>
          )}

          {/* Oyun bitdikdən sonra göstərilən ekran */}
          {isGameOver && !showScoreSubmit && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-gray-900 border-2 border-red-500 rounded-lg p-4 w-full max-w-72 text-center">
                {/* Trophy Icon */}
                <div className="text-4xl mb-3 text-red-500">🏆</div>

                {/* Game Over Title */}
                <h2 className="text-2xl font-bold mb-3 text-white">Game Over!</h2>

                {/* Final Score */}
                <p className="text-lg mb-4 text-gray-300">Final Score: {score}</p>

                {/* Name Input - Optional */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg p-2.5">
                    <span className="text-white text-lg">👤</span>
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm"
                      maxLength={20}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={handleScoreSubmit}
                    disabled={!playerName.trim() || submitScoreMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {submitScoreMutation.isPending ? "Saving..." : "Save Score"}
                  </Button>

                  <Button
                    onClick={startGame}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-medium"
                  >
                    Play Again
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* Mobile Jump Button - Only visible when playing */}

        </div>
      </div>

      {showScoreSubmit && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-10">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-center text-yellow-400">
              🎉 Yeni Rekord!
            </h3>
            <p className="text-center text-muted-foreground mb-4">
              Xalınız: {score}
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Adınızı daxil edin..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                maxLength={20}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleScoreSubmit}
                  disabled={!playerName.trim() || submitScoreMutation.isPending}
                  className="flex-1"
                >
                  {submitScoreMutation.isPending
                    ? "Yaddaşda..."
                    : "Yadda Saxla"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowScoreSubmit(false)}
                  className="flex-1"
                >
                  Keç
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Screen */}
      {showResults && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-10">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-center text-primary">
              📊 Oyun Nəticələri
            </h3>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm text-muted-foreground">Son Xal:</span>
                <span className="font-bold text-primary">{score}</span>
              </div>

              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm text-muted-foreground">Oyun Müddəti:</span>
                <span className="font-bold">{gameStats.gameTime}s</span>
              </div>

              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm text-muted-foreground">Ümumi Tullanma:</span>
                <span className="font-bold">{gameStats.totalFlaps}</span>
              </div>

              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm text-muted-foreground">Keçilən Boru:</span>
                <span className="font-bold">{gameStats.pipesPassed}</span>
              </div>

              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm text-muted-foreground">Tullanma/Xal:</span>
                <span className="font-bold">
                  {gameStats.pipesPassed > 0
                    ? (gameStats.totalFlaps / gameStats.pipesPassed).toFixed(1)
                    : "0.0"
                  }
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={startGame} className="flex-1">
                🎮 Yenidən Oyna
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowResults(false)}
                className="flex-1"
              >
                Bağla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* External Mobile Jump Button */}
      <div className="p-4 flex justify-center bg-background border-t">
        <Button
          className="w-full h-14 text-xl font-bold rounded-xl shadow-md active:scale-95 transition-transform"
          onClick={(e) => {
            e.preventDefault();
            if (isGameOver) {
              startGame(); // Restart if game over
            } else if (!isPlaying) {
              startGame(); // Start if not playing
            } else {
              flap(); // Flap if playing
            }
          }}
          size="lg"
          variant={isGameOver ? "destructive" : "default"}
        >
          {isGameOver ? "YENİDƏN BAŞLA 🔄" : isPlaying ? "HOPLAN ⬆️" : "BAŞLA / HOPLAN 🚀"}
        </Button>
      </div>
    </div>
  );
}
