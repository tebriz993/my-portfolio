import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCw, User, List } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Position {
  x: number;
  y: number;
}

interface TetrisGameProps {
  onBack: () => void;
}

// Tetris pieces (Tetrominos)
const TETROMINOS = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: 'bg-cyan-500'
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: 'bg-yellow-500'
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-purple-500'
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: 'bg-green-500'
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-red-500'
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-blue-500'
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-orange-500'
  },
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const INITIAL_DROP_TIME = Math.round(1000 / 1.3); // ~769ms for 1.3x speed

interface Tetromino {
  shape: number[][];
  color: string;
  position: Position;
}

export default function TetrisGame({ onBack }: TetrisGameProps) {
  const [board, setBoard] = useState<string[][]>(
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(''))
  );
  const [currentPiece, setCurrentPiece] = useState<Tetromino | null>(null);
  const [nextPiece, setNextPiece] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [linesCleared, setLinesCleared] = useState<number>(0);
  const [piecesPlaced, setPiecesPlaced] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [dropTime, setDropTime] = useState<number>(INITIAL_DROP_TIME);
  const [playerName, setPlayerName] = useState<string>("");
  const [showScoreSubmit, setShowScoreSubmit] = useState<boolean>(false);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  const dropTimeRef = useRef<number>(INITIAL_DROP_TIME);
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Fetch top scores for tetris game
  const { data: topScores = [] } = useQuery({
    queryKey: ['/api/games/tetris/scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/tetris/scores?limit=5');
      if (!response.ok) throw new Error('Failed to fetch scores');
      return response.json();
    }
  });

  // Fetch all scores for results modal
  const { data: allScores = [] } = useQuery({
    queryKey: ['/api/games/tetris/all-scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/tetris/scores');
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
          gameType: 'tetris'
        }),
      });
      if (!response.ok) throw new Error('Failed to submit score');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/tetris/scores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games/tetris/all-scores'] });
      setShowScoreSubmit(false);
      setPlayerName("");
    }
  });

  // Get random tetromino
  const getRandomTetromino = useCallback((): string => {
    const pieces = Object.keys(TETROMINOS);
    return pieces[Math.floor(Math.random() * pieces.length)];
  }, []);

  // Create new tetromino
  const createTetromino = useCallback((type: string): Tetromino => {
    const pieceData = TETROMINOS[type as keyof typeof TETROMINOS];
    return {
      shape: pieceData.shape,
      color: pieceData.color,
      position: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(pieceData.shape[0].length / 2), y: 0 }
    };
  }, []);

  // Check if position is valid
  const isValidPosition = useCallback((piece: Tetromino, board: string[][], offset = { x: 0, y: 0 }): boolean => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          const newX = piece.position.x + x + offset.x;
          const newY = piece.position.y + y + offset.y;

          // Check boundaries
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return false;
          }

          // Check collision with existing pieces
          if (newY >= 0 && board[newY][newX] !== '') {
            return false;
          }
        }
      }
    }
    return true;
  }, []);

  // Rotate piece
  const rotatePiece = useCallback((piece: Tetromino): Tetromino => {
    const rotatedShape = piece.shape[0].map((_, index) =>
      piece.shape.map(row => row[index]).reverse()
    );
    return { ...piece, shape: rotatedShape };
  }, []);

  // Move piece
  const movePiece = useCallback((direction: 'left' | 'right' | 'down' | 'rotate') => {
    if (!currentPiece || !isPlaying || isGameOver) return;

    let newPiece = { ...currentPiece };
    let offset = { x: 0, y: 0 };

    switch (direction) {
      case 'left':
        offset.x = -1;
        break;
      case 'right':
        offset.x = 1;
        break;
      case 'down':
        offset.y = 1;
        break;
      case 'rotate':
        newPiece = rotatePiece(currentPiece);
        break;
    }

    if (direction === 'rotate') {
      if (isValidPosition(newPiece, board)) {
        setCurrentPiece(newPiece);
      }
    } else {
      if (isValidPosition(currentPiece, board, offset)) {
        setCurrentPiece({
          ...currentPiece,
          position: {
            x: currentPiece.position.x + offset.x,
            y: currentPiece.position.y + offset.y
          }
        });
      } else if (direction === 'down') {
        // Lock piece in place
        lockPiece();
      }
    }
  }, [currentPiece, board, isPlaying, isGameOver, isValidPosition, rotatePiece]);

  // Lock piece in place
  const lockPiece = useCallback(() => {
    if (!currentPiece) return;

    const newBoard = board.map(row => [...row]);

    // Place piece on board
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x] !== 0) {
          const boardY = currentPiece.position.y + y;
          const boardX = currentPiece.position.x + x;
          if (boardY >= 0) {
            newBoard[boardY][boardX] = currentPiece.color;
          }
        }
      }
    }

    // Check for completed lines
    const completedLines: number[] = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (newBoard[y].every(cell => cell !== '')) {
        completedLines.push(y);
      }
    }

    // Remove completed lines
    if (completedLines.length > 0) {
      // Create a new board without the completed lines
      const filteredBoard = newBoard.filter((_, index) => !completedLines.includes(index));
      // Add empty rows at the top to maintain board height
      const emptyRows = Array(completedLines.length).fill(null).map(() => Array(BOARD_WIDTH).fill(''));
      newBoard.splice(0, newBoard.length, ...emptyRows, ...filteredBoard);

      // Update score and level
      const points = [0, 40, 100, 300, 1200][completedLines.length] * level;
      setScore(prev => prev + points);
      setLinesCleared(prev => {
        const newLinesCleared = prev + completedLines.length;
        const newLevel = Math.floor(newLinesCleared / 10) + 1;
        if (newLevel > level) {
          setLevel(newLevel);
          const newDropTime = Math.max(50, INITIAL_DROP_TIME - (newLevel - 1) * 100);
          setDropTime(newDropTime);
          dropTimeRef.current = newDropTime;
        }
        return newLinesCleared;
      });
    }

    setBoard(newBoard);

    // Increment pieces placed counter and update speed
    setPiecesPlaced(prev => {
      const newPiecesPlaced = prev + 1;
      // Every 5 pieces, increase speed by 0.5x
      if (newPiecesPlaced % 5 === 0) {
        setSpeedMultiplier(prevMultiplier => {
          const newMultiplier = prevMultiplier + 0.5;
          const newDropTime = Math.max(50, Math.round(INITIAL_DROP_TIME / newMultiplier));
          setDropTime(newDropTime);
          dropTimeRef.current = newDropTime;
          return newMultiplier;
        });
      }
      return newPiecesPlaced;
    });

    // Create new piece
    const newPieceType = nextPiece || getRandomTetromino();
    const newPiece = createTetromino(newPieceType);

    // Check game over
    if (!isValidPosition(newPiece, newBoard)) {
      setIsGameOver(true);
      setIsPlaying(false);
      // Check if this is a new high score
      const isRecord = topScores.length === 0 || score > (topScores[0]?.score || 0);
      setIsNewRecord(isRecord);
      setShowScoreSubmit(true);
      return;
    }

    setCurrentPiece(newPiece);
    setNextPiece(getRandomTetromino());
  }, [currentPiece, board, level, nextPiece, getRandomTetromino, createTetromino, isValidPosition]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isPlaying || isGameOver) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          movePiece('left');
          break;
        case "ArrowRight":
          e.preventDefault();
          movePiece('right');
          break;
        case "ArrowDown":
          e.preventDefault();
          movePiece('down');
          break;
        case "ArrowUp":
        case " ":
          e.preventDefault();
          movePiece('rotate');
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [movePiece, isPlaying, isGameOver]);

  // Game loop
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      gameIntervalRef.current = setInterval(() => {
        movePiece('down');
      }, dropTimeRef.current);
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
  }, [isPlaying, isGameOver, movePiece]);

  // Update drop time ref when state changes
  useEffect(() => {
    dropTimeRef.current = dropTime;
  }, [dropTime]);

  // Start game
  const startGame = () => {
    const newBoard = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(''));
    const firstPiece = createTetromino(getRandomTetromino());

    setBoard(newBoard);
    setCurrentPiece(firstPiece);
    setNextPiece(getRandomTetromino());
    setScore(0);
    setLevel(1);
    setLinesCleared(0);
    setDropTime(INITIAL_DROP_TIME);
    dropTimeRef.current = INITIAL_DROP_TIME;
    setIsGameOver(false);
    setIsPlaying(true);
  };

  // Reset game
  const resetGame = () => {
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill('')));
    setCurrentPiece(null);
    setNextPiece('');
    setScore(0);
    setLevel(1);
    setLinesCleared(0);
    setPiecesPlaced(0);
    setSpeedMultiplier(1);
    setDropTime(INITIAL_DROP_TIME);
    dropTimeRef.current = INITIAL_DROP_TIME;
    setIsGameOver(false);
    setIsPlaying(false);
    setShowScoreSubmit(false);
    setIsNewRecord(false);
    setPlayerName("");
  };

  // Render board with current piece
  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);

    // Add current piece to display board
    if (currentPiece) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x] !== 0) {
            const boardY = currentPiece.position.y + y;
            const boardX = currentPiece.position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.color;
            }
          }
        }
      }
    }

    return displayBoard;
  };

  const displayBoard = renderBoard();

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Mobile Header - Snake-style Compact */}
      <div className="flex items-center justify-between p-3 bg-muted/20 border-b shrink-0">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back
        </Button>

        {/* Game Stats - Compact for mobile */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1">
            <span className="font-bold">{score}</span>
            <span className="text-muted-foreground hidden sm:inline">score</span>
          </div>
          <div className="w-px h-4 bg-muted"></div>
          <div className="flex items-center gap-1">
            <span className="font-bold">{level}</span>
            <span className="text-muted-foreground hidden sm:inline">lvl</span>
          </div>
          <div className="w-px h-4 bg-muted hidden sm:block"></div>
          <div className="flex items-center gap-1 hidden sm:flex">
            <span className="font-bold text-green-500">{speedMultiplier.toFixed(1)}x</span>
          </div>
        </div>

        {/* Control Buttons - Always visible */}
        <div className="flex gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <List className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Results</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Tetris Game - All Results
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
          {!isPlaying && !isGameOver ? (
            <Button onClick={startGame} size="sm" className="bg-green-600 hover:bg-green-700">
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
              <div className="text-sm mb-4 space-y-1">
                <p>Final Score: {score}</p>
                <p>Level: {level}</p>
                <p>Lines Cleared: {linesCleared}</p>
                {isNewRecord && <p className="text-yellow-600 font-semibold">New Record!</p>}
              </div>

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

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center p-1 relative">
        {/* Next Piece Preview - Top Left Corner */}
        <Card className="absolute top-4 left-4 p-2 z-10">
          <div className="text-xs font-semibold mb-1 text-center">Next</div>
          <div
            className="grid bg-gray-900 border rounded"
            style={{
              gridTemplateColumns: 'repeat(4, 12px)',
              gridTemplateRows: 'repeat(4, 12px)',
              width: '48px',
              height: '48px'
            }}
          >
            {nextPiece && Array.from({ length: 16 }, (_, i) => {
              const x = i % 4;
              const y = Math.floor(i / 4);
              const piece = TETROMINOS[nextPiece as keyof typeof TETROMINOS];
              const isActive = piece.shape[y] && piece.shape[y][x] === 1;
              return (
                <div
                  key={i}
                  className={`${isActive ? piece.color : 'bg-gray-800'}`}
                />
              );
            })}
          </div>
        </Card>

        {/* Main Game Board */}
        <div
          className="grid border-2 border-muted bg-black rounded-lg"
          style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
            width: `min(75vw, 70vh - 120px, 350px)`,
            height: `min(150vw, 70vh - 120px, 700px)`
          }}
        >
          {displayBoard.map((row, y) =>
            row.map((cell, x) => (
              <div
                key={`${y}-${x}`}
                className={`border border-gray-700 ${cell || 'bg-gray-900'}`}
              />
            ))
          )}
        </div>
      </div>

      {/* Direction Control Buttons - Mobile Optimized */}
      <div className="shrink-0 p-4 bg-muted/10">
        <div className="grid grid-cols-4 gap-3 max-w-80 mx-auto">
          <Button
            variant="outline"
            size="lg"
            onClick={() => movePiece('rotate')}
            disabled={!isPlaying}
            className="h-12 text-sm"
          >
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => movePiece('left')}
            disabled={!isPlaying}
            className="h-12"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => movePiece('down')}
            disabled={!isPlaying}
            className="h-12"
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => movePiece('right')}
            disabled={!isPlaying}
            className="h-12"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Instructions - Compact */}
        <div className="mt-2 text-center text-xs text-muted-foreground">
          <p>Use buttons or arrow keys • SPACE to rotate</p>
        </div>
      </div>
    </div>
  );
}