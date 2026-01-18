import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, User, List, Zap, Shield, Target, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
  speed: number;
  jumpPower: number;
  onGround: boolean;
  side: 'left' | 'right';
  score: number;
  powerUpActive: string | null;
  powerUpDuration: number;
  character: string;
  color: string;
}

interface Ball {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  speed: number;
}

interface PowerUp {
  type: 'freeze' | 'speed' | 'biggoal' | 'fireball';
  name: string;
  icon: string;
  color: string;
  duration: number;
  cooldown: number;
}

interface HeadBallGameProps {
  onBack: () => void;
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_HEIGHT = 50;
const GOAL_WIDTH = 20;
const GOAL_HEIGHT = 100;
const NET_HEIGHT = 80;

const POWER_UPS: PowerUp[] = [
  { type: 'freeze', name: 'Freeze', icon: '❄️', color: 'bg-blue-500', duration: 3000, cooldown: 15000 },
  { type: 'speed', name: 'Speed', icon: '⚡', color: 'bg-yellow-500', duration: 5000, cooldown: 12000 },
  { type: 'biggoal', name: 'Big Goal', icon: '🎯', color: 'bg-green-500', duration: 8000, cooldown: 20000 },
  { type: 'fireball', name: 'Fireball', icon: '🔥', color: 'bg-red-500', duration: 0, cooldown: 10000 },
];

const CHARACTERS = [
  { name: 'Classic', emoji: '⚽', color: 'bg-blue-500' },
  { name: 'Ninja', emoji: '🥷', color: 'bg-purple-500' },
  { name: 'Robot', emoji: '🤖', color: 'bg-gray-500' },
  { name: 'Wizard', emoji: '🧙', color: 'bg-indigo-500' },
];

export default function HeadBallGame({ onBack }: HeadBallGameProps) {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver' | 'lobby'>('menu');
  const [gameMode, setGameMode] = useState<'ai' | 'local' | 'online'>('ai');
  const [roomCode, setRoomCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const [matchTime, setMatchTime] = useState<number>(60); // seconds
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [player1, setPlayer1] = useState<Player>({
    x: 100,
    y: GAME_HEIGHT - GROUND_HEIGHT - 60,
    width: 40,
    height: 60,
    velocityX: 0,
    velocityY: 0,
    speed: 5,
    jumpPower: 15,
    onGround: true,
    side: 'left',
    score: 0,
    powerUpActive: null,
    powerUpDuration: 0,
    character: 'Classic',
    color: 'bg-blue-500'
  });
  const [player2, setPlayer2] = useState<Player>({
    x: GAME_WIDTH - 140,
    y: GAME_HEIGHT - GROUND_HEIGHT - 60,
    width: 40,
    height: 60,
    velocityX: 0,
    velocityY: 0,
    speed: 4,
    jumpPower: 12,
    onGround: true,
    side: 'right',
    score: 0,
    powerUpActive: null,
    powerUpDuration: 0,
    character: 'Robot',
    color: 'bg-red-500'
  });
  const [ball, setBall] = useState<Ball>({
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    velocityX: 0,
    velocityY: 0,
    radius: 15,
    speed: 1
  });

  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [powerUpCooldowns, setPowerUpCooldowns] = useState<{ [key: string]: number }>({});
  const [lastGoalScorer, setLastGoalScorer] = useState<'player1' | 'player2' | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [showScoreSubmit, setShowScoreSubmit] = useState<boolean>(false);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Fetch top scores for head ball game
  const { data: topScores = [] } = useQuery({
    queryKey: ['/api/games/headball/scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/headball/scores?limit=5');
      if (!response.ok) throw new Error('Failed to fetch scores');
      return response.json();
    }
  });

  // Fetch all scores for results modal
  const { data: allScores = [] } = useQuery({
    queryKey: ['/api/games/headball/all-scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/headball/scores');
      if (!response.ok) throw new Error('Failed to fetch all scores');
      return response.json();
    }
  });

