import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, ArrowLeft, Trophy, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type GameScore } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReactionTimeGameProps {
  onBack: () => void;
}

export default function ReactionTimeGame({ onBack }: ReactionTimeGameProps) {
  const [state, setState] = useState<"idle" | "waiting" | "ready" | "early" | "result">("idle");
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startGame = () => {
    setState("waiting");
    const randomTime = Math.floor(Math.random() * 2000) + 2000; // 2-4 seconds

    timeoutRef.current = setTimeout(() => {
      setState("ready");
      setStartTime(Date.now());
    }, randomTime);
  };

  const handleClick = () => {
    if (state === "waiting") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setState("early");
    } else if (state === "ready") {
      const now = Date.now();
      const score = now - startTime;
      setEndTime(score);
      setState("result");
      if (bestScore === null || score < bestScore) {
        setBestScore(score);
      }
    } else if (state === "idle" || state === "early" || state === "result") {
      // Don't restart immediately if clicking on the form
      // This click handler is on the div, but inputs inside might bubble?
      // Actually the form will be outside the clickable div to avoid this.
      startGame();
    }
  };

  const submitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/games/scores", {
        playerName,
        gameType: "reaction-time",
        score: endTime,
      });

      toast({
        title: "Score Saved!",
        description: `Your reflex of ${endTime}ms has been recorded.`,
      });

      // Invalidate queries to refresh leaderboard if it was visible
      queryClient.invalidateQueries({ queryKey: ["/api/games/reaction-time/scores"] });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save score. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getMessage = () => {
    switch (state) {
      case "idle":
        return "Click anywhere to start";
      case "waiting":
        return "Wait for green...";
      case "ready":
        return "CLICK NOW!";
      case "early":
        return "Too early! Click to try again";
      case "result":
        return `${endTime} ms`;
    }
  };

  const getBgColor = () => {
    switch (state) {
      case "waiting":
        return "bg-red-500 hover:bg-red-600";
      case "ready":
        return "bg-green-500 hover:bg-green-600";
      case "early":
        return "bg-yellow-500 hover:bg-yellow-600";
      case "result":
        return "bg-blue-500 hover:bg-blue-600";
      default:
        return "bg-primary/10 hover:bg-primary/20";
    }
  };

  /* Fetch top scores safely */
  const { data: scores = [] } = useQuery<GameScore[]>({
    queryKey: ["/api/games/reaction-time/scores"],
    queryFn: async () => {
      const res = await fetch("/api/games/reaction-time/scores");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto space-y-6">
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex gap-2">
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
                  Reflex Leaderboard
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
                      <div className="font-mono">{score.score}ms</div>
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

        {/* Show all-time best from database */}
        {scores.length > 0 && (
          <div className="flex items-center gap-2 text-primary font-bold">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Best: {Math.min(...scores.map(s => s.score))}ms
          </div>
        )}
      </div>


      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Reflex Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`w-full h-80 rounded-xl flex items-center justify-center cursor-pointer transition-colors duration-200 select-none ${getBgColor()}`}
            onMouseDown={state !== "result" ? handleClick : undefined}
            onClick={state === "result" ? handleClick : undefined}
          >
            <motion.div
              key={state}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              {state === "idle" && <div className="text-6xl mb-4">⚡</div>}
              {state === "waiting" && <div className="text-6xl mb-4">🛑</div>}
              {state === "ready" && <div className="text-6xl mb-4">🟢</div>}
              {state === "early" && <div className="text-6xl mb-4">⚠️</div>}
              {state === "result" && <div className="text-6xl mb-4">⏱️</div>}

              <h2 className="text-3xl font-bold text-foreground">
                {getMessage()}
              </h2>
              {state === "result" && (
                <p className="text-lg mt-2 opacity-90">Click to try again</p>
              )}
            </motion.div>
          </div>

          {state === "result" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mt-6 p-4 bg-muted/50 rounded-lg"
            >
              <h3 className="text-sm font-medium mb-2">Save your score</h3>
              <form onSubmit={submitScore} className="flex gap-2">
                <Input
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={20}
                  className="bg-background"
                />
                <Button type="submit" disabled={isSubmitting || !playerName.trim()}>
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              </form>
            </motion.div>
          )}

          <div className="mt-6 text-center text-muted-foreground">
            <p>Test your visual reaction speed.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
