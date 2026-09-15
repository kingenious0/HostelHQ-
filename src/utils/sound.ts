/**
 * Browser Web Audio API Chime Generator
 * Pure client-side synthesis with no external MP3 dependencies.
 * Creates a crisp, pleasant two-note rising chime (E5: 659.25Hz -> G5: 783.99Hz).
 */

let lastPlayedAt = 0;

export function playNotificationChime(): void {
  if (typeof window === "undefined") return;

  // Deduplicate overlapping chime requests within 1.5s
  const now = Date.now();
  if (now - lastPlayedAt < 1500) {
    return;
  }
  lastPlayedAt = now;

  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Pleasant two-note rising chime (E5 to G5)
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + startTime + duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    playTone(659.25, 0, 0.15); // E5 note
    playTone(783.99, 0.12, 0.25); // G5 note
  } catch (e) {
    console.warn(
      "Audio context restricted by browser policy until first user interaction.",
      e
    );
  }
}