  // Submit score mutation
  const submitScoreMutation = useMutation({
    mutationFn: async (scoreData: { playerName: string; score: number; timeInSeconds: number }) => {
      const response = await fetch('/api/games/headball/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreData),
      });
      if (!response.ok) throw new Error('Failed to submit score');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/headball/scores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games/headball/all-scores'] });
      setShowScoreSubmit(false);
      setPlayerName("");
    },
  });

  // WebSocket Connection Logic
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/headball/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket');
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'ROOM_CREATED':
          setRoomCode(message.payload.code);
          setGameState('lobby');
          setIsHost(true);
          break;

        case 'GAME_START':
          setGameState('playing');
          startGame('online');
          setIsHost(message.payload.role === 'player1');
          if (message.payload.role === 'player2') {
            // Client setup if needed
          }
          break;

        case 'GAME_STATE':
          if (!isHost && gameMode === 'online') {
            // Apply state from host
            const state = message.payload;
            setPlayer1(state.player1);
            setPlayer2(state.player2);
            setBall(state.ball);
            setTimeLeft(state.timeLeft);
            // setScore({ p1: state.player1.score, p2: state.player2.score });
          }
          break;

        case 'PLAYER_INPUT':
          if (isHost && gameMode === 'online') {
            // Host applies client inputs
            // We'll store these in a ref or state map to apply in gameLoop
            // For simplicity, directly updating keys set for p2
            // This part needs careful handling in gameLoop
            // We will simulate "keys" for player 2 based on input
            const input = message.payload;
            // Logic to handle remote input - see gameLoop update
            handleRemoteInput(input);
          }
          break;

        case 'PLAYER_DISCONNECTED':
          alert('Opponent disconnected');
          resetGame();
          break;

        case 'ERROR':
          alert(message.payload.message);
          break;
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };
  }, [isHost, gameMode]);

  const handleRemoteInput = (input: { key: string, type: 'down' | 'up' }) => {
    // This is a simplified way to handle remote inputs. 
    // Ideally we'd separate input handling from the key set.
    // But for P2 physics on Host, we can check a separate "remoteKeys" set.
    setRemoteKeys(prev => {
      const newKeys = new Set(prev);
      if (input.type === 'down') newKeys.add(input.key);
      else newKeys.delete(input.key);
      return newKeys;
    });
  };

  const [remoteKeys, setRemoteKeys] = useState<Set<string>>(new Set());


  const createRoom = () => {
    connectWebSocket();
    setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'CREATE_ROOM' }));
      }
    }, 500); // Small delay to ensure connection
  };

  const joinRoom = () => {
    if (joinCode.length !== 6) return;
    connectWebSocket();
    setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { code: joinCode } }));
      }
    }, 500);
  };


  // Reset ball to center
  const resetBall = useCallback(() => {
    setBall({
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      velocityX: Math.random() > 0.5 ? 3 : -3,
      velocityY: -2,
      radius: 15,
      speed: 1
    });
  }, []);

  // Check ball collision with player
  const checkBallPlayerCollision = useCallback((ball: Ball, player: Player) => {
    const dx = ball.x - (player.x + player.width / 2);
    const dy = ball.y - (player.y + player.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < ball.radius + Math.min(player.width, player.height) / 2;
  }, []);

  // Check goal collision
  const checkGoal = useCallback((ball: Ball) => {
    // Left goal
    if (ball.x - ball.radius <= GOAL_WIDTH &&
      ball.y >= GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT &&
      ball.y <= GAME_HEIGHT - GROUND_HEIGHT) {
      return 'player2';
    }

    // Right goal
    if (ball.x + ball.radius >= GAME_WIDTH - GOAL_WIDTH &&
      ball.y >= GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT &&
      ball.y <= GAME_HEIGHT - GROUND_HEIGHT) {
      return 'player1';
    }

    return null;
  }, []);

  // AI Logic for player 2
  const updateAI = useCallback((player: Player, ball: Ball, opponent: Player) => {
    if (gameMode !== 'ai') return player;

    const newPlayer = { ...player };
    const ballCenterX = ball.x;
    const playerCenterX = player.x + player.width / 2;
    const distanceToBall = Math.abs(ballCenterX - playerCenterX);

    // Basic AI behavior
    if (ballCenterX > GAME_WIDTH / 2) { // Ball is on AI side
      // Move towards ball
      if (ballCenterX > playerCenterX + 10) {
        newPlayer.velocityX = Math.min(newPlayer.speed, newPlayer.velocityX + 0.5);
      } else if (ballCenterX < playerCenterX - 10) {
        newPlayer.velocityX = Math.max(-newPlayer.speed, newPlayer.velocityX - 0.5);
      }

      // Jump if ball is close and above
      if (distanceToBall < 50 && ball.y < player.y && player.onGround) {
        newPlayer.velocityY = -newPlayer.jumpPower;
        newPlayer.onGround = false;
      }
    } else {
      // Return to position
      const homeX = GAME_WIDTH - 140;
      if (playerCenterX > homeX + 20) {
        newPlayer.velocityX = Math.max(-newPlayer.speed, newPlayer.velocityX - 0.3);
      } else if (playerCenterX < homeX - 20) {
        newPlayer.velocityX = Math.min(newPlayer.speed, newPlayer.velocityX + 0.3);
      }
    }

    // Use power-ups randomly
    if (Math.random() < 0.002) { // 0.2% chance per frame
      const availablePowerUps = POWER_UPS.filter(p => !powerUpCooldowns[`player2_${p.type}`]);
      if (availablePowerUps.length > 0) {
        const randomPowerUp = availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
        usePowerUp('player2', randomPowerUp.type);
      }
    }

    return newPlayer;
  }, [gameMode, powerUpCooldowns]);

  // Use power up
  const usePowerUp = useCallback((player: 'player1' | 'player2', powerType: string) => {
    const powerUp = POWER_UPS.find(p => p.type === powerType);
    if (!powerUp || powerUpCooldowns[`${player}_${powerType}`]) return;

    // Set cooldown
    setPowerUpCooldowns(prev => ({
      ...prev,
      [`${player}_${powerType}`]: Date.now() + powerUp.cooldown
    }));

    if (player === 'player1') {
      setPlayer1(prev => ({
        ...prev,
        powerUpActive: powerType,
        powerUpDuration: powerUp.duration
      }));
    } else {
      setPlayer2(prev => ({
        ...prev,
        powerUpActive: powerType,
        powerUpDuration: powerUp.duration
      }));
    }

    // Apply instant effects
    if (powerType === 'freeze') {
      const targetPlayer = player === 'player1' ? 'player2' : 'player1';
      if (targetPlayer === 'player1') {
        setPlayer1(prev => ({ ...prev, powerUpActive: 'frozen', powerUpDuration: powerUp.duration }));
      } else {
        setPlayer2(prev => ({ ...prev, powerUpActive: 'frozen', powerUpDuration: powerUp.duration }));
      }
    } else if (powerType === 'fireball') {
      setBall(prev => ({
        ...prev,
        velocityX: prev.velocityX * 2,
        velocityY: prev.velocityY * 2
      }));
    }
  }, [powerUpCooldowns]);

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    // ONLINE LOGIC
    if (gameMode === 'online') {
      if (isHost) {
        // Host runs physics and broadcasting
        // (Physics continues below normally)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'GAME_STATE',
            payload: {
              player1,
              player2,
              ball,
              timeLeft
            }
          }));
        }
      } else {
        // Client just renders state (updated via onmessage)
        return;
      }
    }


    setPlayer1(prev => {
      let newPlayer = { ...prev };

      // Handle power-up duration
      if (newPlayer.powerUpDuration > 0) {
        newPlayer.powerUpDuration -= 16; // ~60fps
        if (newPlayer.powerUpDuration <= 0) {
          newPlayer.powerUpActive = null;
        }
      }

      // Handle input (only if not frozen)
      if (newPlayer.powerUpActive !== 'frozen') {
        if (keys.has('a') || keys.has('ArrowLeft')) {
          newPlayer.velocityX = Math.max(-newPlayer.speed, newPlayer.velocityX - 0.5);
        }
        if (keys.has('d') || keys.has('ArrowRight')) {
          newPlayer.velocityX = Math.min(newPlayer.speed, newPlayer.velocityX + 0.5);
        }
        if ((keys.has('w') || keys.has('ArrowUp')) && newPlayer.onGround) {
          newPlayer.velocityY = -newPlayer.jumpPower;
          newPlayer.onGround = false;
        }
      }

      // Apply speed boost
      const speedMultiplier = newPlayer.powerUpActive === 'speed' ? 1.5 : 1;
      newPlayer.velocityX *= speedMultiplier;

      // Physics
      newPlayer.velocityX *= 0.8; // Friction
      newPlayer.velocityY += 0.8; // Gravity

      newPlayer.x += newPlayer.velocityX;
      newPlayer.y += newPlayer.velocityY;

      // Boundaries
      if (newPlayer.x < 0) newPlayer.x = 0;
      if (newPlayer.x > GAME_WIDTH / 2 - newPlayer.width) newPlayer.x = GAME_WIDTH / 2 - newPlayer.width;

      if (newPlayer.y >= GAME_HEIGHT - GROUND_HEIGHT - newPlayer.height) {
        newPlayer.y = GAME_HEIGHT - GROUND_HEIGHT - newPlayer.height;
        newPlayer.velocityY = 0;
        newPlayer.onGround = true;
      }

      return newPlayer;
    });

    setPlayer2(prev => {
      let newPlayer = updateAI(prev, ball, player1);

      // Handle power-up duration
      if (newPlayer.powerUpDuration > 0) {
        newPlayer.powerUpDuration -= 16;
        if (newPlayer.powerUpDuration <= 0) {
          newPlayer.powerUpActive = null;
        }
      }

      // Handle local multiplayer input for player 2
      if (gameMode === 'local' && newPlayer.powerUpActive !== 'frozen') {
        if (keys.has('j')) {
          newPlayer.velocityX = Math.max(-newPlayer.speed, newPlayer.velocityX - 0.5);
        }
        if (keys.has('l')) {
          newPlayer.velocityX = Math.min(newPlayer.speed, newPlayer.velocityX + 0.5);
        }
        if (keys.has('i') && newPlayer.onGround) {
          newPlayer.velocityY = -newPlayer.jumpPower;
          newPlayer.onGround = false;
        }
      }

      // Handle ONLINE input for player 2 (Host side)
      if (gameMode === 'online' && isHost && newPlayer.powerUpActive !== 'frozen') {
        // Use remoteKeys
        if (remoteKeys.has('a') || remoteKeys.has('arrowleft')) {
          newPlayer.velocityX = Math.max(-newPlayer.speed, newPlayer.velocityX - 0.5);
        }
        if (remoteKeys.has('d') || remoteKeys.has('arrowright')) {
          newPlayer.velocityX = Math.min(newPlayer.speed, newPlayer.velocityX + 0.5);
        }
        if ((remoteKeys.has('w') || remoteKeys.has('arrowup')) && newPlayer.onGround) {
          newPlayer.velocityY = -newPlayer.jumpPower;
          newPlayer.onGround = false;
        }
      }

      // Apply speed boost
      const speedMultiplier = newPlayer.powerUpActive === 'speed' ? 1.5 : 1;
      newPlayer.velocityX *= speedMultiplier;

      // Physics
      newPlayer.velocityX *= 0.8;
      newPlayer.velocityY += 0.8;

      newPlayer.x += newPlayer.velocityX;
      newPlayer.y += newPlayer.velocityY;

      // Boundaries
      if (newPlayer.x < GAME_WIDTH / 2) newPlayer.x = GAME_WIDTH / 2;
      if (newPlayer.x > GAME_WIDTH - newPlayer.width) newPlayer.x = GAME_WIDTH - newPlayer.width;

      if (newPlayer.y >= GAME_HEIGHT - GROUND_HEIGHT - newPlayer.height) {
        newPlayer.y = GAME_HEIGHT - GROUND_HEIGHT - newPlayer.height;
        newPlayer.velocityY = 0;
        newPlayer.onGround = true;
      }

      return newPlayer;
    });

    setBall(prev => {
      let newBall = { ...prev };

      // Ball physics
      newBall.velocityY += 0.5; // Gravity
      newBall.x += newBall.velocityX;
      newBall.y += newBall.velocityY;

      // Ball boundaries
      if (newBall.x - newBall.radius <= 0 || newBall.x + newBall.radius >= GAME_WIDTH) {
        newBall.velocityX = -newBall.velocityX * 0.8;
      }
      if (newBall.y + newBall.radius >= GAME_HEIGHT - GROUND_HEIGHT) {
        newBall.y = GAME_HEIGHT - GROUND_HEIGHT - newBall.radius;
        newBall.velocityY = -newBall.velocityY * 0.7;
        newBall.velocityX *= 0.9;
      }
      if (newBall.y - newBall.radius <= 0) {
        newBall.velocityY = -newBall.velocityY * 0.8;
      }

      // Check collisions with players
      if (checkBallPlayerCollision(newBall, player1)) {
        const dx = newBall.x - (player1.x + player1.width / 2);
        const dy = newBall.y - (player1.y + player1.height / 2);
        const angle = Math.atan2(dy, dx);
        const force = player1.powerUpActive === 'speed' ? 8 : 6;
        newBall.velocityX = Math.cos(angle) * force;
        newBall.velocityY = Math.sin(angle) * force;
      }

      if (checkBallPlayerCollision(newBall, player2)) {
        const dx = newBall.x - (player2.x + player2.width / 2);
        const dy = newBall.y - (player2.y + player2.height / 2);
        const angle = Math.atan2(dy, dx);
        const force = player2.powerUpActive === 'speed' ? 8 : 6;
        newBall.velocityX = Math.cos(angle) * force;
        newBall.velocityY = Math.sin(angle) * force;
      }

      // Check goals
      const goal = checkGoal(newBall);
      if (goal) {
        if (goal === 'player1') {
          setPlayer1(prev => ({ ...prev, score: prev.score + 1 }));
        } else {
          setPlayer2(prev => ({ ...prev, score: prev.score + 1 }));
        }
        setLastGoalScorer(goal);
        setTimeout(resetBall, 1000);
      }

      return newBall;
    });

    // Update cooldowns
    setPowerUpCooldowns(prev => {
      const now = Date.now();
      const updated: { [key: string]: number } = {};
      for (const [key, value] of Object.entries(prev)) {
        if (value > now) {
          updated[key] = value;
        }
      }
      return updated;
    });

  }, [gameState, keys, remoteKeys, ball, player1, player2, checkBallPlayerCollision, checkGoal, resetBall, updateAI, gameMode, isHost, timeLeft]);

  // Start game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = setInterval(gameLoop, 16); // ~60fps

      // Game timer
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('gameOver');
            setShowScoreSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        clearInterval(timer);
      };
    }
  }, [gameState, gameLoop]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setKeys(prev => new Set([...Array.from(prev), key]));

      // ONLINE: Send input if client
      if (gameMode === 'online' && !isHost && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PLAYER_INPUT', payload: { key, type: 'down' } }));
      }


      // Power-ups for player 1
      if (gameState === 'playing') {
        if (e.key === '1') usePowerUp('player1', 'freeze');
        if (e.key === '2') usePowerUp('player1', 'speed');
        if (e.key === '3') usePowerUp('player1', 'biggoal');
        if (e.key === '4') usePowerUp('player1', 'fireball');

        // Power-ups for player 2 (local multiplayer)
        if (gameMode === 'local') {
          if (e.key === '7') usePowerUp('player2', 'freeze');
          if (e.key === '8') usePowerUp('player2', 'speed');
          if (e.key === '9') usePowerUp('player2', 'biggoal');
          if (e.key === '0') usePowerUp('player2', 'fireball');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setKeys(prev => {
        const newKeys = new Set(Array.from(prev));
        newKeys.delete(key);
        return newKeys;
      });

      // ONLINE: Send input if client
      if (gameMode === 'online' && !isHost && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PLAYER_INPUT', payload: { key, type: 'up' } }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, gameMode, usePowerUp]);

  const startGame = (mode: 'ai' | 'local' | 'online') => {
    setGameMode(mode);
    setGameState('playing');
    setTimeLeft(matchTime);
    setPlayer1(prev => ({ ...prev, score: 0 }));
    setPlayer2(prev => ({ ...prev, score: 0 }));
    resetBall();
    setLastGoalScorer(null);
    setPowerUpCooldowns({});
  };

  const resetGame = () => {
    setGameState('menu');
    setPlayer1(prev => ({ ...prev, score: 0 }));
    setPlayer2(prev => ({ ...prev, score: 0 }));
    resetBall();
    setTimeLeft(matchTime);
    setShowScoreSubmit(false);
  };

  const handleSubmitScore = () => {
    if (playerName.trim()) {
      const finalScore = Math.max(player1.score, player2.score) * 100 + (60 - (matchTime - timeLeft)) * 10;
      submitScoreMutation.mutate({
        playerName: playerName.trim(),
        score: finalScore,
        timeInSeconds: matchTime - timeLeft,
      });
    }
  };

  if (gameState === 'menu') {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-muted/20 border-b">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-2xl font-bold">Head Ball</h1>
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
                  Head Ball - All Results
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
        </div>

        {/* Main Menu */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8">
            <div className="max-w-2xl w-full space-y-8 text-center">
              <div>
                <h2 className="text-4xl font-bold mb-4">⚽ Head Ball</h2>
                <p className="text-lg text-muted-foreground">
                  Physics-based football game with special powers!
                </p>
              </div>

              {/* Top Scores */}
              <div className="bg-muted/20 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">🏆 Top Scores</h3>
                {topScores.length > 0 ? (
                  <div className="space-y-2">
                    {topScores.slice(0, 3).map((score: any, index: number) => (
                      <div key={score.id} className="flex items-center justify-between">
                        <span className={index === 0 ? "text-yellow-500 font-bold" : ""}>
                          #{index + 1} {score.playerName}
                        </span>
                        <span className="font-mono">{score.score}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No scores yet - be the first!</p>
                )}
              </div>

              {/* Game Mode Selection */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Choose Game Mode</h3>
                <div className="grid gap-4 max-w-md mx-auto">
                  <Button
                    onClick={() => startGame('ai')}
                    size="lg"
                    className="h-16 text-lg"
                  >
                    🤖 vs AI
                  </Button>
                  <Button
                    onClick={() => startGame('local')}
                    size="lg"
                    variant="outline"
                    className="h-16 text-lg"
                  >
                    👥 Local Multiplayer
                  </Button>
                </div>

                {/* Online Multiplayer Section */}
                <div className="mt-8 border-t pt-6 bg-muted/10 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    🌐 Online Multiplayer
                  </h3>
                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                    <div className="space-y-2">
                      <Button onClick={createRoom} className="w-full bg-indigo-600 hover:bg-indigo-700">
                        Create Game
                      </Button>
                      <p className="text-xs text-muted-foreground">Host a match and get a code</p>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter Code (e.g. 123456)"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        maxLength={6}
                        className="text-center font-mono tracking-widest uppercase"
                      />
                      <Button onClick={joinRoom} variant="outline" className="w-full">
                        Join Game
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div className="bg-blue-500/10 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Player 1 Controls</h4>
                <div className="space-y-1">
                  <p><kbd className="px-2 py-1 bg-muted rounded">A/D</kbd> or <kbd className="px-2 py-1 bg-muted rounded">←/→</kbd> Move</p>
                  <p><kbd className="px-2 py-1 bg-muted rounded">W</kbd> or <kbd className="px-2 py-1 bg-muted rounded">↑</kbd> Jump</p>
                  <p><kbd className="px-2 py-1 bg-muted rounded">1-4</kbd> Power-ups</p>
                </div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Player 2 Controls</h4>
                <div className="space-y-1">
                  <p><kbd className="px-2 py-1 bg-muted rounded">J/L</kbd> Move</p>
                  <p><kbd className="px-2 py-1 bg-muted rounded">I</kbd> Jump</p>
                  <p><kbd className="px-2 py-1 bg-muted rounded">7-0</kbd> Power-ups</p>
                </div>
              </div>
            </div>

            {/* Power-ups Guide */}
            <div className="bg-muted/20 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Power-ups</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {POWER_UPS.map((power) => (
                  <div key={power.type} className="text-center">
                    <div className="text-lg mb-1">{power.icon}</div>
                    <div className="font-medium">{power.name}</div>
                  </div>
                ))}
              </div>
            </div>


          </div>
        </div>
      </div>
    );
  }

  // Lobby Screen
  if (gameState === 'lobby') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-8 bg-muted/20 p-8 rounded-xl border-2 border-dashed border-indigo-500/30">
          <div>
            <h2 className="text-3xl font-bold mb-2">Waiting for Player...</h2>
            <p className="text-muted-foreground">Share this code with your friend:</p>
          </div>

          <div className="py-6">
            <div className="text-6xl font-mono font-bold tracking-widest text-indigo-400 bg-background/50 py-4 rounded-lg border-2 border-indigo-500/20 select-all">
              {roomCode}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-yellow-500 animate-pulse">
            <Zap className="h-4 w-4" />
            <span>Waiting for connection...</span>
          </div>

          <Button variant="ghost" onClick={resetGame}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Game Header */}
      <div className="flex items-center justify-between p-3 bg-muted/20 border-b text-sm">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={resetGame}>
            ← Menu
          </Button>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="font-mono font-bold">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center gap-4 text-lg font-bold">
            <span className="text-blue-500">{player1.score}</span>
            <span>-</span>
            <span className="text-red-500">{player2.score}</span>
          </div>
          {lastGoalScorer && (
            <div className="text-xs text-muted-foreground">
              Goal by {lastGoalScorer === 'player1' ? 'Player 1' : 'Player 2'}!
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {gameMode === 'ai' ? '🤖 vs AI' : '👥 Local'}
          </span>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="relative bg-green-600 rounded-lg border-4 border-white overflow-hidden"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        >
          {/* Field markings */}
          <div className="absolute inset-0">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white transform -translate-x-px"></div>
            {/* Center circle */}
            <div className="absolute left-1/2 top-1/2 w-20 h-20 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>

          {/* Goals */}
          <div
            className="absolute left-0 bg-gray-800 border-2 border-white"
            style={{
              width: GOAL_WIDTH,
              height: GOAL_HEIGHT,
              bottom: GROUND_HEIGHT,
            }}
          ></div>
          <div
            className="absolute right-0 bg-gray-800 border-2 border-white"
            style={{
              width: GOAL_WIDTH,
              height: GOAL_HEIGHT,
              bottom: GROUND_HEIGHT,
            }}
          ></div>

          {/* Net */}
          <div
            className="absolute bg-gray-700"
            style={{
              left: GOAL_WIDTH / 2,
              width: 2,
              height: NET_HEIGHT,
              bottom: GROUND_HEIGHT + GOAL_HEIGHT / 2,
            }}
          ></div>
          <div
            className="absolute bg-gray-700"
            style={{
              right: GOAL_WIDTH / 2,
              width: 2,
              height: NET_HEIGHT,
              bottom: GROUND_HEIGHT + GOAL_HEIGHT / 2,
            }}
          ></div>

          {/* Ground */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-green-800"
            style={{ height: GROUND_HEIGHT }}
          ></div>

          {/* Player 1 */}
          <div
            className={`absolute rounded-full ${player1.color} border-2 border-white flex items-center justify-center text-white font-bold transition-all duration-100 ${player1.powerUpActive === 'frozen' ? 'opacity-50' : ''
              } ${player1.powerUpActive === 'speed' ? 'shadow-lg shadow-yellow-500' : ''
              }`}
            style={{
              left: player1.x,
              top: player1.y,
              width: player1.width,
              height: player1.height,
            }}
          >
            {CHARACTERS.find(c => c.name === player1.character)?.emoji || '⚽'}
            {player1.powerUpActive && player1.powerUpActive !== 'frozen' && (
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs">
                {POWER_UPS.find(p => p.type === player1.powerUpActive)?.icon}
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div
            className={`absolute rounded-full ${player2.color} border-2 border-white flex items-center justify-center text-white font-bold transition-all duration-100 ${player2.powerUpActive === 'frozen' ? 'opacity-50' : ''
              } ${player2.powerUpActive === 'speed' ? 'shadow-lg shadow-yellow-500' : ''
              }`}
            style={{
              left: player2.x,
              top: player2.y,
              width: player2.width,
              height: player2.height,
            }}
          >
            {CHARACTERS.find(c => c.name === player2.character)?.emoji || '🤖'}
            {player2.powerUpActive && player2.powerUpActive !== 'frozen' && (
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs">
                {POWER_UPS.find(p => p.type === player2.powerUpActive)?.icon}
              </div>
            )}
          </div>

          {/* Ball */}
          <div
            className="absolute rounded-full bg-white border-2 border-gray-300 flex items-center justify-center transition-all duration-100"
            style={{
              left: ball.x - ball.radius,
              top: ball.y - ball.radius,
              width: ball.radius * 2,
              height: ball.radius * 2,
            }}
          >
            ⚽
          </div>
        </div>
      </div>

      {/* Power-up Controls */}
      <div className="p-4 bg-muted/10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-4">
          {/* Player 1 Power-ups */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-blue-500">Player 1 Power-ups</h4>
            <div className="grid grid-cols-4 gap-2">
              {POWER_UPS.map((power, index) => {
                const cooldownKey = `player1_${power.type}`;
                const isOnCooldown = powerUpCooldowns[cooldownKey] > Date.now();
                return (
                  <Button
                    key={power.type}
                    variant="outline"
                    size="sm"
                    disabled={isOnCooldown}
                    onClick={() => usePowerUp('player1', power.type)}
                    className="h-12 text-xs"
                  >
                    <div className="text-center">
                      <div className="text-lg">{power.icon}</div>
                      <div>{index + 1}</div>
                      {isOnCooldown && (
                        <div className="text-xs">
                          {Math.ceil((powerUpCooldowns[cooldownKey] - Date.now()) / 1000)}s
                        </div>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Player 2 Power-ups (only for local multiplayer) */}
          {gameMode === 'local' && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-500">Player 2 Power-ups</h4>
              <div className="grid grid-cols-4 gap-2">
                {POWER_UPS.map((power, index) => {
                  const cooldownKey = `player2_${power.type}`;
                  const isOnCooldown = powerUpCooldowns[cooldownKey] > Date.now();
                  const keyNumber = index + 7;
                  return (
                    <Button
                      key={power.type}
                      variant="outline"
                      size="sm"
                      disabled={isOnCooldown}
                      onClick={() => usePowerUp('player2', power.type)}
                      className="h-12 text-xs"
                    >
                      <div className="text-center">
                        <div className="text-lg">{power.icon}</div>
                        <div>{keyNumber === 10 ? '0' : keyNumber}</div>
                        {isOnCooldown && (
                          <div className="text-xs">
                            {Math.ceil((powerUpCooldowns[cooldownKey] - Date.now()) / 1000)}s
                          </div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score Submit Modal */}
      {showScoreSubmit && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <CardContent className="p-6 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-xl font-bold mb-2">Game Over!</h2>

              <div className="mb-4 space-y-2">
                <p className="text-lg">
                  Final Score: <span className="font-bold text-blue-500">{player1.score}</span> - <span className="font-bold text-red-500">{player2.score}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Time: {Math.floor((matchTime - timeLeft) / 60)}:{((matchTime - timeLeft) % 60).toString().padStart(2, '0')}
                </p>
                {(player1.score > player2.score || (gameMode === 'local' && player2.score > player1.score)) && (
                  <p className="text-sm text-green-600 font-semibold">
                    {player1.score > player2.score ? 'Player 1 Wins!' : 'Player 2 Wins!'}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="text-center"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitScore}
                    disabled={!playerName.trim() || submitScoreMutation.isPending}
                    className="flex-1"
                  >
                    {submitScoreMutation.isPending ? "Submitting..." : "Submit Score"}
                  </Button>
                  <Button onClick={resetGame} variant="outline">
                    Menu
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}