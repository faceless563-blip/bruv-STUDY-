export type AmbientSoundType = 'off' | 'rain' | 'brown' | 'library';

class StudySoundEngine {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private currentType: AmbientSoundType = 'off';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public startAmbient(type: AmbientSoundType, volume: number = 0.14): void {
    this.stopAmbient();
    this.currentType = type;
    if (type === 'off') return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.2;
      } else if (type === 'rain') {
        lastOut = (lastOut + 0.05 * white) / 1.05;
        data[i] = (lastOut * 1.8 + white * 0.25) * 0.8;
      } else {
        // library: gentle warm room tone
        lastOut = (lastOut + 0.015 * white) / 1.015;
        data[i] = lastOut * 1.4;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = type === 'rain' ? 1800 : type === 'brown' ? 420 : 650;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.noiseNode = source;
    this.gainNode = gain;
  }

  public stopAmbient(): void {
    if (this.noiseNode && 'stop' in this.noiseNode) {
      try {
        (this.noiseNode as AudioBufferSourceNode).stop();
      } catch {
        // ignore if already stopped
      }
    }
    this.noiseNode = null;
    this.gainNode = null;
    this.currentType = 'off';
  }

  public getCurrentType(): AmbientSoundType {
    return this.currentType;
  }

  public playChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }
}

export const soundEngine = new StudySoundEngine();
