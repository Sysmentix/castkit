import { WebSocket } from 'ws';
import {
  SignalingMessage,
  SdpMessageData,
  IceCandidateMessageData,
} from '../core/index.js';
import { StreamRoom } from '../room-manager.js';

export class WebRtcSignaler {
  /**
   * Forward SDP offer/answer between peers (Broadcaster <-> Viewer)
   */
  public handleSdp(room: StreamRoom, message: Extract<SignalingMessage, { type: 'offer' | 'answer' }>): void {
    const { from, to } = message.data as SdpMessageData;

    // If destination is broadcaster OR if destination is empty and sender is a viewer
    if (
      room.broadcaster &&
      (room.broadcaster.participant.id === to || (!to && room.broadcaster.participant.id !== from))
    ) {
      if (room.broadcaster.ws.readyState === WebSocket.OPEN) {
        room.broadcaster.ws.send(JSON.stringify(message));
      }
      return;
    }

    // If destination is a specific viewer
    if (to) {
      const targetViewer = room.viewers.get(to);
      if (targetViewer && targetViewer.ws.readyState === WebSocket.OPEN) {
        targetViewer.ws.send(JSON.stringify(message));
        return;
      }
    }

    // If it's an offer broadcast from broadcaster to all viewers
    if (room.broadcaster?.participant.id === from && !to) {
      room.broadcastToViewers(message);
    }
  }

  /**
   * Forward ICE candidates between peers
   */
  public handleIceCandidate(room: StreamRoom, message: Extract<SignalingMessage, { type: 'ice_candidate' }>): void {
    const { from, to } = message.data as IceCandidateMessageData;

    // Send to broadcaster if to is broadcaster ID or if to is empty and sender is viewer
    if (
      room.broadcaster &&
      (room.broadcaster.participant.id === to || (!to && room.broadcaster.participant.id !== from))
    ) {
      if (room.broadcaster.ws.readyState === WebSocket.OPEN) {
        room.broadcaster.ws.send(JSON.stringify(message));
      }
      return;
    }

    // Send to specific viewer
    if (to) {
      const targetViewer = room.viewers.get(to);
      if (targetViewer && targetViewer.ws.readyState === WebSocket.OPEN) {
        targetViewer.ws.send(JSON.stringify(message));
      }
    }
  }
}
