import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, User, List } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Position {
  x: number;
  y: number;
}

interface SnakeGameProps {
  onBack: () => void;
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_FOOD = { x: 15, y: 15 };
const GAME_SPEED = 150;

export default function SnakeGame({ onBack }: SnakeGameProps) {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>(INITIAL_FOOD);
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>("");
  const [showScoreSubmit, setShowScoreSubmit] = useState<boolean>(false);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef<Direction>("RIGHT");
  const queryClient = useQueryClient();

  // Fetch top scores for snake game
  const { data: topScores = [] } = useQuery({
    queryKey: ['/api/games/snake/scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/snake/scores?limit=5');
      if (!response.ok) throw new Error('Failed to fetch scores');
      return response.json();
    }
  });

  // Fetch all scores for results modal
  const { data: allScores = [] } = useQuery({
    queryKey: ['/api/games/snake/all-scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/snake/scores');
      if (!response.ok) throw new Error('Failed to fetch all scores');
      return response.json();
    }
  });

  // Submit score mutation
  const submitScoreMutation = useMutation({
    mutationFn: async (scoreData: { playerName: string; score: number }) => {
      const response = await fetch('/api/games/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scoreData,
          gameType: 'snake'
        }),
      });
      if (!response.ok) throw new Error('Failed to submit score');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/snake/scores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games/snake/all-scores'] });
      setShowScoreSubmit(false);
      setPlayerName("");
    }
  });

  // Generate random food position
  const generateFood = useCallback((currentSnake: Position[]) => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (
      currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)
    );
    return newFood;
  }, []);

  // Check if position hits self (collision with own body)
  const hitsOwnBody = useCallback((pos: Position, currentSnake: Position[]) => {
    return currentSnake.some(segment => segment.x === pos.x && segment.y === pos.y);
  }, []);

  // Handle wall wrapping - snake comes out from opposite side
  const wrapPosition = useCallback((pos: Position): Position => {
    return {
      x: pos.x < 0 ? GRID_SIZE - 1 : pos.x >= GRID_SIZE ? 0 : pos.x,
      y: pos.y < 0 ? GRID_SIZE - 1 : pos.y >= GRID_SIZE ? 0 : pos.y,
    };
  }, []);

  // Move snake
  const moveSnake = useCallback(() => {
    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      let head = { ...newSnake[0] };

      // Move head based on direction
      switch (directionRef.current) {
        case "UP":
          head.y -= 1;
          break;
        case "DOWN":
          head.y += 1;
          break;
        case "LEFT":
          head.x -= 1;
          break;
        case "RIGHT":
          head.x += 1;
          break;
      }

      // Wrap around walls - snake comes out from opposite side
      head = wrapPosition(head);

      // Check for collision with own body (game over)
      if (hitsOwnBody(head, newSnake)) {
        setIsGameOver(true);
        setIsPlaying(false);
        // Check if this is a new high score
        const isRecord = topScores.length === 0 || score > (topScores[0]?.score || 0);
        setIsNewRecord(isRecord);
        setShowScoreSubmit(true);
        return currentSnake;
      }

      newSnake.unshift(head);

      // Check if food is eaten
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, hitsOwnBody, wrapPosition, generateFood]);

  // Handle direction change
  const changeDirection = useCallback((newDirection: Direction) => {
    if (!isPlaying) return;
    
    const opposites = {
      UP: "DOWN",
      DOWN: "UP",
      LEFT: "RIGHT",
      RIGHT: "LEFT"
    };
    
    if (opposites[newDirection] !== directionRef.current) {
      setDirection(newDirection);
      directionRef.current = newDirection;
    }
  }, [isPlaying]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          changeDirection("UP");
          break;
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          changeDirection("DOWN");
          break;
        case "ArrowLeft":
          e.preventDefault();
          changeDirection("LEFT");
          break;
        case "ArrowRight":
          e.preventDefault();
          changeDirection("RIGHT");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [changeDirection]);

  // Game loop
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      gameIntervalRef.current = setInterval(moveSnake, GAME_SPEED);
    } else {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    }

    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  }, [isPlaying, isGameOver, moveSnake]);

  // Start game
  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    setFood(INITIAL_FOOD);
    setDirection("RIGHT");
    directionRef.current = "RIGHT";
    setScore(0);
    setIsGameOver(false);
    setIsPlaying(true);
  };

  // Reset game
  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setFood(INITIAL_FOOD);
    setDirection("RIGHT");
    directionRef.current = "RIGHT";
    setScore(0);
    setIsGameOver(false);
    setIsPlaying(false);
    setShowScoreSubmit(false);
    setIsNewRecord(false);
    setPlayerName("");
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Mobile Header - Compact */}
      <div className="flex items-center justify-between p-3 bg-muted/20 border-b shrink-0">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back
        </Button>
        
        {/* Game Stats and Record Score */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <span className="font-bold">{score}</span>
            <span className="text-muted-foreground">score</span>
          </div>
          <div className="w-px h-4 bg-muted"></div>
          <div className="flex items-center gap-1">
            <span className="font-bold">{snake.length}</span>
            <span className="text-muted-foreground">length</span>
          </div>
        </div>

        {/* Control Buttons - Compact */}
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
                  Snake Game - All Results
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {allScores.length > 0 ? (
                  <div className="space-y-2">
                    {allScores.map((score: any, index: number) => (
                      <div key={score.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/30 border">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${
                            index < 3 ? 
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
          {!isPlaying && !isGameOver ? (
            <Button onClick={startGame} size="sm">
              Start
            </Button>
          ) : (
            <Button onClick={resetGame} size="sm" variant="outline">
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Game Over Modal with Score Submission */}
      {isGameOver && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="border-destructive max-w-sm w-full">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 mx-auto mb-3 text-destructive" />
              <h2 className="text-lg font-bold mb-2">
                {isNewRecord ? "🏆 NEW HIGH SCORE!" : "Game Over!"}
              </h2>
              <p className="text-sm mb-4">
                Final Score: {score}
                {isNewRecord && <span className="block text-yellow-600 font-semibold mt-1">New Record!</span>}
              </p>
              
              {/* Score Submission Form */}
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

      {/* Game Board - Responsive */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div 
          className="grid border-2 border-muted bg-muted/20 rounded-lg" 
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            width: `min(100vw - 16px, 100vh - 160px, 500px)`,
            height: `min(100vw - 16px, 100vh - 160px, 500px)`
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);
            
            const snakeSegmentIndex = snake.findIndex(segment => segment.x === x && segment.y === y);
            const isSnakeHead = snakeSegmentIndex === 0;
            const isSnakeTail = snakeSegmentIndex === snake.length - 1 && snake.length > 1;
            const isSnakeBody = snakeSegmentIndex > 0 && snakeSegmentIndex < snake.length - 1;
            const isFood = food.x === x && food.y === y;

            // Determine snake head direction for styling
            let headDirection = "";
            if (isSnakeHead && snake.length > 1) {
              const neck = snake[1];
              const head = snake[0];
              if (head.x > neck.x || (head.x === 0 && neck.x === GRID_SIZE - 1)) headDirection = "right";
              else if (head.x < neck.x || (head.x === GRID_SIZE - 1 && neck.x === 0)) headDirection = "left";
              else if (head.y > neck.y || (head.y === 0 && neck.y === GRID_SIZE - 1)) headDirection = "down";
              else if (head.y < neck.y || (head.y === GRID_SIZE - 1 && neck.y === 0)) headDirection = "up";
            }

            let cellContent = null;
            let cellClass = "relative flex items-center justify-center w-full h-full aspect-square";

            if (isSnakeHead) {
              cellClass += " bg-green-600";
              // Add snake head with eyes based on direction
              cellContent = (
                <div className="w-full h-full rounded-full bg-green-600 relative flex items-center justify-center">
                  <div className={`flex ${
                    headDirection === "right" ? "justify-end pr-0.5" :
                    headDirection === "left" ? "justify-start pl-0.5" :
                    headDirection === "down" ? "items-end pb-0.5 flex-col" :
                    headDirection === "up" ? "items-start pt-0.5 flex-col" :
                    "justify-center"
                  } gap-px`}>
                    <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                    <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                  </div>
                </div>
              );
            } else if (isSnakeTail) {
              cellClass += " bg-green-400";
              cellContent = (
                <div className="w-4/5 h-4/5 rounded-full bg-green-400"></div>
              );
            } else if (isSnakeBody) {
              cellClass += " bg-green-500";
              cellContent = (
                <div className="w-full h-full rounded-sm bg-green-500 border border-green-600"></div>
              );
            } else if (isFood) {
              cellClass += " bg-transparent";
              cellContent = (
                <div className="w-4/5 h-4/5 rounded-full bg-red-500 shadow-lg relative">
                  <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-red-300 rounded-full"></div>
                </div>
              );
            }

            return (
              <div key={index} className={cellClass}>
                {cellContent}
              </div>
            );
          })}
        </div>
      </div>

      {/* Direction Control Buttons - Mobile Optimized */}
      <div className="shrink-0 p-4 pb-6">
        <div className="grid grid-cols-3 gap-2 max-w-48 mx-auto">
          <div></div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => changeDirection("UP")}
            disabled={!isPlaying}
            className="h-12 w-12 p-0"
          >
            <ArrowUp className="h-6 w-6" />
          </Button>
          <div></div>
          
          <Button
            variant="outline"
            size="lg"
            onClick={() => changeDirection("LEFT")}
            disabled={!isPlaying}
            className="h-12 w-12 p-0"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div></div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => changeDirection("RIGHT")}
            disabled={!isPlaying}
            className="h-12 w-12 p-0"
          >
            <ArrowRight className="h-6 w-6" />
          </Button>
          
          <div></div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => changeDirection("DOWN")}
            disabled={!isPlaying}
            className="h-12 w-12 p-0"
          >
            <ArrowDown className="h-6 w-6" />
          </Button>
          <div></div>
        </div>

        {/* Leaderboard Display - Compact */}


        {/* Instructions - Compact */}
        <div className="mt-4 text-center text-xs text-muted-foreground">
          <p>Use buttons or arrow keys to control</p>
          <p>Snake wraps around walls</p>
        </div>
      </div>
    </div>
  );
}