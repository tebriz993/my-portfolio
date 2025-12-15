import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Eraser, Check, Clock, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { GameScore } from "@shared/schema";

interface SudokuGameProps {
    onBack: () => void;
}

// ... imports and interfaces ...

// (Keep Sudoku logic functions unchanged, skipping lines 14-93 for brevity in this replace block if possible, but replace_file_content needs contiguous block. 
//  Since imports are at the top, I will replace the imports and proceed.
//  Wait, I can't effectively replace imports AND add component logic at the bottom in one go unless I replace the whole file or do multiple edits.
//  I will do multiple edits. First imports.)

// Replacing Imports
// ... existing content ...

interface SudokuGameProps {
    onBack: () => void;
}

// Sudoku Generator Logic
const BLANK = 0;

function isValid(board: number[][], row: number, col: number, num: number) {
    for (let x = 0; x < 9; x++) {
        if (board[row][x] === num || board[x][col] === num) return false;
    }
    const startRow = row - (row % 3), startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[i + startRow][j + startCol] === num) return false;
        }
    }
    return true;
}

function solveSudoku(board: number[][]) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] === BLANK) {
                for (let num = 1; num <= 9; num++) {
                    if (isValid(board, row, col, num)) {
                        board[row][col] = num;
                        if (solveSudoku(board)) return true;
                        board[row][col] = BLANK;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generateSudoku() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(BLANK));

    // Fill diagonal 3x3 matrices (independent)
    for (let i = 0; i < 9; i = i + 3) {
        fillBox(board, i, i);
    }

    // Solve the rest
    solveSudoku(board);

    // Remove digits to make puzzle
    const solution = board.map(row => [...row]);
    const puzzle = board.map(row => [...row]);

    let attempts = 40; // remove 40 numbers
    while (attempts > 0) {
        let row = Math.floor(Math.random() * 9);
        let col = Math.floor(Math.random() * 9);
        if (puzzle[row][col] !== BLANK) {
            puzzle[row][col] = BLANK;
            attempts--;
        }
    }

    return { puzzle, solution };
}

function fillBox(board: number[][], row: number, col: number) {
    let num: number;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            do {
                num = Math.floor(Math.random() * 9) + 1;
            } while (!isSafeInBox(board, row, col, num));
            board[row + i][col + j] = num;
        }
    }
}

function isSafeInBox(board: number[][], row: number, col: number, num: number) {
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[row + i][col + j] === num) return false;
        }
    }
    return true;
}

