import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trophy, User, List, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface TankGameProps {
  onBack: () => void;
}

interface Vector2D {
  x: number;
  y: number;
}

interface Tank {
  x: number;
  y: number;
  rotation: number; // Body rotation (degrees)
  turretRotation: number; // Turret rotation (degrees)
  health: number;
  maxHealth: number;
  isPlayer: boolean;
  lastShot: number;
  color: string;
  speed: number;
  vx: number;
  vy: number;
  // AI specific
  targetX?: number;
  targetY?: number;
  aiState?: 'patrol' | 'chase' | 'attack' | 'flee' | 'flank';
  stuckCounter?: number;
  lastX?: number;
  lastY?: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  isPlayer: boolean;
  speed: number;
  damage: number;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'rock' | 'wall' | 'bush';
  destructible: boolean;
  health: number;
}

interface Explosion {
  x: number;
  y: number;
  frame: number;
  maxFrames: number;
  size: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'health' | 'speed' | 'damage';
  id: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const TANK_SIZE = 40;
const TANK_COLLISION_RADIUS = 18;
const BULLET_SIZE = 6;
const BULLET_SPEED = 10;
const PLAYER_SPEED = 3.5;
const PLAYER_SHOOT_COOLDOWN = 250;

// Dynamic difficulty - enemy shoot cooldown decreases over time
const ENEMY_SHOOT_COOLDOWN_INITIAL = 1800; // Start slower (easier)
const ENEMY_SHOOT_COOLDOWN_MIN = 600; // Cap at this (challenging but fair)
const DIFFICULTY_RAMP_TIME = 120000; // 2 minutes to reach max difficulty

const PLAYER_MAX_HEALTH = 100;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function normalizeAngle(angle: number): number {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = normalizeAngle(b - a);
  return a + diff * t;
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

function checkRectCollision(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function checkCircleRectCollision(
  cx: number, cy: number, radius: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const distX = cx - closestX;
  const distY = cy - closestY;
  return (distX * distX + distY * distY) < (radius * radius);
}

function isPositionBlocked(
  x: number, y: number, radius: number,
  obstacles: Obstacle[], tanks: Tank[], excludeTank?: Tank
): boolean {
  // Check canvas bounds
  if (x - radius < 0 || x + radius > CANVAS_WIDTH ||
    y - radius < 0 || y + radius > CANVAS_HEIGHT) {
    return true;
  }

  // Check obstacles
  for (const obs of obstacles) {
    if (obs.type !== 'bush' &&
      checkCircleRectCollision(x, y, radius, obs.x, obs.y, obs.width, obs.height)) {
      return true;
    }
  }

  // Check other tanks
  for (const tank of tanks) {
    if (tank === excludeTank) continue;
    if (distance(x, y, tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2) < radius + TANK_COLLISION_RADIUS) {
      return true;
    }
  }

  return false;
}

function hasLineOfSight(
  x1: number, y1: number, x2: number, y2: number,
  obstacles: Obstacle[]
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / 15);

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const checkX = x1 + dx * t;
    const checkY = y1 + dy * t;

    for (const obs of obstacles) {
      if (obs.type !== 'bush' &&
        checkX > obs.x && checkX < obs.x + obs.width &&
        checkY > obs.y && checkY < obs.y + obs.height) {
        return false;
      }
    }
  }
  return true;
}

// ============================================================================
// LEVEL GENERATION
// ============================================================================

function generateObstacles(level: number): Obstacle[] {
  const obs: Obstacle[] = [];

  // Border walls
  obs.push({ x: 80, y: 20, width: 150, height: 12, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: CANVAS_WIDTH - 230, y: 20, width: 150, height: 12, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: 80, y: CANVAS_HEIGHT - 32, width: 120, height: 12, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: CANVAS_WIDTH - 200, y: CANVAS_HEIGHT - 32, width: 120, height: 12, type: 'wall', destructible: false, health: 999 });

  // Side walls
  obs.push({ x: 60, y: 80, width: 12, height: 100, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: 60, y: 280, width: 12, height: 100, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: CANVAS_WIDTH - 72, y: 80, width: 12, height: 100, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: CANVAS_WIDTH - 72, y: 280, width: 12, height: 100, type: 'wall', destructible: false, health: 999 });

  // Center strategic cover
  obs.push({ x: CANVAS_WIDTH / 2 - 50, y: CANVAS_HEIGHT / 2 - 40, width: 100, height: 12, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: CANVAS_WIDTH / 2 - 50, y: CANVAS_HEIGHT / 2 + 28, width: 100, height: 12, type: 'wall', destructible: false, health: 999 });
  obs.push({ x: CANVAS_WIDTH / 2 - 6, y: CANVAS_HEIGHT / 2 - 40, width: 12, height: 80, type: 'wall', destructible: false, health: 999 });

  // Random obstacles based on level
  const randomCount = Math.min(4 + level * 2, 15);
  for (let i = 0; i < randomCount; i++) {
    const type = Math.random() < 0.3 ? 'rock' : (Math.random() < 0.5 ? 'wall' : 'bush');
    const width = type === 'wall' ? 50 + Math.random() * 40 : 35;
    const height = type === 'wall' ? 12 : 35;

    // Find valid position
    let attempts = 0;
    let x: number = 0;
    let y: number = 0;
    do {
      x = 100 + Math.random() * (CANVAS_WIDTH - 200);
      y = 60 + Math.random() * (CANVAS_HEIGHT - 160);
      attempts++;
    } while (attempts < 20 && obs.some(o =>
      checkRectCollision(x, y, width, height, o.x - 20, o.y - 20, o.width + 40, o.height + 40)
    ));

    if (attempts < 20) {
      obs.push({
        x, y, width, height, type,
        destructible: type === 'wall',
        health: type === 'wall' ? 3 + level : 1
      });
    }
  }

  return obs;
}

function generateEnemies(level: number): Tank[] {
  const count = Math.min(2 + Math.floor(level * 0.8), 6);
  const enemies: Tank[] = [];

  for (let i = 0; i < count; i++) {
    const health = 1 + Math.floor(level / 2);
    enemies.push({
      x: 100 + Math.random() * (CANVAS_WIDTH - 200),
      y: 40 + Math.random() * 120,
      rotation: 90 + (Math.random() - 0.5) * 60,
      turretRotation: 90,
      health,
      maxHealth: health,
      isPlayer: false,
      lastShot: 0,
      color: level >= 3 ? '#dc2626' : '#65a30d',
      speed: 1.5 + level * 0.2,
      vx: 0,
      vy: 0,
      aiState: 'patrol',
      stuckCounter: 0,
      lastX: 0,
      lastY: 0
    });
  }

  return enemies;
}

function generatePowerups(level: number): PowerUp[] {
  const count = 2 + Math.floor(level / 2);
  const powerups: PowerUp[] = [];
  const types: ('health' | 'speed' | 'damage')[] = ['health', 'health', 'speed', 'damage'];

  for (let i = 0; i < count; i++) {
    powerups.push({
      x: 80 + Math.random() * (CANVAS_WIDTH - 160),
      y: 80 + Math.random() * (CANVAS_HEIGHT - 200),
      type: types[Math.floor(Math.random() * types.length)],
      id: Date.now() + i
    });
  }

  return powerups;
}

// ============================================================================
// AI SYSTEM
// ============================================================================

// Calculate dynamic enemy shoot cooldown based on elapsed game time
function getEnemyShootCooldown(gameStartTime: number): number {
  const elapsed = Date.now() - gameStartTime;
  const progress = Math.min(elapsed / DIFFICULTY_RAMP_TIME, 1);
  // Smoothly interpolate from initial to min cooldown
  const cooldown = ENEMY_SHOOT_COOLDOWN_INITIAL -
    (ENEMY_SHOOT_COOLDOWN_INITIAL - ENEMY_SHOOT_COOLDOWN_MIN) * progress;
  return cooldown;
}

function updateEnemyAI(
  enemy: Tank,
  player: Tank,
  allTanks: Tank[],
  obstacles: Obstacle[],
  deltaTime: number,
  gameStartTime: number
): { tank: Tank; bullet: Bullet | null } {
  const e = { ...enemy };
  const now = Date.now();

  const playerCenterX = player.x + TANK_SIZE / 2;
  const playerCenterY = player.y + TANK_SIZE / 2;
  const enemyCenterX = e.x + TANK_SIZE / 2;
  const enemyCenterY = e.y + TANK_SIZE / 2;

  const dx = playerCenterX - enemyCenterX;
  const dy = playerCenterY - enemyCenterY;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy);
  const angleToPlayer = Math.atan2(dy, dx) * 180 / Math.PI;

