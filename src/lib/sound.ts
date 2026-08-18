// Lightweight zero-dependency Web Audio synthesizer for crisp, instant chat sound effects

class SoundEffects {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private ringtoneInterval: any = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeGainNodes: GainNode[] = [];

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Play a soft, crisp message send "pop/whoosh"
  playSendSound() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(840, ctx.currentTime + 0.04);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Ignore audio failure
    }
  }

  // Play a gentle incoming message "ding/chime"
  playReceiveSound() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.08);

      osc2.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } catch {
      // Ignore audio failure
    }
  }

  // Play a continuous realistic call ringtone (Ring-Ring ... Ring-Ring ...)
  startRingtone() {
    if (this.isMuted) return;
    this.stopRingtone();

    const playPulse = () => {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        // Modern, soft, elegant musical chime sequence (E5 -> G5 -> B5 -> E6)
        const notes = [
          { freq: 659.25, time: 0, duration: 0.45 },
          { freq: 783.99, time: 0.16, duration: 0.45 },
          { freq: 987.77, time: 0.36, duration: 0.55 },
          { freq: 1318.51, time: 0.58, duration: 0.65 },
        ];

        notes.forEach(({ freq, time, duration }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

          gain.gain.setValueAtTime(0.045, ctx.currentTime + time);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          this.activeOscillators.push(osc);
          this.activeGainNodes.push(gain);

          osc.start(ctx.currentTime + time);
          osc.stop(ctx.currentTime + time + duration);

          setTimeout(() => {
            this.activeOscillators = this.activeOscillators.filter((o) => o !== osc);
            this.activeGainNodes = this.activeGainNodes.filter((g) => g !== gain);
          }, (time + duration + 0.1) * 1000);
        });
      } catch {
        // ignore
      }
    };

    playPulse();
    this.ringtoneInterval = setInterval(playPulse, 2400);
  }

  // Stop incoming/outgoing call ringtone immediately
  stopRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }

    // Immediately mute and disconnect all playing active gain nodes
    this.activeGainNodes.forEach((gain) => {
      try {
        if (this.ctx) {
          gain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        gain.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeGainNodes = [];

    // Immediately stop and disconnect all active oscillators
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeOscillators = [];
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) this.stopRingtone();
  }

  getMuted(): boolean {
    return this.isMuted;
  }
}

export const sounds = new SoundEffects();
