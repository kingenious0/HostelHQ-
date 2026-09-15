/**
 * Browser Web Audio API Chime Generator
 * Pure client-side synthesis with no external MP3 dependencies.
 * Creates a clear, rich, audible chime with harmonics and resonant decay.
 */

let lastPlayedAt = 0;

export function playNotificationChime(volume: number = 0.75): void {
  if (typeof window === "undefined") return;

  // Deduplicate overlapping chime requests within 1.2s
  const now = Date.now();
  if (now - lastPlayedAt < 1200) {
    return;
  }
  lastPlayedAt = now;

  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Ensure AudioContext is actively running (handles browser background sleep)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(
      Math.min(Math.max(volume, 0.1), 1.0),
      ctx.currentTime
    );
    masterGain.connect(ctx.destination);

    // Creates a resonant bell tone with fundamental + subtle shimmer overtone
    const playBellTone = (
      freq: number,
      startTime: number,
      duration: number,
      peakGain: number
    ) => {
      // Fundamental oscillator (triangle wave for punchy presence and clear audibility)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      // Overtone oscillator (sine at 2x frequency for sparkling bell attack)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime + startTime);

      // Envelopes: crisp attack, resonant sustain, natural exponential decay
      const attackTime = 0.015;
      const decayStart = ctx.currentTime + startTime + attackTime;
      const endTime = ctx.currentTime + startTime + duration;

      gain1.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
      gain1.gain.linearRampToValueAtTime(peakGain, decayStart);
      gain1.gain.exponentialRampToValueAtTime(0.0001, endTime);

      gain2.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
      gain2.gain.linearRampToValueAtTime(peakGain * 0.35, decayStart);
      gain2.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc1.connect(gain1);
      gain1.connect(masterGain);

      osc2.connect(gain2);
      gain2.connect(masterGain);

      osc1.start(ctx.currentTime + startTime);
      osc1.stop(endTime);

      osc2.start(ctx.currentTime + startTime);
      osc2.stop(endTime);
    };

    // Note 1: E5 (659.25 Hz) - crisp entrance
    playBellTone(659.25, 0, 0.28, 0.7);

    // Note 2: B5 (987.77 Hz) - bright, elegant upward chime with longer resonance
    playBellTone(987.77, 0.14, 0.55, 0.85);

    // Auto-close audio context after sound finishes to free hardware audio channels
    setTimeout(() => {
      try {
        if (ctx.state !== "closed") {
          ctx.close();
        }
      } catch (_) {}
    }, 1200);
  } catch (e) {
    console.warn(
      "Audio context restricted by browser policy until first user interaction.",
      e
    );
  }
}