  const canSeePlayer = hasLineOfSight(enemyCenterX, enemyCenterY, playerCenterX, playerCenterY, obstacles);

  // Detect if stuck
  if (e.lastX !== undefined && e.lastY !== undefined) {
    const moved = distance(e.x, e.y, e.lastX, e.lastY);
    if (moved < 0.5) {
      e.stuckCounter = (e.stuckCounter || 0) + 1;
    } else {
      e.stuckCounter = 0;
    }
  }
  e.lastX = e.x;
  e.lastY = e.y;

  // State machine for AI behavior
  const isStuck = (e.stuckCounter || 0) > 30;

  if (canSeePlayer && distToPlayer < 300) {
    e.aiState = 'attack';
  } else if (canSeePlayer && distToPlayer < 500) {
    e.aiState = 'chase';
  } else if (isStuck) {
    e.aiState = 'flank';
  } else if (!canSeePlayer) {
    e.aiState = 'patrol';
  }

  // Turret always aims at player if visible - faster aiming when attacking
  if (canSeePlayer) {
    const aimSpeed = e.aiState === 'attack' ? 0.2 : 0.12;
    e.turretRotation = lerpAngle(e.turretRotation, angleToPlayer, aimSpeed);
  }

  // Movement based on state
  let targetAngle = e.rotation;
  let moveForward = false;
  let moveBackward = false;

