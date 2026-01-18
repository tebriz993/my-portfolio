import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';

// Types for messages
type MessageType =
    | 'CREATE_ROOM'
    | 'JOIN_ROOM'
    | 'ROOM_CREATED'
    | 'ERROR'
    | 'PLAYER_JOINED'
    | 'GAME_START'
    | 'GAME_STATE'
    | 'PLAYER_INPUT'
    | 'PLAYER_DISCONNECTED';

interface WSMessage {
    type: MessageType;
    payload?: any;
}

interface Room {
    code: string;
    host: WebSocket;
    client?: WebSocket;
    createdAt: number;
}

const rooms = new Map<string, Room>();

// Generate 6-digit code
function generateRoomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setupWebSocket(server: Server) {
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
        let currentRoomCode: string | null = null;
        let isHost = false;

        ws.on('message', (data) => {
            try {
                const message: WSMessage = JSON.parse(data.toString());

                switch (message.type) {
                    case 'CREATE_ROOM': {
                        const code = generateRoomCode();
                        rooms.set(code, {
                            code,
                            host: ws,
                            createdAt: Date.now()
                        });
                        currentRoomCode = code;
                        isHost = true;
                        ws.send(JSON.stringify({ type: 'ROOM_CREATED', payload: { code } }));
                        break;
                    }

                    case 'JOIN_ROOM': {
                        const { code } = message.payload;
                        const room = rooms.get(code);

                        if (!room) {
                            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room not found' } }));
                            return;
                        }

                        if (room.client) {
                            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room is full' } }));
                            return;
                        }

                        // Join room
                        room.client = ws;
                        currentRoomCode = code;
                        isHost = false;

                        // Notify host
                        room.host.send(JSON.stringify({ type: 'PLAYER_JOINED', payload: { role: 'player2' } }));

                        // Notify client (joiner)
                        ws.send(JSON.stringify({ type: 'GAME_START', payload: { role: 'player2' } }));

                        // Start game for host
                        room.host.send(JSON.stringify({ type: 'GAME_START', payload: { role: 'player1' } }));
                        break;
                    }

                    case 'GAME_STATE': {
                        // Relayed from Host to Client
                        if (currentRoomCode && isHost) {
                            const room = rooms.get(currentRoomCode);
                            if (room?.client && room.client.readyState === WebSocket.OPEN) {
                                room.client.send(JSON.stringify({ type: 'GAME_STATE', payload: message.payload }));
                            }
                        }
                        break;
                    }

                    case 'PLAYER_INPUT': {
                        // Relayed from Client to Host
                        if (currentRoomCode && !isHost) {
                            const room = rooms.get(currentRoomCode);
                            if (room?.host && room.host.readyState === WebSocket.OPEN) {
                                room.host.send(JSON.stringify({ type: 'PLAYER_INPUT', payload: message.payload }));
                            }
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error('WebSocket error:', error);
            }
        });

        ws.on('close', () => {
            if (currentRoomCode) {
                const room = rooms.get(currentRoomCode);
                if (room) {
                    // Notify other player
                    const otherPlayer = isHost ? room.client : room.host;
                    if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
                        otherPlayer.send(JSON.stringify({ type: 'PLAYER_DISCONNECTED' }));
                    }
                    // Clean up room
                    rooms.delete(currentRoomCode);
                }
            }
        });
    });

    // Cleanup old rooms periodically
    setInterval(() => {
        const now = Date.now();
        for (const [code, room] of rooms.entries()) {
            if (now - room.createdAt > 24 * 60 * 60 * 1000) { // 24 hours
                rooms.delete(code);
            }
        }
    }, 60 * 60 * 1000);

    return wss;
}
