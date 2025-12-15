import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trophy, User, List } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DinoGameProps {
  onBack: () => void;
}

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: 'cactus' | 'bird';
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 200;
const DINO_WIDTH = 65;  // Increased from 40 -> 55 -> 65 for MUCH better visibility
const DINO_HEIGHT = 65; // Increased from 40 -> 55 -> 65 - birds MUST hit now!
const GROUND_HEIGHT = 20;
const GRAVITY = 1.0;
const JUMP_FORCE = -20;
const GAME_SPEED = 4;

export default function DinoGame({ onBack }: DinoGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [dinoY, setDinoY] = useState(GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT);
  const [dinoVelocityY, setDinoVelocityY] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [isDucking, setIsDucking] = useState(false);
  const dinoVelocityRef = useRef(0);
  const dinoYRef = useRef(GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [gameSpeed, setGameSpeed] = useState(GAME_SPEED);
  const [playerName, setPlayerName] = useState("");
  const [showScoreSubmit, setShowScoreSubmit] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  // Parallax background offsets
  const [cloudOffset, setCloudOffset] = useState(0);
  const [mountainOffset, setMountainOffset] = useState(0);
  const [groundOffset, setGroundOffset] = useState(0);

  const gameLoopRef = useRef<number>();
  const queryClient = useQueryClient();

  // Fetch top scores for dino game
  const { data: topScores = [] } = useQuery({
    queryKey: ['/api/games/dino/scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/dino/scores?limit=5');
      if (!response.ok) throw new Error('Failed to fetch scores');
      return response.json();
    }
  });

  // Fetch all scores for results modal
  const { data: allScores = [] } = useQuery({
    queryKey: ['/api/games/dino/all-scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/dino/scores');
      if (!response.ok) throw new Error('Failed to fetch all scores');
      return response.json();
    }
  });

  // Submit score mutation
  const submitScoreMutation = useMutation({
    mutationFn: async (scoreData: { playerName: string; score: number }) => {
      const response = await fetch('/api/games/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...scoreData,
          gameType: 'dino'
        }),
      });
      if (!response.ok) throw new Error('Failed to submit score');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/dino/scores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games/dino/all-scores'] });
      setShowScoreSubmit(false);
    }
  });

  const jump = useCallback(() => {
    if (isPlaying && !isGameOver && !isDucking) {
      const groundY = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;
      if (dinoYRef.current >= groundY - 5) { // Only jump if near ground
        dinoVelocityRef.current = JUMP_FORCE;
        setDinoVelocityY(JUMP_FORCE);
        setIsJumping(true);
      }
    }
  }, [isPlaying, isGameOver, isDucking]);

  const duck = useCallback(() => {
    if (!isJumping && isPlaying && !isGameOver) {
      isDuckingRef.current = true;
      setIsDucking(true);
    }
  }, [isJumping, isPlaying, isGameOver]);

  const stopDucking = useCallback(() => {
    isDuckingRef.current = false;
    setIsDucking(false);
  }, []);

  const checkCollision = useCallback((dino: { x: number, y: number, width: number, height: number }, obstacle: Obstacle) => {
    // CRITICAL: Bird Y position MUST match rendering position!
    const obstacleY = obstacle.type === 'cactus'
      ? GAME_HEIGHT - GROUND_HEIGHT - obstacle.height
      : GAME_HEIGHT - GROUND_HEIGHT - obstacle.height - 45; // Birds at 45px - VERY LOW, will definitely hit!

    // Precise collision detection
    const margin = 3;
    return (
      dino.x + margin < obstacle.x + obstacle.width - margin &&
      dino.x + dino.width - margin > obstacle.x + margin &&
      dino.y + margin < obstacleY + obstacle.height - margin &&
      dino.y + dino.height - margin > obstacleY + margin
    );
  }, []);

  const gameLoop = useCallback(() => {
    if (!isPlaying || isGameOver) return;

    // Update score
    setScore(prev => prev + 1);

    // Increase game speed gradually
    setGameSpeed(prev => Math.min(prev + 0.001, 8));

    // Update parallax background
    setCloudOffset(prev => (prev + gameSpeed * 0.2) % GAME_WIDTH);
    setMountainOffset(prev => (prev + gameSpeed * 0.5) % GAME_WIDTH);
    setGroundOffset(prev => (prev + gameSpeed) % 50);

    // Update dino physics using refs for immediate updates
    const groundY = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;

    // Update velocity
    dinoVelocityRef.current += GRAVITY;

    // Update position
    dinoYRef.current += dinoVelocityRef.current;

    // Check ground collision
    if (dinoYRef.current >= groundY) {
      dinoYRef.current = groundY;
      dinoVelocityRef.current = 0;
      setIsJumping(false);
    }

    // Update state for rendering
    setDinoY(dinoYRef.current);
    setDinoVelocityY(dinoVelocityRef.current);

    // Update obstacles
    setObstacles(prev => {
      const updated = prev
        .map(obstacle => ({ ...obstacle, x: obstacle.x - gameSpeed }))
        .filter(obstacle => obstacle.x + obstacle.width > 0);



      // Add new obstacles
      const lastObstacle = updated[updated.length - 1];
      const shouldAddObstacle = !lastObstacle || lastObstacle.x < GAME_WIDTH - 200 - Math.random() * 100;

      if (shouldAddObstacle && Math.random() < 0.01) {
        const obstacleType = Math.random() < 0.7 ? 'cactus' : 'bird';
        const newObstacle: Obstacle = {
          x: GAME_WIDTH,
          width: obstacleType === 'cactus' ? 25 : 40,  // Birds slightly wider
          height: obstacleType === 'cactus' ? 35 : 35, // Birds taller for better visibility
          type: obstacleType
        };
        updated.push(newObstacle);
      }

      return updated;
    });

    // Check collisions
    const currentDinoHeight = isDuckingRef.current ? DINO_HEIGHT / 2 : DINO_HEIGHT;
    const currentDinoY = isDuckingRef.current ? dinoYRef.current + DINO_HEIGHT / 2 : dinoYRef.current;

    const dinoRect = {
      x: 50,
      y: currentDinoY,
      width: DINO_WIDTH,
      height: currentDinoHeight
    };

    for (const obstacle of obstacles) {
      if (checkCollision(dinoRect, obstacle)) {
        setIsGameOver(true);
        setIsPlaying(false);

        // Check if this is a new high score
        const isRecord = topScores.length === 0 || score > (topScores[0]?.score || 0);
        setIsNewRecord(isRecord);
        setShowScoreSubmit(true);
        return;
      }
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, isGameOver, gameSpeed, obstacles, score, topScores, checkCollision]);

  // Handle keyboard input with refs for immediate response
  const isPlayingRef = useRef(false);
  const isGameOverRef = useRef(false);
  const isDuckingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    isGameOverRef.current = isGameOver;
    isDuckingRef.current = isDucking;
  }, [isPlaying, isGameOver, isDucking]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only prevent default for our game keys (removed PageUp/PageDown)
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
      }

      // Only Space and ArrowUp for jump (PageUp removed to prevent scrolling conflicts)
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        // Direct jump without callback dependency
        if (isPlayingRef.current && !isGameOverRef.current && !isDuckingRef.current) {
          const groundY = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;
          if (dinoYRef.current >= groundY - 5) {
            dinoVelocityRef.current = JUMP_FORCE;
            setDinoVelocityY(JUMP_FORCE);
            setIsJumping(true);
          }
        }
      } else if (e.code === 'ArrowDown') {
        // Direct duck without callback dependency
        if (isPlayingRef.current && !isGameOverRef.current && !e.repeat) {
          isDuckingRef.current = true;
          setIsDucking(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        isDuckingRef.current = false;
        setIsDucking(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty dependency array for constant event listeners

  // Game loop effect
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

  const startGame = () => {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;
    setScore(0);
    setDinoY(groundY);
    setDinoVelocityY(0);
    dinoYRef.current = groundY;
    dinoVelocityRef.current = 0;
    isDuckingRef.current = false;
    setIsJumping(false);
    setIsDucking(false);
    setObstacles([]);
    setGameSpeed(GAME_SPEED);
    setIsGameOver(false);
    setIsPlaying(true);
    setShowScoreSubmit(false);
    setIsNewRecord(false);
    setPlayerName("");
  };

  const resetGame = () => {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;
    setScore(0);
    setDinoY(groundY);
    setDinoVelocityY(0);
    dinoYRef.current = groundY;
    dinoVelocityRef.current = 0;
    isDuckingRef.current = false;
    setIsJumping(false);
    setIsDucking(false);
    setObstacles([]);
    setGameSpeed(GAME_SPEED);
    setIsGameOver(false);
    setIsPlaying(false);
    setShowScoreSubmit(false);
    setIsNewRecord(false);
    setPlayerName("");
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/20 border-b shrink-0">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back
        </Button>

        <div className="flex items-center gap-1">
          <span className="font-bold">{score}</span>
          <span className="text-muted-foreground">score</span>
        </div>

        <div className="flex gap-1">
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
                  Dino Game - All Results
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
                  <p className="text-center text-muted-foreground py-8">No scores yet. Be the first to play!</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {!isPlaying && !isGameOver && (
            <Button onClick={startGame} size="sm">
              Start Game
            </Button>
          )}
        </div>
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="border-destructive max-w-sm w-full">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 mx-auto mb-3 text-destructive" />
              <h2 className="text-lg font-bold mb-2">
                {isNewRecord ? "🦕 NEW HIGH SCORE!" : "Game Over!"}
              </h2>
              <div className="text-sm mb-4 space-y-1">
                <p>Final Score: {score}</p>
                {isNewRecord && <p className="text-yellow-600 font-semibold">New Record!</p>}
              </div>

              {showScoreSubmit && (
                <div className="mb-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <Input
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="flex-1"
                      maxLength={20}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (playerName.trim()) {
                        submitScoreMutation.mutate({
                          playerName: playerName.trim(),
                          score: score,
                        });
                      }
                    }}
                    disabled={!playerName.trim() || submitScoreMutation.isPending}
                    size="sm"
                    className="w-full mb-2"
                  >
                    {submitScoreMutation.isPending ? "Saving..." : "Save Score"}
                  </Button>
                </div>
              )}

              <Button onClick={resetGame} size="sm" className="w-full">
                Play Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="relative border-2 border-muted rounded-lg overflow-hidden"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        >
          {/* Sky Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-orange-200 dark:from-sky-900 dark:via-sky-700 dark:to-orange-900" />

          {/* Clouds Layer - Slowest parallax */}
          <div className="absolute inset-0" style={{ transform: `translateX(-${cloudOffset}px)` }}>
            {[0, 1, 2].map((i) => (
              <div key={`cloud-set-${i}`} className="absolute" style={{ left: i * GAME_WIDTH }}>
                {/* Cloud 1 */}
                <div className="absolute" style={{ top: '20px', left: '100px' }}>
                  <div className="flex gap-1">
                    <div className="w-8 h-6 bg-white/80 dark:bg-white/40 rounded-full" />
                    <div className="w-10 h-7 bg-white/80 dark:bg-white/40 rounded-full -ml-3" />
                    <div className="w-8 h-6 bg-white/80 dark:bg-white/40 rounded-full -ml-3" />
                  </div>
                </div>
                {/* Cloud 2 */}
                <div className="absolute" style={{ top: '40px', left: '300px' }}>
                  <div className="flex gap-1">
                    <div className="w-6 h-5 bg-white/70 dark:bg-white/30 rounded-full" />
                    <div className="w-8 h-6 bg-white/70 dark:bg-white/30 rounded-full -ml-2" />
                    <div className="w-6 h-5 bg-white/70 dark:bg-white/30 rounded-full -ml-2" />
                  </div>
                </div>
                {/* Cloud 3 */}
                <div className="absolute" style={{ top: '15px', left: '550px' }}>
                  <div className="flex gap-1">
                    <div className="w-7 h-5 bg-white/80 dark:bg-white/40 rounded-full" />
                    <div className="w-9 h-6 bg-white/80 dark:bg-white/40 rounded-full -ml-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mountains Layer - Medium parallax */}
          <div className="absolute bottom-0 left-0 right-0" style={{ transform: `translateX(-${mountainOffset}px)`, height: '100px' }}>
            {[0, 1, 2].map((i) => (
              <div key={`mountain-set-${i}`} className="absolute bottom-0" style={{ left: i * GAME_WIDTH, width: GAME_WIDTH }}>
                {/* Back mountains */}
                <svg className="absolute bottom-0" viewBox="0 0 800 80" style={{ width: '100%', height: '80px' }}>
                  <polygon points="0,80 150,20 300,80" fill="#8B7355" opacity="0.6" />
                  <polygon points="200,80 400,10 600,80" fill="#8B7355" opacity="0.6" />
                  <polygon points="500,80 700,25 800,80" fill="#8B7355" opacity="0.6" />
                </svg>
                {/* Front mountains */}
                <svg className="absolute bottom-0" viewBox="0 0 800 60" style={{ width: '100%', height: '60px' }}>
                  <polygon points="0,60 100,15 200,60" fill="#A0826D" />
                  <polygon points="150,60 350,5 550,60" fill="#A0826D" />
                  <polygon points="450,60 650,20 800,60" fill="#A0826D" />
                </svg>
              </div>
            ))}
          </div>

          {/* Animated Ground with pattern */}
          <div
            className="absolute bottom-0 w-full bg-gradient-to-br from-yellow-600 via-yellow-700 to-yellow-800 dark:from-yellow-800 dark:via-yellow-900 dark:to-yellow-950 border-t-4 border-yellow-900 dark:border-yellow-950"
            style={{ height: GROUND_HEIGHT }}
          >
            {/* Ground pattern */}
            <div
              className="absolute inset-0 flex"
              style={{ transform: `translateX(-${groundOffset}px)` }}
            >
              {Array.from({ length: Math.ceil(GAME_WIDTH / 50) + 2 }, (_, i) => (
                <div key={i} className="w-[50px] h-full border-r border-yellow-900/30" />
              ))}
            </div>
          </div>


          {/* Dino */}
          <div
            className="absolute rounded transition-all duration-75 flex items-center justify-center font-bold text-2xl"
            style={{
              left: 50,
              bottom: GAME_HEIGHT - dinoY - (isDucking ? DINO_HEIGHT / 2 : DINO_HEIGHT),
              width: DINO_WIDTH,
              height: isDucking ? DINO_HEIGHT / 2 : DINO_HEIGHT
            }}
          >
            {isDucking ? (
              <svg width="24" height="16" viewBox="0 0 32 16" fill="currentColor" className="text-green-700 dark:text-green-400">
                <g>
                  <rect x="8" y="8" width="16" height="8" rx="2" />
                  <rect x="20" y="6" width="6" height="4" rx="1" />
                  <rect x="6" y="12" width="4" height="4" />
                  <rect x="22" y="12" width="4" height="4" />
                  <circle cx="22" cy="8" r="1" />
                </g>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" className="text-green-700 dark:text-green-400">
                <g>
                  <rect x="10" y="8" width="12" height="20" rx="2" />
                  <rect x="18" y="6" width="8" height="6" rx="1" />
                  <rect x="8" y="24" width="4" height="4" />
                  <rect x="20" y="24" width="4" height="4" />
                  <circle cx="22" cy="9" r="1" />
                  <rect x="6" y="12" width="8" height="3" rx="1" />
                </g>
              </svg>
            )}
          </div>

          {/* Obstacles */}
          {obstacles.map((obstacle, index) => (
            <div
              key={index}
              className={`absolute ${obstacle.type === 'cactus'
                ? 'bg-green-800 dark:bg-green-600'
                : 'bg-gray-600 dark:bg-gray-400'
                } flex items-center justify-center text-white font-bold`}
              style={{
                left: obstacle.x,
                bottom: obstacle.type === 'cactus' ? GROUND_HEIGHT : GROUND_HEIGHT + 45,
                width: obstacle.width,
                height: obstacle.height
              }}
            >
              {obstacle.type === 'cactus' ? '🌵' : '🦅'}
            </div>
          ))}

          {/* Instructions */}
          {!isPlaying && !isGameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
              <div className="text-center text-white bg-black/50 p-4 rounded">
                <p className="text-lg font-bold mb-2">Dino Run</p>
                <p className="text-sm">↑ / SPACE: Jump 🦖</p>
                <p className="text-sm">↓: Duck - Avoid Birds! 🦅</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="shrink-0 p-4 bg-muted/10">
        <div className="max-w-80 mx-auto grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={jump}
            disabled={!isPlaying}
            className="h-12"
          >
            Jump ↑
          </Button>
          <Button
            variant="outline"
            size="lg"
            onMouseDown={duck}
            onMouseUp={stopDucking}
            onTouchStart={duck}
            onTouchEnd={stopDucking}
            disabled={!isPlaying}
            className="h-12"
          >
            Duck ↓
          </Button>
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">
          <p>↑/SPACE: Jump 🦖 • ↓: Duck (For Birds) 🦅</p>
        </div>
      </div>
    </div>
  );
}