  switch (e.aiState) {
    case 'attack':
      // More aggressive attack behavior
      if (distToPlayer < 120) {
        // Too close, back up while still shooting
        targetAngle = angleToPlayer + 180;
        moveForward = true;
      } else if (distToPlayer < 200) {
        // Optimal range - strafe to make harder target
        const strafeAngle = angleToPlayer + 90 + Math.sin(now / 400) * 50;
        targetAngle = strafeAngle;
        moveForward = true;
      } else {
        // Close the distance
        targetAngle = angleToPlayer;
        moveForward = true;
      }
      break;

    case 'chase':
      // Aggressively pursue player
      targetAngle = angleToPlayer;
      moveForward = true;
      break;

    case 'flank':
      // Try to go around obstacle
      const flankAngle = angleToPlayer + (Math.random() > 0.5 ? 90 : -90);
      targetAngle = flankAngle;
      moveForward = true;
      e.stuckCounter = 0;
      break;

    case 'patrol':
    default:
      // Actively hunt player - move toward their position
      if (!e.targetX || !e.targetY || distance(enemyCenterX, enemyCenterY, e.targetX, e.targetY) < 50) {
        // Set target toward player with some randomness
        e.targetX = playerCenterX + (Math.random() - 0.5) * 150;
        e.targetY = playerCenterY + (Math.random() - 0.5) * 150;
        e.targetX = clamp(e.targetX, 80, CANVAS_WIDTH - 80);
        e.targetY = clamp(e.targetY, 80, CANVAS_HEIGHT - 80);
      }
      targetAngle = Math.atan2(e.targetY - enemyCenterY, e.targetX - enemyCenterX) * 180 / Math.PI;
      moveForward = true;
      break;
  }

  // Smoothly rotate body
  e.rotation = lerpAngle(e.rotation, targetAngle, 0.08);

  // Movement
  if (moveForward || moveBackward) {
    const rad = e.rotation * Math.PI / 180;
    const moveSpeed = e.speed * (moveBackward ? -0.6 : 1);
    const newX = e.x + Math.cos(rad) * moveSpeed;
    const newY = e.y + Math.sin(rad) * moveSpeed;

    if (!isPositionBlocked(newX + TANK_SIZE / 2, newY + TANK_SIZE / 2, TANK_COLLISION_RADIUS, obstacles, allTanks, e)) {
      e.x = newX;
      e.y = newY;
    } else {
      // Try sliding along walls
      const slideX = e.x + Math.cos(rad) * moveSpeed;
      if (!isPositionBlocked(slideX + TANK_SIZE / 2, e.y + TANK_SIZE / 2, TANK_COLLISION_RADIUS, obstacles, allTanks, e)) {
        e.x = slideX;
      } else {
        const slideY = e.y + Math.sin(rad) * moveSpeed;
        if (!isPositionBlocked(e.x + TANK_SIZE / 2, slideY + TANK_SIZE / 2, TANK_COLLISION_RADIUS, obstacles, allTanks, e)) {
          e.y = slideY;
        }
      }
    }
  }

  // Intentional shooting - enemy actively fires when they have line of sight
  // Cooldown decreases over time making the game progressively harder
  let bullet: Bullet | null = null;
  const currentCooldown = getEnemyShootCooldown(gameStartTime);

  if (canSeePlayer && now - e.lastShot > currentCooldown) {
    const turretDiff = Math.abs(normalizeAngle(e.turretRotation - angleToPlayer));
    // Wider aim tolerance makes enemies feel more aggressive
    if (turretDiff < 20) {
      const rad = e.turretRotation * Math.PI / 180;
      bullet = {
        x: enemyCenterX + Math.cos(rad) * (TANK_SIZE / 2 + 5),
        y: enemyCenterY + Math.sin(rad) * (TANK_SIZE / 2 + 5),
        vx: Math.cos(rad) * BULLET_SPEED,
        vy: Math.sin(rad) * BULLET_SPEED,
        rotation: e.turretRotation,
        isPlayer: false,
        speed: BULLET_SPEED,
        damage: 15
      };
      e.lastShot = now;
    }
  }

