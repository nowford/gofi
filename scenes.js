/* One scene clock per illustration; never animate offscreen or in a hidden tab. */
(() => {
  const scenes=[...document.querySelectorAll('.animated-scene')];
  const visible=new Set();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>scenes.forEach(scene=>scene.classList.toggle('scene-running',visible.has(scene) && !document.hidden && !reduced.matches));
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(({target,isIntersecting})=>isIntersecting?visible.add(target):visible.delete(target));
    update();
  },{threshold:.08});
  scenes.forEach(scene=>observer.observe(scene));
  document.addEventListener('visibilitychange',update);
  reduced.addEventListener('change',update);
  document.querySelector('.meet-tea')?.addEventListener('click',()=> {
    const button=document.querySelector('[data-teacher="tea"]');
    button.click();
    document.querySelector('#team').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});
    button.focus({preventScroll:true});
  });
})();
