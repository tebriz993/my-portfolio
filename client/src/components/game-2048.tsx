import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { GameScore } from "@shared/schema";

interface Game2048Props {
    onBack: () => void;
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const GRID_SIZE = 4;

export default function Game2048({ onBack }: Game2048Props) {
    const [grid, setGrid] = useState<number[][]>([]);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);

    // Submission state
    const [playerName, setPlayerName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const initializeGame = useCallback(() => {
        const newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
        addNewTile(newGrid);
        addNewTile(newGrid);
        setGrid(newGrid);
        setScore(0);
        setGameOver(false);
        setWon(false);
    }, []);

    useEffect(() => {
        initializeGame();
        // Load best score from local storage or API if available could be added here
        const savedBest = localStorage.getItem("2048-best-score");
        if (savedBest) {
            setBestScore(parseInt(savedBest));
        }
    }, [initializeGame]);

    useEffect(() => {
        if (score > bestScore) {
            setBestScore(score);
            localStorage.setItem("2048-best-score", score.toString());
        }
    }, [score, bestScore]);

    const addNewTile = (currentGrid: number[][]) => {
        const emptyCells = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (currentGrid[i][j] === 0) {
                    emptyCells.push({ x: i, y: j });
                }
            }
        }

        if (emptyCells.length > 0) {
            const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            currentGrid[x][y] = Math.random() < 0.9 ? 2 : 4;
        }
    };

    const move = useCallback((direction: Direction) => {
        if (gameOver || (won && !gameOver)) return;

        let moved = false;
        let newGrid = grid.map(row => [...row]);
        let addedScore = 0;

        const rotateGrid = (g: number[][]) => {
            const newG = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
            for (let i = 0; i < GRID_SIZE; i++) {
                for (let j = 0; j < GRID_SIZE; j++) {
                    newG[j][GRID_SIZE - 1 - i] = g[i][j];
                }
            }
            return newG;
        };

        const slide = (row: number[]) => {
            const arr = row.filter(val => val);
            const missing = GRID_SIZE - arr.length;
            const zeros = Array(missing).fill(0);
            return arr.concat(zeros);
        };

        const combine = (row: number[]) => {
            for (let i = 0; i < GRID_SIZE - 1; i++) {
                if (row[i] !== 0 && row[i] === row[i + 1]) {
                    row[i] = row[i] * 2;
                    row[i + 1] = 0;
                    addedScore += row[i];
                    if (row[i] === 2048 && !won) {
                        setWon(true);
                    }
                }
            }
            return row;
        };

        // Standardize to "slide left" operation by rotating
        if (direction === "RIGHT") newGrid = rotateGrid(rotateGrid(newGrid));
        if (direction === "DOWN") newGrid = rotateGrid(rotateGrid(rotateGrid(newGrid)));
        if (direction === "UP") newGrid = rotateGrid(newGrid);

        // Perform operation
        for (let i = 0; i < GRID_SIZE; i++) {
            const oldRow = [...newGrid[i]];
            newGrid[i] = slide(newGrid[i]);
            newGrid[i] = combine(newGrid[i]);
            newGrid[i] = slide(newGrid[i]);

            if (JSON.stringify(oldRow) !== JSON.stringify(newGrid[i])) {
                moved = true;
            }
        }

        // Rotate back
        if (direction === "RIGHT") newGrid = rotateGrid(rotateGrid(newGrid));
        if (direction === "DOWN") newGrid = rotateGrid(newGrid);
        if (direction === "UP") newGrid = rotateGrid(rotateGrid(rotateGrid(newGrid)));

        if (moved) {
            setScore(prev => prev + addedScore);
            addNewTile(newGrid);
            setGrid(newGrid);

            if (checkGameOver(newGrid)) {
                setGameOver(true);
            }
        }
    }, [grid, gameOver, won]);

    const checkGameOver = (currentGrid: number[][]) => {
        // Check for empty cells
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (currentGrid[i][j] === 0) return false;
            }
        }

        // Check for possible merges
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (i < GRID_SIZE - 1 && currentGrid[i][j] === currentGrid[i + 1][j]) return false;
                if (j < GRID_SIZE - 1 && currentGrid[i][j] === currentGrid[i][j + 1]) return false;
            }
        }

        return true;
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                switch (e.key) {
                    case "ArrowUp": move("UP"); break;
                    case "ArrowDown": move("DOWN"); break;
                    case "ArrowLeft": move("LEFT"); break;
                    case "ArrowRight": move("RIGHT"); break;
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [move]);

    // Touch handling
    const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart({
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        });
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - touchStart.x;
        const deltaY = touchEndY - touchStart.y;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (Math.abs(deltaX) > 30) { // Threshold
                if (deltaX > 0) move("RIGHT");
                else move("LEFT");
            }
        } else {
            if (Math.abs(deltaY) > 30) {
                if (deltaY > 0) move("DOWN");
                else move("UP");
            }
        }
        setTouchStart(null);
    };

    const getCellColor = (value: number) => {
        const colors: Record<number, string> = {
            0: "bg-muted",
            2: "bg-blue-100 text-blue-900",
            4: "bg-blue-200 text-blue-900",
            8: "bg-blue-300 text-white",
            16: "bg-blue-400 text-white",
            32: "bg-blue-500 text-white",
            64: "bg-blue-600 text-white",
            128: "bg-indigo-400 text-white",
            256: "bg-indigo-500 text-white",
            512: "bg-indigo-600 text-white",
            1024: "bg-purple-500 text-white",
            2048: "bg-purple-600 text-white",
        };
        return colors[value] || "bg-purple-900 text-white";
    };

    const { data: scores = [], isError, error } = useQuery<GameScore[]>({
        queryKey: ["/api/games/2048/scores"],
        queryFn: async () => {
            const res = await fetch("/api/games/2048/scores");
            if (!res.ok) {
                // If endpoint doesn't exist, just return empty to prevent error splash
                if (res.status === 404) return [];
                const text = await res.text();
                throw new Error(text || "Failed to fetch scores");
            }
            return res.json();
        },
        retry: false
    });

    const submitScore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) return;

        setIsSubmitting(true);
        try {
            await apiRequest("POST", "/api/games/scores", {
                playerName,
                gameType: "2048",
                score: score,
            });

            toast({
                title: "Score Saved!",
                description: `You scored ${score} points!`,
            });

            queryClient.invalidateQueries({ queryKey: ["/api/games/2048/scores"] });

        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save score. Maybe the backend doesn't support this game yet.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-6 select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="w-full flex items-center justify-between mb-2">
                <Button variant="ghost" onClick={onBack} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Games
                </Button>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Trophy className="h-4 w-4 mr-2 text-yellow-500" />
                            Leaderboard
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                2048 Leaderboard
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 mt-4">
                            {isError ? (
                                <div className="p-4 rounded-lg bg-muted text-center text-sm">
                                    <p>Leaderboard not available yet.</p>
                                </div>
                            ) : scores.length > 0 ? (
                                scores.map((s, i) => (
                                    <div key={s.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="font-mono text-muted-foreground w-6">#{i + 1}</div>
                                            <div className="font-bold">{s.playerName}</div>
                                        </div>
                                        <div className="font-mono font-bold text-primary">{s.score}</div>
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

            <div className="flex justify-between w-full px-1">
                <div className="bg-primary/10 p-4 rounded-lg text-center flex-1 mr-2">
                    <div className="text-xs uppercase font-bold text-primary/60">Score</div>
                    <div className="text-2xl font-bold text-primary">{score}</div>
                </div>
                <div className="bg-secondary p-4 rounded-lg text-center flex-1 ml-2">
                    <div className="text-xs uppercase font-bold text-muted-foreground">Best</div>
                    <div className="text-2xl font-bold">{bestScore}</div>
                </div>
            </div>

            <Card className="w-full aspect-square p-2 relative bg-secondary/30 border-2">
                <div className="grid grid-cols-4 grid-rows-4 gap-2 h-full w-full">
                    {grid.map((row, i) => (
                        row.map((cell, j) => (
                            <div
                                key={`${i}-${j}`}
                                className={`rounded-lg flex items-center justify-center text-2xl font-bold transition-all duration-100 ${getCellColor(cell)}`}
                            >
                                {cell !== 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        key={cell} // Re-animate on value change
                                    >
                                        {cell}
                                    </motion.span>
                                )}
                            </div>
                        ))
                    ))}
                </div>

                {(gameOver || won) && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10 flex-col gap-4">
                        <h2 className="text-4xl font-bold text-primary mb-2">
                            {won ? "You Won!" : "Game Over"}
                        </h2>
                        <div className="p-6 bg-card border shadow-lg rounded-xl max-w-xs w-full">
                            <h3 className="text-center font-medium mb-4">Final Score: {score}</h3>
                            <form onSubmit={submitScore} className="space-y-4">
                                <Input
                                    placeholder="Enter your name"
                                    value={playerName}
                                    onChange={e => setPlayerName(e.target.value)}
                                    maxLength={15}
                                    autoFocus
                                />
                                <Button type="submit" className="w-full" disabled={isSubmitting || !playerName.trim()}>
                                    Save Score
                                </Button>
                            </form>
                        </div>
                        <Button onClick={initializeGame} variant="outline" size="lg" className="mt-4 gap-2">
                            <RefreshCw className="h-5 w-5" /> Play Again
                        </Button>
                    </div>
                )}
            </Card>

            <div className="text-center text-sm text-muted-foreground">
                Use <kbd className="bg-muted px-1 rounded">Arrow Keys</kbd> or swipe to move tiles
            </div>
        </div>
    );
}