  return { tank: e, bullet };
}

// ============================================================================
// RENDERING
// ============================================================================

function drawGame(
  ctx: CanvasRenderingContext2D,
  player: Tank,
  enemies: Tank[],
  bullets: Bullet[],
  obstacles: Obstacle[],
  powerups: PowerUp[],
  explosions: Explosion[],
  mousePos: { x: number; y: number },
  level: number
) {
  // Clear and draw background
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Grass pattern
  ctx.fillStyle = '#48BB78';
  for (let x = 0; x < CANVAS_WIDTH; x += 30) {
    for (let y = 0; y < CANVAS_HEIGHT; y += 30) {
      if ((Math.floor(x / 30) + Math.floor(y / 30)) % 2 === 0) {
        ctx.fillRect(x, y, 30, 30);
      }
    }
  }

  // Draw obstacles
  for (const obs of obstacles) {
    if (obs.type === 'rock') {
      ctx.fillStyle = '#6B7280';
      ctx.beginPath();
      ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (obs.type === 'wall') {
      // Brick pattern
      ctx.fillStyle = '#92400E';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1;
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

      // Brick lines
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1;
      for (let bx = obs.x; bx < obs.x + obs.width; bx += 15) {
        ctx.beginPath();
        ctx.moveTo(bx, obs.y);
        ctx.lineTo(bx, obs.y + obs.height);
        ctx.stroke();
      }
    } else { // bush
      ctx.fillStyle = '#22C55E';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Draw powerups
  for (const pup of powerups) {
    ctx.save();
    const glow = pup.type === 'health' ? '#10B981' : pup.type === 'speed' ? '#3B82F6' : '#F59E0B';
    ctx.shadowBlur = 12;
    ctx.shadowColor = glow;

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pup.x, pup.y, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(pup.x, pup.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = glow;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pup.type === 'health' ? '+' : pup.type === 'speed' ? '⚡' : '💥', pup.x, pup.y);
    ctx.restore();
  }

  // Draw tanks
  const drawTank = (tank: Tank) => {
    ctx.save();
    const cx = tank.x + TANK_SIZE / 2;
    const cy = tank.y + TANK_SIZE / 2;

    // Tank body
    ctx.translate(cx, cy);
    ctx.rotate(tank.rotation * Math.PI / 180);

    // Tracks
    ctx.fillStyle = '#374151';
    ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2 + 2, TANK_SIZE, 8);
    ctx.fillRect(-TANK_SIZE / 2, TANK_SIZE / 2 - 10, TANK_SIZE, 8);

    // Body
    ctx.fillStyle = tank.color;
    ctx.fillRect(-TANK_SIZE / 2 + 3, -TANK_SIZE / 2.5, TANK_SIZE - 6, TANK_SIZE / 1.25);

    ctx.restore();

    // Turret (separate rotation)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tank.turretRotation * Math.PI / 180);

    // Turret base
    ctx.fillStyle = tank.isPlayer ? '#2563EB' : (tank.color === '#dc2626' ? '#B91C1C' : '#4D7C0F');
    ctx.beginPath();
    ctx.arc(0, 0, TANK_SIZE / 4, 0, Math.PI * 2);
    ctx.fill();

    // Barrel
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(0, -3, TANK_SIZE / 2 + 8, 6);

    ctx.restore();

    // Health bar
    if (tank.health > 0) {
      const healthPercent = tank.health / tank.maxHealth;
      const barWidth = TANK_SIZE;
      ctx.fillStyle = '#374151';
      ctx.fillRect(tank.x, tank.y - 12, barWidth, 5);
      ctx.fillStyle = healthPercent > 0.6 ? '#22C55E' : healthPercent > 0.3 ? '#EAB308' : '#EF4444';
      ctx.fillRect(tank.x, tank.y - 12, barWidth * healthPercent, 5);
    }
  };

  // Draw player tank
  if (player.health > 0) {
    drawTank(player);
  }

  // Draw enemies
  for (const enemy of enemies) {
    drawTank(enemy);
  }

  // Draw bullets
  for (const bullet of bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.rotation * Math.PI / 180);

    // Bullet trail
    ctx.fillStyle = bullet.isPlayer ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(-20, -2, 20, 4);

    // Bullet
    ctx.fillStyle = bullet.isPlayer ? '#FBBF24' : '#EF4444';
    ctx.beginPath();
    ctx.arc(0, 0, BULLET_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw explosions
  for (const exp of explosions) {
    const progress = exp.frame / exp.maxFrames;
    const radius = exp.size * (0.5 + progress * 0.5);
    const alpha = 1 - progress;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw crosshair
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mousePos.x - 20, mousePos.y);
  ctx.lineTo(mousePos.x - 8, mousePos.y);
  ctx.moveTo(mousePos.x + 8, mousePos.y);
  ctx.lineTo(mousePos.x + 20, mousePos.y);
  ctx.moveTo(mousePos.x, mousePos.y - 20);
  ctx.lineTo(mousePos.x, mousePos.y - 8);
  ctx.moveTo(mousePos.x, mousePos.y + 8);
  ctx.lineTo(mousePos.x, mousePos.y + 20);
  ctx.stroke();

  // Draw dot in center
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, 2, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TankGame({ onBack }: TankGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);

  const [playerTank, setPlayerTank] = useState<Tank>({
    x: CANVAS_WIDTH / 2 - TANK_SIZE / 2,
    y: CANVAS_HEIGHT - 80,
    rotation: -90,
    turretRotation: -90,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    isPlayer: true,
    lastShot: 0,
    color: '#3b82f6',
    speed: PLAYER_SPEED,
    vx: 0,
    vy: 0
  });

  const [enemies, setEnemies] = useState<Tank[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [powerups, setPowerups] = useState<PowerUp[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [showScoreSubmit, setShowScoreSubmit] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [gameTime, setGameTime] = useState<number>(0); // Track elapsed time for display

  // Refs for game loop
  const keysPressed = useRef<Set<string>>(new Set());
  const mousePos = useRef<{ x: number; y: number }>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const mouseDown = useRef<boolean>(false);
  const gameLoopRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const playerRef = useRef(playerTank);
  const enemiesRef = useRef(enemies);
  const bulletsRef = useRef(bullets);
  const obstaclesRef = useRef(obstacles);

  const queryClient = useQueryClient();

  // Queries
  const { data: topScores = [] } = useQuery({
    queryKey: ['/api/games/tank/scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/tank/scores?limit=5');
      if (!response.ok) throw new Error('Failed to fetch scores');
      return response.json();
    }
  });

  const { data: allScores = [] } = useQuery({
    queryKey: ['/api/games/tank/all-scores'],
    queryFn: async () => {
      const response = await fetch('/api/games/tank/scores');
      if (!response.ok) throw new Error('Failed to fetch all scores');
      return response.json();
    }
  });

  const submitScoreMutation = useMutation({
    mutationFn: async (scoreData: { playerName: string; score: number }) => {
      const response = await fetch('/api/games/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scoreData, gameType: 'tank' }),
      });
      if (!response.ok) throw new Error('Failed to submit score');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/tank/scores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games/tank/all-scores'] });
      setShowScoreSubmit(false);
    }
  });

  // Sync refs
  useEffect(() => { playerRef.current = playerTank; }, [playerTank]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { bulletsRef.current = bullets; }, [bullets]);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);

  // Add explosion effect
  const addExplosion = useCallback((x: number, y: number, size: number = 25) => {
    setExplosions(prev => [...prev, { x, y, frame: 0, maxFrames: 20, size }]);
  }, []);

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    if (!isPlaying || isGameOver || isPaused) return;

    const deltaTime = timestamp - lastTimeRef.current;
    if (deltaTime < 16) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    lastTimeRef.current = timestamp;

    const now = Date.now();
    const player = playerRef.current;
    const currentEnemies = enemiesRef.current;
    const currentObstacles = obstaclesRef.current;

    // Player turret follows mouse
    const playerCenterX = player.x + TANK_SIZE / 2;
    const playerCenterY = player.y + TANK_SIZE / 2;
    const angleToMouse = Math.atan2(
      mousePos.current.y - playerCenterY,
      mousePos.current.x - playerCenterX
    ) * 180 / Math.PI;

    // WASD Movement
    let moveX = 0;
    let moveY = 0;

    if (keysPressed.current.has('KeyW') || keysPressed.current.has('ArrowUp')) {
      moveY -= 1;
    }
    if (keysPressed.current.has('KeyS') || keysPressed.current.has('ArrowDown')) {
      moveY += 1;
    }
    if (keysPressed.current.has('KeyA') || keysPressed.current.has('ArrowLeft')) {
      moveX -= 1;
    }
    if (keysPressed.current.has('KeyD') || keysPressed.current.has('ArrowRight')) {
      moveX += 1;
    }

    // Normalize diagonal movement
    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
    }

    // Calculate new position
    let newPlayerX = player.x + moveX * player.speed;
    let newPlayerY = player.y + moveY * player.speed;

    // Update body rotation based on movement direction
    let newBodyRotation = player.rotation;
    if (moveX !== 0 || moveY !== 0) {
      newBodyRotation = Math.atan2(moveY, moveX) * 180 / Math.PI;
    }

    // Check collision
    if (isPositionBlocked(
      newPlayerX + TANK_SIZE / 2,
      newPlayerY + TANK_SIZE / 2,
      TANK_COLLISION_RADIUS,
      currentObstacles,
      currentEnemies,
      player
    )) {
      // Try sliding along X or Y
      if (!isPositionBlocked(newPlayerX + TANK_SIZE / 2, player.y + TANK_SIZE / 2, TANK_COLLISION_RADIUS, currentObstacles, currentEnemies, player)) {
        newPlayerY = player.y;
      } else if (!isPositionBlocked(player.x + TANK_SIZE / 2, newPlayerY + TANK_SIZE / 2, TANK_COLLISION_RADIUS, currentObstacles, currentEnemies, player)) {
        newPlayerX = player.x;
      } else {
        newPlayerX = player.x;
        newPlayerY = player.y;
      }
    }

    // Player shooting (mouse click or space)
    if ((mouseDown.current || keysPressed.current.has('Space')) && now - player.lastShot > PLAYER_SHOOT_COOLDOWN) {
      const rad = angleToMouse * Math.PI / 180;
      const bullet: Bullet = {
        x: playerCenterX + Math.cos(rad) * (TANK_SIZE / 2 + 5),
        y: playerCenterY + Math.sin(rad) * (TANK_SIZE / 2 + 5),
        vx: Math.cos(rad) * BULLET_SPEED,
        vy: Math.sin(rad) * BULLET_SPEED,
        rotation: angleToMouse,
        isPlayer: true,
        speed: BULLET_SPEED,
        damage: 25
      };
      setBullets(prev => [...prev, bullet]);
      setPlayerTank(prev => ({ ...prev, lastShot: now }));
    }

    setPlayerTank(prev => ({
      ...prev,
      x: newPlayerX,
      y: newPlayerY,
      rotation: lerpAngle(prev.rotation, newBodyRotation, 0.15),
      turretRotation: angleToMouse
    }));

    // Update game time for display
    setGameTime(Math.floor((now - gameStartTime) / 1000));

    // Update enemies with improved AI and dynamic difficulty
    // Process enemies synchronously to ensure bullets are added immediately
    const allTanks = [playerRef.current, ...currentEnemies];
    const updatedEnemies: Tank[] = [];
    const newEnemyBullets: Bullet[] = [];

    for (const enemy of currentEnemies) {
      const result = updateEnemyAI(enemy, playerRef.current, allTanks, currentObstacles, deltaTime, gameStartTime);
      updatedEnemies.push(result.tank);
      if (result.bullet) {
        newEnemyBullets.push(result.bullet);
      }
    }

    // Update enemies state
    setEnemies(updatedEnemies);

    // Add enemy bullets immediately
    if (newEnemyBullets.length > 0) {
      setBullets(prev => [...prev, ...newEnemyBullets]);
    }

    // Update bullets
    setBullets(prevBullets => {
      const activeBullets: Bullet[] = [];

      for (const bullet of prevBullets) {
        const newX = bullet.x + bullet.vx;
        const newY = bullet.y + bullet.vy;

        // Check bounds
        if (newX < 0 || newX > CANVAS_WIDTH || newY < 0 || newY > CANVAS_HEIGHT) continue;

        // Check obstacle collision
        let hitObstacle = false;
        let hitObstacleIndex = -1;

        for (let i = 0; i < currentObstacles.length; i++) {
          const obs = currentObstacles[i];
          if (obs.type !== 'bush' && checkCircleRectCollision(newX, newY, BULLET_SIZE / 2, obs.x, obs.y, obs.width, obs.height)) {
            hitObstacle = true;
            hitObstacleIndex = i;
            addExplosion(newX, newY, 15);
            break;
          }
        }

        if (hitObstacle) {
          if (hitObstacleIndex >= 0) {
            setObstacles(prevObs => prevObs.map((obs, idx) => {
              if (idx === hitObstacleIndex && obs.destructible) {
                const newHealth = obs.health - 1;
                if (newHealth <= 0) return null as any;
                return { ...obs, health: newHealth };
              }
              return obs;
            }).filter(Boolean));
          }
          continue;
        }

        // Check tank hits
        if (bullet.isPlayer) {
          let hitEnemy = false;
          setEnemies(prevEnemies => prevEnemies.map(enemy => {
            const enemyCenterX = enemy.x + TANK_SIZE / 2;
            const enemyCenterY = enemy.y + TANK_SIZE / 2;
            if (distance(newX, newY, enemyCenterX, enemyCenterY) < TANK_COLLISION_RADIUS + BULLET_SIZE / 2) {
              hitEnemy = true;
              addExplosion(enemyCenterX, enemyCenterY, 30);
              const newHealth = enemy.health - 1;
              if (newHealth <= 0) {
                setScore(prev => prev + 100);
                return null as any;
              }
              return { ...enemy, health: newHealth };
            }
            return enemy;
          }).filter(Boolean));
          if (hitEnemy) continue;
        } else {
          // Enemy bullet hit player
          if (distance(newX, newY, playerCenterX, playerCenterY) < TANK_COLLISION_RADIUS + BULLET_SIZE / 2) {
            addExplosion(playerCenterX, playerCenterY, 20);
            setPlayerTank(prev => {
              const newHealth = prev.health - 5;
              if (newHealth <= 0) {
                setIsGameOver(true);
                setIsPlaying(false);
                setShowScoreSubmit(true);
              }
              return { ...prev, health: Math.max(0, newHealth) };
            });
            continue;
          }
        }

        activeBullets.push({ ...bullet, x: newX, y: newY });
      }

      return activeBullets;
    });

    // Update explosions
    setExplosions(prev => prev.map(exp => ({ ...exp, frame: exp.frame + 1 })).filter(exp => exp.frame < exp.maxFrames));

    // Check powerup collection
    setPowerups(prev => prev.filter(pup => {
      if (distance(playerCenterX, playerCenterY, pup.x, pup.y) < TANK_COLLISION_RADIUS + 15) {
        if (pup.type === 'health') {
          setPlayerTank(p => ({ ...p, health: Math.min(p.health + 25, PLAYER_MAX_HEALTH) }));
          setScore(s => s + 50);
        } else if (pup.type === 'speed') {
          setScore(s => s + 75);
        } else if (pup.type === 'damage') {
          setScore(s => s + 100);
        }
        return false;
      }
      return true;
    }));

    // Check level completion
    if (enemiesRef.current.length === 0) {
      setLevel(prev => {
        const newLevel = prev + 1;
        setEnemies(generateEnemies(newLevel));
        setObstacles(generateObstacles(newLevel));
        setPowerups(generatePowerups(newLevel));
        return newLevel;
      });
      setScore(prev => prev + 500);
    }

    // Draw
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawGame(ctx, playerRef.current, enemiesRef.current, bulletsRef.current, obstaclesRef.current, powerups, explosions, mousePos.current, level);
      }
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, isGameOver, isPaused, addExplosion, level, powerups, explosions, gameStartTime]);

  // Input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
      keysPressed.current.add(e.code);

      if (e.code === 'Escape') {
        setIsPaused(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        mousePos.current = {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Start game loop
  useEffect(() => {
    if (isPlaying && !isGameOver && !isPaused) {
      lastTimeRef.current = performance.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [isPlaying, isGameOver, isPaused, gameLoop]);

  const startGame = () => {
    const now = Date.now();
    setGameStartTime(now);
    setGameTime(0);
    setPlayerTank({
      x: CANVAS_WIDTH / 2 - TANK_SIZE / 2,
      y: CANVAS_HEIGHT - 80,
      rotation: -90,
      turretRotation: -90,
      health: PLAYER_MAX_HEALTH,
      maxHealth: PLAYER_MAX_HEALTH,
      isPlayer: true,
      lastShot: 0,
      color: '#3b82f6',
      speed: PLAYER_SPEED,
      vx: 0,
      vy: 0
    });
    setLevel(1);
    setScore(0);
    setEnemies(generateEnemies(1));
    setObstacles(generateObstacles(1));
    setPowerups(generatePowerups(1));
    setBullets([]);
    setExplosions([]);
    setIsGameOver(false);
    setIsPlaying(true);
    setIsPaused(false);
    setShowScoreSubmit(false);
    setPlayerName("");
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between p-2 md:p-3 bg-muted/20 border-b shrink-0 gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          ←
        </Button>

        <div className="flex items-center gap-2 md:gap-4 text-sm">
          <div className="flex items-center gap-1 md:gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground">Level:</span>
            <span className="font-bold">Lvl {level}</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground">Score:</span>
            <span className="font-bold">🎯 {score}</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground">Time:</span>
            <span className="font-mono text-xs">{Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}</span>
            {gameTime >= 60 && (
              <span className={`text-xs px-1 py-0.5 rounded ${gameTime >= 120 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                {gameTime >= 120 ? '⚡⚡' : '⚡'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground">HP:</span>
            <div className="w-16 md:w-24 h-3 bg-gray-600 rounded-full overflow-hidden border border-gray-500">
              <div
                className={`h-full transition-all ${playerTank.health > 60 ? 'bg-green-500' :
                  playerTank.health > 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                style={{ width: `${(playerTank.health / PLAYER_MAX_HEALTH) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold min-w-[30px]">{playerTank.health}</span>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2">
                <List className="h-3 w-3 md:mr-1" />
                <span className="hidden md:inline">Results</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Tank Battle - All Results
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
                            : "text-muted-foreground"
                            }`}>
                            #{index + 1}
                          </span>
                          <span className="font-medium">{score.playerName}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold">{score.score}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(score.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No scores yet!</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {isPlaying && (
            <Button onClick={() => setIsPaused(p => !p)} size="sm" variant="outline" className="h-8 px-2">
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          )}
        </div>
      </div>

      {/* Start Game Overlay */}
      {!isPlaying && !isGameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center space-y-6 p-8">
            <h2 className="text-4xl font-bold text-white">🎮 Tank Battle</h2>
            <div className="text-sm text-gray-300 space-y-2">
              <p><kbd className="px-2 py-1 bg-muted rounded">WASD</kbd> / <kbd className="px-2 py-1 bg-muted rounded">Arrows</kbd> - Move</p>
              <p><kbd className="px-2 py-1 bg-muted rounded">Mouse</kbd> - Aim turret</p>
              <p><kbd className="px-2 py-1 bg-muted rounded">Click</kbd> / <kbd className="px-2 py-1 bg-muted rounded">Space</kbd> - Shoot</p>
              <p><kbd className="px-2 py-1 bg-muted rounded">ESC</kbd> - Pause</p>
            </div>
            <Button
              onClick={startGame}
              size="lg"
              className="text-xl font-bold px-8 py-6 bg-green-600 hover:bg-green-700 text-white shadow-lg"
            >
              START GAME
            </Button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="border-destructive max-w-sm w-full">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 mx-auto mb-3 text-destructive" />
              <h2 className="text-lg font-bold mb-2">Game Over!</h2>
              <div className="text-sm mb-4 space-y-1">
                <p>Final Score: <span className="font-bold">{score}</span></p>
                <p>Level Reached: <span className="font-bold">{level}</span></p>
              </div>

              {showScoreSubmit && (
                <div className="mb-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <Input
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="flex-1"
                      maxLength={20}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (playerName.trim()) {
                        submitScoreMutation.mutate({
                          playerName: playerName.trim(),
                          score: score,
                        });
                      }
                    }}
                    disabled={!playerName.trim() || submitScoreMutation.isPending}
                    size="sm"
                    className="w-full mb-2"
                  >
                    {submitScoreMutation.isPending ? "Saving..." : "Save Score"}
                  </Button>
                </div>
              )}

              <Button onClick={startGame} size="sm" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Play Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Paused Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-4">PAUSED</h2>
            <p className="text-muted-foreground">Press ESC to resume</p>
          </div>
        </div>
      )}

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-muted rounded-lg shadow-xl max-w-full"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Mobile Controls */}
      <div className="shrink-0 p-2 bg-muted/10 md:hidden">
        <div className="max-w-xs mx-auto grid grid-cols-3 gap-1">
          <div />
          <Button
            variant="outline"
            size="sm"
            onTouchStart={() => keysPressed.current.add('KeyW')}
            onTouchEnd={() => keysPressed.current.delete('KeyW')}
            disabled={!isPlaying}
            className="h-10"
          >
            ↑
          </Button>
          <div />

          <Button
            variant="outline"
            size="sm"
            onTouchStart={() => keysPressed.current.add('KeyA')}
            onTouchEnd={() => keysPressed.current.delete('KeyA')}
            disabled={!isPlaying}
            className="h-10"
          >
            ←
          </Button>
          <Button
            variant="default"
            size="sm"
            onTouchStart={() => { mouseDown.current = true; }}
            onTouchEnd={() => { mouseDown.current = false; }}
            disabled={!isPlaying}
            className="h-10"
          >
            🔥
          </Button>
          <Button
            variant="outline"
            size="sm"
            onTouchStart={() => keysPressed.current.add('KeyD')}
            onTouchEnd={() => keysPressed.current.delete('KeyD')}
            disabled={!isPlaying}
            className="h-10"
          >
            →
          </Button>

          <div />
          <Button
            variant="outline"
            size="sm"
            onTouchStart={() => keysPressed.current.add('KeyS')}
            onTouchEnd={() => keysPressed.current.delete('KeyS')}
            disabled={!isPlaying}
            className="h-10"
          >
            ↓
          </Button>
          <div />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-1">
          WASD: Move • Mouse: Aim • Click/Space: Shoot
        </p>
      </div>
    </div>
  );
}
