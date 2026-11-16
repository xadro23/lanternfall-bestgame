// Lanternfall input: keyboard state, the pointer's normalised position, the
// burn trigger and the pulse key, plus a small `?shot=` hook so the game can
// be driven deterministically for screenshots (same scene, same seed).

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.ndc = { x: 0, y: 0 };
    this.mouseDown = false;
    this.pulseClicked = false;
    this.paused = false;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'p') { this.paused = !this.paused; return; }
      if (k === ' ') { this.pulseClicked = true; e.preventDefault(); return; }
      this.keys.add(k);
      if (['w', 'a', 's', 'd'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.ndc.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  takePulse() {
    const p = this.pulseClicked;
    this.pulseClicked = false;
    return p;
  }

  // Screenshot driver: the query string names a scene plus a seed.
  static fromQuery() {
    const q = new URLSearchParams(location.search);
    return { shot: q.get('shot'), seed: Number(q.get('seed') || 1) };
  }
}
