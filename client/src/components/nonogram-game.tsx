import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Trophy, Heart, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { GameScore } from "@shared/schema";
import { cn } from "@/lib/utils";

interface NonogramGameProps {
    onBack: () => void;
}

type CellState = "EMPTY" | "FILLED" | "MARKED" | "ERROR";

interface Level {
    name: string;
    size: number;
    grid: number[][]; // 1 for filled, 0 for empty
}

const LEVELS: Level[] = [
    {
        name: "Heart",
        size: 5,
        grid: [
            [0, 1, 0, 1, 0],
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0],
            [0, 0, 1, 0, 0]
        ]
    },
    {
        name: "Smile",
        size: 5,
        grid: [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 1, 0],
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0]
        ]
    },
    {
        name: "House",
        size: 5,
        grid: [
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 1, 0, 1, 0],
            [0, 1, 1, 1, 0]
        ]
    },
    {
        name: "Duck",
        size: 10,
        grid: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [1, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]
    },
    {
        name: "Invader",
        size: 10,
        grid: [
            [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]
    }
];

export default function NonogramGame({ onBack }: NonogramGameProps) {
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [grid, setGrid] = useState<CellState[][]>([]);
    const [lives, setLives] = useState(3);
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);
    const [mode, setMode] = useState<"FILL" | "MARK">("FILL");

    // Hints
    const [rowHints, setRowHints] = useState<number[][]>([]);
    const [colHints, setColHints] = useState<number[][]>([]);

    // Submission
    const [playerName, setPlayerName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    // Initialize level
    const loadLevel = useCallback((index: number) => {
        const level = LEVELS[index];
        const size = level.size;

        // Reset grid
        setGrid(Array(size).fill(null).map(() => Array(size).fill("EMPTY")));
        setLives(3);
        setGameOver(false);
        setWon(false);

        // Calculate hints
        const calculateHints = (line: number[]) => {
            const hints: number[] = [];
            let count = 0;
            for (const cell of line) {
                if (cell === 1) {
                    count++;
                } else if (count > 0) {
                    hints.push(count);
                    count = 0;
                }
            }
            if (count > 0) hints.push(count);
            return hints.length > 0 ? hints : [0];
        };

        const rHints = level.grid.map(row => calculateHints(row));

        const cHints = [];
        for (let j = 0; j < size; j++) {
            const col = [];
            for (let i = 0; i < size; i++) {
                col.push(level.grid[i][j]);
            }
            cHints.push(calculateHints(col));
        }

        setRowHints(rHints);
        setColHints(cHints);

    }, []);

    useEffect(() => {
        loadLevel(currentLevelIndex);
    }, [currentLevelIndex, loadLevel]);

    const handleCellClick = (r: number, c: number) => {
        if (gameOver || won || grid[r][c] !== "EMPTY") return;

        const level = LEVELS[currentLevelIndex];
        const isTargetFilled = level.grid[r][c] === 1;
        const newGrid = grid.map(row => [...row]);

        if (mode === "FILL") {
            if (isTargetFilled) {
                newGrid[r][c] = "FILLED";
                setGrid(newGrid);
                checkWin(newGrid);
            } else {
                newGrid[r][c] = "ERROR"; // Show error state briefly? Or just filled red?
                setGrid(newGrid);

                // Penalty
                const newLives = lives - 1;
                setLives(newLives);

                // Flash error then mark as X or keep as Error?
                // Standard behavior: it marks as X (Empty) automatically because you know it's empty now.
                setTimeout(() => {
                    if (newLives > 0) {
                        const fixedGrid = newGrid.map(row => [...row]);
                        fixedGrid[r][c] = "MARKED"; // Start showing it as X
                        setGrid(fixedGrid);
                    }
                }, 500);

                if (newLives <= 0) {
                    setGameOver(true);
                }
            }
        } else {
            // MARK Mode
            newGrid[r][c] = "MARKED";
            setGrid(newGrid);
        }
    };

    const handleRightClick = (e: React.MouseEvent, r: number, c: number) => {
        e.preventDefault();
        if (gameOver || won) return;

        const newGrid = grid.map(row => [...row]);
        if (newGrid[r][c] === "EMPTY") {
            newGrid[r][c] = "MARKED";
        } else if (newGrid[r][c] === "MARKED") {
            newGrid[r][c] = "EMPTY";
        }
        setGrid(newGrid);
    };

    const checkWin = (currentGrid: CellState[][]) => {
        const level = LEVELS[currentLevelIndex];
        for (let i = 0; i < level.size; i++) {
            for (let j = 0; j < level.size; j++) {
                if (level.grid[i][j] === 1 && currentGrid[i][j] !== "FILLED") {
                    return;
                }
            }
        }
        setWon(true);
    };

    const { data: scores = [], isError } = useQuery<GameScore[]>({
        queryKey: ["/api/games/nonogram/scores"],
        queryFn: async () => {
            const res = await fetch("/api/games/nonogram/scores");
            if (!res.ok) {
                if (res.status === 404) return [];
                return [];
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
            // Score calculation: Level Size * 10 * Lives
            const score = LEVELS[currentLevelIndex].size * 10 * lives;

            await apiRequest("POST", "/api/games/scores", {
                playerName,
                gameType: "nonogram",
                score: score,
            });
            toast({ title: "Score Saved!", description: `You scored ${score} points!` });
            queryClient.invalidateQueries({ queryKey: ["/api/games/nonogram/scores"] });
        } catch (error) {
            toast({ title: "Error", description: "Failed to save score.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const level = LEVELS[currentLevelIndex];
    const cellSize = level.size > 5 ? "h-6 w-6 md:h-8 md:w-8 text-xs" : "h-10 w-10 md:h-12 md:w-12 text-sm";

    return (
        <div className="flex flex-col items-center justify-center max-w-4xl mx-auto space-y-6">
            <div className="w-full flex items-center justify-between mb-2">
                <Button variant="ghost" onClick={onBack} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
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
                            <DialogTitle>Nonogram Leaderboard</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto">
                            {scores.map((s, i) => (
                                <div key={s.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="font-mono text-muted-foreground w-6">#{i + 1}</div>
                                        <div className="font-bold">{s.playerName}</div>
                                    </div>
                                    <div className="font-mono font-bold text-primary">{s.score}</div>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
                {LEVELS.map((l, i) => (
                    <Button
                        key={l.name}
                        variant={i === currentLevelIndex ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentLevelIndex(i)}
                        disabled={isSubmitting} // Lock level switch during submit
                    >
                        {l.name}
                    </Button>
                ))}
            </div>

            <div className="flex items-center justify-between w-full max-w-md bg-muted/30 p-4 rounded-xl">
                <div className="flex items-center gap-1 text-red-500">
                    {[...Array(3)].map((_, i) => (
                        <Heart key={i} className={cn("h-6 w-6 fill-current", i < lives ? "opacity-100" : "opacity-20")} />
                    ))}
                </div>
                <div className="flex bg-muted rounded-full p-1">
                    <button
                        className={cn("px-4 py-1 rounded-full text-sm font-medium transition-colors", mode === "FILL" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-background/50")}
                        onClick={() => setMode("FILL")}
                    >
                        Fill
                    </button>
                    <button
                        className={cn("px-4 py-1 rounded-full text-sm font-medium transition-colors", mode === "MARK" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-background/50")}
                        onClick={() => setMode("MARK")}
                    >
                        Mark (X)
                    </button>
                </div>
            </div>

            <Card className="p-4 md:p-8 bg-card shadow-lg relative overflow-hidden">
                <div className="flex flex-col items-center">
                    {/* Top Hints */}
                    <div className="flex mb-1">
                        <div className="w-[60px] md:w-[80px]" /> {/* Spacer for row hints */}
                        <div className="flex gap-1">
                            {colHints.map((col, i) => (
                                <div key={i} className={cn("flex flex-col justify-end items-center gap-0.5 pb-1", cellSize)}>
                                    {col.map((num, idx) => (
                                        <span key={idx} className="leading-none text-muted-foreground font-mono font-bold">{num}</span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Row Hints + Grid */}
                    <div className="flex">
                        {/* Row Hints */}
                        <div className="flex flex-col gap-1 mr-1">
                            {rowHints.map((row, i) => (
                                <div key={i} className={cn("flex justify-end items-center gap-1 pr-2 w-[60px] md:w-[80px]", cellSize)}>
                                    {row.map((num, idx) => (
                                        <span key={idx} className="leading-none text-muted-foreground font-mono font-bold">{num}</span>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="flex flex-col gap-1">
                            {grid.map((row, i) => (
                                <div key={i} className="flex gap-1">
                                    {row.map((cell, j) => (
                                        <motion.div
                                            key={`${i}-${j}`}
                                            className={cn(
                                                "border rounded-sm cursor-pointer flex items-center justify-center transition-colors",
                                                cellSize,
                                                cell === "EMPTY" && "bg-secondary/20 hover:bg-secondary/40",
                                                cell === "FILLED" && "bg-primary border-primary",
                                                cell === "MARKED" && "bg-muted/10",
                                                cell === "ERROR" && "bg-red-500 border-red-500 animate-pulse"
                                            )}
                                            onClick={() => handleCellClick(i, j)}
                                            onContextMenu={(e) => handleRightClick(e, i, j)}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            {cell === "MARKED" && <X className="h-full w-full p-1 text-muted-foreground/50" />}
                                            {cell === "ERROR" && <X className="h-full w-full p-1 text-white" />}
                                        </motion.div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Overlays */}
                <AnimatePresence>
                    {(won || gameOver) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center p-6 z-10"
                        >
                            <div className="flex flex-col items-center gap-6 max-w-sm w-full">
                                <h2 className={cn("text-4xl font-bold", won ? "text-primary" : "text-destructive")}>
                                    {won ? "Puzzle Solved!" : "Game Over"}
                                </h2>

                                {won && (
                                    <Card className="w-full p-4 border-2 border-primary/20">
                                        <h3 className="text-center font-medium mb-4">Record Your Victory</h3>
                                        <form onSubmit={submitScore} className="space-y-4">
                                            <Input
                                                placeholder="Your name"
                                                value={playerName}
                                                onChange={e => setPlayerName(e.target.value)}
                                                maxLength={15}
                                                autoFocus
                                            />
                                            <Button type="submit" className="w-full" disabled={isSubmitting || !playerName.trim()}>
                                                Save Result
                                            </Button>
                                        </form>
                                    </Card>
                                )}

                                <div className="flex gap-4">
                                    <Button onClick={() => loadLevel(currentLevelIndex)} variant="outline" size="lg">
                                        <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                                    </Button>
                                    {won && currentLevelIndex < LEVELS.length - 1 && (
                                        <Button onClick={() => setCurrentLevelIndex(i => i + 1)} size="lg">
                                            Next Level
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            <div className="text-center text-sm text-muted-foreground pb-8">
                <p className="hidden md:block">Left click to Fill • Right click to Mark (X)</p>
                <p className="md:hidden">Tap to {mode === "FILL" ? "Fill" : "Mark"}</p>
            </div>
        </div>
    );
}
