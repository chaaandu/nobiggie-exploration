/**
 * Synthesised sound, Web Audio only, no files. Off by default. Every sound is a few
 * milliseconds of shaped noise or a pitched blip, varied slightly each time so it never
 * sounds like a loop.
 */
export type SoundName = 'pop' | 'squelch' | 'crunch' | 'drip' | 'click' | 'tape';

type Ctx = AudioContext;

class Synth {
  enabled = false;
  private ctx: Ctx | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private recordTap: MediaStreamAudioDestinationNode | null = null;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.ensure();
  }

  /** A MediaStream of everything we play, for Record a dip. */
  stream(): MediaStream | null {
    const ctx = this.ensure();
    if (!ctx || !this.out) return null;
    if (!this.recordTap) {
      this.recordTap = ctx.createMediaStreamDestination();
      this.out.connect(this.recordTap);
    }
    return this.recordTap.stream;
  }

  private ensure(): Ctx | null {
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      const ctx = new C();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      const out = ctx.createGain();
      out.gain.value = 0.8;
      out.connect(comp);
      comp.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.out = out;
      this.noise = buf;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  play(name: SoundName) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.004;
    const v = 0.92 + Math.random() * 0.16; // pitch variation
    switch (name) {
      case 'pop':
        this.blip(t, 170 * v, 640 * v, 0.07, 0.5, 'sine');
        this.hiss(t, 0.06, 0.26, 'bandpass', 1900 * v, 1.1);
        break;
      case 'click':
        this.hiss(t, 0.018, 0.3, 'highpass', 2400, 0.7);
        this.blip(t, 1300 * v, 1100 * v, 0.025, 0.12, 'triangle');
        break;
      case 'squelch':
        this.sweep(t, 0.24, 0.2, 950 * v, 260 * v);
        this.blip(t + 0.02, 120 * v, 70 * v, 0.16, 0.12, 'sine');
        break;
      case 'drip':
        this.blip(t, 720 * v, 1700 * v, 0.07, 0.24, 'sine');
        break;
      case 'crunch': {
        for (let i = 0; i < 6; i++) {
          const at = t + Math.random() * 0.11;
          this.hiss(at, 0.012 + Math.random() * 0.02, 0.16 + Math.random() * 0.22, 'bandpass', 2300 + Math.random() * 2600, 0.8 + Math.random() * 1.4);
        }
        this.blip(t, 110, 70, 0.05, 0.16, 'sine');
        break;
      }
      case 'tape':
        for (let i = 0; i < 14; i++) this.hiss(t + i * 0.022 + Math.random() * 0.01, 0.018, 0.07 + Math.random() * 0.06, 'bandpass', 1300 + Math.random() * 900, 1.5);
        break;
    }
  }

  private env(t: number, dur: number, peak: number, attack = 0.004): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out!);
    return g;
  }

  private blip(t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    o.connect(this.env(t, dur * 1.6, peak));
    o.start(t);
    o.stop(t + dur * 1.7);
  }

  private hiss(t: number, dur: number, peak: number, type: BiquadFilterType, freq: number, q: number) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    f.connect(this.env(t, dur, peak, 0.002));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private sweep(t: number, dur: number, peak: number, f0: number, f1: number) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx!.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    src.connect(f);
    f.connect(this.env(t, dur, peak, 0.03));
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.05);
  }
}

export const sound = new Synth();
