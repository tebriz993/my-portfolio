import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckersRules, CheckersAI, INITIAL_BOARD, BoardGrid, Move, Player } from "@/lib/checkers-engine";
import { Loader2, RefreshCw, Trophy, User, Cpu } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type CheckersGameProps = {
    onBack?: () => void;
};

export default function CheckersGame({ onBack }: CheckersGameProps) {
    const [board, setBoard] = useState<BoardGrid>(INITIAL_BOARD.map(row => [...row]));
    const [turn, setTurn] = useState<Player>(1); // 1 = White, 2 = Black
    const [userTeam, setUserTeam] = useState<Player>(1); // Default User is White
    const [validMoves, setValidMoves] = useState<Record<string, Move[]>>({});
    const [selectedPos, setSelectedPos] = useState<{ r: number, c: number } | null>(null);
    const [scores, setScores] = useState({ 1: 0, 2: 0 });
    const [gameOver, setGameOver] = useState<{ winner: Player | null, message: string } | null>(null);
    const [isAiThinking, setIsAiThinking] = useState(false);

    // Initialize valid moves on mount and turn change
    useEffect(() => {
        if (gameOver) return;

        const moves = CheckersRules.getValidMoves(board, turn);
        setValidMoves(moves);

        if (Object.keys(moves).length === 0) {
            const winner = turn === 1 ? 2 : 1;
            endGame(winner);
        } else {
            // Trigger AI if it's NOT user's turn
            if (turn !== userTeam) {
                makeAiMove();
            }
        }
    }, [turn, board, gameOver, userTeam]);

    const endGame = (winner: Player) => {
        const winnerName = winner === userTeam ? "You" : "AI";
        setGameOver({
            winner,
            message: `Game Over! ${winnerName} (${winner === 1 ? 'White' : 'Black'}) wins!`
        });
    };

    const resetGame = () => {
        setBoard(INITIAL_BOARD.map(row => [...row]));
        setTurn(1);
        setScores({ 1: 0, 2: 0 });
        setGameOver(null);
        setSelectedPos(null);
        setIsAiThinking(false);
        // userTeam stays same, or we could reset it. Keeping it same is better UX.
    };

    const toggleSide = () => {
        const newSide = userTeam === 1 ? 2 : 1;
        setUserTeam(newSide);
        // Reset game to apply side change cleanly
        setBoard(INITIAL_BOARD.map(row => [...row]));
        setTurn(1);
        setScores({ 1: 0, 2: 0 });
        setGameOver(null);
        setSelectedPos(null);
        setIsAiThinking(false);
    };

    const makeAiMove = async () => {
        setIsAiThinking(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        // AI plays as the team that is NOT the user
        const aiTeam = userTeam === 1 ? 2 : 1;
        const bestMove = CheckersAI.getBestMove(board, aiTeam);

        if (bestMove) {
            executeMove(bestMove);
        } else {
            endGame(userTeam); // AI loses
        }
        setIsAiThinking(false);
    };

    const handleCellClick = (r: number, c: number) => {
        // Prevent click if game over, AI thinking, or NOT user's turn
        if (gameOver || isAiThinking || turn !== userTeam) return;

        const piece = board[r][c];
        const key = `${r},${c}`;

        if (CheckersRules.isMyPiece(piece, turn) && validMoves[key]) {
            setSelectedPos({ r, c });
        }
        else if (selectedPos) {
            const movesForSelected = validMoves[`${selectedPos.r},${selectedPos.c}`] || [];
            const move = movesForSelected.find(m => m.to.r === r && m.to.c === c);

            if (move) {
                executeMove(move);
                setSelectedPos(null);
            } else {
                setSelectedPos(null);
            }
        }
    };

    const executeMove = (move: Move) => {
        const newBoard = board.map(row => [...row]);
        const piece = newBoard[move.from.r][move.from.c];

        let capturePoints = 0;
        move.captured.forEach(cap => {
            if (newBoard[cap.r][cap.c] !== 0) capturePoints++;
            newBoard[cap.r][cap.c] = 0;
        });

        newBoard[move.to.r][move.to.c] = piece;
        newBoard[move.from.r][move.from.c] = 0;

        let promoted = false;
        if (piece === 1 && move.to.r === 0) {
            newBoard[move.to.r][move.to.c] = 3;
            promoted = true;
            if (userTeam === 1) toast({ title: "Promoted!", description: "White piece became a King 👑" });
        } else if (piece === 2 && move.to.r === 7) {
            newBoard[move.to.r][move.to.c] = 4;
            promoted = true;
            if (userTeam === 2) toast({ title: "Promoted!", description: "Black piece became a King 👑" });
        }

        if (capturePoints > 0) {
            setScores(prev => ({
                ...prev,
                [turn]: prev[turn] + capturePoints
            }));
        }

        setBoard(newBoard);
        setTurn(prev => prev === 1 ? 2 : 1);
    };

    // Render Helpers
    const getPieceStyle = (piece: number) => {
        if (piece === 0) return null;
        const isKing = piece === 3 || piece === 4;
        const isWhite = piece === 1 || piece === 3;

        return (
            <div className={`
                w-[80%] h-[80%] rounded-full shadow-lg transition-transform active:scale-90
                flex items-center justify-center text-2xl select-none
                ${isWhite ? 'bg-white border-4 border-slate-200 text-slate-900' : 'bg-slate-800 border-4 border-black text-white'}
                ${isKing ? 'ring-4 ring-yellow-400' : ''}
            `}>
                {isKing && "👑"}
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-4xl mx-auto gap-8 p-4">
            {/* Header / Scoreboard */}
            <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
                <div className="flex items-center gap-2 self-start md:self-auto">
                    <Button variant="outline" onClick={onBack} size="sm">
                        ← Back
                    </Button>
                    <Button variant="secondary" onClick={toggleSide} size="sm" className="gap-2">
                        <User className="w-4 h-4" />
                        Play as {userTeam === 1 ? 'White' : 'Black'}
                    </Button>
                </div>

                <Card className="flex-1 w-full md:max-w-md">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${turn === 1 ? 'bg-green-100 border border-green-300' : 'opacity-50'}`}>
                            <div className="w-4 h-4 rounded-full bg-white border-2 border-slate-300 shadow-sm" />
                            <div>
                                <p className="font-bold text-sm">{userTeam === 1 ? 'You' : 'AI'} (White)</p>
                                <p className="text-xs text-muted-foreground">Score: {scores[1]}</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold font-mono">VS</span>
                            <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {gameOver ? "Ended" : (turn === userTeam ? "You" : "AI")}
                            </div>
                        </div>

                        <div className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${turn === 2 ? 'bg-green-100 border border-green-300' : 'opacity-50'}`}>
                            <div>
                                <p className="font-bold text-sm text-right">{userTeam === 2 ? 'You' : 'AI'} (Black)</p>
                                <p className="text-xs text-muted-foreground text-right">Score: {scores[2]}</p>
                            </div>
                            <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-black shadow-sm" />
                        </div>
                    </CardContent>
                </Card>

                <Button variant="ghost" onClick={resetGame} size="icon" title="Reset Game">
                    <RefreshCw className="h-5 w-5" />
                </Button>
            </div>

            {/* Game Board */}
            <div className="relative">
                <div className="bg-[#5d4037] p-2 md:p-3 rounded-lg shadow-2xl border-4 border-[#3e2723]">
                    <div className={`grid grid-cols-8 gap-0 border-2 border-[#3e2723] transition-transform duration-500 ${userTeam === 2 ? 'rotate-180' : ''}`}>
                        {board.map((row, r) => (
                            row.map((piece, c) => {
                                const isBlackCell = (r + c) % 2 !== 0;
                                const cellKey = `${r},${c}`;

                                // Highlight logic
                                const isSelected = selectedPos?.r === r && selectedPos?.c === c;

                                // Is this cell a valid move target for the selected piece?
                                const movesForSelected = selectedPos ? (validMoves[`${selectedPos.r},${selectedPos.c}`] || []) : [];
                                const isTarget = movesForSelected.some(m => m.to.r === r && m.to.c === c);
                                const isPlayable = isBlackCell;

                                return (
                                    <div
                                        key={cellKey}
                                        onClick={() => handleCellClick(r, c)}
                                        className={`
                                            w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex items-center justify-center relative
                                            ${isBlackCell ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'}
                                            ${isSelected ? 'ring-inset ring-4 ring-yellow-400 bg-yellow-600/50' : ''}
                                            ${isTarget ? 'cursor-pointer after:content-[""] after:absolute after:w-4 after:h-4 after:bg-green-500 after:rounded-full after:animate-pulse hover:bg-green-500/20' : ''}
                                            ${isPlayable && !isTarget ? '' : ''}
                                            transition-transform duration-500 ${userTeam === 2 ? 'rotate-180' : ''}
                                        `}
                                    >
                                        {getPieceStyle(piece)}
                                    </div>
                                );
                            })
                        ))}
                    </div>
                </div>

                {/* Game Over Overlay */}
                {gameOver && (
                    <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
                        <div className="bg-background p-8 rounded-xl shadow-2xl text-center border-2 border-primary animate-in fade-in zoom-in duration-300">
                            <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-3xl font-bold mb-2">{gameOver.winner === 1 ? "You Won!" : "AI Won!"}</h2>
                            <p className="text-muted-foreground mb-6">{gameOver.message}</p>
                            <Button onClick={resetGame} size="lg" className="w-full">
                                Play Again
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Status Indicator */}
            {isAiThinking && (
                <div className="fixed bottom-8 bg-black/80 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse z-50">
                    <Cpu className="h-4 w-4" />
                    <span className="text-sm font-medium">AI is thinking...</span>
                </div>
            )}
        </div>
    );
}