export default function SudokuGame({ onBack }: SudokuGameProps) {
    const [board, setBoard] = useState<number[][]>([]);
    const [initialBoard, setInitialBoard] = useState<number[][]>([]);
    const [solution, setSolution] = useState<number[][]>([]);
    const [selectedCell, setSelectedCell] = useState<{ r: number, c: number } | null>(null);
    const [mistakes, setMistakes] = useState(0);
    const [isWon, setIsWon] = useState(false);

    // Timer state
    const [seconds, setSeconds] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Score submission state
    const [playerName, setPlayerName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const startNewGame = useCallback(() => {
        const { puzzle, solution } = generateSudoku();
        setBoard(puzzle.map(row => [...row]));
        setInitialBoard(puzzle.map(row => [...row]));
        setSolution(solution);
        setMistakes(0);
        setIsWon(false);
        setSelectedCell(null);
        setSeconds(0);

        // Reset and start timer
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);
    }, []);

    // Stop timer when won or component unmounts
    useEffect(() => {
        if (isWon && timerRef.current) {
            clearInterval(timerRef.current);
        }
    }, [isWon]);

    useEffect(() => {
        startNewGame();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [startNewGame]);

    const handleNumberInput = (num: number) => {
        if (!selectedCell || isWon) return;
        const { r, c } = selectedCell;

        // Cannot edit initial cells
        if (initialBoard[r][c] !== BLANK) return;

        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = num;
        setBoard(newBoard);

        // Simple immediate validation (optional, visual feedback usually better)
        if (num !== 0 && num !== solution[r][c]) {
            setMistakes(m => m + 1);
        }

        checkWin(newBoard);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!selectedCell) return;

        if (e.key >= '1' && e.key <= '9') {
            handleNumberInput(parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            handleNumberInput(0);
        } else if (e.key === 'ArrowUp') {
            setSelectedCell(prev => prev ? { r: Math.max(0, prev.r - 1), c: prev.c } : null);
        } else if (e.key === 'ArrowDown') {
            setSelectedCell(prev => prev ? { r: Math.min(8, prev.r + 1), c: prev.c } : null);
        } else if (e.key === 'ArrowLeft') {
            setSelectedCell(prev => prev ? { r: prev.r, c: Math.max(0, prev.c - 1) } : null);
        } else if (e.key === 'ArrowRight') {
            setSelectedCell(prev => prev ? { r: prev.r, c: Math.min(8, prev.c + 1) } : null);
        }
    };

    const checkWin = (currentBoard: number[][]) => {
        const isComplete = currentBoard.every((row, r) =>
            row.every((cell, c) => cell === solution[r][c])
        );
        if (isComplete) setIsWon(true);
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const submitScore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) return;

        setIsSubmitting(true);
        try {
            await apiRequest("POST", "/api/games/scores", {
                playerName,
                gameType: "sudoku",
                score: 1, // Solved
                timeInSeconds: seconds,
            });

            toast({
                title: "Score Saved!",
                description: `Solved in ${formatTime(seconds)}!`,
            });

            queryClient.invalidateQueries({ queryKey: ["/api/games/sudoku/scores"] });

        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save score.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const { data: scores = [] } = useQuery<GameScore[]>({
        queryKey: ["/api/games/sudoku/scores"],
        queryFn: async () => {
            const res = await fetch("/api/games/sudoku/scores");
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        }
    });

    return (
        <div className="flex flex-col items-center justify-center max-w-2xl mx-auto space-y-6" onKeyDown={handleKeyDown} tabIndex={0}>
            <div className="w-full flex items-center justify-between mb-2 gap-2">
                <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" onClick={onBack} size="sm" className="gap-2 px-2 sm:px-4">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Back</span>
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="px-2 sm:px-4">
                                <Trophy className="h-4 w-4 sm:mr-2 text-yellow-500" />
                                <span className="hidden sm:inline">Results</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                    Sudoku Leaderboard
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2 mt-4">
                                {scores.length > 0 ? (
                                    scores.map((score, i) => (
                                        <div key={score.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="font-mono text-muted-foreground w-6">#{i + 1}</div>
                                                <div className="font-bold">{score.playerName}</div>
                                            </div>
                                            <div className="font-mono flex items-center gap-2">
                                                <Clock className="h-3 w-3" />
                                                {score.timeInSeconds ? formatTime(score.timeInSeconds) : "-"}
                                            </div>
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
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="flex items-center font-mono text-lg">
                        <Clock className="w-4 h-4 mr-2" />
                        {formatTime(seconds)}
                    </div>
                    <div className="text-muted-foreground font-medium text-sm">
                        <span className="hidden sm:inline">Mistakes: </span>
                        <span className="sm:hidden">Err: </span>
                        <span className="text-red-500">{mistakes}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={startNewGame} className="px-2 sm:px-4">
                        <RefreshCw className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">New Game</span>
                    </Button>
                </div>
            </div>

            <Card className="w-full max-w-[500px]">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">Sudoku</CardTitle>
                </CardHeader>
                <CardContent>
                    {isWon ? (
                        <div className="text-center py-10 space-y-4">
                            <div className="text-6xl">🏆</div>
                            <h2 className="text-3xl font-bold text-green-500">Puzzle Solved!</h2>
                            <p className="text-muted-foreground">Time: {formatTime(seconds)}</p>

                            <div className="p-4 bg-muted/30 rounded-lg max-w-xs mx-auto">
                                <h3 className="text-sm font-medium mb-3">Save your time</h3>
                                <form onSubmit={submitScore} className="flex gap-2">
                                    <Input
                                        placeholder="Your name"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        maxLength={20}
                                        className="bg-background"
                                    />
                                    <Button type="submit" disabled={isSubmitting || !playerName.trim()}>
                                        Save
                                    </Button>
                                </form>
                            </div>

                            <Button onClick={startNewGame} size="lg" variant="outline" className="mt-4">Play Again</Button>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-9 gap-0.5 bg-border border-2 border-border mb-6">
                                {board.map((row, r) =>
                                    row.map((cell, c) => {
                                        const isInitial = initialBoard[r][c] !== BLANK;
                                        const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                                        const isError = cell !== BLANK && cell !== solution[r][c];
                                        const isRelated = selectedCell && (selectedCell.r === r || selectedCell.c === c); // Highlight row/col

                                        // Border logic for 3x3 grids
                                        const borderRight = (c + 1) % 3 === 0 && c !== 8 ? "border-r-2 border-r-primary/50" : "";
                                        const borderBottom = (r + 1) % 3 === 0 && r !== 8 ? "border-b-2 border-b-primary/50" : "";

                                        return (
                                            <div
                                                key={`${r}-${c}`}
                                                className={`
                                        aspect-square flex items-center justify-center text-lg font-medium cursor-pointer transition-colors
                                        ${borderRight} ${borderBottom}
                                        ${isSelected ? "bg-primary text-primary-foreground" : isRelated ? "bg-secondary/40" : "bg-card"}
                                        ${isInitial ? "font-bold" : "text-blue-500"}
                                        ${isError && !isInitial ? "text-red-500 bg-red-100 dark:bg-red-900/20" : ""}
                                    `}
                                                onClick={() => setSelectedCell({ r, c })}
                                            >
                                                {cell !== BLANK ? cell : ""}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                    <Button
                                        key={num}
                                        variant="secondary"
                                        className="h-12 text-lg font-bold"
                                        onClick={() => handleNumberInput(num)}
                                    >
                                        {num}
                                    </Button>
                                ))}
                                <Button
                                    variant="destructive"
                                    className="h-12 w-full sm:col-span-9 mt-2 sm:mt-0"
                                    onClick={() => handleNumberInput(0)}
                                >
                                    <Eraser className="h-4 w-4 mr-2" /> Erase
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>



            <div className="text-center text-sm text-muted-foreground">
                Select a cell and press a number key or use the buttons below.
            </div>
        </div>
    );
}
