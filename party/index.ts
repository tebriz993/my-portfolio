import type * as Party from "partykit/server";

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// HEADBALL GAME SERVER
// ============================================================================

export default class HeadballServer implements Party.Server {
  host: Party.Connection | null = null;
  client: Party.Connection | null = null;

  constructor(readonly room: Party.Room) { }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connected: ${conn.id} to room: ${this.room.id}`);

    // First player becomes host
    if (!this.host) {
      this.host = conn;
      conn.send(JSON.stringify({
        type: 'ROOM_CREATED',
        payload: { code: this.room.id }
      }));
    }
    // Second player becomes client
    else if (!this.client) {
      this.client = conn;

      // Notify host that player joined
      this.host.send(JSON.stringify({
        type: 'PLAYER_JOINED',
        payload: { role: 'player2' }
      }));

      // Start game for client
      conn.send(JSON.stringify({
        type: 'GAME_START',
        payload: { role: 'player2' }
      }));

      // Start game for host
      this.host.send(JSON.stringify({
        type: 'GAME_START',
        payload: { role: 'player1' }
      }));
    }
    // Room is full
    else {
      conn.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Room is full' }
      }));
      conn.close();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data: WSMessage = JSON.parse(message);

      switch (data.type) {
        case 'GAME_STATE':
          // Host sends game state to client
          if (sender === this.host && this.client) {
            this.client.send(message);
          }
          break;

        case 'PLAYER_INPUT':
          // Client sends input to host
          if (sender === this.client && this.host) {
            this.host.send(message);
          }
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  onClose(conn: Party.Connection) {
    console.log(`Player disconnected: ${conn.id}`);

    // Determine which player disconnected and notify the other
    const otherPlayer = conn === this.host ? this.client : this.host;

    if (otherPlayer) {
      otherPlayer.send(JSON.stringify({
        type: 'PLAYER_DISCONNECTED'
      }));
    }

    // Clean up room
    if (conn === this.host) {
      this.host = null;
    } else if (conn === this.client) {
      this.client = null;
    }
  }
}

HeadballServer satisfies Party.Worker;
