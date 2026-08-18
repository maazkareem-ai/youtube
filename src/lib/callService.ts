import { getSupabase } from './supabaseClient';
import { sounds } from './sound';

export interface CallSignal {
  id: string;
  senderId: string;
  targetUserId: string;
  callType?: 'audio' | 'video';
  type: 'offer' | 'answer' | 'candidate' | 'reject' | 'end';
  payload?: any;
  timestamp: number;
}

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export class CallService {
  private static activePeerConnection: RTCPeerConnection | null = null;
  private static localStream: MediaStream | null = null;
  private static remoteStream: MediaStream | null = null;

  // Send call signaling message via Supabase Realtime broadcast and dev server middleware
  static async sendSignal(signal: Omit<CallSignal, 'id' | 'timestamp'>): Promise<void> {
    const fullSignal: CallSignal = {
      ...signal,
      id: `sig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    // 1. Post to dev server relay for cross-browser / Incognito testing on localhost
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sandbox-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_call_signal', signal: fullSignal }),
        });
      } catch {
        // ignore
      }
    }

    // 2. Broadcast via Supabase Realtime channel if active
    const supabase = getSupabase();
    if (supabase) {
      try {
        const channel = supabase.channel('call_signals_global');
        await channel.subscribe();
        await channel.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: fullSignal,
        });
      } catch (err) {
        console.warn('Supabase call signal error:', err);
      }
    }
  }

  // Poll & Listen for incoming call signals
  static pollSignals(currentUserId: string, onSignal: (signal: CallSignal) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    // 1. Subscribe to Supabase Realtime channel for 0ms instant push
    const supabase = getSupabase();
    let supabaseChannel: any = null;
    if (supabase) {
      try {
        supabaseChannel = supabase.channel('call_signals_global');
        supabaseChannel
          .on('broadcast', { event: 'call_signal' }, (evt: any) => {
            const sig: CallSignal = evt.payload;
            if (sig && sig.senderId !== currentUserId) {
              onSignal(sig);
            }
          })
          .subscribe();
      } catch {
        // ignore
      }
    }

    // 2. High-speed 600ms polling relay for localhost dev server
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/sandbox-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_call_signals', userId: currentUserId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.signals && Array.isArray(data.signals)) {
            data.signals.forEach((sig: CallSignal) => {
              if (sig.senderId !== currentUserId) {
                onSignal(sig);
              }
            });
          }
        }
      } catch {
        // ignore
      }
    }, 600);

    return () => {
      clearInterval(interval);
      if (supabaseChannel) {
        try {
          supabaseChannel.unsubscribe();
        } catch {
          // ignore
        }
      }
    };
  }

  // Create & configure WebRTC Peer Connection for HD Audio
  static createPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): RTCPeerConnection {
    if (this.activePeerConnection) {
      this.activePeerConnection.close();
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    this.activePeerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    const remoteMediaStream = new MediaStream();
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        onRemoteStream(event.streams[0]);
      } else if (event.track) {
        remoteMediaStream.addTrack(event.track);
        this.remoteStream = remoteMediaStream;
        onRemoteStream(remoteMediaStream);
      }
    };

    return pc;
  }

  // Capture local microphone audio stream
  static async getMicrophoneStream(): Promise<MediaStream> {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.localStream = stream;
    return stream;
  }

  // Capture local HD camera video + microphone audio stream
  static async getVideoStream(): Promise<MediaStream> {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
    });
    this.localStream = stream;
    return stream;
  }

  static getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  static getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Clean up all active streams and peer connection
  static endActiveCall(): void {
    sounds.stopRingtone();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    if (this.activePeerConnection) {
      this.activePeerConnection.close();
      this.activePeerConnection = null;
    }
  }
}
