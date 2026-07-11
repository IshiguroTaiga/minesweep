// Hybrid Audio Engine for Minesweeper
// Supports playing custom static files (bgm.mp3, victory.mp3, click.mp3, flag.mp3, explode.mp3)
// and falls back to Web Audio API procedural synthesis if files are missing or fail to load.

class AudioEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  private bgmVolVal: number = 0.15;
  private sfxVolVal: number = 0.3;
  private bgmOn: boolean = true;
  private sfxOn: boolean = true;
  
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private currentStep: number = 0;
  private isBgmPlaying: boolean = false;
  
  // Static file audio controls
  private bgmAudio: HTMLAudioElement | null = null;
  private isBgmFileFallbackActive: boolean = false;
  
  constructor() {
    if (typeof window !== "undefined") {
      // Load saved preferences from localStorage
      this.bgmVolVal = parseFloat(localStorage.getItem("ms_bgm_volume") ?? "0.12");
      this.sfxVolVal = parseFloat(localStorage.getItem("ms_sfx_volume") ?? "0.3");
      this.bgmOn = (localStorage.getItem("ms_bgm_enabled") ?? "true") === "true";
      this.sfxOn = (localStorage.getItem("ms_sfx_enabled") ?? "true") === "true";
    }
  }

  // Initialize Audio Context lazily on user gesture
  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      
      this.ctx = new AudioCtx();
      
      // BGM Gain Node (used for procedural fallback)
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmOn ? this.bgmVolVal : 0, this.ctx.currentTime);
      this.bgmGain.connect(this.ctx.destination);
      
      // SFX Gain Node (used for procedural fallback)
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxOn ? this.sfxVolVal : 0, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);
    } catch (e) {
      console.error("Failed to initialize Web Audio API:", e);
    }
  }

  private async ensureResume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  // --- VOLUME & TOGGLE CONTROLS ---

  public getBgmVolume(): number {
    return this.bgmVolVal;
  }

  public setBgmVolume(volume: number) {
    this.bgmVolVal = Math.max(0, Math.min(1, volume));
    if (typeof window !== "undefined") {
      localStorage.setItem("ms_bgm_volume", this.bgmVolVal.toString());
    }
    
    // Update static audio element volume
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.bgmVolVal;
    }
    
    // Update Web Audio API node volume
    if (this.bgmGain && this.ctx && this.bgmOn) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVolVal, this.ctx.currentTime, 0.05);
    }
  }

  public isBgmEnabled(): boolean {
    return this.bgmOn;
  }

  public setBgmEnabled(enabled: boolean) {
    this.bgmOn = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("ms_bgm_enabled", enabled ? "true" : "false");
    }
    
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(enabled ? this.bgmVolVal : 0, this.ctx.currentTime, 0.05);
    }
    
    if (enabled && !this.isBgmPlaying) {
      this.startBgm();
    } else if (!enabled && this.isBgmPlaying) {
      this.stopBgm();
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolVal;
  }

  public setSfxVolume(volume: number) {
    this.sfxVolVal = Math.max(0, Math.min(1, volume));
    if (typeof window !== "undefined") {
      localStorage.setItem("ms_sfx_volume", this.sfxVolVal.toString());
    }
    if (this.sfxGain && this.ctx && this.sfxOn) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolVal, this.ctx.currentTime, 0.05);
    }
  }

  public isSfxEnabled(): boolean {
    return this.sfxOn;
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxOn = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("ms_sfx_enabled", enabled ? "true" : "false");
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(enabled ? this.sfxVolVal : 0, this.ctx.currentTime, 0.05);
    }
  }

  // --- HYBRID SFX PLAYER ---
  
  private async playSfxFileOrFallback(fileUrl: string, fallbackFn: () => void) {
    await this.ensureResume();
    if (!this.sfxOn) return;

    const audio = new Audio(fileUrl);
    audio.volume = this.sfxVolVal;
    
    // Catch fetch/loading errors (e.g. 404 file not found)
    audio.addEventListener("error", () => {
      fallbackFn();
    });

    try {
      await audio.play();
    } catch {
      // Fallback if play was blocked or file does not exist
      fallbackFn();
    }
  }

  // --- PLAY SYNTHESIS HELPERS ---

  private playSynthNote(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.05,
    attack: number = 0.05,
    release: number = 0.8
  ) {
    if (!this.ctx || !this.bgmGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.setValueAtTime(volume, startTime + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
  }

  // --- BACKGROUND MUSIC (BGM) ---

  public async startBgm() {
    await this.ensureResume();
    if (!this.bgmOn || this.isBgmPlaying) return;
    this.isBgmPlaying = true;

    // Try playing static custom file first
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio("/audio/bgm.mp3");
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.bgmVolVal;
      
      this.bgmAudio.addEventListener("error", () => {
        console.warn("BGM static file not found, falling back to procedural synth.");
        this.isBgmFileFallbackActive = true;
        if (this.isBgmPlaying) {
          this.startProceduralBgm();
        }
      });
    }

    if (!this.isBgmFileFallbackActive) {
      this.bgmAudio.volume = this.bgmVolVal;
      this.bgmAudio.play().catch((e) => {
        console.warn("Static BGM play blocked/failed, trying procedural synth:", e);
        this.isBgmFileFallbackActive = true;
        this.startProceduralBgm();
      });
    } else {
      this.startProceduralBgm();
    }
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    
    // Pause custom static BGM
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }

    // Stop procedural BGM
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private startProceduralBgm() {
    if (!this.isBgmPlaying || !this.ctx) return;

    // Chord Progression Data (ambient frequencies)
    // 0: Cmaj9, 1: Am9, 2: Fmaj9, 3: G9
    const chords = [
      {
        bass: 65.41, // C2
        notes: [130.81, 164.81, 196.00, 246.94, 293.66, 392.00], // C3, E3, G3, B3, D4, G4
      },
      {
        bass: 55.00, // A1
        notes: [110.00, 130.81, 164.81, 196.00, 246.94, 329.63], // A2, C3, E3, G3, B3, E4
      },
      {
        bass: 43.65, // F1
        notes: [87.31, 110.00, 130.81, 164.81, 196.00, 261.63], // F2, A2, C3, E3, G3, C4
      },
      {
        bass: 49.00, // G1
        notes: [98.00, 123.47, 146.83, 174.61, 220.00, 293.66], // G2, B2, D3, F3, A3, D4
      },
    ];

    const tempo = 0.5; // Seconds per beat (120 BPM)
    this.currentStep = 0;

    const scheduleNextBeat = () => {
      if (!this.ctx || !this.isBgmPlaying) return;

      const time = this.ctx.currentTime;
      const beatIndex = this.currentStep % 8; // 8 beats per chord
      const chordIndex = Math.floor(this.currentStep / 8) % chords.length;
      const chord = chords[chordIndex];

      // Bass note on beats 0 and 4
      if (beatIndex === 0 || beatIndex === 4) {
        this.playSynthNote(chord.bass, time, tempo * 3.5, "triangle", 0.03, 0.2, tempo * 1.5);
      }

      // Arpeggiated melody line (soft, ambient)
      let noteFreq = 0;
      switch (beatIndex) {
        case 1: noteFreq = chord.notes[0]; break;
        case 2: noteFreq = chord.notes[2]; break;
        case 3: noteFreq = chord.notes[1]; break;
        case 5: noteFreq = chord.notes[3]; break;
        case 6: noteFreq = chord.notes[4]; break;
        case 7: noteFreq = chord.notes[5]; break;
      }

      if (noteFreq > 0) {
        this.playSynthNote(noteFreq, time, tempo * 2.2, "sine", 0.015, 0.1, tempo * 1.0);
      }

      this.currentStep++;
    };

    // Run first step immediately
    scheduleNextBeat();
    
    // Interval runs at 500ms intervals to schedule notes
    this.musicInterval = setInterval(scheduleNextBeat, tempo * 1000);
  }

  // --- SOUND EFFECTS (SFX) ---

  // Cell clicks
  public async playClick() {
    this.playSfxFileOrFallback("/audio/click.mp3", () => this.playProceduralClick());
  }

  private playProceduralClick() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.03);

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  // Flag placements
  public async playFlag() {
    this.playSfxFileOrFallback("/audio/flag.mp3", () => this.playProceduralFlag());
  }

  private playProceduralFlag() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    
    // Low pop
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(300, time);
    osc1.frequency.exponentialRampToValueAtTime(450, time + 0.08);
    gain1.gain.setValueAtTime(0.06, time);
    gain1.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(time);
    osc1.stop(time + 0.09);

    // Chime echo 50ms later
    setTimeout(() => {
      if (!this.ctx || !this.sfxGain) return;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.06);
      gain2.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.06);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(this.ctx.currentTime);
      osc2.stop(this.ctx.currentTime + 0.07);
    }, 50);
  }

  // Mine explosions (Lose game)
  public async playExplode() {
    this.playSfxFileOrFallback("/audio/explode.mp3", () => this.playProceduralExplode());
  }

  private playProceduralExplode() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;

    // 1. Noise Generator (for the crunch/blast)
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5s duration
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(600, time);
    noiseFilter.frequency.exponentialRampToValueAtTime(30, time + 1.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    // 2. Sub-bass Oscillator (for the heavy room-shaking rumble)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    
    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(80, time);
    subOsc.frequency.linearRampToValueAtTime(30, time + 0.8);

    const subFilter = this.ctx.createBiquadFilter();
    subFilter.type = "lowpass";
    subFilter.frequency.setValueAtTime(100, time);

    subGain.gain.setValueAtTime(0.25, time);
    subGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.9);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.sfxGain);

    // Start everything
    noiseNode.start(time);
    subOsc.start(time);

    noiseNode.stop(time + 1.5);
    subOsc.stop(time + 1.0);
  }

  // Completing the game (Win game)
  public async playWin() {
    this.playSfxFileOrFallback("/audio/victory.mp3", () => this.playProceduralWin());
  }

  private playProceduralWin() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    
    // Victory theme notes (C4, E4, G4, C5, E5, G5, C6)
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const delays = [0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.48];

    // Play each note in the ascending arpeggio
    notes.forEach((freq, idx) => {
      const noteTime = time + delays[idx];
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.08, noteTime + 0.02);
      gain.gain.setValueAtTime(0.08, noteTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.6);
    });

    // Sustained major chord at the end (delay 0.6)
    setTimeout(() => {
      if (!this.ctx || !this.sfxGain) return;
      const chordNotes = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5 (Cmaj7)
      const chordTime = this.ctx.currentTime;

      chordNotes.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, chordTime);

        gain.gain.setValueAtTime(0, chordTime);
        gain.gain.linearRampToValueAtTime(0.04, chordTime + 0.1);
        gain.gain.setValueAtTime(0.04, chordTime + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 2.0);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(chordTime);
        osc.stop(chordTime + 2.2);
      });
    }, 600);
  }

  // --- SOUNDBOARD EFFECTS ---

  public async playLaser() {
    this.playSfxFileOrFallback("/audio/soundboard_laser.mp3", () => this.playProceduralLaser());
  }

  private playProceduralLaser() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1000, time);
    osc.frequency.linearRampToValueAtTime(100, time + 0.2);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.22);
  }

  public async playCoin() {
    this.playSfxFileOrFallback("/audio/soundboard_coin.mp3", () => this.playProceduralCoin());
  }

  private playProceduralCoin() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    
    osc1.type = "square";
    osc1.frequency.setValueAtTime(987.77, time); // B5
    gain1.gain.setValueAtTime(0.05, time);
    gain1.gain.setValueAtTime(0.05, time + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.0001, time + 0.08 + 0.02);
    
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(time);
    osc1.stop(time + 0.1);

    setTimeout(() => {
      if (!this.ctx || !this.sfxGain) return;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(1318.51, this.ctx.currentTime); // E6
      gain2.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain2.gain.setValueAtTime(0.05, this.ctx.currentTime + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);
      
      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(this.ctx.currentTime);
      osc2.stop(this.ctx.currentTime + 0.26);
    }, 80);
  }

  public async playAirhorn() {
    this.playSfxFileOrFallback("/audio/soundboard_airhorn.mp3", () => this.playProceduralAirhorn());
  }

  private playProceduralAirhorn() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    
    const freqs = [320, 323, 325, 317];
    freqs.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(600, time);
      filter.Q.setValueAtTime(1.5, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.06, time + 0.05);
      gain.gain.setValueAtTime(0.06, time + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(time);
      osc.stop(time + 0.5);
    });
  }

  public async playAlert() {
    this.playSfxFileOrFallback("/audio/soundboard_alert.mp3", () => this.playProceduralAlert());
  }

  private playProceduralAlert() {
    if (!this.ctx || !this.sfxGain) return;
    const time = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(550, time);
    
    osc.frequency.linearRampToValueAtTime(880, time + 0.2);
    osc.frequency.linearRampToValueAtTime(550, time + 0.4);
    osc.frequency.linearRampToValueAtTime(880, time + 0.6);
    osc.frequency.linearRampToValueAtTime(550, time + 0.8);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.05);
    gain.gain.setValueAtTime(0.08, time + 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.9);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 1.0);
  }
}

// Export as a singleton instance
export const audioEngine = new AudioEngine();
export default audioEngine;
