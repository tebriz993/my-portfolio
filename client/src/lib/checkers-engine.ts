
// Types
export type Player = 1 | 2; // 1 = White/User, 2 = Black/AI
export type Piece = 0 | 1 | 2 | 3 | 4; // 0=Empty, 1=White, 2=Black, 3=WhiteKing, 4=BlackKing
export type BoardGrid = Piece[][];

export interface Position {
    r: number;
    c: number;
}

export interface Move {
    from: Position;
    to: Position;
    captured: Position[]; // List of captured piece positions
}

export interface GameState {
    board: BoardGrid;
    turn: Player;
    scores: { 1: number; 2: number };
    winner: Player | null;
    validMoves: Record<string, Move[]>; // Key: "r,c"
}

// Helpers
export const INITIAL_BOARD: BoardGrid = [
    [0, 2, 0, 2, 0, 2, 0, 2],
    [2, 0, 2, 0, 2, 0, 2, 0],
    [0, 2, 0, 2, 0, 2, 0, 2],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
];

export class CheckersRules {
    static getValidMoves(board: BoardGrid, turn: Player): Record<string, Move[]> {
        const moves: Record<string, Move[]> = {};
        let canCapture = false;

        // First check for captures (mandatory if available)
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (this.isMyPiece(piece, turn)) {
                    const isKing = piece === 3 || piece === 4;
                    const chains = this.getCaptureChains(board, r, c, turn, [], isKing);

                    if (chains.length > 0) {
                        canCapture = true;
                        const key = `${r},${c}`;
                        if (!moves[key]) moves[key] = [];
                        moves[key].push(...chains.map(chain => ({
                            from: { r, c },
                            to: chain.to,
                            captured: chain.captured
                        })));
                    }
                }
            }
        }

        if (canCapture) return moves;

        // If no captures, get normal moves
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (this.isMyPiece(piece, turn)) {
                    const isKing = piece === 3 || piece === 4;
                    const normalMoves = this.getNormalMoves(board, r, c, turn, isKing);
                    if (normalMoves.length > 0) {
                        const key = `${r},${c}`;
                        moves[key] = normalMoves.map(m => ({
                            from: { r, c },
                            to: m.to,
                            captured: []
                        }));
                    }
                }
            }
        }

        return moves;
    }

    static isMyPiece(piece: Piece, turn: Player): boolean {
        if (piece === 0) return false;
        if (turn === 1 && (piece === 1 || piece === 3)) return true;
        if (turn === 2 && (piece === 2 || piece === 4)) return true;
        return false;
    }

    static getNormalMoves(board: BoardGrid, r: number, c: number, turn: Player, isKing: boolean): { to: Position }[] {
        const moves: { to: Position }[] = [];
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

        for (const [dr, dc] of directions) {
            if (!isKing) {
                const forward = turn === 1 ? -1 : 1;
                if (dr !== forward) continue;
            }

            const maxDist = isKing ? 7 : 1;

            for (let dist = 1; dist <= maxDist; dist++) {
                const nr = r + (dr * dist);
                const nc = c + (dc * dist);

                if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;

                if (board[nr][nc] === 0) {
                    moves.push({ to: { r: nr, c: nc } });
                } else {
                    break; // Blocked
                }
            }
        }
        return moves;
    }

    static getCaptureChains(board: BoardGrid, r: number, c: number, turn: Player, capturedSoFar: Position[], isKing: boolean): { to: Position; captured: Position[] }[] {
        const allPaths: { to: Position; captured: Position[] }[] = [];
        // Deep copy captured positions to avoid reference issues
        const currentCaptured = [...capturedSoFar];
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

        if (!isKing) {
            // Normal piece capture logic
            for (const [dr, dc] of directions) {
                const midR = r + dr;
                const midC = c + dc;
                const endR = r + (dr * 2);
                const endC = c + (dc * 2);

                if (endR >= 0 && endR < 8 && endC >= 0 && endC < 8) {
                    // Check if we already captured this specific piece in this chain
                    if (currentCaptured.some(pos => pos.r === midR && pos.c === midC)) continue;

                    const cellEnemy = board[midR][midC];
                    const cellLand = board[endR][endC];

                    if (cellEnemy !== 0 && !this.isMyPiece(cellEnemy, turn)) {
                        if (cellLand === 0) {
                            // Determine if we temporarily landed on this spot in the recursive simulation? 
                            // Actually the board isn't mutated in the recursion here (unlike the python code which seemed to pass `grid` but didn't mutate it in `_get_capture_chains` explicitly, 
                            // wait, the python code passed `captured_so_far` but didn't mutate board. It assumed jump over the same piece twice is invalid)

                            const newCaptured = [...currentCaptured, { r: midR, c: midC }];

                            // Recursively check for more captures from the new landing spot
                            // Note: We don't verify "isKing" promotion mid-jump in standard checkers usually until the turn ends, 
                            // but if it becomes king it might continue? Python code passes `is_king` unchanged.
                            const subChains = this.getCaptureChains(board, endR, endC, turn, newCaptured, isKing);

                            if (subChains.length > 0) {
                                allPaths.push(...subChains);
                            } else {
                                allPaths.push({ to: { r: endR, c: endC }, captured: newCaptured });
                            }
                        }
                    }
                }
            }
        } else {
            // King capture logic
            for (const [dr, dc] of directions) {
                // Search for enemy
                for (let dist = 1; dist < 8; dist++) {
                    const midR = r + (dr * dist);
                    const midC = c + (dc * dist);

                    if (midR < 0 || midR >= 8 || midC < 0 || midC >= 8) break;

                    const cell = board[midR][midC];

                    if (this.isMyPiece(cell, turn)) break; // Blocked by own piece

                    if (currentCaptured.some(pos => pos.r === midR && pos.c === midC)) continue; // Already captured

                    if (cell !== 0 && !this.isMyPiece(cell, turn)) {
                        // Found enemy
                        // Now look for landing spots after invalid enemy
                        for (let landDist = dist + 1; landDist < 8; landDist++) {
                            const landR = r + (dr * landDist);
                            const landC = c + (dc * landDist);

                            if (landR < 0 || landR >= 8 || landC < 0 || landC >= 8) break;

                            const landCell = board[landR][landC];

                            // Ensure we don't land on a non-empty square (unless it is one we are currently capturing - handled by board check effectively constant)
                            // Actually `board` here is static. We must ensure `landCell` is 0.
                            // AND we must ensure we aren't crossing ANOTHER piece.

                            if (landCell === 0) {
                                const newCaptured = [...currentCaptured, { r: midR, c: midC }];
                                const subChains = this.getCaptureChains(board, landR, landC, turn, newCaptured, isKing);

                                if (subChains.length > 0) {
                                    allPaths.push(...subChains);
                                } else {
                                    allPaths.push({ to: { r: landR, c: landC }, captured: newCaptured });
                                }
                            } else {
                                break; // Blocked by piece
                            }
                        }
                        break; // Found the enemy in this direction, stop scanning this direction
                    }
                }
            }
        }

        return allPaths;
    }
}

