/* Step clock for the drawn phones (phones.css). Markup declares what happens on which step:
   data-at="n" → .on from step n; data-cls="shake@3 open@5" → extra classes; data-press="3 7" → key tap;
   data-fill="start per max" → line width; data-text="3:Три,5:Пять" → label; screen data-cues="9:joy" →
   'gofi:cue' event on the scene, so the character beside the phone reacts. Runs only while the scene is visible. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const screens = [...document.querySelectorAll('.gp-screen[data-steps]')];
  const parse = (value, fn) => (value || '').split(/[\s,]+/).filter(Boolean).map(fn);

  function apply(screen, step, live) {
    screen.querySelectorAll('[data-at]').forEach(el => el.classList.toggle('on', step >= +el.dataset.at));
    screen.querySelectorAll('[data-cls]').forEach(el => parse(el.dataset.cls, pair => pair.split('@'))
      .forEach(([name, at]) => el.classList.toggle(name, step >= +at)));
    screen.querySelectorAll('[data-fill]').forEach(el => {
      const [start, per, max = 100] = el.dataset.fill.split(' ').map(Number);
      el.style.width = `${Math.min(max, start + per * step)}%`;
    });
    screen.querySelectorAll('[data-text]').forEach(el => {
      let text = el.dataset.base ?? (el.dataset.base = el.textContent);
      parse(el.dataset.text, pair => pair.split(':')).forEach(([at, value]) => {if (step >= +at) text = value;});
      el.textContent = text;
    });
    if (!live) return;
    // Presses may live outside the screen (a finger's ripple drawn over the phone).
    (screen.closest('.animated-scene') || screen).querySelectorAll('[data-press]').forEach(el => {
      if (!parse(el.dataset.press, Number).includes(step)) return;
      el.classList.add('press');
      setTimeout(() => el.classList.remove('press'), 160);
    });
    parse(screen.dataset.cues, pair => pair.split(':')).forEach(([at, shot]) => {
      if (+at === step) screen.dispatchEvent(new CustomEvent('gofi:cue', {bubbles:true, detail:{shot}}));
    });
  }

  screens.forEach(screen => {
    const total = +screen.dataset.steps, tick = +(screen.dataset.tick || 600), hold = +(screen.dataset.hold || 6);
    const scene = screen.closest('.animated-scene');
    let step = 0;
    if (reduce.matches) {apply(screen, total, false); return;}
    apply(screen, 0, false);
    if (screen.dataset.driver === 'poke' && scene) {
      // Steps come from the finger: contact n → step n+1; a new loop clears the answer.
      scene.addEventListener('gofi:poke', ({detail:{n}}) => {
        if (n < 0) {apply(screen, 0, false); return;}
        apply(screen, n + 1, true);
        if (n + 1 === total - 1) setTimeout(() => apply(screen, total, false), 450);
      });
      return;
    }
    setInterval(() => {
      if (reduce.matches) {apply(screen, total, false); return;}
      if (scene && !scene.classList.contains('scene-running')) return;
      step = step >= total + hold ? 0 : step + 1;
      apply(screen, step, true);
    }, tick);
  });
})();
