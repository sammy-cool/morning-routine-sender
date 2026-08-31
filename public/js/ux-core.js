/* global module */
/**
 * Morning Routine Sender - UX Core & Haptic Engine
 * File: public/js/ux-core.js
 * Version: 1.0.0
 *
 * Provides a unified client-side UX subsystem containing:
 * 1. SWR (Stale-While-Revalidate) Cache Engine
 * 2. Mobile Haptic Feedback Engine (Vibration API with resilient guards)
 * 3. Procedural Web Audio Synthesis Engine (Zero external MP3/WAV files)
 * 4. Accessible Keyboard Shortcuts Dispatcher ('c', 'j', 'h', 's', '?', 'Escape')
 * 5. Real-Time Network Status Monitor with Floating Glassmorphic Offline Banner
 */

(function (global) {
  "use strict";

  // =========================================================================
  // 1. SWR (STALE-WHILE-REVALIDATE) CACHE ENGINE WITH LRU EVICTION
  // =========================================================================
  const SWR_STORAGE_PREFIX = "mrn_swr_cache_";
  const MAX_MEMORY_CACHE_SIZE = 100;
  const memoryCache = new Map();

  /**
   * Safe localStorage getItem helper.
   * @param {string} key
   * @returns {string|null}
   */
  function safeStorageGet(key) {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(key);
      }
    } catch (_e) {
      /* LocalStorage disabled or in private mode */
    }
    return null;
  }

  /**
   * Safe localStorage setItem helper.
   * @param {string} key
   * @param {string} val
   */
  function safeStorageSet(key, val) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, val);
      }
    } catch (_e) {
      /* Quota exceeded or storage unavailable */
    }
  }

  /**
   * Safe localStorage removeItem helper.
   * @param {string} key
   */
  function safeStorageRemove(key) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch (_e) {
      /* Non-fatal */
    }
  }

  const cache = {
    /**
     * Retrieve a cached entry by key and assess staleness against maxAgeMs.
     * @param {string} key - Cache identifier
     * @param {number} [maxAgeMs=60000] - Staleness threshold in milliseconds (default: 60s)
     * @returns {{ data: any, isStale: boolean, timestamp: number, age: number } | null}
     */
    get(key, maxAgeMs = 60000) {
      if (!key) return null;

      let entry = memoryCache.get(key);

      if (entry) {
        // Refresh LRU order on access
        memoryCache.delete(key);
        memoryCache.set(key, entry);
      } else {
        const stored = safeStorageGet(SWR_STORAGE_PREFIX + key);
        if (stored) {
          try {
            entry = JSON.parse(stored);
            if (entry && typeof entry.timestamp === "number") {
              this.set(key, entry.data, entry.timestamp);
            } else {
              entry = null;
            }
          } catch (_err) {
            safeStorageRemove(SWR_STORAGE_PREFIX + key);
            entry = null;
          }
        }
      }

      if (!entry) return null;

      const now = Date.now();
      const age = Math.max(0, now - entry.timestamp);
      const isStale = typeof maxAgeMs === "number" ? age > maxAgeMs : false;

      return {
        data: entry.data,
        isStale,
        timestamp: entry.timestamp,
        age,
      };
    },

    /**
     * Store data in both in-memory Map and localStorage with current timestamp.
     * @param {string} key - Cache identifier
     * @param {any} data - Data payload to cache
     * @param {number} [explicitTimestamp] - Optional timestamp for restoration
     * @returns {{ data: any, timestamp: number }}
     */
    set(key, data, explicitTimestamp) {
      if (!key) return null;

      // LRU eviction if capacity exceeded
      if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE && !memoryCache.has(key)) {
        const oldestKey = memoryCache.keys().next().value;
        if (oldestKey) memoryCache.delete(oldestKey);
      } else if (memoryCache.has(key)) {
        memoryCache.delete(key);
      }

      const entry = {
        data,
        timestamp: explicitTimestamp || Date.now(),
      };

      memoryCache.set(key, entry);
      safeStorageSet(SWR_STORAGE_PREFIX + key, JSON.stringify(entry));

      return entry;
    },

    /**
     * Invalidate and remove a cached item or all cached items.
     * @param {string} [key] - Specific key to invalidate. If omitted, clears all SWR keys.
     */
    invalidate(key) {
      if (key) {
        memoryCache.delete(key);
        safeStorageRemove(SWR_STORAGE_PREFIX + key);
      } else {
        memoryCache.clear();
        try {
          if (typeof localStorage !== "undefined") {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith(SWR_STORAGE_PREFIX)) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          }
        } catch (_e) {
          // Ignore storage errors
        }
      }
    },

    /**
     * Check if a key exists in cache.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
      return this.get(key) !== null;
    },

    /**
     * Clear entire cache.
     */
    clear() {
      this.invalidate();
    },
  };

  // =========================================================================
  // 2. MOBILE HAPTIC FEEDBACK ENGINE
  // =========================================================================
  const haptics = {
    /**
     * Verify if the Vibration API is supported and accessible.
     * @returns {boolean}
     */
    isSupported() {
      return (
        typeof navigator !== "undefined" &&
        "vibrate" in navigator &&
        typeof navigator.vibrate === "function"
      );
    },

    /**
     * Trigger vibration pattern with fail-safe error handling.
     * @param {number|number[]} pattern - Millisecond vibration pattern
     * @returns {boolean}
     */
    vibrate(pattern) {
      if (!this.isSupported()) return false;
      try {
        return Boolean(navigator.vibrate(pattern));
      } catch (_err) {
        return false;
      }
    },

    /**
     * Light haptic tap for subtle interactive feedback (15ms).
     * @returns {boolean}
     */
    light() {
      return this.vibrate(15);
    },

    /**
     * Success double-pulse pattern [20ms pulse, 40ms pause, 20ms pulse].
     * @returns {boolean}
     */
    success() {
      return this.vibrate([20, 40, 20]);
    },

    /**
     * Celebration milestone rhythm [30ms, 50ms, 30ms, 50ms, 80ms].
     * @returns {boolean}
     */
    celebration() {
      return this.vibrate([30, 50, 30, 50, 80]);
    },
  };

  // =========================================================================
  // 3. PROCEDURAL WEB AUDIO SYNTHESIS ENGINE
  // =========================================================================
  const SOUND_STORAGE_KEY = "mrn_ux_sound_muted";
  let sharedAudioCtx = null;

  /**
   * Lazily initialize or retrieve the shared AudioContext instance.
   * Handles browser autoplay suspension state seamlessly.
   * @returns {AudioContext|null}
   */
  function getAudioContext() {
    if (typeof window === "undefined") return null;

    const AudioCtxClass =
      window.AudioContext ||
      window.webkitAudioContext ||
      (typeof globalThis !== "undefined" ? globalThis.AudioContext : null);

    if (!AudioCtxClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      try {
        sharedAudioCtx = new AudioCtxClass();
      } catch (_e) {
        return null;
      }
    }

    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  }

  /**
   * Synthesize a single tone with an attack/exponential decay envelope.
   * @param {AudioContext} ctx
   * @param {number} freq - Frequency in Hz
   * @param {number} startTime - AudioContext relative start timestamp
   * @param {number} duration - Note duration in seconds
   * @param {number} [peakGain=0.18] - Peak volume amplitude
   * @param {OscillatorType} [type='sine'] - Waveform type
   */
  function synthesizeTone(ctx, freq, startTime, duration, peakGain = 0.18, type = "sine") {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Volume Envelope: Quick attack to avoid clicking, exponential decay to zero
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_e) {
          // Cleanup
        }
      };
    } catch (_e) {
      // Audio playback fails gracefully
    }
  }

  const sound = {
    /**
     * Check if audio feedback is currently muted.
     * @returns {boolean}
     */
    isMuted() {
      const val = safeStorageGet(SOUND_STORAGE_KEY);
      return val === "true";
    },

    /**
     * Toggle or set the mute state with localStorage persistence.
     * @param {boolean} [isMuted] - Optional explicit boolean value
     * @returns {boolean} Current muted state
     */
    toggleMute(isMuted) {
      const nextState = typeof isMuted === "boolean" ? isMuted : !this.isMuted();
      safeStorageSet(SOUND_STORAGE_KEY, String(nextState));
      return nextState;
    },

    /**
     * Subtle tactile click tone (800 Hz triangle wave, 30ms):
     * @returns {boolean}
     */
    playClick() {
      if (this.isMuted()) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;
      synthesizeTone(ctx, 800, ctx.currentTime, 0.03, 0.08, "triangle");
      return true;
    },

    /**
     * Procedural pleasant rising chime:
     * C5 (523.25 Hz) -> E5 (659.25 Hz) -> G5 (783.99 Hz)
     * @returns {boolean}
     */
    playSuccess() {
      if (this.isMuted()) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;

      const now = ctx.currentTime;
      const noteDuration = 0.14;

      // Harmonic rising triad (C Major)
      synthesizeTone(ctx, 523.25, now, noteDuration, 0.16, "sine");
      synthesizeTone(ctx, 659.25, now + 0.08, noteDuration, 0.18, "sine");
      synthesizeTone(ctx, 783.99, now + 0.16, noteDuration * 1.6, 0.2, "sine");

      return true;
    },

    /**
     * Procedural celebratory milestone shimmer chime:
     * Harmonic arpeggio across key frequencies:
     * C5 (523.25 Hz) -> G5 (783.99 Hz) -> C6 (1046.50 Hz) -> E6 (1318.51 Hz)
     * @returns {boolean}
     */
    playMilestone() {
      if (this.isMuted()) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;

      const now = ctx.currentTime;

      const notes = [
        { freq: 523.25, offset: 0.0, dur: 0.22, gain: 0.14, type: "sine" },
        { freq: 659.25, offset: 0.06, dur: 0.22, gain: 0.15, type: "triangle" },
        { freq: 783.99, offset: 0.12, dur: 0.26, gain: 0.17, type: "sine" },
        { freq: 1046.5, offset: 0.18, dur: 0.32, gain: 0.19, type: "sine" },
        { freq: 1318.51, offset: 0.24, dur: 0.45, gain: 0.22, type: "triangle" },
      ];

      notes.forEach((n) => {
        synthesizeTone(ctx, n.freq, now + n.offset, n.dur, n.gain, n.type);
      });

      return true;
    },
  };

  // =========================================================================
  // 4. PROCEDURAL WEB AUDIO AMBIENT SOUNDSCAPES ENGINE
  // =========================================================================
  let ambientMasterGain = null;
  let ambientCurrentMode = null;
  let ambientActiveNodes = [];
  let ambientIntervalTimers = [];
  let ambientVolume = 0.5;

  function createPinkNoiseBuffer(ctx, duration = 4.0) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.07;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  const ambient = {
    SUPPORTED_MODES: ["binaural", "rain", "zen-waves"],

    isSupported() {
      return (
        typeof window !== "undefined" &&
        Boolean(
          window.AudioContext ||
          window.webkitAudioContext ||
          (typeof globalThis !== "undefined" && globalThis.AudioContext),
        )
      );
    },

    play(mode, volume) {
      if (!this.isSupported()) return false;
      if (!this.SUPPORTED_MODES.includes(mode)) return false;

      const ctx = getAudioContext();
      if (!ctx) return false;

      if (typeof volume === "number") {
        ambientVolume = Math.max(0, Math.min(1, volume));
      }

      this.stop(0.3);
      ambientCurrentMode = mode;

      ambientMasterGain = ctx.createGain();
      ambientMasterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      ambientMasterGain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, ambientVolume),
        ctx.currentTime + 0.8,
      );
      ambientMasterGain.connect(ctx.destination);

      try {
        if (mode === "binaural") {
          this._startBinaural(ctx, ambientMasterGain);
        } else if (mode === "rain") {
          this._startRain(ctx, ambientMasterGain);
        } else if (mode === "zen-waves") {
          this._startZenWaves(ctx, ambientMasterGain);
        }
        return true;
      } catch (_err) {
        this.stop(0);
        return false;
      }
    },

    _startBinaural(ctx, destinationGain) {
      const now = ctx.currentTime;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(320, now);
      filter.Q.setValueAtTime(1.0, now);
      filter.connect(destinationGain);
      ambientActiveNodes.push(filter);

      const oscLeft = ctx.createOscillator();
      const gainLeft = ctx.createGain();
      oscLeft.type = "sine";
      oscLeft.frequency.setValueAtTime(200, now);
      gainLeft.gain.setValueAtTime(0.18, now);

      const oscRight = ctx.createOscillator();
      const gainRight = ctx.createGain();
      oscRight.type = "sine";
      oscRight.frequency.setValueAtTime(210, now);
      gainRight.gain.setValueAtTime(0.18, now);

      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(100, now);
      gainSub.gain.setValueAtTime(0.06, now);

      if (typeof ctx.createStereoPanner === "function") {
        const panLeft = ctx.createStereoPanner();
        panLeft.pan.setValueAtTime(-0.85, now);
        oscLeft.connect(gainLeft);
        gainLeft.connect(panLeft);
        panLeft.connect(filter);

        const panRight = ctx.createStereoPanner();
        panRight.pan.setValueAtTime(0.85, now);
        oscRight.connect(gainRight);
        gainRight.connect(panRight);
        panRight.connect(filter);
        ambientActiveNodes.push(panLeft, panRight);
      } else {
        oscLeft.connect(gainLeft);
        gainLeft.connect(filter);
        oscRight.connect(gainRight);
        gainRight.connect(filter);
      }

      oscSub.connect(gainSub);
      gainSub.connect(filter);

      oscLeft.start(now);
      oscRight.start(now);
      oscSub.start(now);

      ambientActiveNodes.push(oscLeft, gainLeft, oscRight, gainRight, oscSub, gainSub);
    },

    _startRain(ctx, destinationGain) {
      const now = ctx.currentTime;
      const noiseBuffer = createPinkNoiseBuffer(ctx, 4.0);

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = "bandpass";
      rainFilter.frequency.setValueAtTime(950, now);
      rainFilter.Q.setValueAtTime(0.7, now);

      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.28, now);

      noiseSource.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(destinationGain);

      noiseSource.start(now);
      ambientActiveNodes.push(noiseSource, rainFilter, rainGain);

      const dropletTimer = setInterval(() => {
        if (!ambientCurrentMode || ambientCurrentMode !== "rain") return;
        try {
          const t = ctx.currentTime;
          const dropOsc = ctx.createOscillator();
          const dropGain = ctx.createGain();
          const dropFilter = ctx.createBiquadFilter();

          const freq = 1200 + Math.random() * 1400;
          dropOsc.type = "sine";
          dropOsc.frequency.setValueAtTime(freq, t);
          dropOsc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.06);

          dropFilter.type = "bandpass";
          dropFilter.frequency.setValueAtTime(freq, t);
          dropFilter.Q.setValueAtTime(4.0, t);

          const dropVolume = 0.02 + Math.random() * 0.04;
          dropGain.gain.setValueAtTime(0.0001, t);
          dropGain.gain.linearRampToValueAtTime(dropVolume, t + 0.005);
          dropGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

          dropOsc.connect(dropFilter);
          dropFilter.connect(dropGain);
          dropGain.connect(destinationGain);

          dropOsc.start(t);
          dropOsc.stop(t + 0.065);

          dropOsc.onended = () => {
            try {
              dropOsc.disconnect();
              dropFilter.disconnect();
              dropGain.disconnect();
            } catch (_e) {
              /* Non-fatal cleanup */
            }
          };
        } catch (_e) {
          /* Droplet synth error */
        }
      }, 120);

      ambientIntervalTimers.push(dropletTimer);
    },

    _startZenWaves(ctx, destinationGain) {
      const now = ctx.currentTime;
      const noiseBuffer = createPinkNoiseBuffer(ctx, 5.0);

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = "lowpass";
      waveFilter.frequency.setValueAtTime(250, now);
      waveFilter.Q.setValueAtTime(2.0, now);

      const waveGain = ctx.createGain();
      waveGain.gain.setValueAtTime(0.25, now);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.09, now);

      const lfoFilterGain = ctx.createGain();
      lfoFilterGain.gain.setValueAtTime(260, now);

      const lfoAmpGain = ctx.createGain();
      lfoAmpGain.gain.setValueAtTime(0.12, now);

      lfo.connect(lfoFilterGain);
      lfoFilterGain.connect(waveFilter.frequency);

      lfo.connect(lfoAmpGain);
      lfoAmpGain.connect(waveGain.gain);

      noiseSource.connect(waveFilter);
      waveFilter.connect(waveGain);
      waveGain.connect(destinationGain);

      noiseSource.start(now);
      lfo.start(now);

      ambientActiveNodes.push(noiseSource, waveFilter, waveGain, lfo, lfoFilterGain, lfoAmpGain);
    },

    stop(fadeDuration = 0.8) {
      ambientIntervalTimers.forEach((timer) => clearInterval(timer));
      ambientIntervalTimers = [];

      const prevMaster = ambientMasterGain;
      const nodesToCleanup = [...ambientActiveNodes];
      ambientActiveNodes = [];
      ambientCurrentMode = null;
      ambientMasterGain = null;

      const executeCleanup = () => {
        try {
          nodesToCleanup.forEach((node) => {
            if (typeof node.stop === "function") {
              try {
                node.stop();
              } catch (_e) {
                /* Non-fatal */
              }
            }
            if (typeof node.disconnect === "function") {
              try {
                node.disconnect();
              } catch (_e) {
                /* Non-fatal */
              }
            }
          });
          if (prevMaster && typeof prevMaster.disconnect === "function") {
            try {
              prevMaster.disconnect();
            } catch (_e) {
              /* Non-fatal */
            }
          }
        } catch (_e) {
          /* Non-fatal cleanup */
        }
      };

      if (
        fadeDuration <= 0 ||
        !prevMaster ||
        !sharedAudioCtx ||
        sharedAudioCtx.state !== "running"
      ) {
        executeCleanup();
        return;
      }

      try {
        const now = sharedAudioCtx.currentTime;
        prevMaster.gain.cancelScheduledValues(now);
        prevMaster.gain.setValueAtTime(prevMaster.gain.value, now);
        prevMaster.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
        setTimeout(executeCleanup, fadeDuration * 1000 + 50);
      } catch (_e) {
        executeCleanup();
      }
    },

    setVolume(vol, rampTime = 0.1) {
      ambientVolume = Math.max(0, Math.min(1, Number(vol) || 0));
      if (ambientMasterGain && sharedAudioCtx) {
        try {
          const now = sharedAudioCtx.currentTime;
          ambientMasterGain.gain.cancelScheduledValues(now);
          ambientMasterGain.gain.setValueAtTime(ambientMasterGain.gain.value, now);
          ambientMasterGain.gain.linearRampToValueAtTime(
            Math.max(0.0001, ambientVolume),
            now + rampTime,
          );
        } catch (_e) {
          /* Non-fatal volume adjust */
        }
      }
    },

    getCurrentMode() {
      return ambientCurrentMode;
    },

    isPlaying() {
      return ambientCurrentMode !== null;
    },
  };

  // =========================================================================
  // 5. NATIVE SPEECH SYNTHESIS VOICE BRIEFING ENGINE
  // =========================================================================
  let voiceSpeechRate = 1.0;
  let voicePitch = 1.0;
  let voicePreferredName = null;
  let voiceVisualizerHook = null;
  let voiceVisualizerRaf = null;
  let voiceIsSpeaking = false;
  let voiceAvailableVoices = [];

  const PREFERRED_VOICE_NAMES = [
    "Google US English",
    "Samantha",
    "Daniel",
    "Karen",
    "Moira",
    "Alex",
  ];

  function loadSpeechVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    try {
      voiceAvailableVoices = window.speechSynthesis.getVoices() || [];
      return voiceAvailableVoices;
    } catch (_e) {
      return [];
    }
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
      window.speechSynthesis.onvoiceschanged = () => loadSpeechVoices();
    }
    loadSpeechVoices();
  }

  function resolveBestVoice(preferredName) {
    const voices = voiceAvailableVoices.length > 0 ? voiceAvailableVoices : loadSpeechVoices();
    if (!voices || voices.length === 0) return null;

    if (preferredName) {
      const explicit = voices.find(
        (v) => v.name && v.name.toLowerCase().includes(preferredName.toLowerCase()),
      );
      if (explicit) return explicit;
    }

    for (const name of PREFERRED_VOICE_NAMES) {
      const match = voices.find((v) => v.name && v.name.includes(name));
      if (match) return match;
    }

    const enUs = voices.find((v) => v.lang === "en-US" || v.lang === "en_US");
    if (enUs) return enUs;

    const enGb = voices.find((v) => v.lang === "en-GB" || v.lang === "en_GB");
    if (enGb) return enGb;

    const anyEn = voices.find((v) => v.lang && v.lang.startsWith("en"));
    if (anyEn) return anyEn;

    return voices[0] || null;
  }

  let activeUtterance = null;

  function startVisualizerLoop() {
    if (!voiceVisualizerHook) return;
    if (voiceVisualizerRaf) {
      cancelAnimationFrame(voiceVisualizerRaf);
      voiceVisualizerRaf = null;
    }

    let phase = 0;
    const updateBars = () => {
      if (!voiceIsSpeaking) {
        if (voiceVisualizerHook) voiceVisualizerHook([0, 0, 0, 0, 0]);
        voiceVisualizerRaf = null;
        return;
      }

      phase += 0.18;
      const bars = [
        Math.max(0.15, Math.min(1.0, 0.45 + 0.45 * Math.sin(phase * 1.4))),
        Math.max(0.2, Math.min(1.0, 0.65 + 0.35 * Math.sin(phase * 2.1 + 0.8))),
        Math.max(0.3, Math.min(1.0, 0.8 + 0.2 * Math.sin(phase * 1.7 + 1.6))),
        Math.max(0.2, Math.min(1.0, 0.6 + 0.35 * Math.sin(phase * 2.5 + 2.4))),
        Math.max(0.15, Math.min(1.0, 0.4 + 0.4 * Math.sin(phase * 1.2 + 3.2))),
      ];

      try {
        voiceVisualizerHook(bars);
      } catch (_e) {
        /* Non-fatal visualizer hook error */
      }

      voiceVisualizerRaf = requestAnimationFrame(updateBars);
    };

    voiceVisualizerRaf = requestAnimationFrame(updateBars);
  }

  function stopVisualizerLoop() {
    if (voiceVisualizerRaf) {
      cancelAnimationFrame(voiceVisualizerRaf);
      voiceVisualizerRaf = null;
    }
    if (voiceVisualizerHook) {
      try {
        voiceVisualizerHook([0, 0, 0, 0, 0]);
      } catch (_e) {
        /* Non-fatal hook reset */
      }
    }
  }

  const voice = {
    isSupported() {
      return typeof window !== "undefined" && "speechSynthesis" in window;
    },

    isSpeaking() {
      if (!this.isSupported()) return false;
      return voiceIsSpeaking || window.speechSynthesis.speaking;
    },

    setVisualizer(callback) {
      voiceVisualizerHook = typeof callback === "function" ? callback : null;
    },

    setVoice(voiceName) {
      voicePreferredName = voiceName ? String(voiceName) : null;
    },

    setRate(rate) {
      voiceSpeechRate = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));
    },

    setPitch(pitch) {
      voicePitch = Math.max(0.5, Math.min(1.5, Number(pitch) || 1.0));
    },

    getVoices() {
      return loadSpeechVoices();
    },

    speak(text, onEnd, onBoundary) {
      if (!this.isSupported() || !text) {
        if (typeof onEnd === "function") onEnd();
        return false;
      }

      this.stop();

      try {
        const synth = window.speechSynthesis;
        activeUtterance = new SpeechSynthesisUtterance(String(text));

        activeUtterance.rate = voiceSpeechRate;
        activeUtterance.pitch = voicePitch;

        const matchedVoice = resolveBestVoice(voicePreferredName);
        if (matchedVoice) {
          activeUtterance.voice = matchedVoice;
        }

        activeUtterance.onstart = () => {
          voiceIsSpeaking = true;
          startVisualizerLoop();
        };

        activeUtterance.onboundary = (event) => {
          if (typeof onBoundary === "function") {
            try {
              onBoundary(event);
            } catch (_e) {
              /* Non-fatal boundary callback */
            }
          }
        };

        const cleanup = () => {
          voiceIsSpeaking = false;
          activeUtterance = null;
          stopVisualizerLoop();
        };

        activeUtterance.onend = () => {
          cleanup();
          if (typeof onEnd === "function") {
            try {
              onEnd();
            } catch (_e) {
              /* Non-fatal onEnd */
            }
          }
        };

        activeUtterance.onerror = () => {
          cleanup();
          if (typeof onEnd === "function") {
            try {
              onEnd();
            } catch (_e) {
              /* Non-fatal onError */
            }
          }
        };

        synth.speak(activeUtterance);
        return true;
      } catch (_err) {
        voiceIsSpeaking = false;
        activeUtterance = null;
        stopVisualizerLoop();
        if (typeof onEnd === "function") onEnd();
        return false;
      }
    },

    stop() {
      if (this.isSupported()) {
        try {
          window.speechSynthesis.cancel();
        } catch (_e) {
          /* Non-fatal cancel */
        }
      }
      voiceIsSpeaking = false;
      stopVisualizerLoop();
    },

    pause() {
      if (this.isSupported() && voiceIsSpeaking) {
        try {
          window.speechSynthesis.pause();
        } catch (_e) {
          /* Non-fatal pause */
        }
      }
    },

    resume() {
      if (this.isSupported()) {
        try {
          window.speechSynthesis.resume();
        } catch (_e) {
          /* Non-fatal resume */
        }
      }
    },
  };

  // =========================================================================
  // 6. DYNAMIC 4-THEME SWITCHER ENGINE
  // =========================================================================
  const THEME_STORAGE_KEY = "mrn_theme_preference";
  const DEFAULT_THEME = "theme-obsidian";
  const VALID_THEMES = ["theme-obsidian", "theme-solar", "theme-emerald", "theme-cyberpunk"];

  const themeMetadata = {
    "theme-obsidian": {
      name: "theme-obsidian",
      label: "Obsidian",
      primaryColor: "#6366f1",
      accentColor: "#06b6d4",
    },
    "theme-solar": {
      name: "theme-solar",
      label: "Solar Sunrise",
      primaryColor: "#f59e0b",
      accentColor: "#fb923c",
    },
    "theme-emerald": {
      name: "theme-emerald",
      label: "Zen Emerald",
      primaryColor: "#10b981",
      accentColor: "#2dd4bf",
    },
    "theme-cyberpunk": {
      name: "theme-cyberpunk",
      label: "Cyberpunk Neon",
      primaryColor: "#d946ef",
      accentColor: "#00f0ff",
    },
  };

  let currentTheme = DEFAULT_THEME;

  const theme = {
    getAvailableThemes() {
      return Object.values(themeMetadata);
    },

    get() {
      return currentTheme;
    },

    set(themeName, options = { persist: true }) {
      if (!VALID_THEMES.includes(themeName)) {
        themeName = DEFAULT_THEME;
      }

      const root = typeof document !== "undefined" ? document.documentElement : null;
      if (root) {
        VALID_THEMES.forEach((t) => {
          root.classList.remove(t);
        });
        root.classList.add(themeName);
        root.setAttribute("data-theme", themeName);
      }

      currentTheme = themeName;

      if (options.persist !== false) {
        safeStorageSet(THEME_STORAGE_KEY, themeName);
      }

      this.updatePickerUI();

      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        try {
          window.dispatchEvent(
            new CustomEvent("mrn:theme-change", { detail: { theme: themeName } }),
          );
        } catch (_e) {
          /* Non-fatal event dispatch error */
        }
      }

      return themeName;
    },

    updatePickerUI() {
      if (typeof document === "undefined" || typeof document.querySelectorAll !== "function")
        return;
      const meta = themeMetadata[currentTheme] || themeMetadata[DEFAULT_THEME];

      const activeDot = document.getElementById ? document.getElementById("themeActiveDot") : null;
      const activeLabel = document.getElementById
        ? document.getElementById("themeActiveLabel")
        : null;
      if (activeDot) activeDot.style.background = meta.primaryColor;
      if (activeLabel) activeLabel.textContent = meta.label;

      const optionBtns = document.querySelectorAll(".theme-option-btn");
      if (optionBtns && typeof optionBtns.forEach === "function") {
        optionBtns.forEach((btn) => {
          const isMatch = btn.getAttribute("data-theme") === currentTheme;
          btn.classList.toggle("selected", isMatch);
          const checkIcon = btn.querySelector ? btn.querySelector(".theme-check-icon") : null;
          if (checkIcon) checkIcon.style.display = isMatch ? "inline-block" : "none";
        });
      }
    },

    init() {
      const savedTheme = safeStorageGet(THEME_STORAGE_KEY);
      this.set(savedTheme || DEFAULT_THEME, { persist: false });

      if (typeof document === "undefined") return this;

      const pickerBtn = document.getElementById("themePickerBtn");
      const dropdownMenu = document.getElementById("themeDropdownMenu");
      const container = document.getElementById("themePickerContainer");

      if (pickerBtn && dropdownMenu) {
        pickerBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = dropdownMenu.classList.contains("active");
          dropdownMenu.classList.toggle("active", !isOpen);
          pickerBtn.setAttribute("aria-expanded", String(!isOpen));
          if (!isOpen) sound.playClick();
        });

        const optionBtns = document.querySelectorAll(".theme-option-btn");
        optionBtns.forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const targetTheme = btn.getAttribute("data-theme");
            this.set(targetTheme);
            dropdownMenu.classList.remove("active");
            pickerBtn.setAttribute("aria-expanded", "false");
            haptics.light();
            sound.playSuccess();
          });
        });

        document.addEventListener("click", (e) => {
          if (container && !container.contains(e.target)) {
            dropdownMenu.classList.remove("active");
            pickerBtn.setAttribute("aria-expanded", "false");
          }
        });

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && dropdownMenu.classList.contains("active")) {
            dropdownMenu.classList.remove("active");
            pickerBtn.setAttribute("aria-expanded", "false");
            pickerBtn.focus();
          }
        });
      }

      this.updatePickerUI();
      return this;
    },
  };

  // =========================================================================
  // 7. INTERACTIVE SPOTLIGHT ONBOARDING TOUR
  // =========================================================================
  const TOUR_STORAGE_KEY = "mrn_tour_completed";

  const TOUR_STEPS = [
    {
      targetSelectors: ["#streakHeroCard", "#dashboardCheckinBtn", ".streak-hero-card"],
      title: "1-Click Habit Check-in",
      icon: "⚡",
      content:
        "Lock in your morning momentum daily! Confirm your completed routine with a single tap to build streaks and maintain consistency.",
    },
    {
      targetSelectors: ["#dashboardJournalCard", ".dashboard-journal-card"],
      title: "Mindset Journal & Reflection",
      icon: "✍️",
      content:
        "Capture your One Big Thing, record daily gratitude, and log key reflections. Your thoughts are automatically saved and exportable.",
    },
    {
      targetSelectors: ["#heatmapCard", "#coachPersonaCard", ".heatmap-card"],
      title: "365-Day Consistency & AI Coaches",
      icon: "🔥",
      content:
        "Visualize your year-long dedication on the activity heatmap, and switch between dynamic AI coach personas tailored to your goals.",
    },
  ];

  let currentTourStep = 0;
  let tourBackdropEl = null;
  let tourCardEl = null;
  let activeTargetEl = null;

  const tour = {
    isCompleted() {
      return safeStorageGet(TOUR_STORAGE_KEY) === "true";
    },

    reset() {
      safeStorageRemove(TOUR_STORAGE_KEY);
    },

    start(force = false) {
      if (this.isCompleted() && !force) return;
      currentTourStep = 0;
      this.createTourDOM();
      this.showStep(currentTourStep);
    },

    createTourDOM() {
      if (typeof document === "undefined") return;

      if (!tourBackdropEl) {
        tourBackdropEl = document.createElement("div");
        tourBackdropEl.className = "mrn-tour-backdrop";
        document.body.appendChild(tourBackdropEl);
      }

      if (!tourCardEl) {
        tourCardEl = document.createElement("div");
        tourCardEl.className = "mrn-tour-card";
        document.body.appendChild(tourCardEl);
      }
    },

    positionCard(target) {
      if (!target || !tourCardEl) return;
      const rect = target.getBoundingClientRect();
      const cardRect = tourCardEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      let top = scrollY + rect.bottom + 16;
      let left = scrollX + rect.left + rect.width / 2 - cardRect.width / 2;

      if (top + cardRect.height > scrollY + viewportHeight - 20) {
        top = scrollY + rect.top - cardRect.height - 16;
      }

      left = Math.max(16, Math.min(left, viewportWidth - cardRect.width - 16));

      tourCardEl.style.top = `${top}px`;
      tourCardEl.style.left = `${left}px`;
    },

    showStep(stepIndex) {
      if (stepIndex < 0 || stepIndex >= TOUR_STEPS.length) return;
      currentTourStep = stepIndex;
      const step = TOUR_STEPS[stepIndex];

      if (activeTargetEl) {
        activeTargetEl.classList.remove("mrn-tour-target-highlight");
      }

      let target = null;
      for (const sel of step.targetSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          target = el;
          break;
        }
      }

      activeTargetEl = target;
      if (activeTargetEl) {
        activeTargetEl.classList.add("mrn-tour-target-highlight");
        if (typeof activeTargetEl.scrollIntoView === "function") {
          activeTargetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      const isLastStep = stepIndex === TOUR_STEPS.length - 1;

      tourCardEl.innerHTML = `
        <div class="mrn-tour-header">
          <span class="mrn-tour-step-badge">Step ${stepIndex + 1} of ${TOUR_STEPS.length}</span>
          <button type="button" class="mrn-tour-skip-btn" id="mrnTourSkipBtn">Skip Tour</button>
        </div>
        <div class="mrn-tour-title">${step.icon} ${step.title}</div>
        <div class="mrn-tour-body">${step.content}</div>
        <div class="mrn-tour-footer">
          <div class="mrn-tour-dots">
            ${TOUR_STEPS.map(
              (_, i) =>
                `<span class="mrn-tour-dot ${i === stepIndex ? "active" : ""}" data-step="${i}"></span>`,
            ).join("")}
          </div>
          <div class="mrn-tour-actions">
            <button type="button" class="mrn-tour-btn mrn-tour-btn-back" id="mrnTourBackBtn" ${
              stepIndex === 0 ? "disabled" : ""
            }>Back</button>
            <button type="button" class="mrn-tour-btn mrn-tour-btn-next" id="mrnTourNextBtn">
              ${isLastStep ? "Finish 🎉" : "Next"}
            </button>
          </div>
        </div>
      `;

      document.getElementById("mrnTourSkipBtn")?.addEventListener("click", () => this.skip());
      document.getElementById("mrnTourBackBtn")?.addEventListener("click", () => this.prev());
      document.getElementById("mrnTourNextBtn")?.addEventListener("click", () => {
        if (isLastStep) {
          this.complete();
        } else {
          this.next();
        }
      });

      const dotEls = tourCardEl.querySelectorAll(".mrn-tour-dot");
      dotEls.forEach((dot) => {
        dot.addEventListener("click", () => {
          const targetStep = parseInt(dot.getAttribute("data-step"), 10);
          this.showStep(targetStep);
        });
      });

      setTimeout(() => {
        if (activeTargetEl) {
          this.positionCard(activeTargetEl);
        }
      }, 350);

      haptics.light();
      sound.playClick();
    },

    next() {
      if (currentTourStep < TOUR_STEPS.length - 1) {
        this.showStep(currentTourStep + 1);
      } else {
        this.complete();
      }
    },

    prev() {
      if (currentTourStep > 0) {
        this.showStep(currentTourStep - 1);
      }
    },

    complete() {
      safeStorageSet(TOUR_STORAGE_KEY, "true");
      this.cleanup();

      if (typeof globalThis.confetti === "function") {
        try {
          globalThis.confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#d946ef"],
          });
        } catch (_e) {
          /* Non-fatal confetti trigger */
        }
      }

      haptics.success();
      sound.playSuccess();
    },

    skip() {
      safeStorageSet(TOUR_STORAGE_KEY, "true");
      this.cleanup();
    },

    cleanup() {
      if (activeTargetEl) {
        activeTargetEl.classList.remove("mrn-tour-target-highlight");
        activeTargetEl = null;
      }
      if (tourBackdropEl) {
        tourBackdropEl.remove();
        tourBackdropEl = null;
      }
      if (tourCardEl) {
        tourCardEl.remove();
        tourCardEl = null;
      }
    },

    init() {
      if (typeof window === "undefined") return this;
      if (!this.isCompleted()) {
        setTimeout(() => {
          this.start(false);
        }, 1200);
      }
      return this;
    },
  };

  // =========================================================================
  // 8. KEYBOARD SHORTCUTS DISPATCHER
  // =========================================================================
  const shortcutHandlers = new Map();
  let isKeydownListenerBound = false;

  /**
   * Determine if the event target is inside an editable text area/input.
   * @param {EventTarget|null} target
   * @returns {boolean}
   */
  function isInteractiveInputField(target) {
    if (!target || !(target instanceof HTMLElement)) return false;

    const tagName = target.tagName ? target.tagName.toUpperCase() : "";
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }

    if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
      return true;
    }

    if (typeof target.closest === "function" && target.closest('[contenteditable="true"]')) {
      return true;
    }

    return false;
  }

  /**
   * Global keydown handler.
   * @param {KeyboardEvent} event
   */
  function handleGlobalKeyDown(event) {
    // 1. Ignore if user is typing into input, textarea, or contenteditable
    if (isInteractiveInputField(event.target)) {
      return;
    }

    // 2. Ignore with modifier keys (Ctrl, Alt, Meta/Cmd)
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    const key = event.key;
    const normalizedKey = key === "?" || key === "Escape" ? key : key.toLowerCase();

    const handler = shortcutHandlers.get(normalizedKey) || shortcutHandlers.get(key);

    if (typeof handler === "function") {
      if (
        (normalizedKey === "?" || normalizedKey === "Escape" || event.code === "Space") &&
        typeof event.preventDefault === "function"
      ) {
        event.preventDefault();
      }
      handler(event);
    }
  }

  const shortcuts = {
    /**
     * Initialize keyboard shortcuts dispatcher.
     * @param {Record<string, (e: KeyboardEvent) => void>} handlers - Map of key handlers
     */
    init(handlers = {}) {
      this.clear();

      if (handlers && typeof handlers === "object") {
        Object.entries(handlers).forEach(([key, fn]) => {
          this.register(key, fn);
        });
      }

      if (!isKeydownListenerBound && typeof window !== "undefined") {
        window.addEventListener("keydown", handleGlobalKeyDown, true);
        isKeydownListenerBound = true;
      }

      return this;
    },

    /**
     * Register a single shortcut handler.
     * @param {string} key - Key identifier ('c', 'j', 'h', 's', '?', 'Escape')
     * @param {(e: KeyboardEvent) => void} handler - Callback function
     */
    register(key, handler) {
      if (!key || typeof handler !== "function") return;
      const normalizedKey = key === "?" || key === "Escape" ? key : key.toLowerCase();
      shortcutHandlers.set(normalizedKey, handler);
    },

    /**
     * Unregister a shortcut handler.
     * @param {string} key
     */
    unregister(key) {
      if (!key) return;
      const normalizedKey = key === "?" || key === "Escape" ? key : key.toLowerCase();
      shortcutHandlers.delete(normalizedKey);
    },

    /**
     * Remove all shortcut handlers.
     */
    clear() {
      shortcutHandlers.clear();
    },

    /**
     * Teardown global listener and unregister all handlers.
     */
    destroy() {
      this.clear();
      if (isKeydownListenerBound && typeof window !== "undefined") {
        window.removeEventListener("keydown", handleGlobalKeyDown, true);
        isKeydownListenerBound = false;
      }
    },
  };

  // =========================================================================
  // 5. NETWORK STATUS MONITOR & FLOATING OFFLINE BANNER
  // =========================================================================
  const BANNER_ID = "mrn-network-status-banner";
  const STYLES_ID = "mrn-ux-core-banner-styles";
  const networkListeners = new Set();
  let isNetworkInitialized = false;
  let onlineDismissTimeout = null;

  /**
   * Inject CSS styles for the floating network status banner.
   */
  function injectBannerStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLES_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLES_ID;
    style.textContent = `
      #${BANNER_ID} {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(120%);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-radius: 9999px;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.4;
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
        z-index: 999999;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        opacity: 0;
        pointer-events: none;
        max-width: 90vw;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
      #${BANNER_ID}.mrn-visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
        pointer-events: auto;
      }
      #${BANNER_ID}.mrn-offline {
        background: rgba(26, 17, 23, 0.94);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.35);
      }
      #${BANNER_ID}.mrn-online {
        background: rgba(13, 30, 24, 0.94);
        color: #86efac;
        border: 1px solid rgba(34, 197, 94, 0.35);
      }
      #${BANNER_ID} .mrn-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      #${BANNER_ID}.mrn-offline .mrn-dot {
        background: #ef4444;
        box-shadow: 0 0 10px #ef4444;
        animation: mrn-pulse 2s infinite;
      }
      #${BANNER_ID}.mrn-online .mrn-dot {
        background: #22c55e;
        box-shadow: 0 0 10px #22c55e;
      }
      #${BANNER_ID} .mrn-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @keyframes mrn-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      @media (max-width: 640px) {
        #${BANNER_ID} {
          bottom: 16px;
          padding: 10px 16px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create or fetch the floating offline/online banner element.
   * @returns {HTMLElement|null}
   */
  function getOrCreateBanner() {
    if (typeof document === "undefined") return null;

    injectBannerStyles();
    let banner = document.getElementById(BANNER_ID);

    if (!banner) {
      banner = document.createElement("div");
      banner.id = BANNER_ID;
      banner.setAttribute("role", "status");
      banner.setAttribute("aria-live", "polite");
      banner.innerHTML = `
        <span class="mrn-dot" aria-hidden="true"></span>
        <span class="mrn-text">You are currently offline. Changes will sync once reconnected.</span>
      `;
      document.body.appendChild(banner);
    }

    return banner;
  }

  const network = {
    /**
     * Check if network is currently connected.
     * @returns {boolean}
     */
    isOnline() {
      if (typeof navigator === "undefined" || !("onLine" in navigator)) {
        return true;
      }
      return navigator.onLine;
    },

    /**
     * Show the floating offline banner.
     * @param {string} [customMessage]
     */
    showOfflineBanner(customMessage) {
      if (onlineDismissTimeout) {
        clearTimeout(onlineDismissTimeout);
        onlineDismissTimeout = null;
      }

      const banner = getOrCreateBanner();
      if (!banner) return;

      const textEl = banner.querySelector(".mrn-text");
      if (textEl) {
        textEl.textContent =
          customMessage || "You are currently offline. Routine check-ins will sync automatically.";
      }

      banner.classList.remove("mrn-online");
      banner.classList.add("mrn-offline", "mrn-visible");
    },

    /**
     * Show temporary "back online" feedback and smoothly dismiss.
     * @param {string} [customMessage]
     */
    showOnlineBanner(customMessage) {
      if (onlineDismissTimeout) {
        clearTimeout(onlineDismissTimeout);
      }

      const banner = getOrCreateBanner();
      if (!banner) return;

      const textEl = banner.querySelector(".mrn-text");
      if (textEl) {
        textEl.textContent = customMessage || "Connection restored. Syncing your habits...";
      }

      banner.classList.remove("mrn-offline");
      banner.classList.add("mrn-online", "mrn-visible");

      if (onlineDismissTimeout) {
        clearTimeout(onlineDismissTimeout);
        onlineDismissTimeout = null;
      }

      // Smoothly hide after 3.2 seconds
      onlineDismissTimeout = setTimeout(() => {
        this.hideBanner();
        onlineDismissTimeout = null;
      }, 3200);
      if (typeof onlineDismissTimeout?.unref === "function") {
        onlineDismissTimeout.unref();
      }
    },

    /**
     * Hide the status banner.
     */
    hideBanner() {
      const banner = typeof document !== "undefined" ? document.getElementById(BANNER_ID) : null;
      if (banner) {
        banner.classList.remove("mrn-visible");
      }
    },

    /**
     * Add a listener for online/offline events.
     * @param {(isOnline: boolean) => void} callback
     */
    addListener(callback) {
      if (typeof callback === "function") {
        networkListeners.add(callback);
      }
    },

    /**
     * Remove a network status listener.
     * @param {(isOnline: boolean) => void} callback
     */
    removeListener(callback) {
      networkListeners.delete(callback);
    },

    /**
     * Initialize network monitoring and DOM listeners.
     */
    init() {
      if (isNetworkInitialized || typeof window === "undefined") return this;

      boundOnlineHandler = () => {
        this.showOnlineBanner();
        networkListeners.forEach((cb) => cb(true));
      };

      boundOfflineHandler = () => {
        this.showOfflineBanner();
        networkListeners.forEach((cb) => cb(false));
      };

      window.addEventListener("online", boundOnlineHandler);
      window.addEventListener("offline", boundOfflineHandler);

      // Check initial state
      if (!this.isOnline()) {
        this.showOfflineBanner();
      }

      isNetworkInitialized = true;
      return this;
    },

    destroy() {
      if (typeof window !== "undefined") {
        if (boundOnlineHandler) window.removeEventListener("online", boundOnlineHandler);
        if (boundOfflineHandler) window.removeEventListener("offline", boundOfflineHandler);
      }
      if (onlineDismissTimeout) {
        clearTimeout(onlineDismissTimeout);
        onlineDismissTimeout = null;
      }
      networkListeners.clear();
      this.hideBanner();
      isNetworkInitialized = false;
      return this;
    },
  };

  let boundOnlineHandler = null;
  let boundOfflineHandler = null;

  // Global page unload audio & voice teardown
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    const onPageUnload = () => {
      ambient.stop(0);
      voice.stop();
    };
    window.addEventListener("pagehide", onPageUnload);
    window.addEventListener("beforeunload", onPageUnload);
  }

  // =========================================================================
  // 10. ENHANCED CUSTOMIZABLE TOAST NOTIFICATION ENGINE
  // =========================================================================
  const toast = {
    /**
     * Get toast library reference safely
     */
    getLib() {
      return (
        (typeof window !== "undefined" && window.customizableToast) ||
        (typeof customizableToast !== "undefined" ? customizableToast : null)
      );
    },

    /**
     * Configure global defaults for customizable-toast-notification
     */
    initDefaults() {
      const lib = this.getLib();
      if (lib && typeof lib.setDefaultColors === "function") {
        lib.setDefaultColors({
          success: "#10b981",
          error: "#ef4444",
          info: "#7c3aed",
          warning: "#f59e0b",
        });
      }
    },

    /**
     * Core toast dispatcher with sound, haptics, theme awareness & CTA support
     */
    show(message, type = "info", options = {}) {
      const lib = this.getLib();
      const normalizedType = type === "warn" ? "warning" : type;

      // Trigger haptics and sounds automatically based on type
      if (normalizedType === "success") {
        if (typeof haptics !== "undefined" && haptics.success) haptics.success();
        if (typeof sound !== "undefined" && sound.playSuccess && !options.silent)
          sound.playSuccess();
      } else if (normalizedType === "error") {
        if (typeof haptics !== "undefined" && haptics.light) haptics.light();
      }

      if (lib && typeof lib.createToast === "function") {
        const currentTheme =
          typeof theme !== "undefined" && theme.get ? theme.get() : "theme-obsidian";
        let progressColor = "#7c3aed";
        if (currentTheme === "theme-solar") progressColor = "#f59e0b";
        else if (currentTheme === "theme-emerald") progressColor = "#10b981";
        else if (currentTheme === "theme-cyberpunk") progressColor = "#d946ef";

        return lib.createToast({
          message: String(message || ""),
          type: normalizedType,
          position: options.position || "top-center",
          fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
          borderRadius: options.borderRadius || "16px",
          showProgressBar: options.showProgressBar !== false,
          progressPosition: options.progressPosition || "bottom",
          progressColor: options.progressColor || progressColor,
          progressHeight: options.progressHeight || "3px",
          pauseOnHover: options.pauseOnHover !== false,
          duration: options.duration || (options.cta ? 6000 : 4500),
          animationDuration: options.animationDuration || "0.35s",
          animationEasing: options.animationEasing || "cubic-bezier(0.16, 1, 0.3, 1)",
          showCloseButton: options.showCloseButton !== false,
          wrapText: options.wrapText || "normal",
          ...options,
        });
      }

      // Fallback if library is not loaded
      if (typeof document !== "undefined" && typeof document.createElement === "function") {
        const fallback = document.createElement("div");
        if (fallback) {
          if (fallback.style) {
            fallback.style.cssText =
              "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(12,17,29,0.95);color:#fff;padding:12px 24px;border-radius:14px;border:1px solid rgba(255,255,255,0.1);z-index:99999;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.5);";
          }
          fallback.textContent = String(message || "");
          if (document.body && typeof document.body.appendChild === "function") {
            document.body.appendChild(fallback);
          }
          setTimeout(() => {
            if (typeof fallback.remove === "function") fallback.remove();
          }, 4000);
        }
      }
    },

    success(message, options = {}) {
      return this.show(message, "success", options);
    },

    error(message, options = {}) {
      return this.show(message, "error", options);
    },

    info(message, options = {}) {
      return this.show(message, "info", options);
    },

    warn(message, options = {}) {
      return this.show(message, "warning", options);
    },

    /**
     * Action toast with Interactive CTA Button
     */
    cta(message, { label, onClick, href, type = "info", autoClose = true, ...rest } = {}) {
      return this.show(message, type, {
        cta: {
          label: label || "Action",
          onClick,
          href,
          autoClose: autoClose !== false,
          variant: href ? "link" : "button",
        },
        duration: rest.duration || 6500,
        ...rest,
      });
    },

    /**
     * 1-Click Routine CTA Toast
     */
    routine(message = "⚡ Ready to start your morning routine sprint?", options = {}) {
      return this.cta(message, {
        label: "Open Routine 🚀",
        href: "/routine",
        type: "info",
        ...options,
      });
    },

    /**
     * Celebratory Streak Milestone Toast
     */
    streak(streakCount, options = {}) {
      if (typeof sound !== "undefined" && sound.playMilestone) sound.playMilestone();
      if (typeof haptics !== "undefined" && haptics.celebration) haptics.celebration();
      return this.cta(`🔥 ${streakCount}-Day Streak Locked In! Unstoppable discipline.`, {
        label: "Share Badge 🏆",
        onClick: () => {
          const btn = document.getElementById("openShareModalBtn");
          if (btn) btn.click();
        },
        type: "success",
        duration: 7000,
        ...options,
      });
    },
  };

  // =========================================================================
  // 11. MAIN UXCORE FACADE & INITIALIZER
  // =========================================================================
  const UXCore = {
    cache,
    haptics,
    sound,
    ambient,
    voice,
    theme,
    tour,
    shortcuts,
    network,
    toast,

    /**
     * Optional all-in-one initializer.
     * @param {Object} [options]
     * @param {Record<string, Function>} [options.shortcuts] - Keyboard handlers
     * @param {boolean} [options.initNetwork=true] - Auto-start network monitor
     * @param {boolean} [options.initTour=true] - Auto-check onboarding tour
     */
    init(options = {}) {
      this.theme.init();
      this.toast.initDefaults();
      if (options.shortcuts) {
        this.shortcuts.init(options.shortcuts);
      }
      if (options.initNetwork !== false) {
        this.network.init();
      }
      if (options.initTour !== false) {
        this.tour.init();
      }
      return this;
    },

    destroy() {
      this.ambient.stop(0);
      this.voice.stop();
      this.shortcuts.destroy();
      this.network.destroy();
      this.tour.cleanup();
      return this;
    },
  };

  // Automatically start network monitor & theme on DOMContentLoaded in browser environments
  if (typeof window !== "undefined") {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      network.init();
      theme.init();
    } else {
      window.addEventListener("DOMContentLoaded", () => {
        network.init();
        theme.init();
      });
    }
  }

  // Export to global scope
  if (typeof global !== "undefined") {
    global.UXCore = UXCore;
  }

  // CommonJS export support for tests & Node.js
  if (typeof module !== "undefined" && module.exports) {
    module.exports = UXCore;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
