import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RotateCcw, Trophy, Clock, Target, User, List } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  SiReact, SiJavascript, SiTypescript, SiNodedotjs, SiPython,
  SiDocker, SiKubernetes, SiAmazon, SiMongodb, SiPostgresql,
  SiGit, SiVuedotjs, SiAngular, SiSharp, SiDotnet
} from "react-icons/si";

interface GameCard {
  id: number;
  icon: any;
  name: string;
  color: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface MemoryCardGameProps {
  onBack: () => void;
}

export default function MemoryCardGame({ onBack }: MemoryCardGameProps) {
  const [cards, setCards] = useState<GameCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [gameTime, setGameTime] = useState<number>(0);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isGameCompleted, setIsGameCompleted] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>("");
  const [showScoreSubmit, setShowScoreSubmit] = useState<boolean>(false);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  
  const queryClient = useQueryClient();

  // Fetch top scores for memory game
  const { data: topScores = [] } = useQuery({
    queryKey: ['/api/games/memory/scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/memory/scores?limit=5');
      if (!response.ok) throw new Error('Failed to fetch scores');
      return response.json();
    }
  });

  // Fetch all scores for results modal
  const { data: allScores = [] } = useQuery({
    queryKey: ['/api/games/memory/all-scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/memory/scores');
      if (!response.ok) throw new Error('Failed to fetch all scores');
      return response.json();
    }
  });

  // Submit score mutation
  const submitScoreMutation = useMutation({
    mutationFn: async (scoreData: { playerName: string; score: number; timeInSeconds: number }) => {
      const response = await fetch('/api/games/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scoreData,
          gameType: 'memory'
        }),
      });
      if (!response.ok) throw new Error('Failed to submit score');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/memory/scores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games/memory/all-scores'] });
      setShowScoreSubmit(false);
      setPlayerName("");
    }
  });

  // Technology icons for the memory game (15 different technologies, 30 cards total for 5x6 grid)
  const technologies = [
    { icon: SiReact, name: "React", color: "text-blue-500" },
    { icon: SiJavascript, name: "JavaScript", color: "text-yellow-500" },
    { icon: SiTypescript, name: "TypeScript", color: "text-blue-600" },
    { icon: SiNodedotjs, name: "Node.js", color: "text-green-600" },
    { icon: SiPython, name: "Python", color: "text-blue-700" },
    { icon: SiDocker, name: "Docker", color: "text-blue-600" },
    { icon: SiKubernetes, name: "Kubernetes", color: "text-blue-700" },
    { icon: SiAmazon, name: "AWS", color: "text-orange-500" },
    { icon: SiMongodb, name: "MongoDB", color: "text-green-600" },
    { icon: SiPostgresql, name: "PostgreSQL", color: "text-blue-700" },
    { icon: SiGit, name: "Git", color: "text-red-600" },
    { icon: SiVuedotjs, name: "Vue.js", color: "text-green-500" },
    { icon: SiAngular, name: "Angular", color: "text-red-600" },
    { icon: SiSharp, name: "C#", color: "text-purple-600" },
    { icon: SiDotnet, name: ".NET", color: "text-purple-700" },
  ];

  // Initialize game
  const initializeGame = useCallback(() => {
    // Create pairs of cards (30 cards = 15 pairs)
    const gameCards: GameCard[] = [];
    let id = 0;

    // Add pairs of technology cards
    technologies.forEach((tech) => {
      // First card of the pair
      gameCards.push({
        id: id++,
        icon: tech.icon,
        name: tech.name,
        color: tech.color,
        isFlipped: false,
        isMatched: false,
      });
      // Second card of the pair
      gameCards.push({
        id: id++,
        icon: tech.icon,
        name: tech.name,
        color: tech.color,
        isFlipped: false,
        isMatched: false,
      });
    });

    // Shuffle the cards
    const shuffledCards = gameCards.sort(() => Math.random() - 0.5);
    setCards(shuffledCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setMoves(0);
    setGameTime(0);
    setIsGameStarted(false);
    setIsGameCompleted(false);
    setShowScoreSubmit(false);
    setIsNewRecord(false);
  }, []);

  // Handle card click
  const handleCardClick = (cardId: number) => {
    if (!isGameStarted) {
      setIsGameStarted(true);
    }

    if (flippedCards.length === 2) return;
    if (flippedCards.includes(cardId)) return;
    if (cards.find(card => card.id === cardId)?.isMatched) return;

    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);

    // Update card flip state
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, isFlipped: true } : card
    ));

    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1);
      checkForMatch(newFlippedCards);
    }
  };

  // Check for matching cards
  const checkForMatch = (flippedCardIds: number[]) => {
    const [firstId, secondId] = flippedCardIds;
    const firstCard = cards.find(card => card.id === firstId);
    const secondCard = cards.find(card => card.id === secondId);

    if (!firstCard || !secondCard) return;

    // Check if cards match (same name)
    const isMatch = firstCard.name === secondCard.name;

    setTimeout(() => {
      if (isMatch) {
        // Mark as matched
        setCards(prev => prev.map(card => 
          flippedCardIds.includes(card.id) 
            ? { ...card, isMatched: true, isFlipped: true }
            : card
        ));
        setMatchedPairs(prev => prev + 1);
        
        // Check if game is completed (15 pairs = 15 matches to win)
        if (matchedPairs + 1 >= 15) {
          setIsGameCompleted(true);
          // Check if this is a new record (faster time)
          const isRecord = topScores.length === 0 || gameTime < (topScores[0]?.timeInSeconds || Infinity);
          setIsNewRecord(isRecord);
          setShowScoreSubmit(true);
        }
      } else {
        // Flip back if no match
        setCards(prev => prev.map(card => 
          flippedCardIds.includes(card.id) 
            ? { ...card, isFlipped: false }
            : card
        ));
      }
      setFlippedCards([]);
    }, 1000);
  };

  // Game timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGameStarted && !isGameCompleted) {
      interval = setInterval(() => {
        setGameTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameStarted, isGameCompleted]);

  // Initialize game on component mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Game Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">Pairs: {matchedPairs}/15</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">{formatTime(gameTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Moves: {moves}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <List className="h-4 w-4 mr-2" />
                  Results
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Memory Card Game - All Results
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
                            <div className="text-sm font-mono">{formatTime(score.timeInSeconds)}</div>
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
            <Button onClick={initializeGame} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              New Game
            </Button>
          </div>
        </div>

        {/* Game Completion Message with Score Submission */}
        {isGameCompleted && (
          <Card className="mb-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
                <Trophy className="h-6 w-6" />
                <span className="font-bold text-lg">
                  {isNewRecord ? "🏆 NEW RECORD!" : "Congratulations!"}
                </span>
              </div>
              <p className="mt-2 text-green-600 dark:text-green-400">
                You completed the game in {moves} moves and {formatTime(gameTime)}!
                {isNewRecord && <span className="block text-yellow-600 font-semibold">Fastest time ever!</span>}
              </p>
              
              {/* Score Submission Form */}
              {showScoreSubmit && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <Input
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-40"
                      maxLength={20}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (playerName.trim()) {
                        submitScoreMutation.mutate({
                          playerName: playerName.trim(),
                          score: 100 - moves, // Score based on fewer moves = higher score
                          timeInSeconds: gameTime,
                        });
                      }
                    }}
                    disabled={!playerName.trim() || submitScoreMutation.isPending}
                    size="sm"
                  >
                    {submitScoreMutation.isPending ? "Saving..." : "Save Score"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}


      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-6 gap-2 md:gap-3 max-w-3xl mx-auto">
        {cards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card
              key={card.id}
              className={`aspect-square cursor-pointer transition-all duration-300 hover:scale-105 ${
                card.isMatched 
                  ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700' 
                  : 'hover:shadow-md'
              } ${
                card.isFlipped || card.isMatched
                  ? 'transform rotate-y-0'
                  : 'transform hover:rotate-y-12'
              }`}
              onClick={() => handleCardClick(card.id)}
            >
              <CardContent className="p-2 h-full flex items-center justify-center">
                {card.isFlipped || card.isMatched ? (
                  <div className="flex flex-col items-center gap-1">
                    <IconComponent className={`h-6 w-6 md:h-8 md:w-8 ${card.color}`} />
                    <span className="text-xs font-medium text-center leading-tight">
                      {card.name}
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">?</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Game Instructions */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Flip cards to find matching pairs of technologies. Match all 15 pairs to win!</p>
      </div>
    </div>
  );
}