export class CheckersAI {
    // Basic Minimax with Alpha-Beta Pruning
    // Evaluating board state for Player 2 (AI)
    static getBestMove(board: BoardGrid, turn: Player): Move | null {
        try {
            const { move } = this.minimax(board, 3, true, turn, -Infinity, Infinity);
            return move;
        } catch (e) {
            console.error("AI Error:", e);
            return null;
        }
    }

    static minimax(board: BoardGrid, depth: number, isMaximizing: boolean, turn: Player, alpha: number, beta: number): { score: number; move: Move | null } {
        if (depth === 0) {
            return { score: this.evaluateBoard(board), move: null };
        }

        const validMovesMap = CheckersRules.getValidMoves(board, turn);
        const allMoves: Move[] = [];

        Object.values(validMovesMap).forEach(moves => allMoves.push(...moves));

        if (allMoves.length === 0) {
            return { score: this.evaluateBoard(board), move: null };
        }

        // Shuffle for variety
        for (let i = allMoves.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allMoves[i], allMoves[j]] = [allMoves[j], allMoves[i]];
        }

        let bestMove: Move | null = null;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of allMoves) {
                const newBoard = this.simulateMove(board, move, turn);
                const { score } = this.minimax(newBoard, depth - 1, false, turn === 1 ? 2 : 1, alpha, beta);

                if (score > maxEval) {
                    maxEval = score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of allMoves) {
                const newBoard = this.simulateMove(board, move, turn);
                const { score } = this.minimax(newBoard, depth - 1, true, turn === 1 ? 2 : 1, alpha, beta);

                if (score < minEval) {
                    minEval = score;
                    bestMove = move;
                }
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return { score: minEval, move: bestMove };
        }
    }

    static simulateMove(board: BoardGrid, move: Move, turn: Player): BoardGrid {
        // Deep copy
        const newBoard = board.map(row => [...row]);
        const piece = newBoard[move.from.r][move.from.c];

        // Remove captured
        for (const cap of move.captured) {
            newBoard[cap.r][cap.c] = 0;
        }

        // Move piece
        newBoard[move.to.r][move.to.c] = piece;
        newBoard[move.from.r][move.from.c] = 0;

        // Promotion
        if (piece === 1 && move.to.r === 0) newBoard[move.to.r][move.to.c] = 3;
        else if (piece === 2 && move.to.r === 7) newBoard[move.to.r][move.to.c] = 4;

        return newBoard;
    }

    static evaluateBoard(board: BoardGrid): number {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p === 0) continue;

                if (p === 2) score += 10;
                if (p === 4) score += 100;
                if (p === 1) score -= 10;
                if (p === 3) score -= 100;
            }
        }
        return score;
    }
}
