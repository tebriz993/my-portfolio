import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Trophy, Skull } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { GameScore } from "@shared/schema";

interface TicTacToeProps {
    onBack: () => void;
}

type Player = "X" | "O" | null;

export default function TicTacToeGame({ onBack }: TicTacToeProps) {
    const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
    const [isPlayerTurn, setIsPlayerTurn] = useState(true); // Player starts first
    const [winner, setWinner] = useState<Player | "Draw" | null>(null);
    const [localScores, setLocalScores] = useState({ player: 0, ai: 0, draws: 0 });

    // Submission state
    const [playerName, setPlayerName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    // Win combinations
    const winCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    const checkWinner = (squares: Player[]) => {
        for (let combo of winCombos) {
            const [a, b, c] = combo;
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        if (squares.every((square) => square !== null)) return "Draw";
        return null;
    };

    const minimax = (squares: Player[], depth: number, isMaximizing: boolean): number => {
        const result = checkWinner(squares);
        if (result === "O") return 10 - depth;
        if (result === "X") return depth - 10;
        if (result === "Draw") return 0;

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (squares[i] === null) {
                    squares[i] = "O";
                    const score = minimax(squares, depth + 1, false);
                    squares[i] = null;
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (squares[i] === null) {
                    squares[i] = "X";
                    const score = minimax(squares, depth + 1, true);
                    squares[i] = null;
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    };

    const getBestMove = (squares: Player[]) => {
        let bestScore = -Infinity;
        let move = -1;
        for (let i = 0; i < 9; i++) {
            if (squares[i] === null) {
                squares[i] = "O";
                const score = minimax(squares, 0, false);
                squares[i] = null;
                if (score > bestScore) {
                    bestScore = score;
                    move = i;
                }
            }
        }
        return move;
    };

    useEffect(() => {
        if (!isPlayerTurn && !winner) {
            // AI Turn
            const timeOut = setTimeout(() => {
                const nextMove = getBestMove([...board]);
                if (nextMove !== -1) {
                    handleMove(nextMove, "O");
                }
            }, 500); // Small delay for realism
            return () => clearTimeout(timeOut);
        }
    }, [isPlayerTurn, winner]);

    const handleMove = (index: number, player: "X" | "O") => {
        if (board[index] || winner) return;

        const newBoard = [...board];
        newBoard[index] = player;
        setBoard(newBoard);

        const result = checkWinner(newBoard);
        if (result) {
            setWinner(result);
            if (result === "X") setLocalScores(s => ({ ...s, player: s.player + 1 }));
            else if (result === "O") setLocalScores(s => ({ ...s, ai: s.ai + 1 }));
            else setLocalScores(s => ({ ...s, draws: s.draws + 1 }));
        } else {
            setIsPlayerTurn(player === "O");
        }
    };

    const resetGame = () => {
        setBoard(Array(9).fill(null));
        setWinner(null);
        setIsPlayerTurn(true);
    };

    const submitScore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) return;

        setIsSubmitting(true);
        try {
            // Save 1 point for win, 0.5 for draw (if we want to track that), but let's just save "1" if user won
            // Actually, for Tic Tac Toe, maybe we just want to record the "Win" event.
            // If it's a draw or loss, maybe user still wants to record it? 
            // Let's record: 100 for Win, 50 for Draw, 0 for Loss?
            // The score logic in backend is DESC.

            let scoreVal = 0;
            if (winner === "X") scoreVal = 100;
            else if (winner === "Draw") scoreVal = 50;
            else scoreVal = 0;

            await apiRequest("POST", "/api/games/scores", {
                playerName,
                gameType: "tic-tac-toe",
                score: scoreVal,
            });

            toast({
                title: "Result Saved!",
                description: `Recorded: ${winner === "X" ? "Win" : winner === "Draw" ? "Draw" : "Loss"}`,
            });

            queryClient.invalidateQueries({ queryKey: ["/api/games/tic-tac-toe/scores"] });

        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save result.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const { data: scores = [] } = useQuery<GameScore[]>({
        queryKey: ["/api/games/tic-tac-toe/scores"],
        queryFn: async () => {
            const res = await fetch("/api/games/tic-tac-toe/scores");
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        }
    });

    return (
        <div className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-6">
            <div className="w-full flex items-center justify-between mb-2">
                <Button variant="ghost" onClick={onBack} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Games
                </Button>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Trophy className="h-4 w-4 mr-2 text-yellow-500" />
                            Results
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                Tic-Tac-Toe Leaderboard
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
                                        <div className="font-mono">{score.score === 100 ? "Win" : score.score === 50 ? "Draw" : "Loss"}</div>
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

            <Card className="w-full">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl flex items-center justify-center gap-2">
                        AI Tic-Tac-Toe <Skull className="h-5 w-5 text-red-500" />
                    </CardTitle>
                    <p className="text-muted-foreground">Can you beat the unbeatable AI?</p>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between mb-6 px-4 text-sm font-medium">
                        <div className="flex flex-col items-center">
                            <span className="text-blue-500">You (X)</span>
                            <span className="text-2xl">{localScores.player}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-gray-500">Draws</span>
                            <span className="text-2xl">{localScores.draws}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-red-500">AI (O)</span>
                            <span className="text-2xl">{localScores.ai}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 aspect-square max-w-[300px] mx-auto mb-6">
                        {board.map((cell, index) => (
                            <motion.button
                                key={index}
                                whileHover={{ scale: !cell && !winner ? 1.05 : 1 }}
                                whileTap={{ scale: !cell && !winner ? 0.95 : 1 }}
                                className={`
                  h-24 rounded-lg text-4xl font-bold flex items-center justify-center border-2
                  ${!cell ? 'bg-secondary/50 hover:bg-secondary cursor-pointer' : 'bg-background cursor-default'}
                  ${cell === "X" ? "text-blue-500 border-blue-200" : ""}
                  ${cell === "O" ? "text-red-500 border-red-200" : ""}
                  ${!cell && !winner && isPlayerTurn ? "hover:border-primary/50" : "border-transparent"}
                `}
                                onClick={() => isPlayerTurn && handleMove(index, "X")}
                                disabled={!!cell || !!winner || !isPlayerTurn}
                            >
                                {cell && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    >
                                        {cell}
                                    </motion.span>
                                )}
                            </motion.button>
                        ))}
                    </div>

                    {winner && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-4"
                        >
                            <h3 className="text-2xl font-bold">
                                {winner === "Draw" ? "It's a Draw!" : winner === "X" ? "You Won! (Impossible)" : "AI Wins!"}
                            </h3>

                            <div className="p-4 bg-muted/30 rounded-lg max-w-xs mx-auto">
                                <h3 className="text-sm font-medium mb-3">Save Result</h3>
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

                            <Button onClick={resetGame} className="gap-2" variant="outline">
                                <RefreshCw className="h-4 w-4" /> Play Again
                            </Button>
                        </motion.div>
                    )}

                    {!winner && (
                        <div className="text-center h-8 flex items-center justify-center">
                            {!isPlayerTurn && <span className="animate-pulse text-muted-foreground">AI is thinking...</span>}
                        </div>
                    )}
                </CardContent>
            </Card>



            <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-4 rounded-lg text-sm text-center border border-yellow-500/20">
                💡 This AI uses the Minimax algorithm, checking all future possibilities to make the perfect move every time.
            </div>
        </div>
    );
}
