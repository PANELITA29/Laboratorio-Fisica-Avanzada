/**
 * Procedural Audio Synthesizer using native Web Audio API.
 * Synthesizes 60Hz harmonic electrical hum, mechanical switch clicks,
 * component thermal burnout noise, and deep cosmic ambient drones without external MP3s.
 */

class ProceduralAudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private cosmicOsc1: OscillatorNode | null = null;
  private cosmicOsc2: OscillatorNode | null = null;
  private cosmicGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopCircuitHum();
      this.stopCosmicDrone();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Mechanical analog switch click (closing or opening SPST switch)
   */
  public playSwitchClick(closed: boolean): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(closed ? 950 : 620, now);
    osc.frequency.exponentialRampToValueAtTime(closed ? 280 : 180, now + 0.045);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * 60Hz + 120Hz harmonic electrical hum proportional to circuit current I
   */
  public updateCircuitHum(currentAmps: number): void {
    if (this.isMuted || currentAmps <= 0.01) {
      this.stopCircuitHum();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    const targetGain = Math.min(0.08, Math.log10(1 + currentAmps) * 0.04);

    if (!this.humOsc1 || !this.humGain) {
      this.humOsc1 = ctx.createOscillator();
      this.humOsc2 = ctx.createOscillator();
      this.humGain = ctx.createGain();

      this.humOsc1.type = 'sine';
      this.humOsc1.frequency.value = 60; // Fundamental 60Hz AC/ripple hum

      this.humOsc2.type = 'sawtooth';
      this.humOsc2.frequency.value = 120; // Second harmonic

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;

      this.humGain.gain.value = targetGain;

      this.humOsc1.connect(filter);
      this.humOsc2.connect(filter);
      filter.connect(this.humGain);
      this.humGain.connect(ctx.destination);

      this.humOsc1.start();
      this.humOsc2.start();
    } else {
      this.humGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
    }
  }

  public stopCircuitHum(): void {
    if (this.humOsc1) {
      try {
        this.humOsc1.stop();
        this.humOsc2?.stop();
        this.humOsc1.disconnect();
        this.humOsc2?.disconnect();
        this.humGain?.disconnect();
      } catch {}
      this.humOsc1 = null;
      this.humOsc2 = null;
      this.humGain = null;
    }
  }

  /**
   * Thermal burnout sizzle/pop when bulb exceeds rated wattage
   */
  public playBurnoutSound(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  /**
   * Soft low-frequency cosmic ambient drone for the 3D Space Lab
   */
  public startCosmicDrone(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.cosmicOsc1) return;

    this.cosmicOsc1 = ctx.createOscillator();
    this.cosmicOsc2 = ctx.createOscillator();
    this.cosmicGain = ctx.createGain();

    this.cosmicOsc1.type = 'sine';
    this.cosmicOsc1.frequency.value = 55; // A1 deep bass

    this.cosmicOsc2.type = 'sine';
    this.cosmicOsc2.frequency.value = 82.41; // E2 fifth harmonic

    this.cosmicGain.gain.value = 0.035;

    this.cosmicOsc1.connect(this.cosmicGain);
    this.cosmicOsc2.connect(this.cosmicGain);
    this.cosmicGain.connect(ctx.destination);

    this.cosmicOsc1.start();
    this.cosmicOsc2.start();
  }

  public stopCosmicDrone(): void {
    if (this.cosmicOsc1) {
      try {
        this.cosmicOsc1.stop();
        this.cosmicOsc2?.stop();
        this.cosmicOsc1.disconnect();
        this.cosmicOsc2?.disconnect();
        this.cosmicGain?.disconnect();
      } catch {}
      this.cosmicOsc1 = null;
      this.cosmicOsc2 = null;
      this.cosmicGain = null;
    }
  }

  /**
   * Success chime when an experimental challenge is validated
   */
  public playSuccessChime(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  /**
   * Alarma acústica intermitente cuando se detecta una falla de CORTOCIRCUITO (SHORT)
   */
  public playShortCircuitAlarm(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const freqs = [880, 440, 880];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.11;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.105);
    });
  }

  /**
   * Pitido agudo de continuidad del multímetro digital (2.4 kHz)
   */
  public playContinuityBeep(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  /**
   * Impacto gravitacional cuando dos cuerpos celestes colisionan
   */
  public playPlanetaryImpact(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Detonación cataclísmica de Supernova (onda de choque sub-grave + barrido de plasma)
   */
  public playSupernovaExplosion(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Sub-grave sísmico profundo
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 2.2);
    subGain.gain.setValueAtTime(0.42, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 2.35);

    // 2. Ráfaga de ruido de plasma relativista filtrado
    const bufferSize = Math.floor(ctx.sampleRate * 1.8);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.65));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 1.7);
    filter.Q.value = 1.2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.002, now + 1.8);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Chisporroteo eléctrico de alta frecuencia para sobrecarga térmica (P > P_max) en Circuitos DC
   */
  public playSparkCrackle(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const burst = Math.random() > 0.72 ? (Math.random() * 2 - 1) : 0;
      data[i] = burst * Math.exp(-i / (ctx.sampleRate * 0.05));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1850, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.13);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Inyección gravitacional al crear un nuevo planeta con clic en el lienzo 3D
   */
  public playPlanetSpawnWhoosh(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  /**
   * Impulso sísmico / mecánico para el laboratorio de Osciladores RK4
   */
  public playSeismicPulseSound(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.32);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Efervescencia / burbujeo químico para desprendimiento de gas (H2, O2) en el Reactor 3D
   */
  public playChemicalBubbling(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bubbleFreqs = [340, 480, 620, 790];
    bubbleFreqs.forEach((baseFreq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + i * 0.045;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t0);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, t0 + 0.055);
      gain.gain.setValueAtTime(0.09, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.065);
    });
  }

  /**
   * Detonación química y fractura de vidrio borosilicato 3D en el Reactor Químico
   */
  public playGlassShatterExplosion(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Onda de choque exotérmica grave
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sawtooth';
    boomOsc.frequency.setValueAtTime(165, now);
    boomOsc.frequency.exponentialRampToValueAtTime(28, now + 0.85);
    boomGain.gain.setValueAtTime(0.38, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(now);
    boomOsc.stop(now + 0.92);

    // 2. Fragmentos cristalinos de alta frecuencia (cristal borosilicato rompiéndose)
    const shardFreqs = [2650, 3420, 4180, 3110, 4890];
    shardFreqs.forEach((freq, idx) => {
      const shardOsc = ctx.createOscillator();
      const shardGain = ctx.createGain();
      const tStart = now + 0.04 + idx * 0.055;
      shardOsc.type = 'triangle';
      shardOsc.frequency.setValueAtTime(freq, tStart);
      shardOsc.frequency.exponentialRampToValueAtTime(freq * 0.72, tStart + 0.12);
      shardGain.gain.setValueAtTime(0.14, tStart);
      shardGain.gain.exponentialRampToValueAtTime(0.001, tStart + 0.13);
      shardOsc.connect(shardGain);
      shardGain.connect(ctx.destination);
      shardOsc.start(tStart);
      shardOsc.stop(tStart + 0.14);
    });
  }
}

export const audioSynth = new ProceduralAudioSynth();


