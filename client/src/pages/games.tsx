import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Gamepad2 } from "lucide-react";
import { Link } from "wouter";
import MemoryCardGame from "../components/memory-card-game";
import SnakeGame from "../components/snake-game";
import TetrisGame from "../components/tetris-game";
import PuzzleGame from "../components/puzzle-game";
import DinoGame from "../components/dino-game";
import FlappyBirdGame from "../components/flappy-bird-game";
import HeadBallGame from "../components/head-ball-game";
import ReactionTimeGame from "../components/reaction-time-game";
import TicTacToeGame from "../components/tic-tac-toe-game";
import SudokuGame from "../components/sudoku-game";

export default function Games() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const games = [
    {
      id: "memory-card",
      title: "Memory Card Game",
      description: "Flip cards and find matching pairs with technology icons",
      icon: "🧠",
      component: MemoryCardGame,
    },
    {
      id: "snake-game",
      title: "Snake Game",
      description: "Classic snake game - eat food and grow longer!",
      icon: "🐍",
      component: SnakeGame,
    },
    {
      id: "tetris-game",
      title: "Tetris",
      description: "Classic Tetris - arrange blocks and clear lines!",
      icon: "🎮",
      component: TetrisGame,
    },
    {
      id: "puzzle-game",
      title: "Puzzle Game",
      description: "Random shapes and pieces - complete the puzzle!",
      icon: "🧩",
      component: PuzzleGame,
    },
    {
      id: "dino-game",
      title: "Dino Run",
      description: "Jump over obstacles in this endless runner game!",
      icon: "🦕",
      component: DinoGame,
    },
    {
      id: "flappy-bird",
      title: "Flappy Bird",
      description: "Tap to keep the bird in the air and navigate through pipes!",
      icon: "🐦",
      component: FlappyBirdGame,
    },
    {
      id: "head-ball",
      title: "Head Ball",
      description: "Physics-based 1v1 soccer game with special powers!",
      icon: "⚽",
      component: HeadBallGame,
    },
    {
      id: "reaction-time",
      title: "Reaction Time",
      description: "Test your reflexes! Click as fast as you can when the screen turns green.",
      icon: "⚡",
      component: ReactionTimeGame,
    },
    {
      id: "tic-tac-toe",
      title: "Tic-Tac-Toe AI",
      description: "Can you beat the AI? It utilizes the Minimax algorithm to be unbeatable!",
      icon: "❌",
      component: TicTacToeGame,
    },
    {
      id: "sudoku",
      title: "Sudoku",
      description: "Classic Sudoku puzzle. train your brain with generated puzzles.",
      icon: "🔢",
      component: SudokuGame,
    },
  ];

  if (selectedGame) {
    const game = games.find(g => g.id === selectedGame);
    if (game) {
      const GameComponent = game.component;
      return (
        <div className="min-h-screen bg-background">
          <div className="container-custom py-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Link to="/">
                  <Button variant="outline" size="sm">
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedGame(null)}
                >
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  All Games
                </Button>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">{game.title}</h1>
            </div>
            <GameComponent onBack={() => setSelectedGame(null)} />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-custom py-8">
        <div className="flex items-center justify-between mb-8">
          <Link to="/">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-center">My Games</h1>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>

        <div className="max-w-4xl mx-auto">
          <p className="text-lg text-muted-foreground text-center mb-12">
            Take a break and enjoy some fun games! More games coming soon.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <Card
                key={game.id}
                className="cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => setSelectedGame(game.id)}
              >
                <CardHeader className="text-center">
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                    {game.icon}
                  </div>
                  <CardTitle className="text-xl">{game.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center mb-4">
                    {game.description}
                  </p>

                  {(game.id === "dino-game" || game.id === "head-ball") && (
                    <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-2 border-yellow-400">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200 text-center">
                        Some improvements are in progress 🚧
                      </p>
                    </div>
                  )}

                  <Button className="w-full" variant="outline">
                    Play Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}