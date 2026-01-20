import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trophy, User, List, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TankGameProps {
    onBack: () => void;
}

interface Position {
    x: number;
    y: number;
}

interface Tank {
    x: number;
    y: number;
    rotation: number; // degrees
    health: number;
    isPlayer: boolean;
    lastShot: number;
    color: string;
}

interface Bullet {
    x: number;
    y: number;
    rotation: number;
    isPlayer: boolean;
    speed: number;
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
}

interface PowerUp {
    x: number;
    y: number;
    type: 'health' | 'speed' | 'shield';
    id: number;
}

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const TANK_SIZE = 40;
const BULLET_SIZE = 8;
const TANK_SPEED = 3;
const BULLET_SPEED = 7;
const PLAYER_SHOOT_COOLDOWN = 300;
const ENEMY_SHOOT_COOLDOWN = 1500;
const ROTATION_SPEED = 4;
const PLAYER_MAX_HEALTH = 50;

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
        rotation: -90, // Yuxarıya baxır
        health: PLAYER_MAX_HEALTH,
        isPlayer: true,
        lastShot: 0,
        color: '#3b82f6'
    });
    const [enemies, setEnemies] = useState<Tank[]>([]);
    const [bullets, setBullets] = useState<Bullet[]>([]);
    const [obstacles, setObstacles] = useState<Obstacle[]>([]);
    const [explosions, setExplosions] = useState<Explosion[]>([]);
    const [powerups, setPowerups] = useState<PowerUp[]>([]);
    const [playerName, setPlayerName] = useState("");
    const [showScoreSubmit, setShowScoreSubmit] = useState(false);
    const [isNewRecord, setIsNewRecord] = useState(false);

    // Refs for game loop
    const keysPressed = useRef<Set<string>>(new Set());
    const gameLoopRef = useRef<number>();
    const lastTimeRef = useRef<number>(0);
    const playerRef = useRef(playerTank);
    const enemiesRef = useRef(enemies);
    const bulletsRef = useRef(bullets);
    const obstaclesRef = useRef(obstacles);

    const queryClient = useQueryClient();

    // Fetch top scores
    const { data: topScores = [] } = useQuery({
        queryKey: ['/api/games/tank/scores'],
        queryFn: async () => {
            const response = await fetch('/api/games/tank/scores?limit=5');
            if (!response.ok) throw new Error('Failed to fetch scores');
            return response.json();
        }
    });

    // Fetch all scores
    const { data: allScores = [] } = useQuery({
        queryKey: ['/api/games/tank/all-scores'],
        queryFn: async () => {
            const response = await fetch('/api/games/tank/scores');
            if (!response.ok) throw new Error('Failed to fetch all scores');
            return response.json();
        }
    });

    // Submit score mutation
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

    // Generate obstacles for level
    const generateObstacles = useCallback((lvl: number): Obstacle[] => {
        const obs: Obstacle[] = [];

        // Kənar divarları (barrier)
        // Yuxarı kənar divarları
        obs.push({ x: 100, y: 30, width: 150, height: 15, type: 'wall', destructible: false, health: 999 });
        obs.push({ x: 550, y: 30, width: 150, height: 15, type: 'wall', destructible: false, health: 999 });

        // Aşağı kənar divarları (oyunçu sahəsini qoruyur)
        obs.push({ x: 100, y: CANVAS_HEIGHT - 45, width: 120, height: 15, type: 'wall', destructible: false, health: 999 });
        obs.push({ x: 580, y: CANVAS_HEIGHT - 45, width: 120, height: 15, type: 'wall', destructible: false, health: 999 });

        // Sol və sağ kənar divarları - ortaya doğru
        obs.push({ x: 80, y: 100, width: 15, height: 120, type: 'wall', destructible: false, health: 999 });
        obs.push({ x: 80, y: 280, width: 15, height: 120, type: 'wall', destructible: false, health: 999 });
        obs.push({ x: CANVAS_WIDTH - 95, y: 100, width: 15, height: 120, type: 'wall', destructible: false, health: 999 });
        obs.push({ x: CANVAS_WIDTH - 95, y: 280, width: 15, height: 120, type: 'wall', destructible: false, health: 999 });

        // Ortada strateji divarlar - sınmaz
        obs.push({ x: CANVAS_WIDTH / 2 - 60, y: CANVAS_HEIGHT / 2 - 50, width: 120, height: 15, type: 'wall', destructible: false, health: 999 });
        obs.push({ x: CANVAS_WIDTH / 2 - 60, y: CANVAS_HEIGHT / 2 + 35, width: 120, height: 15, type: 'wall', destructible: false, health: 999 });

        // Random maneələr
        const randomCount = 3 + lvl;
        for (let i = 0; i < randomCount; i++) {
            const type = Math.random() < 0.4 ? 'rock' : (Math.random() < 0.6 ? 'wall' : 'bush');
            obs.push({
                x: 80 + Math.random() * (CANVAS_WIDTH - 160),
                y: 80 + Math.random() * (CANVAS_HEIGHT - 180),
                width: type === 'wall' ? 60 + Math.random() * 40 : 40,
                height: type === 'wall' ? 12 : 40,
                type,
                destructible: type !== 'rock',
                health: type === 'wall' ? 8 : 1
            });
        }
        return obs;
    }, []);

    // Generate enemies for level
    const generateEnemies = useCallback((lvl: number): Tank[] => {
        const enemyCount = Math.min(2 + lvl, 6);
        const newEnemies: Tank[] = [];

        for (let i = 0; i < enemyCount; i++) {
            newEnemies.push({
                x: 100 + Math.random() * (CANVAS_WIDTH - 200),
                y: 50 + Math.random() * 150, // Yuxarı hissədə
                rotation: 90, // Aşağıya baxır
                health: 1 + Math.floor(lvl / 3),
                isPlayer: false,
                lastShot: 0,
                color: lvl >= 3 ? '#dc2626' : '#65a30d'
            });
        }
        return newEnemies;
    }, []);

    // Generate powerups for level
    let powerupIdCounter = 0;
    const generatePowerups = useCallback((lvl: number): PowerUp[] => {
        const pups: PowerUp[] = [];
        const count = 2 + Math.floor(lvl / 2); // Daha çox level = daha çox bonus
        const types: ('health' | 'speed' | 'shield')[] = ['health', 'health', 'speed', 'shield'];

        for (let i = 0; i < count; i++) {
            pups.push({
                x: 50 + Math.random() * (CANVAS_WIDTH - 100),
                y: 100 + Math.random() * (CANVAS_HEIGHT - 250),
                type: types[Math.floor(Math.random() * types.length)],
                id: ++powerupIdCounter
            });
        }
        return pups;
    }, []);

    // Collision detection
    const checkCollision = useCallback((
        x1: number, y1: number, w1: number, h1: number,
        x2: number, y2: number, w2: number, h2: number
    ) => {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }, []);

    // Check if position is blocked
    const isBlocked = useCallback((x: number, y: number, size: number, excludeTank?: Tank) => {
        // Check canvas bounds
        if (x < 0 || x + size > CANVAS_WIDTH || y < 0 || y + size > CANVAS_HEIGHT) return true;

        // Check obstacles
        for (const obs of obstaclesRef.current) {
            if (obs.type !== 'bush' && checkCollision(x, y, size, size, obs.x, obs.y, obs.width, obs.height)) {
                return true;
            }
        }

        // Check other tanks
        const allTanks = [playerRef.current, ...enemiesRef.current];
        for (const tank of allTanks) {
            if (excludeTank && tank === excludeTank) continue;
            if (checkCollision(x, y, size, size, tank.x, tank.y, TANK_SIZE, TANK_SIZE)) {
                return true;
            }
        }

        return false;
    }, [checkCollision]);

    // Shoot bullet
    const shoot = useCallback((tank: Tank) => {
        const now = Date.now();
        const cooldown = tank.isPlayer ? PLAYER_SHOOT_COOLDOWN : ENEMY_SHOOT_COOLDOWN;

        if (now - tank.lastShot < cooldown) return null;

        const radians = (tank.rotation * Math.PI) / 180;
        const bulletX = tank.x + TANK_SIZE / 2 + Math.cos(radians) * (TANK_SIZE / 2);
        const bulletY = tank.y + TANK_SIZE / 2 + Math.sin(radians) * (TANK_SIZE / 2);

        return {
            x: bulletX - BULLET_SIZE / 2,
            y: bulletY - BULLET_SIZE / 2,
            rotation: tank.rotation,
            isPlayer: tank.isPlayer,
            speed: BULLET_SPEED
        };
    }, []);

    // Add explosion
    const addExplosion = useCallback((x: number, y: number) => {
        setExplosions(prev => [...prev, { x, y, frame: 0, maxFrames: 15 }]);
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

        // Player movement
        let newPlayerX = playerRef.current.x;
        let newPlayerY = playerRef.current.y;
        let newRotation = playerRef.current.rotation;

        // Klassik tank kontrolleri: Sol/Sağ = dönmə, İrəli/Geri = hərəkət

        // Dönmə (Sol/Sağ)
        if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('KeyA')) {
            newRotation -= ROTATION_SPEED;
        }
        if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('KeyD')) {
            newRotation += ROTATION_SPEED;
        }

        // İrəli hərəkət (Yuxarı/W)
        if (keysPressed.current.has('ArrowUp') || keysPressed.current.has('KeyW')) {
            const radians = (newRotation * Math.PI) / 180;
            const moveX = Math.cos(radians) * TANK_SPEED;
            const moveY = Math.sin(radians) * TANK_SPEED;
            if (!isBlocked(newPlayerX + moveX, newPlayerY + moveY, TANK_SIZE, playerRef.current)) {
                newPlayerX += moveX;
                newPlayerY += moveY;
            }
        }

        // Geri hərəkət (Aşağı/S) - daha yavaş
        if (keysPressed.current.has('ArrowDown') || keysPressed.current.has('KeyS')) {
            const radians = (newRotation * Math.PI) / 180;
            const moveX = -Math.cos(radians) * TANK_SPEED * 0.6;
            const moveY = -Math.sin(radians) * TANK_SPEED * 0.6;
            if (!isBlocked(newPlayerX + moveX, newPlayerY + moveY, TANK_SIZE, playerRef.current)) {
                newPlayerX += moveX;
                newPlayerY += moveY;
            }
        }

        // Player shooting
        if (keysPressed.current.has('Space')) {
            const bullet = shoot(playerRef.current);
            if (bullet) {
                setBullets(prev => [...prev, bullet]);
                setPlayerTank(prev => ({ ...prev, lastShot: Date.now() }));
            }
        }

        setPlayerTank(prev => ({ ...prev, x: newPlayerX, y: newPlayerY, rotation: newRotation }));

        // Enemy AI - Ağıllı davranış
        setEnemies(prevEnemies => {
            return prevEnemies.map(enemy => {
                const dx = playerRef.current.x - enemy.x;
                const dy = playerRef.current.y - enemy.y;
                const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
                const distance = Math.sqrt(dx * dx + dy * dy);

                let angleDiff = targetAngle - enemy.rotation;
                while (angleDiff > 180) angleDiff -= 360;
                while (angleDiff < -180) angleDiff += 360;

                let newRot = enemy.rotation;
                if (Math.abs(angleDiff) > 5) {
                    newRot += Math.sign(angleDiff) * Math.min(3, Math.abs(angleDiff));
                }

                // Oyunçuya görə yol açıqdır mı yoxla
                const hasLineOfSight = (): boolean => {
                    const steps = Math.ceil(distance / 20);
                    for (let i = 1; i < steps; i++) {
                        const checkX = enemy.x + TANK_SIZE / 2 + (dx / steps) * i;
                        const checkY = enemy.y + TANK_SIZE / 2 + (dy / steps) * i;
                        for (const obs of obstaclesRef.current) {
                            if (obs.type !== 'bush' &&
                                checkX > obs.x && checkX < obs.x + obs.width &&
                                checkY > obs.y && checkY < obs.y + obs.height) {
                                return false;
                            }
                        }
                    }
                    return true;
                };

                const canSeePlayer = hasLineOfSight();
                let newX = enemy.x;
                let newY = enemy.y;

                if (!canSeePlayer) {
                    // Yol bağlıdır - yan hərəkət et (qaçma manevrası)
                    const sideAngle = (newRot + 90) * Math.PI / 180;
                    const sideX = Math.cos(sideAngle) * TANK_SPEED;
                    const sideY = Math.sin(sideAngle) * TANK_SPEED;

                    // Sağa cəhd et
                    if (!isBlocked(newX + sideX, newY + sideY, TANK_SIZE, enemy)) {
                        newX += sideX;
                        newY += sideY;
                    }
                    // Sola cəhd et
                    else if (!isBlocked(newX - sideX, newY - sideY, TANK_SIZE, enemy)) {
                        newX -= sideX;
                        newY -= sideY;
                    }
                    // Geri çəkil
                    else {
                        const backAngle = (newRot + 180) * Math.PI / 180;
                        const backX = Math.cos(backAngle) * TANK_SPEED * 0.5;
                        const backY = Math.sin(backAngle) * TANK_SPEED * 0.5;
                        if (!isBlocked(newX + backX, newY + backY, TANK_SIZE, enemy)) {
                            newX += backX;
                            newY += backY;
                        }
                    }
                } else if (distance > 150) {
                    // Yol açıqdır - oyunçuya doğru hərəkət et
                    const radians = (newRot * Math.PI) / 180;
                    const moveX = Math.cos(radians) * TANK_SPEED * 0.8;
                    const moveY = Math.sin(radians) * TANK_SPEED * 0.8;
                    if (!isBlocked(newX + moveX, newY + moveY, TANK_SIZE, enemy)) {
                        newX += moveX;
                        newY += moveY;
                    }
                }

                // Atəş - yalnız yol açıqdırsa
                const now = Date.now();
                if (canSeePlayer && now - enemy.lastShot > ENEMY_SHOOT_COOLDOWN && Math.abs(angleDiff) < 20) {
                    const bullet = shoot({ ...enemy, rotation: newRot });
                    if (bullet) {
                        setBullets(prev => [...prev, bullet]);
                        return { ...enemy, x: newX, y: newY, rotation: newRot, lastShot: now };
                    }
                }

                return { ...enemy, x: newX, y: newY, rotation: newRot };
            });
        });

        // Update bullets
        setBullets(prevBullets => {
            const newBullets: Bullet[] = [];

            for (const bullet of prevBullets) {
                const radians = (bullet.rotation * Math.PI) / 180;
                const newX = bullet.x + Math.cos(radians) * bullet.speed;
                const newY = bullet.y + Math.sin(radians) * bullet.speed;

                // Check bounds
                if (newX < 0 || newX > CANVAS_WIDTH || newY < 0 || newY > CANVAS_HEIGHT) continue;

                // Check obstacle collision - obstaclesRef istifadə edərək sync yoxla
                let hitObstacle = false;
                let hitObstacleIndex = -1;

                for (let i = 0; i < obstaclesRef.current.length; i++) {
                    const obs = obstaclesRef.current[i];
                    if (obs.type !== 'bush' && checkCollision(newX, newY, BULLET_SIZE, BULLET_SIZE, obs.x, obs.y, obs.width, obs.height)) {
                        hitObstacle = true;
                        hitObstacleIndex = i;
                        addExplosion(newX, newY);
                        break;
                    }
                }

                // Əgər maneəyə dəyibsə, güllə dayanır və maneənin sağlamlığı azalır
                if (hitObstacle) {
                    if (hitObstacleIndex >= 0) {
                        setObstacles(prevObs => {
                            return prevObs.map((obs, idx) => {
                                if (idx === hitObstacleIndex && obs.destructible) {
                                    const newHealth = obs.health - 1;
                                    if (newHealth <= 0) return null as any;
                                    return { ...obs, health: newHealth };
                                }
                                return obs;
                            }).filter(Boolean);
                        });
                    }
                    continue; // Güllə dayanır, delib keçmir!
                }

                // Check tank collision
                if (bullet.isPlayer) {
                    // Check enemy hits
                    let hitEnemy = false;
                    setEnemies(prevEnemies => {
                        return prevEnemies.map(enemy => {
                            if (checkCollision(newX, newY, BULLET_SIZE, BULLET_SIZE, enemy.x, enemy.y, TANK_SIZE, TANK_SIZE)) {
                                hitEnemy = true;
                                addExplosion(enemy.x + TANK_SIZE / 2, enemy.y + TANK_SIZE / 2);
                                const newHealth = enemy.health - 1;
                                if (newHealth <= 0) {
                                    setScore(prev => prev + 100);
                                    return null as any;
                                }
                                return { ...enemy, health: newHealth };
                            }
                            return enemy;
                        }).filter(Boolean);
                    });
                    if (hitEnemy) continue;
                } else {
                    // Check player hit
                    if (checkCollision(newX, newY, BULLET_SIZE, BULLET_SIZE, playerRef.current.x, playerRef.current.y, TANK_SIZE, TANK_SIZE)) {
                        addExplosion(playerRef.current.x + TANK_SIZE / 2, playerRef.current.y + TANK_SIZE / 2);
                        setPlayerTank(prev => {
                            const newHealth = prev.health - 1;
                            if (newHealth <= 0) {
                                setIsGameOver(true);
                                setIsPlaying(false);
                                setShowScoreSubmit(true);
                                const isRecord = topScores.length === 0 || score > (topScores[0]?.score || 0);
                                setIsNewRecord(isRecord);
                            }
                            return { ...prev, health: newHealth };
                        });
                        continue;
                    }
                }

                newBullets.push({ ...bullet, x: newX, y: newY });
            }

            return newBullets;
        });

        // Update explosions
        setExplosions(prev => prev.map(exp => ({ ...exp, frame: exp.frame + 1 })).filter(exp => exp.frame < exp.maxFrames));

        // Check powerup collection
        setPowerups(prev => {
            return prev.filter(pup => {
                const POWERUP_SIZE = 30;
                if (checkCollision(playerRef.current.x, playerRef.current.y, TANK_SIZE, TANK_SIZE,
                    pup.x - POWERUP_SIZE / 2, pup.y - POWERUP_SIZE / 2, POWERUP_SIZE, POWERUP_SIZE)) {
                    // Powerup toplandi!
                    if (pup.type === 'health') {
                        setPlayerTank(p => ({ ...p, health: Math.min(p.health + 3, PLAYER_MAX_HEALTH) }));
                        setScore(s => s + 50);
                    } else if (pup.type === 'speed') {
                        setScore(s => s + 75);
                        // Speed boost (temporary effect could be added later)
                    } else if (pup.type === 'shield') {
                        setPlayerTank(p => ({ ...p, health: Math.min(p.health + 1, PLAYER_MAX_HEALTH) }));
                        setScore(s => s + 100);
                    }
                    return false; // Remove powerup
                }
                return true;
            });
        });

        // Check level completion
        if (enemiesRef.current.length === 0) {
            setLevel(prev => prev + 1);
            setEnemies(generateEnemies(level + 1));
            setObstacles(generateObstacles(level + 1));
            setPowerups(generatePowerups(level + 1));
            setScore(prev => prev + 500); // Level bonus
        }

        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [isPlaying, isGameOver, isPaused, shoot, isBlocked, checkCollision, addExplosion, generateEnemies, generateObstacles, level, score, topScores]);

    // Draw game
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw grass pattern
        ctx.fillStyle = '#48BB78';
        for (let x = 0; x < CANVAS_WIDTH; x += 20) {
            for (let y = 0; y < CANVAS_HEIGHT; y += 20) {
                if ((x + y) % 40 === 0) {
                    ctx.fillRect(x, y, 20, 20);
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
                ctx.fillStyle = '#92400E';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeStyle = '#78350F';
                ctx.lineWidth = 2;
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
            } else {
                ctx.fillStyle = '#22C55E';
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        // Draw powerups
        const POWERUP_SIZE = 30;
        for (const pup of powerups) {
            ctx.save();

            // Glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = pup.type === 'health' ? '#10B981' :
                pup.type === 'speed' ? '#3B82F6' : '#F59E0B';

            // Background circle
            ctx.fillStyle = pup.type === 'health' ? '#10B981' :
                pup.type === 'speed' ? '#3B82F6' : '#F59E0B';
            ctx.beginPath();
            ctx.arc(pup.x, pup.y, POWERUP_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();

            // Inner white circle
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(pup.x, pup.y, POWERUP_SIZE / 3, 0, Math.PI * 2);
            ctx.fill();

            // Icon
            ctx.fillStyle = pup.type === 'health' ? '#10B981' :
                pup.type === 'speed' ? '#3B82F6' : '#F59E0B';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pup.type === 'health' ? '+' : pup.type === 'speed' ? '⚡' : '🛡', pup.x, pup.y);

            ctx.restore();
        }

        // Draw function for tanks
        const drawTank = (tank: Tank) => {
            ctx.save();
            ctx.translate(tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2);
            ctx.rotate((tank.rotation * Math.PI) / 180);

            // Tank body
            ctx.fillStyle = tank.color;
            ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2.5, TANK_SIZE, TANK_SIZE / 1.25);

            // Tank tracks
            ctx.fillStyle = '#374151';
            ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2.5, TANK_SIZE, 5);
            ctx.fillRect(-TANK_SIZE / 2, TANK_SIZE / 2.5 - 5, TANK_SIZE, 5);

            // Tank turret
            ctx.fillStyle = tank.isPlayer ? '#2563EB' : (tank.color === '#dc2626' ? '#B91C1C' : '#4D7C0F');
            ctx.beginPath();
            ctx.arc(0, 0, TANK_SIZE / 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Tank barrel
            ctx.fillStyle = '#1F2937';
            ctx.fillRect(0, -3, TANK_SIZE / 2 + 5, 6);

            ctx.restore();

            // Health bar
            if (tank.health > 0) {
                const maxHealth = tank.isPlayer ? PLAYER_MAX_HEALTH : (1 + Math.floor(level / 3));
                const healthPercent = tank.health / maxHealth;
                const barWidth = TANK_SIZE; // Sabit bar genişliyi
                ctx.fillStyle = '#374151';
                ctx.fillRect(tank.x, tank.y - 10, barWidth, 4);
                ctx.fillStyle = healthPercent > 0.6 ? '#22C55E' : (healthPercent > 0.3 ? '#EAB308' : '#EF4444');
                ctx.fillRect(tank.x, tank.y - 10, barWidth * healthPercent, 4);
            }
        };

        // Draw player tank
        if (playerTank.health > 0) {
            drawTank(playerTank);
        }

        // Draw enemy tanks
        for (const enemy of enemies) {
            drawTank(enemy);
        }

        // Draw bullets
        ctx.fillStyle = '#FBBF24';
        for (const bullet of bullets) {
            ctx.beginPath();
            ctx.arc(bullet.x + BULLET_SIZE / 2, bullet.y + BULLET_SIZE / 2, BULLET_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw explosions
        for (const exp of explosions) {
            const progress = exp.frame / exp.maxFrames;
            const radius = 20 + progress * 30;
            const alpha = 1 - progress;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#F97316';
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, radius * 0.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FBBF24';
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, radius * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw UI overlay
        if (!isPlaying && !isGameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🎮 TANK BATTLE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
            ctx.font = '18px Arial';
            ctx.fillText('WASD/Arrows to move, SPACE to shoot', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
            ctx.fillText('Press START to begin!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
        }

        if (isPaused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        }
    }, [playerTank, enemies, bullets, obstacles, explosions, powerups, isPlaying, isGameOver, isPaused, level]);

    // Keyboard event handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
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

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
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
        setPlayerTank({
            x: CANVAS_WIDTH / 2 - TANK_SIZE / 2,
            y: CANVAS_HEIGHT - 80,
            rotation: -90, // Yuxarıya baxır
            health: PLAYER_MAX_HEALTH,
            isPlayer: true,
            lastShot: 0,
            color: '#3b82f6'
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
        setIsNewRecord(false);
        setPlayerName("");
    };

    return (
        <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-muted/20 border-b shrink-0">
                <Button variant="outline" size="sm" onClick={onBack}>
                    ← Back
                </Button>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Level:</span>
                        <span className="font-bold">{level}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Score:</span>
                        <span className="font-bold">{score}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">HP:</span>
                        <div className="w-20 h-3 bg-gray-600 rounded-full overflow-hidden border border-gray-500">
                            <div
                                className={`h-full transition-all ${playerTank.health > 30 ? 'bg-green-500' :
                                    playerTank.health > 15 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${(playerTank.health / PLAYER_MAX_HEALTH) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold min-w-[40px]">{playerTank.health}/{PLAYER_MAX_HEALTH}</span>
                    </div>
                </div>

                <div className="flex gap-1">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <List className="h-3 w-3 mr-1" />
                                Results
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
                                    <p className="text-center text-muted-foreground py-8">No scores yet. Be the first to play!</p>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {!isPlaying && !isGameOver && (
                        <Button onClick={startGame} size="sm">
                            Start Game
                        </Button>
                    )}

                    {isPlaying && (
                        <Button onClick={() => setIsPaused(p => !p)} size="sm" variant="outline">
                            {isPaused ? 'Resume' : 'Pause'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Game Over Modal */}
            {isGameOver && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="border-destructive max-w-sm w-full">
                        <CardContent className="p-4 text-center">
                            <Trophy className="h-8 w-8 mx-auto mb-3 text-destructive" />
                            <h2 className="text-lg font-bold mb-2">
                                {isNewRecord ? "🎖️ NEW HIGH SCORE!" : "Game Over!"}
                            </h2>
                            <div className="text-sm mb-4 space-y-1">
                                <p>Final Score: {score}</p>
                                <p>Level Reached: {level}</p>
                                {isNewRecord && <p className="text-yellow-600 font-semibold">New Record!</p>}
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

            {/* Game Canvas */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="border-2 border-muted rounded-lg shadow-xl max-w-full"
                    style={{ imageRendering: 'pixelated' }}
                />
            </div>

            {/* Mobile Controls */}
            <div className="shrink-0 p-4 bg-muted/10">
                <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
                    <div />
                    <Button
                        variant="outline"
                        size="lg"
                        onMouseDown={() => keysPressed.current.add('KeyW')}
                        onMouseUp={() => keysPressed.current.delete('KeyW')}
                        onTouchStart={() => keysPressed.current.add('KeyW')}
                        onTouchEnd={() => keysPressed.current.delete('KeyW')}
                        disabled={!isPlaying}
                        className="h-12"
                    >
                        ↑
                    </Button>
                    <div />

                    <Button
                        variant="outline"
                        size="lg"
                        onMouseDown={() => keysPressed.current.add('KeyA')}
                        onMouseUp={() => keysPressed.current.delete('KeyA')}
                        onTouchStart={() => keysPressed.current.add('KeyA')}
                        onTouchEnd={() => keysPressed.current.delete('KeyA')}
                        disabled={!isPlaying}
                        className="h-12"
                    >
                        ←
                    </Button>
                    <Button
                        variant="default"
                        size="lg"
                        onMouseDown={() => keysPressed.current.add('Space')}
                        onMouseUp={() => keysPressed.current.delete('Space')}
                        onTouchStart={() => keysPressed.current.add('Space')}
                        onTouchEnd={() => keysPressed.current.delete('Space')}
                        disabled={!isPlaying}
                        className="h-12"
                    >
                        🔥
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        onMouseDown={() => keysPressed.current.add('KeyD')}
                        onMouseUp={() => keysPressed.current.delete('KeyD')}
                        onTouchStart={() => keysPressed.current.add('KeyD')}
                        onTouchEnd={() => keysPressed.current.delete('KeyD')}
                        disabled={!isPlaying}
                        className="h-12"
                    >
                        →
                    </Button>

                    <div />
                    <Button
                        variant="outline"
                        size="lg"
                        onMouseDown={() => keysPressed.current.add('KeyS')}
                        onMouseUp={() => keysPressed.current.delete('KeyS')}
                        onTouchStart={() => keysPressed.current.add('KeyS')}
                        onTouchEnd={() => keysPressed.current.delete('KeyS')}
                        disabled={!isPlaying}
                        className="h-12"
                    >
                        ↓
                    </Button>
                    <div />
                </div>
                <div className="mt-2 text-center text-xs text-muted-foreground">
                    <p>WASD/Arrows: Move & Rotate • SPACE: Shoot 🎯 • ESC: Pause</p>
                </div>
            </div>
        </div>
    );
}
