// audio.js — every sound is synthesized with WebAudio: no audio files, no
// network, nothing to load. One job: the kitchen's sound effects.
export function createAudio() {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0) {
    if (!enabled) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain, filterFreq) {
    if (!enabled) return;
    const ac = ensure();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(ac.destination);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    get enabled() {
      return enabled;
    },
    pickup() {
      tone(520, 0.08, 'sine', 0.12);
    },
    chop() {
      noise(0.09, 0.25, 900);
      tone(180, 0.07, 'square', 0.08);
    },
    sizzle() {
      noise(0.5, 0.12, 3200);
    },
    ding() {
      tone(880, 0.25, 'sine', 0.15);
      tone(1320, 0.3, 'sine', 0.1, 0.08);
    },
    serve() {
      tone(523, 0.12, 'triangle', 0.15);
      tone(659, 0.12, 'triangle', 0.15, 0.1);
      tone(784, 0.22, 'triangle', 0.15, 0.2);
    },
    fail() {
      tone(220, 0.25, 'sawtooth', 0.08);
      tone(160, 0.35, 'sawtooth', 0.08, 0.12);
    },
    tick() {
      tone(980, 0.05, 'square', 0.05);
    },
  };
}
