// Lanternfall's HUD: hearts, the oil gauge, wave and score lines, banners and
// the three overlay screens (title, upgrade choice, end). Pure DOM over the
// canvas; the game state pushes into it, it never reads back.

const el = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = el('hud');
    this.waveN = el('wave-n');
    this.waveMax = el('wave-max');
    this.score = el('score');
    this.oil = el('oil');
    this.banner = el('banner');
    this.hearts = el('hearts');
    this.hint = el('hint');
    this.title = el('screen-title');
    this.upgrade = el('screen-upgrade');
    this.over = el('screen-over');
    this.cards = el('cards');
    this.bannerTimer = null;
  }

  show() { this.root.hidden = false; }
  hide() { this.root.hidden = true; }

  setWave(n, max) {
    this.waveN.textContent = n;
    this.waveMax.textContent = max;
  }
  setScore(s) { this.score.textContent = s; }

  setOil(frac) {
    this.oil.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    this.oil.classList.toggle('low', frac < 0.25);
  }

  setHearts(cur, max) {
    if (this.hearts.childElementCount !== max) {
      this.hearts.innerHTML = '';
      for (let i = 0; i < max; i++) this.hearts.appendChild(document.createElement('i'));
    }
    [...this.hearts.children].forEach((h, i) => h.classList.toggle('gone', i >= cur));
  }

  say(text, seconds) {
    this.banner.textContent = text;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.remove('show'), seconds * 1000);
  }

  titleScreen(show) { this.title.hidden = !show; }

  upgradeScreen(show, wave, cards, onPick) {
    this.upgrade.hidden = !show;
    if (!show) return;
    el('upgrade-title').textContent = `Wave ${wave} cleared`;
    this.cards.innerHTML = '';
    for (const card of cards) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.type = 'button';
      btn.innerHTML = `<h3>${card.name}</h3><p>${card.blurb}</p><span class="tier">${card.tier}</span>`;
      btn.addEventListener('click', () => onPick(card.id));
      li.appendChild(btn);
      this.cards.appendChild(li);
    }
  }

  overScreen({ win, score, waves, kills, time }, onAgain) {
    this.over.hidden = false;
    el('over-title').innerHTML = win
      ? 'The valley <span style="color:var(--moss)">holds its light</span>'
      : 'The lantern <span style="color:var(--blood)">gutters out</span>';
    el('over-copy').textContent = win
      ? 'Twelve waves burned back. The moths remember this warmth now.'
      : 'The dark takes the valley again — but you walked further this time.';
    const stats = el('over-stats');
    stats.innerHTML = `
      <li>Score <b>${score}</b></li>
      <li>Waves held <b>${waves}</b></li>
      <li>Moths burned <b>${kills}</b></li>
      <li class="win">Time <b>${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}</b></li>`;
    const again = el('btn-again');
    again.onclick = () => { onAgain(); };
  }

  hideAll() {
    this.title.hidden = true;
    this.upgrade.hidden = true;
    this.over.hidden = true;
  }
}
