import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, List, Clock, Zap, ChevronLeft, ChevronRight, ArrowUp, Wifi, WifiOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PartySocket from "partysocket";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  onGround: boolean;
  score: number;
  powerUp: PowerUpType | null;
  powerUpEndTime: number;
  frozen: boolean;
  frozenEndTime: number;
  side: 'left' | 'right';
  color: string;
  emoji: string;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lastTouchedBy: 'player1' | 'player2' | null;
  isFireball: boolean;
  fireballEndTime: number;
}

type PowerUpType = 'freeze' | 'speed' | 'bigBall' | 'fireball';

interface PowerUp {
  type: PowerUpType;
  name: string;
  icon: string;
  duration: number;
  cooldown: number;
}

interface GameState {
  player1: Player;
  player2: Player;
  ball: Ball;
  timeLeft: number;
  isPaused: boolean;
  lastGoalScorer: 'player1' | 'player2' | null;
  goalAnimation: number;
}

interface KeyState {
  left: boolean;
  right: boolean;
  up: boolean;
}

interface HeadBallGameProps {
  onBack: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;
const GROUND_Y = GAME_HEIGHT - 40;

// Goal dimensions - OPEN goals that ball can enter
const GOAL_WIDTH = 60; // Width of goal opening
const GOAL_HEIGHT = 130; // Height of goal opening
const GOAL_POST_WIDTH = 8;
const GOAL_DEPTH = 30; // Depth of goal behind the line

// Physics constants
const GRAVITY = 0.55;
const PLAYER_SPEED = 5.5;
const PLAYER_JUMP_FORCE = -13.5;
const PLAYER_RADIUS = 35; // Increased from 28 for better visibility
const BALL_RADIUS = 18;
const FRICTION = 0.985;
const GROUND_FRICTION = 0.92;
const AIR_RESISTANCE = 0.998;
const BALL_BOUNCE = 0.72;
const WALL_BOUNCE = 0.75;
const PLAYER_BALL_FORCE = 11;
const MAX_BALL_SPEED = 16;

const MATCH_DURATION = 90;

const POWER_UPS: PowerUp[] = [
  { type: 'freeze', name: 'Freeze', icon: '❄️', duration: 2500, cooldown: 12000 },
  { type: 'speed', name: 'Speed', icon: '⚡', duration: 5000, cooldown: 10000 },
  { type: 'bigBall', name: 'Big Ball', icon: '🎯', duration: 6000, cooldown: 15000 },
  { type: 'fireball', name: 'Fireball', icon: '🔥', duration: 0, cooldown: 8000 },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ============================================================================
// GAME INITIALIZATION
// ============================================================================

function createInitialPlayer(side: 'left' | 'right'): Player {
  return {
    x: side === 'left' ? 150 : GAME_WIDTH - 150,
    y: GROUND_Y - PLAYER_RADIUS,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    onGround: true,
    score: 0,
    powerUp: null,
    powerUpEndTime: 0,
    frozen: false,
    frozenEndTime: 0,
    side,
    color: side === 'left' ? '#3B82F6' : '#EF4444',
    emoji: side === 'left' ? '😎' : '🤖'
  };
}

function createInitialBall(): Ball {
  return {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 3,
    vx: (Math.random() - 0.5) * 4,
    vy: 0,
    radius: BALL_RADIUS,
    lastTouchedBy: null,
    isFireball: false,
    fireballEndTime: 0
  };
}

function createInitialGameState(): GameState {
  return {
    player1: createInitialPlayer('left'),
    player2: createInitialPlayer('right'),
    ball: createInitialBall(),
    timeLeft: MATCH_DURATION,
    isPaused: false,
    lastGoalScorer: null,
    goalAnimation: 0
  };
}

// ============================================================================
// PHYSICS ENGINE
// ============================================================================

function updatePlayerPhysics(
  player: Player,
  keys: KeyState,
  speedBoost: boolean
): Player {
  const p = { ...player };

  if (p.frozen) return p;

  const speed = speedBoost ? PLAYER_SPEED * 1.6 : PLAYER_SPEED;

  // Horizontal movement
  if (keys.left) p.vx -= speed * 0.4;
  if (keys.right) p.vx += speed * 0.4;

  // Apply friction
  p.vx *= p.onGround ? GROUND_FRICTION : FRICTION;

  // Clamp horizontal speed
  p.vx = clamp(p.vx, -speed, speed);

  // Jump
  if (keys.up && p.onGround) {
    p.vy = PLAYER_JUMP_FORCE;
    p.onGround = false;
  }

  // Gravity
  p.vy += GRAVITY;

  // Update position
  p.x += p.vx;
  p.y += p.vy;

  // Ground collision
  if (p.y + p.radius >= GROUND_Y) {
    p.y = GROUND_Y - p.radius;
    p.vy = 0;
    p.onGround = true;
  }

  // Side boundaries - players stay on their side
  const midField = GAME_WIDTH / 2;
  if (p.side === 'left') {
    // Left player can't enter their own goal or cross midfield
    p.x = clamp(p.x, GOAL_WIDTH + GOAL_DEPTH + p.radius, midField - p.radius);
  } else {
    // Right player can't enter their own goal or cross midfield
    p.x = clamp(p.x, midField + p.radius, GAME_WIDTH - GOAL_WIDTH - GOAL_DEPTH - p.radius);
  }

  // Ceiling
  if (p.y - p.radius < 0) {
    p.y = p.radius;
    p.vy = Math.abs(p.vy) * 0.5;
  }

  return p;
}

function updateBallPhysics(ball: Ball, bigBallActive: boolean): Ball {
  const b = { ...ball };

  const currentRadius = bigBallActive ? BALL_RADIUS * 1.5 : BALL_RADIUS;
  b.radius = currentRadius;

  // Gravity
  b.vy += GRAVITY * 0.8;

  // Air resistance
  b.vx *= AIR_RESISTANCE;
  b.vy *= AIR_RESISTANCE;

  // Clamp speed
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (speed > MAX_BALL_SPEED) {
    const scale = MAX_BALL_SPEED / speed;
    b.vx *= scale;
    b.vy *= scale;
  }

  // Update position
  b.x += b.vx;
  b.y += b.vy;

  // Ground bounce
  if (b.y + b.radius >= GROUND_Y) {
    b.y = GROUND_Y - b.radius;
    b.vy = -b.vy * BALL_BOUNCE;
    b.vx *= GROUND_FRICTION;
  }

  // Ceiling bounce
  if (b.y - b.radius < 0) {
    b.y = b.radius;
    b.vy = Math.abs(b.vy) * BALL_BOUNCE;
  }

  // Goal area boundaries
  const leftGoalRight = GOAL_WIDTH + GOAL_DEPTH;
  const rightGoalLeft = GAME_WIDTH - GOAL_WIDTH - GOAL_DEPTH;
  const goalTop = GROUND_Y - GOAL_HEIGHT;

  // Left side - check if ball is in goal area or playing field
  if (b.x - b.radius < leftGoalRight) {
    // Check if ball is at goal height (can enter goal)
    if (b.y + b.radius > goalTop && b.y - b.radius < GROUND_Y) {
      // Ball is in goal height range - allow entry into goal
      if (b.x - b.radius < 0) {
        // Hit back wall of goal
        b.x = b.radius;
        b.vx = Math.abs(b.vx) * WALL_BOUNCE;
      }
      // Bounce off goal top bar
      if (b.y - b.radius < goalTop && b.x < leftGoalRight) {
        b.y = goalTop + b.radius;
        b.vy = Math.abs(b.vy) * WALL_BOUNCE;
      }
    } else {
      // Ball is above goal - bounce off wall
      if (b.x - b.radius < leftGoalRight && b.y - b.radius < goalTop) {
        b.x = leftGoalRight + b.radius;
        b.vx = Math.abs(b.vx) * WALL_BOUNCE;
      }
    }
  }

  // Right side - check if ball is in goal area or playing field
  if (b.x + b.radius > rightGoalLeft) {
    if (b.y + b.radius > goalTop && b.y - b.radius < GROUND_Y) {
      // Ball is in goal height range - allow entry
      if (b.x + b.radius > GAME_WIDTH) {
        // Hit back wall of goal
        b.x = GAME_WIDTH - b.radius;
        b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      }
      // Bounce off goal top bar
      if (b.y - b.radius < goalTop && b.x > rightGoalLeft) {
        b.y = goalTop + b.radius;
        b.vy = Math.abs(b.vy) * WALL_BOUNCE;
      }
    } else {
      // Ball is above goal - bounce off wall
      if (b.x + b.radius > rightGoalLeft && b.y - b.radius < goalTop) {
        b.x = rightGoalLeft - b.radius;
        b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      }
    }
  }

  // Goal post collision (the vertical post at edge of goal opening)
  const leftPostX = GOAL_WIDTH + GOAL_DEPTH;
  const rightPostX = GAME_WIDTH - GOAL_WIDTH - GOAL_DEPTH;

  // Left goal post
  if (distance(b.x, b.y, leftPostX, goalTop) < b.radius + GOAL_POST_WIDTH / 2) {
    const angle = Math.atan2(b.y - goalTop, b.x - leftPostX);
    const pushDist = b.radius + GOAL_POST_WIDTH / 2;
    b.x = leftPostX + Math.cos(angle) * pushDist;
    b.y = goalTop + Math.sin(angle) * pushDist;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * WALL_BOUNCE;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
  }

  // Right goal post
  if (distance(b.x, b.y, rightPostX, goalTop) < b.radius + GOAL_POST_WIDTH / 2) {
    const angle = Math.atan2(b.y - goalTop, b.x - rightPostX);
    const pushDist = b.radius + GOAL_POST_WIDTH / 2;
    b.x = rightPostX + Math.cos(angle) * pushDist;
    b.y = goalTop + Math.sin(angle) * pushDist;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * WALL_BOUNCE;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
  }

  return b;
}

function handlePlayerBallCollision(
  player: Player,
  ball: Ball,
  isFireball: boolean
): { player: Player; ball: Ball; collided: boolean } {
  const dist = distance(player.x, player.y, ball.x, ball.y);
  const minDist = player.radius + ball.radius;

  if (dist >= minDist) {
    return { player, ball, collided: false };
  }

  const nx = (ball.x - player.x) / dist;
  const ny = (ball.y - player.y) / dist;

  const overlap = minDist - dist;
  const newBall = { ...ball };
  newBall.x += nx * overlap;
  newBall.y += ny * overlap;

  const force = isFireball ? PLAYER_BALL_FORCE * 1.8 : PLAYER_BALL_FORCE;

  const playerInfluence = 0.6;
  newBall.vx = nx * force + player.vx * playerInfluence;
  newBall.vy = ny * force + player.vy * playerInfluence;

  const playerMovingToBall = (player.vx * nx + player.vy * ny) > 0;
  if (playerMovingToBall) {
    const extraForce = Math.sqrt(player.vx * player.vx + player.vy * player.vy) * 0.5;
    newBall.vx += nx * extraForce;
    newBall.vy += ny * extraForce;
  }

  if (ny < -0.3 && newBall.vy > -3) {
    newBall.vy = Math.min(newBall.vy, -6);
  }

  newBall.lastTouchedBy = player.side === 'left' ? 'player1' : 'player2';

  return { player, ball: newBall, collided: true };
}

// Goal detection - ball must be fully inside goal area
function checkGoal(ball: Ball): 'player1' | 'player2' | null {
  const goalTop = GROUND_Y - GOAL_HEIGHT;
  const leftGoalLine = GOAL_WIDTH; // The actual goal line
  const rightGoalLine = GAME_WIDTH - GOAL_WIDTH;

  // Left goal (player2 scores) - ball center past the goal line
  if (ball.x < leftGoalLine && ball.y > goalTop && ball.y < GROUND_Y) {
    return 'player2';
  }

  // Right goal (player1 scores) - ball center past the goal line
  if (ball.x > rightGoalLine && ball.y > goalTop && ball.y < GROUND_Y) {
    return 'player1';
  }

  return null;
}

// ============================================================================
// AI SYSTEM
// ============================================================================

function updateAI(
  aiPlayer: Player,
  ball: Ball,
  opponent: Player,
  difficulty: number = 0.85
): KeyState {
  const keys: KeyState = { left: false, right: false, up: false };

  if (aiPlayer.frozen) return keys;

  const ballPredictedX = ball.x + ball.vx * 15;
  const myGoalX = aiPlayer.side === 'left' ? GOAL_WIDTH + GOAL_DEPTH : GAME_WIDTH - GOAL_WIDTH - GOAL_DEPTH;
  const midField = GAME_WIDTH / 2;

  const distToBall = distance(aiPlayer.x, aiPlayer.y, ball.x, ball.y);
  const ballOnMySide = aiPlayer.side === 'left' ? ball.x < midField + 50 : ball.x > midField - 50;
  const ballMovingToGoal = aiPlayer.side === 'left' ? ball.vx < -1 : ball.vx > 1;
  const ballNearGoal = aiPlayer.side === 'left'
    ? ball.x < myGoalX + 150
    : ball.x > myGoalX - 150;

  // Defensive behavior
  if (ballNearGoal && ballMovingToGoal) {
    const targetX = aiPlayer.side === 'left'
      ? Math.max(ball.x - 30, myGoalX + 50)
      : Math.min(ball.x + 30, myGoalX - 50);

    if (aiPlayer.x < targetX - 15) keys.right = true;
    else if (aiPlayer.x > targetX + 15) keys.left = true;

    if (distToBall < 100 && ball.y < aiPlayer.y && aiPlayer.onGround) {
      keys.up = true;
    }
  }
  else if (!ballOnMySide || ball.vx * (aiPlayer.side === 'left' ? 1 : -1) > 2) {
    const readyX = aiPlayer.side === 'left' ? midField - 100 : midField + 100;

    if (aiPlayer.x < readyX - 20) keys.right = true;
    else if (aiPlayer.x > readyX + 20) keys.left = true;
  }
  else {
    let targetX = ballPredictedX;

    if (aiPlayer.side === 'left') {
      targetX = clamp(targetX, myGoalX + 50, midField - 30);
    } else {
      targetX = clamp(targetX, midField + 30, myGoalX - 50);
    }

    const attackOffset = aiPlayer.side === 'left' ? -20 : 20;
    if (aiPlayer.x < targetX + attackOffset - 10) {
      keys.right = true;
    } else if (aiPlayer.x > targetX + attackOffset + 10) {
      keys.left = true;
    }

    const shouldJump =
      (distToBall < 120 && ball.y < aiPlayer.y + 20) ||
      (ball.y < GROUND_Y - 100 && distToBall < 80) ||
      (Math.abs(aiPlayer.x - ball.x) < 50 && ball.y < aiPlayer.y - 20);

    if (shouldJump && aiPlayer.onGround && Math.random() < difficulty) {
      keys.up = true;
    }
  }

  if (Math.random() > difficulty) {
    if (Math.random() < 0.1) keys.up = !keys.up;
  }

  return keys;
}

// ============================================================================
// RENDERING
// ============================================================================

function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState
) {
  const { player1, player2, ball, goalAnimation } = state;

  // Clear and draw background
  ctx.fillStyle = '#228B22';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Draw grass pattern
  ctx.fillStyle = '#1E7D1E';
  for (let x = 0; x < GAME_WIDTH; x += 40) {
    ctx.fillRect(x, 0, 20, GAME_HEIGHT);
  }

  // Draw ground
  ctx.fillStyle = '#654321';
  ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

  // Draw center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(GAME_WIDTH / 2, 0);
  ctx.lineTo(GAME_WIDTH / 2, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw center circle
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(GAME_WIDTH / 2, GROUND_Y - 60, 60, Math.PI, 0);
  ctx.stroke();

  // Draw goals
  const goalTop = GROUND_Y - GOAL_HEIGHT;
  const leftGoalRight = GOAL_WIDTH + GOAL_DEPTH;
  const rightGoalLeft = GAME_WIDTH - GOAL_WIDTH - GOAL_DEPTH;

  // Left goal - dark interior
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, goalTop, leftGoalRight, GOAL_HEIGHT);

  // Left goal frame
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = GOAL_POST_WIDTH;
  // Top bar
  ctx.beginPath();
  ctx.moveTo(0, goalTop);
  ctx.lineTo(leftGoalRight, goalTop);
  ctx.stroke();
  // Front post
  ctx.beginPath();
  ctx.moveTo(leftGoalRight, goalTop);
  ctx.lineTo(leftGoalRight, GROUND_Y);
  ctx.stroke();

  // Left goal net pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let y = goalTop + 15; y < GROUND_Y; y += 15) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(leftGoalRight - 5, y);
    ctx.stroke();
  }
  for (let x = 10; x < leftGoalRight; x += 15) {
    ctx.beginPath();
    ctx.moveTo(x, goalTop + 5);
    ctx.lineTo(x, GROUND_Y);
    ctx.stroke();
  }

