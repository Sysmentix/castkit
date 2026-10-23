import { WebSocket } from 'ws';
import {
  StreamChunkMessageData,
  createMessage,
} from '../core/index.js';
import { StreamRoom } from '../room-manager.js';

export class WebSocketRelay {
  private recentChunks: Map<string, StreamChunkMessageData[]> = new Map();
  private maxBufferedChunks = 15;

  /**
   * Handle incoming video chunk from broadcaster and relay to all viewers
   */
  public handleChunk(room: StreamRoom, chunkData: StreamChunkMessageData): void {
    const streamId = room.streamId;

    if (!this.recentChunks.has(streamId)) {
      this.recentChunks.set(streamId, []);
    }
    const buffer = this.recentChunks.get(streamId)!;

    // Buffer chunk for fast startup of new viewers
    buffer.push(chunkData);
    if (buffer.length > this.maxBufferedChunks) {
      buffer.shift();
    }

    // Broadcast chunk to all connected viewers in the room
    const msg = createMessage('stream_chunk', chunkData, streamId, room.broadcaster?.participant.id);
    room.broadcastToViewers(msg);
  }

  /**
   * Catch up a newly joined viewer with the recent keyframe buffer
   */
  public catchUpViewer(room: StreamRoom, viewerWs: WebSocket): void {
    const buffer = this.recentChunks.get(room.streamId);
    if (!buffer || buffer.length === 0 || viewerWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // Send recent chunks in sequence
    for (const chunk of buffer) {
      const msg = createMessage('stream_chunk', chunk, room.streamId, room.broadcaster?.participant.id);
      viewerWs.send(JSON.stringify(msg));
    }
  }

  public clearBuffer(streamId: string): void {
    this.recentChunks.delete(streamId);
  }
}
