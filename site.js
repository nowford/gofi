// GoFi — живость сайта: появление по прокрутке, смена слов в заголовке, плитки решения собираются сами,
// счётчики, наклон телефона за курсором. При «Уменьшении движения» всё показывается сразу и неподвижно.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Появление разделов по очереди (задержка — в style="--d").
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
      if (e.target.querySelector('.count')) countUp(e.target);
    }
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  // Номер пункта для задержки появления по очереди.
  document.querySelectorAll('.stagger').forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty('--i', i)));

  // Слова в заголовке сменяют друг друга.
  const rotator = document.querySelector('.rotator');
  const words = ['без скуки.', 'с героями.', 'по шагам.', 'в радость.'];
  if (rotator && !reduce) {
    let i = 0;
    setInterval(() => {
      i = (i + 1) % words.length;
      const em = rotator.querySelector('em');
      em.classList.add('out');
      setTimeout(() => { em.textContent = words[i]; em.classList.remove('out'); em.classList.add('in-word');
        setTimeout(() => em.classList.remove('in-word'), 400); }, 260);
    }, 2600);
  }

  // Счётчики итога урока считаются вверх.
  function countUp(root) {
    root.querySelectorAll('.count').forEach((el) => {
      const to = +el.dataset.to;
      if (reduce) { el.textContent = to; return; }
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // Плитки решения собираются сами по кругу: плитка за плиткой, затем «верно».
  const solve = document.getElementById('solve');
  if (solve && !reduce) {
    solve.classList.add('anim');
    const lines = [...solve.querySelectorAll('.line')];
    const play = () => {
      solve.classList.remove('done');
      lines.forEach((l) => l.querySelectorAll('.tile, .check').forEach((t) => t.classList.remove('on')));
      let delay = 300;
      lines.forEach((l) => {
        l.querySelectorAll('.tile').forEach((t) => { setTimeout(() => t.classList.add('on'), delay); delay += 170; });
        const c = l.querySelector('.check');
        setTimeout(() => c.classList.add('on'), delay + 120);
        delay += 520;
      });
      setTimeout(play, delay + 2600);
    };
    const start = new IntersectionObserver((es) => { if (es[0].isIntersecting) { play(); start.disconnect(); } }, { threshold: 0.4 });
    start.observe(solve);
  } else if (solve) {
    solve.querySelectorAll('.tile, .check').forEach((t) => t.classList.add('on'));
  }

  // Телефон наклоняется за курсором.
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.tilt').forEach((box) => {
      const phone = box.querySelector('.phone');
      box.addEventListener('pointermove', (e) => {
        const r = box.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        phone.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 12}deg) translateY(-6px)`;
      });
      box.addEventListener('pointerleave', () => { phone.style.transform = ''; });
    });
  }

  // Пятна фона чуть смещаются при прокрутке.
  if (!reduce) {
    const orbs = document.querySelectorAll('.orbs span');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        orbs.forEach((o, i) => { o.style.translate = `0 ${y * (i % 2 ? -0.06 : 0.08)}px`; });
        ticking = false;
      });
    }, { passive: true });
  }
})();
