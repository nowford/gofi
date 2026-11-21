/* Progressive enhancement: HTML stays readable if this script or motion is unavailable. */
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const top = document.querySelector('.top');
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, {threshold:0.12});
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  const teacherImage = document.querySelector('#teacher-image');
  const subjects = [...document.querySelectorAll('.subject')];
  subjects.forEach(button => button.addEventListener('click', () => {
    subjects.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    if (teacherImage) {
      teacherImage.src = `img/${button.dataset.teacher}.png?v=20261117-scenes`;
      teacherImage.alt = button.dataset.name;
    }
    document.querySelector('#teacher-name').textContent = button.dataset.name;
    document.querySelector('#teacher-description').textContent = button.dataset.description;
    document.dispatchEvent(new CustomEvent('gofi:teacher', {detail:{id:button.dataset.teacher,name:button.dataset.name}}));
  }));

  const card = document.querySelector('.demo-card');
  const answers = [...card.querySelectorAll('[data-answer]')];
  const feedback = card.querySelector('.demo-feedback');
  const reset = card.querySelector('.reset');
  answers.forEach(button => button.addEventListener('click', () => {
    if (card.classList.contains('solved')) return;
    answers.forEach(answer => answer.classList.remove('wrong'));
    document.dispatchEvent(new CustomEvent('gofi:answer', {detail:{correct:button.dataset.answer === '25'}}));
    if (button.dataset.answer !== '25') {
      button.classList.add('wrong');
      feedback.textContent = 'Почти! Квадрат — это число, умноженное на себя: 3² = 9, а 4² = 16. Попробуй ещё.';
      return;
    }
    card.classList.add('solved');
    button.classList.add('correct');
    answers.forEach(answer => {answer.disabled = true;});
    feedback.textContent = 'Верно! 9 + 16 = 25. Вот так, по одному решению, и появляется уверенность.';
    reset.hidden = false;
    if (!motion.matches) {
      for (let i=0;i<22;i++) {
        const piece = document.createElement('i');
        piece.className = 'confetti'; piece.setAttribute('aria-hidden','true');
        piece.style.setProperty('--x', `${(Math.random()-.5)*320}px`);
        piece.style.setProperty('--y', `${(Math.random()-.7)*340}px`);
        piece.style.setProperty('--spin', `${Math.random()*600}deg`);
        card.append(piece);
        piece.addEventListener('animationend', () => piece.remove(), {once:true});
        setTimeout(() => piece.remove(), 1200);
      }
    }
  }));
  reset.addEventListener('click', () => {
    card.classList.remove('solved');
    answers.forEach(answer => {answer.disabled=false;answer.classList.remove('correct','wrong');});
    feedback.textContent='Выбери одну из четырёх плиток.';
    reset.hidden=true;
    answers[0].focus();
  });
})();