  // Right goal - dark interior
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(rightGoalLeft, goalTop, GOAL_WIDTH + GOAL_DEPTH, GOAL_HEIGHT);

  // Right goal frame
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = GOAL_POST_WIDTH;
  // Top bar
  ctx.beginPath();
  ctx.moveTo(rightGoalLeft, goalTop);
  ctx.lineTo(GAME_WIDTH, goalTop);
  ctx.stroke();
  // Front post
  ctx.beginPath();
  ctx.moveTo(rightGoalLeft, goalTop);
  ctx.lineTo(rightGoalLeft, GROUND_Y);
  ctx.stroke();

  // Right goal net pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let y = goalTop + 15; y < GROUND_Y; y += 15) {
    ctx.beginPath();
    ctx.moveTo(rightGoalLeft + 5, y);
    ctx.lineTo(GAME_WIDTH, y);
    ctx.stroke();
  }
  for (let x = rightGoalLeft + 10; x < GAME_WIDTH; x += 15) {
    ctx.beginPath();
    ctx.moveTo(x, goalTop + 5);
    ctx.lineTo(x, GROUND_Y);
    ctx.stroke();
  }

  // Draw goal line indicators
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  // Left goal line
  ctx.beginPath();
  ctx.moveTo(GOAL_WIDTH, goalTop);
  ctx.lineTo(GOAL_WIDTH, GROUND_Y);
  ctx.stroke();
  // Right goal line
  ctx.beginPath();
  ctx.moveTo(GAME_WIDTH - GOAL_WIDTH, goalTop);
  ctx.lineTo(GAME_WIDTH - GOAL_WIDTH, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw players
  drawPlayer(ctx, player1, goalAnimation === 1);
  drawPlayer(ctx, player2, goalAnimation === 2);

  // Draw ball
  drawBall(ctx, ball);
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, celebrating: boolean) {
  const { x, y, radius, color, emoji, frozen, powerUp } = player;

  ctx.save();

  if (frozen) {
    ctx.globalAlpha = 0.6;
  }

  if (powerUp === 'speed') {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
  }

  // Draw body
  ctx.fillStyle = color;

  // Head (circle)
  ctx.beginPath();
  ctx.arc(x, y - radius * 0.25, radius * 0.65, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.25, radius * 0.45, radius * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - radius * 0.25, radius * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  // Draw face/emoji
  ctx.font = `${radius * 0.9}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y - radius * 0.25);

  if (celebrating) {
    ctx.font = '28px Arial';
    ctx.fillText('🎉', x, y - radius - 25);
  }

  if (frozen) {
    ctx.font = `${radius}px Arial`;
    ctx.fillText('❄️', x, y);
  }

  if (powerUp && powerUp !== 'speed') {
    const icon = POWER_UPS.find(p => p.type === powerUp)?.icon || '';
    ctx.font = '18px Arial';
    ctx.fillText(icon, x, y - radius - 18);
  }

  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  const { x, y, radius, isFireball } = ball;

  ctx.save();

  if (isFireball) {
    ctx.shadowColor = '#FF4500';
    ctx.shadowBlur = 30;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
    gradient.addColorStop(0, '#FFFF00');
    gradient.addColorStop(0.3, '#FF6600');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball body
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Ball pattern
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Pentagon pattern
  ctx.fillStyle = '#000000';
  const pentagonRadius = radius * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 72 - 90) * Math.PI / 180;
    const px = x + Math.cos(angle) * pentagonRadius;
    const py = y + Math.sin(angle) * pentagonRadius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HeadBallGame({ onBack }: HeadBallGameProps) {
  const [gameMode, setGameMode] = useState<'menu' | 'playing' | 'paused' | 'gameOver' | 'lobby'>('menu');
  const [playMode, setPlayMode] = useState<'ai' | 'local' | 'online'>('ai');
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);

  // Online multiplayer state
  const [roomCode, setRoomCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);

  // Power-up cooldowns
  const [p1Cooldowns, setP1Cooldowns] = useState<Map<PowerUpType, number>>(new Map());
  const [p2Cooldowns, setP2Cooldowns] = useState<Map<PowerUpType, number>>(new Map());

  // Score submission
  const [playerName, setPlayerName] = useState<string>("");
  const [showScoreSubmit, setShowScoreSubmit] = useState<boolean>(false);

  // Mobile touch controls
  const touchControlsRef = useRef<KeyState>({ left: false, right: false, up: false });

  // Refs for game loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const keysRef = useRef<{ p1: KeyState; p2: KeyState }>({
    p1: { left: false, right: false, up: false },
    p2: { left: false, right: false, up: false }
  });
  const lastTimeRef = useRef<number>(0);
  const frameIdRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const remoteKeysRef = useRef<KeyState>({ left: false, right: false, up: false });

  const queryClient = useQueryClient();

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Fetch scores
  const { data: topScores = [] } = useQuery({
    queryKey: ['/api/games/headball/scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/headball/scores?limit=5');
      if (!response.ok) throw new Error('Failed to fetch scores');
      return response.json();
    }
  });

  const { data: allScores = [] } = useQuery({
    queryKey: ['/api/games/headball/all-scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/headball/scores');
      if (!response.ok) throw new Error('Failed to fetch all scores');
      return response.json();
    }
  });

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

  // PartyKit host configuration
  // In production, use the deployed PartyKit server
  // In development, use local PartyKit dev server
  const PARTYKIT_HOST = import.meta.env.PROD
    ? "tabriz-portfolio-games.partykit.dev"
    : "localhost:1999";

  // Generate 6-digit room code
  const generateRoomCode = useCallback(() => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }, []);

  // Connect to PartyKit room
  const connectToRoom = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');
    setConnectionError("");

    try {
      const ps = new PartySocket({
        host: PARTYKIT_HOST,
        room: roomId,
      });

      wsRef.current = ps;

      const connectionTimeout = setTimeout(() => {
        if (ps.readyState !== WebSocket.OPEN) {
          ps.close();
          setConnectionStatus('error');
          setConnectionError('Connection timeout. Server may be unavailable.');
        }
      }, 10000);

      ps.onopen = () => {
        clearTimeout(connectionTimeout);
        setConnectionStatus('connected');
        setConnectionError("");
      };

      ps.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'ROOM_CREATED':
              setRoomCode(message.payload.code);
              setGameMode('lobby');
              setIsHost(true);
              break;

            case 'GAME_START':
              setGameMode('playing');
              setIsHost(message.payload.role === 'player1');
              startGame('online');
              break;

            case 'GAME_STATE':
              if (!isHost && playMode === 'online') {
                const state = message.payload;
                setGameState(prev => ({
                  ...prev,
                  player1: state.player1,
                  player2: state.player2,
                  ball: state.ball,
                  timeLeft: state.timeLeft
                }));
              }
              break;

            case 'PLAYER_INPUT':
              if (isHost && playMode === 'online') {
                const input = message.payload;
                remoteKeysRef.current = {
                  left: input.left || false,
                  right: input.right || false,
                  up: input.up || false
                };
              }
              break;

            case 'PLAYER_DISCONNECTED':
              setConnectionError('Opponent disconnected');
              resetGame();
              break;

            case 'ERROR':
              setConnectionError(message.payload.message || 'Unknown error');
              if (gameMode === 'lobby') {
                setGameMode('menu');
              }
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ps.onerror = () => {
        clearTimeout(connectionTimeout);
        setConnectionStatus('error');
        setConnectionError('Connection failed. PartyKit server may not be running.');
      };

      ps.onclose = () => {
        clearTimeout(connectionTimeout);
        if (connectionStatus !== 'error') {
          setConnectionStatus('disconnected');
        }
      };
    } catch (error) {
      setConnectionStatus('error');
      setConnectionError('Failed to create PartySocket connection');
    }
  }, [isHost, playMode, gameMode, connectionStatus, PARTYKIT_HOST]);

  // Create a new room (host)
  const createRoom = useCallback(() => {
    setConnectionError("");
    const newRoomCode = generateRoomCode();
    connectToRoom(newRoomCode);
  }, [generateRoomCode, connectToRoom]);

  // Join an existing room (client)
  const joinRoom = useCallback(() => {
    if (joinCode.length !== 6) {
      setConnectionError('Please enter a valid 6-digit room code');
      return;
    }

    setConnectionError("");
    connectToRoom(joinCode);
  }, [joinCode, connectToRoom]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.code;

      if (key === 'KeyA' || key === 'ArrowLeft') {
        keysRef.current.p1.left = true;
        e.preventDefault();
      }
      if (key === 'KeyD' || key === 'ArrowRight') {
        keysRef.current.p1.right = true;
        e.preventDefault();
      }
      if (key === 'KeyW' || key === 'ArrowUp' || key === 'Space') {
        keysRef.current.p1.up = true;
        e.preventDefault();
      }

      if (playMode === 'local') {
        if (key === 'KeyJ') keysRef.current.p2.left = true;
        if (key === 'KeyL') keysRef.current.p2.right = true;
        if (key === 'KeyI') keysRef.current.p2.up = true;
      }

      if (gameMode === 'playing') {
        if (key === 'Digit1') usePowerUp('player1', 'freeze');
        if (key === 'Digit2') usePowerUp('player1', 'speed');
        if (key === 'Digit3') usePowerUp('player1', 'bigBall');
        if (key === 'Digit4') usePowerUp('player1', 'fireball');

        if (playMode === 'local') {
          if (key === 'Digit7') usePowerUp('player2', 'freeze');
          if (key === 'Digit8') usePowerUp('player2', 'speed');
          if (key === 'Digit9') usePowerUp('player2', 'bigBall');
          if (key === 'Digit0') usePowerUp('player2', 'fireball');
        }
      }

      if (playMode === 'online' && !isHost && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'PLAYER_INPUT',
          payload: keysRef.current.p1
        }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.code;

      if (key === 'KeyA' || key === 'ArrowLeft') keysRef.current.p1.left = false;
      if (key === 'KeyD' || key === 'ArrowRight') keysRef.current.p1.right = false;
      if (key === 'KeyW' || key === 'ArrowUp' || key === 'Space') keysRef.current.p1.up = false;

      if (playMode === 'local') {
        if (key === 'KeyJ') keysRef.current.p2.left = false;
        if (key === 'KeyL') keysRef.current.p2.right = false;
        if (key === 'KeyI') keysRef.current.p2.up = false;
      }

      if (playMode === 'online' && !isHost && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'PLAYER_INPUT',
          payload: keysRef.current.p1
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameMode, playMode, isHost]);

  // Mobile touch control handlers
  const handleTouchStart = useCallback((control: 'left' | 'right' | 'up') => {
    touchControlsRef.current[control] = true;
    keysRef.current.p1[control] = true;

    if (playMode === 'online' && !isHost && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PLAYER_INPUT',
        payload: keysRef.current.p1
      }));
    }
  }, [playMode, isHost]);

  const handleTouchEnd = useCallback((control: 'left' | 'right' | 'up') => {
    touchControlsRef.current[control] = false;
    keysRef.current.p1[control] = false;

    if (playMode === 'online' && !isHost && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PLAYER_INPUT',
        payload: keysRef.current.p1
      }));
    }
  }, [playMode, isHost]);

  // Power-up usage
  const usePowerUp = useCallback((player: 'player1' | 'player2', type: PowerUpType) => {
    const cooldowns = player === 'player1' ? p1Cooldowns : p2Cooldowns;
    const setCooldowns = player === 'player1' ? setP1Cooldowns : setP2Cooldowns;
    const now = Date.now();

    if (cooldowns.get(type) && cooldowns.get(type)! > now) return;

    const powerUp = POWER_UPS.find(p => p.type === type);
    if (!powerUp) return;

    setCooldowns(prev => new Map(prev).set(type, now + powerUp.cooldown));

    setGameState(prev => {
      const newState = { ...prev };
      const targetPlayer = player === 'player1' ? 'player1' : 'player2';
      const opponent = player === 'player1' ? 'player2' : 'player1';

      switch (type) {
        case 'freeze':
          newState[opponent] = {
            ...newState[opponent],
            frozen: true,
            frozenEndTime: now + powerUp.duration
          };
          break;

        case 'speed':
          newState[targetPlayer] = {
            ...newState[targetPlayer],
            powerUp: 'speed',
            powerUpEndTime: now + powerUp.duration
          };
          break;

        case 'bigBall':
          newState[targetPlayer] = {
            ...newState[targetPlayer],
            powerUp: 'bigBall',
            powerUpEndTime: now + powerUp.duration
          };
          break;

        case 'fireball':
          newState.ball = {
            ...newState.ball,
            isFireball: true,
            fireballEndTime: now + 3000,
            vx: newState.ball.vx * 1.5,
            vy: newState.ball.vy * 1.5
          };
          break;
      }

      return newState;
    });
  }, [p1Cooldowns, p2Cooldowns]);

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    if (gameMode !== 'playing') return;

    const deltaTime = timestamp - lastTimeRef.current;
    if (deltaTime < 16) {
      frameIdRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    lastTimeRef.current = timestamp;

    const state = gameStateRef.current;
    const now = Date.now();

    if (playMode === 'online' && !isHost) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawGame(ctx, state);
      }
      frameIdRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    let newState = { ...state };

    if (state.player1.frozen && now > state.player1.frozenEndTime) {
      newState.player1 = { ...newState.player1, frozen: false };
    }
    if (state.player2.frozen && now > state.player2.frozenEndTime) {
      newState.player2 = { ...newState.player2, frozen: false };
    }
    if (state.player1.powerUp && now > state.player1.powerUpEndTime) {
      newState.player1 = { ...newState.player1, powerUp: null };
    }
    if (state.player2.powerUp && now > state.player2.powerUpEndTime) {
      newState.player2 = { ...newState.player2, powerUp: null };
    }
    if (state.ball.isFireball && now > state.ball.fireballEndTime) {
      newState.ball = { ...newState.ball, isFireball: false };
    }

    let p2Keys = keysRef.current.p2;
    if (playMode === 'ai') {
      p2Keys = updateAI(state.player2, state.ball, state.player1, 0.85);
    } else if (playMode === 'online' && isHost) {
      p2Keys = remoteKeysRef.current;
    }

    // Merge touch controls with keyboard
    const p1Keys = {
      left: keysRef.current.p1.left || touchControlsRef.current.left,
      right: keysRef.current.p1.right || touchControlsRef.current.right,
      up: keysRef.current.p1.up || touchControlsRef.current.up
    };

    newState.player1 = updatePlayerPhysics(
      newState.player1,
      p1Keys,
      newState.player1.powerUp === 'speed'
    );
    newState.player2 = updatePlayerPhysics(
      newState.player2,
      p2Keys,
      newState.player2.powerUp === 'speed'
    );

    const bigBallActive = newState.player1.powerUp === 'bigBall' || newState.player2.powerUp === 'bigBall';
    newState.ball = updateBallPhysics(newState.ball, bigBallActive);

    const p1Collision = handlePlayerBallCollision(
      newState.player1,
      newState.ball,
      newState.ball.isFireball
    );
    if (p1Collision.collided) {
      newState.ball = p1Collision.ball;
    }

    const p2Collision = handlePlayerBallCollision(
      newState.player2,
      newState.ball,
      newState.ball.isFireball
    );
    if (p2Collision.collided) {
      newState.ball = p2Collision.ball;
    }

    const goal = checkGoal(newState.ball);
    if (goal && newState.goalAnimation === 0) {
      if (goal === 'player1') {
        newState.player1 = { ...newState.player1, score: newState.player1.score + 1 };
      } else {
        newState.player2 = { ...newState.player2, score: newState.player2.score + 1 };
      }
      newState.lastGoalScorer = goal;
      newState.goalAnimation = goal === 'player1' ? 1 : 2;

      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          ball: createInitialBall(),
          goalAnimation: 0
        }));
      }, 1500);
    }

    setGameState(newState);

    if (playMode === 'online' && isHost && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'GAME_STATE',
        payload: {
          player1: newState.player1,
          player2: newState.player2,
          ball: newState.ball,
          timeLeft: newState.timeLeft
        }
      }));
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) drawGame(ctx, newState);
    }

    frameIdRef.current = requestAnimationFrame(gameLoop);
  }, [gameMode, playMode, isHost]);

  useEffect(() => {
    if (gameMode === 'playing') {
      lastTimeRef.current = performance.now();
      frameIdRef.current = requestAnimationFrame(gameLoop);

      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            setGameMode('gameOver');
            setShowScoreSubmit(true);
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameMode, gameLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) drawGame(ctx, gameState);
    }
  }, []);

  const startGame = useCallback((mode: 'ai' | 'local' | 'online') => {
    setPlayMode(mode);
    setGameMode('playing');
    setGameState({
      ...createInitialGameState(),
      timeLeft: MATCH_DURATION
    });
    setP1Cooldowns(new Map());
    setP2Cooldowns(new Map());
    keysRef.current = {
      p1: { left: false, right: false, up: false },
      p2: { left: false, right: false, up: false }
    };
    touchControlsRef.current = { left: false, right: false, up: false };
  }, []);

  const resetGame = useCallback(() => {
    setGameMode('menu');
    setGameState(createInitialGameState());
    setShowScoreSubmit(false);
    setRoomCode("");
    setJoinCode("");
    setIsHost(false);
    setConnectionStatus('disconnected');
    setConnectionError("");
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const handleSubmitScore = () => {
    if (playerName.trim()) {
      const finalScore = Math.max(gameState.player1.score, gameState.player2.score) * 100 +
        (MATCH_DURATION - gameState.timeLeft) * 5;
      submitScoreMutation.mutate({
        playerName: playerName.trim(),
        score: finalScore,
        timeInSeconds: MATCH_DURATION - gameState.timeLeft,
      });
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Menu screen
  if (gameMode === 'menu') {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        <div className="flex items-center justify-between p-4 bg-muted/20 border-b">
          <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
          <h1 className="text-2xl font-bold">Head Ball</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <List className="h-4 w-4 mr-2" />Results
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
                              index === 1 ? "text-gray-400" : "text-orange-500"
                            : "text-muted-foreground"}`}>
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

        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8">
            <div className="max-w-2xl w-full space-y-6 text-center">
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
                  <Button onClick={() => startGame('ai')} size="lg" className="h-16 text-lg">
                    🤖 vs AI
                  </Button>
                  <Button onClick={() => startGame('local')} size="lg" variant="outline" className="h-16 text-lg">
                    👥 Local Multiplayer
                  </Button>
                </div>

                {/* Online Multiplayer */}
                <div className="mt-6 border-t pt-6 bg-muted/10 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    🌐 Online Multiplayer
                  </h3>

                  {/* Connection Status */}
                  <div className="flex items-center justify-center gap-2 mb-4 text-sm">
                    {connectionStatus === 'connected' ? (
                      <><Wifi className="h-4 w-4 text-green-500" /><span className="text-green-500">Connected</span></>
                    ) : connectionStatus === 'connecting' ? (
                      <><Wifi className="h-4 w-4 text-yellow-500 animate-pulse" /><span className="text-yellow-500">Connecting...</span></>
                    ) : connectionStatus === 'error' ? (
                      <><WifiOff className="h-4 w-4 text-red-500" /><span className="text-red-500">Error</span></>
                    ) : (
                      <><WifiOff className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Disconnected</span></>
                    )}
                  </div>

                  {connectionError && (
                    <div className="mb-4 p-2 bg-red-500/20 border border-red-500/30 rounded text-sm text-red-400">
                      {connectionError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                    <div className="space-y-2">
                      <Button
                        onClick={createRoom}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                        disabled={connectionStatus === 'connecting'}
                      >
                        {connectionStatus === 'connecting' ? 'Connecting...' : 'Create Game'}
                      </Button>
                      <p className="text-xs text-muted-foreground">Host a match</p>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter Code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="text-center font-mono tracking-widest uppercase"
                      />
                      <Button
                        onClick={joinRoom}
                        variant="outline"
                        className="w-full"
                        disabled={connectionStatus === 'connecting' || joinCode.length !== 6}
                      >
                        Join Game
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-blue-500/10 rounded-lg p-3">
                  <h4 className="font-semibold mb-2">Player 1 Controls</h4>
                  <div className="space-y-1 text-xs">
                    <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">A/D</kbd> or <kbd className="px-1 py-0.5 bg-muted rounded text-xs">←/→</kbd> Move</p>
                    <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">W/Space</kbd> or <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↑</kbd> Jump</p>
                    <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">1-4</kbd> Power-ups</p>
                  </div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3">
                  <h4 className="font-semibold mb-2">Player 2 Controls</h4>
                  <div className="space-y-1 text-xs">
                    <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">J/L</kbd> Move</p>
                    <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">I</kbd> Jump</p>
                    <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">7-0</kbd> Power-ups</p>
                  </div>
                </div>
              </div>

              {/* Power-ups */}
              <div className="bg-muted/20 rounded-lg p-3">
                <h4 className="font-semibold mb-2">Power-ups</h4>
                <div className="grid grid-cols-4 gap-2 text-xs">
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
      </div>
    );
  }

  // Lobby screen
  if (gameMode === 'lobby') {
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

          {connectionError && (
            <div className="p-2 bg-red-500/20 border border-red-500/30 rounded text-sm text-red-400">
              {connectionError}
            </div>
          )}

          <Button variant="ghost" onClick={resetGame}>Cancel</Button>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 md:p-3 bg-muted/20 border-b text-sm shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="outline" size="sm" onClick={resetGame} className="h-8 px-2">← Menu</Button>
          <div className="flex items-center gap-1 md:gap-2">
            <Clock className="h-3 w-3 md:h-4 md:w-4" />
            <span className="font-mono font-bold text-sm md:text-base">
              {Math.floor(gameState.timeLeft / 60)}:{(gameState.timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center gap-3 md:gap-4 text-xl md:text-2xl font-bold">
            <span className="text-blue-500">{gameState.player1.score}</span>
            <span>-</span>
            <span className="text-red-500">{gameState.player2.score}</span>
          </div>
          {gameState.lastGoalScorer && gameState.goalAnimation > 0 && (
            <div className="text-xs text-green-500 animate-pulse">
              GOAL! {gameState.lastGoalScorer === 'player1' ? 'Player 1' : 'Player 2'}!
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:inline">
            {playMode === 'ai' ? '🤖 vs AI' : playMode === 'local' ? '👥 Local' : '🌐 Online'}
          </span>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 bg-gradient-to-b from-background to-muted/20 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="border-4 border-white/20 rounded-lg shadow-2xl max-w-full max-h-full"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Mobile Touch Controls */}
      <div className="md:hidden shrink-0 p-3 bg-muted/20 border-t">
        <div className="flex justify-center items-center gap-4">
          {/* Left Button */}
          <Button
            variant="outline"
            size="lg"
            className="h-16 w-16 rounded-full text-2xl active:bg-blue-500 active:text-white touch-none"
            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('left'); }}
            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('left'); }}
            onMouseDown={() => handleTouchStart('left')}
            onMouseUp={() => handleTouchEnd('left')}
            onMouseLeave={() => handleTouchEnd('left')}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          {/* Jump Button */}
          <Button
            variant="default"
            size="lg"
            className="h-20 w-20 rounded-full text-2xl bg-green-600 hover:bg-green-700 active:bg-green-500 touch-none"
            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('up'); }}
            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('up'); }}
            onMouseDown={() => handleTouchStart('up')}
            onMouseUp={() => handleTouchEnd('up')}
            onMouseLeave={() => handleTouchEnd('up')}
          >
            <ArrowUp className="h-10 w-10" />
          </Button>

          {/* Right Button */}
          <Button
            variant="outline"
            size="lg"
            className="h-16 w-16 rounded-full text-2xl active:bg-blue-500 active:text-white touch-none"
            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('right'); }}
            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('right'); }}
            onMouseDown={() => handleTouchStart('right')}
            onMouseUp={() => handleTouchEnd('right')}
            onMouseLeave={() => handleTouchEnd('right')}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Hold buttons to move • Tap jump to jump
        </p>
      </div>

      {/* Power-up Controls (Desktop) */}
      <div className="hidden md:block p-3 bg-muted/10 shrink-0">
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-blue-500">Player 1 Power-ups</h4>
            <div className="grid grid-cols-4 gap-2">
              {POWER_UPS.map((power, index) => {
                const cooldownEnd = p1Cooldowns.get(power.type) || 0;
                const isOnCooldown = cooldownEnd > Date.now();
                const cooldownLeft = isOnCooldown ? Math.ceil((cooldownEnd - Date.now()) / 1000) : 0;

                return (
                  <Button
                    key={power.type}
                    variant="outline"
                    size="sm"
                    disabled={isOnCooldown}
                    onClick={() => usePowerUp('player1', power.type)}
                    className="h-12 text-xs relative"
                  >
                    <div className="text-center">
                      <div className="text-lg">{power.icon}</div>
                      <div>{index + 1}</div>
                    </div>
                    {isOnCooldown && (
                      <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center text-xs">
                        {cooldownLeft}s
                      </div>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {playMode === 'local' && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-500">Player 2 Power-ups</h4>
              <div className="grid grid-cols-4 gap-2">
                {POWER_UPS.map((power, index) => {
                  const cooldownEnd = p2Cooldowns.get(power.type) || 0;
                  const isOnCooldown = cooldownEnd > Date.now();
                  const cooldownLeft = isOnCooldown ? Math.ceil((cooldownEnd - Date.now()) / 1000) : 0;
                  const keyNumber = index + 7;

                  return (
                    <Button
                      key={power.type}
                      variant="outline"
                      size="sm"
                      disabled={isOnCooldown}
                      onClick={() => usePowerUp('player2', power.type)}
                      className="h-12 text-xs relative"
                    >
                      <div className="text-center">
                        <div className="text-lg">{power.icon}</div>
                        <div>{keyNumber === 10 ? '0' : keyNumber}</div>
                      </div>
                      {isOnCooldown && (
                        <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center text-xs">
                          {cooldownLeft}s
                        </div>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game Over Modal */}
      {gameMode === 'gameOver' && showScoreSubmit && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <CardContent className="p-6 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-xl font-bold mb-2">Game Over!</h2>

              <div className="mb-4 space-y-2">
                <p className="text-lg">
                  Final Score: <span className="font-bold text-blue-500">{gameState.player1.score}</span> - <span className="font-bold text-red-500">{gameState.player2.score}</span>
                </p>
                {gameState.player1.score !== gameState.player2.score && (
                  <p className="text-sm text-green-600 font-semibold">
                    {gameState.player1.score > gameState.player2.score ? 'Player 1 Wins!' : 'Player 2 Wins!'}
                  </p>
                )}
                {gameState.player1.score === gameState.player2.score && (
                  <p className="text-sm text-yellow-600 font-semibold">It's a Draw!</p>
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
