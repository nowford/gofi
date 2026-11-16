/* Real Rive puppets, authored in tools/rive; this layer only schedules their activities.
   Posters remain usable on failures, without JS and with reduced motion. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const instances = new Set();
  const byElement = new WeakMap();
  let runtimePromise;
  const manifestPromise = fetch('characters.json?v=20261116-rive')
    .then(response => {if (!response.ok) throw Error('Character manifest'); return response.json();});
  // A failed optional enhancement must never hide the static page.
  manifestPromise.catch(() => {});
  function runtime() {
    if (!runtimePromise) runtimePromise = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/rive.js';
      script.onload = () => {
        window.rive.RuntimeLoader.setWasmUrl('vendor/rive.wasm');
        resolve(window.rive);
      };
      script.onerror = reject;
      document.head.append(script);
    });
    return runtimePromise;
  }

  class Character {
    constructor(image, options = {}) {
      this.image=image; this.options=options; this.id=image.src.split('/').pop().split('.')[0];
      this.visible=false; this.ready=false; this.generation=0; this.turn=0; this.elapsed=0; this.prepared=false;
      this.host=document.createElement('button');
      this.host.type='button';
      if (image.closest('[aria-hidden="true"]')) this.host.tabIndex=-1;
      this.host.className=`rive-character ${image.className.replace('character','')}`;
      this.host.setAttribute('aria-label',`${image.alt || this.id}: показать сценку`);
      if (image.id) this.host.dataset.slot=image.id;
      image.replaceWith(this.host); this.host.append(image);
      this.host.dataset.character=this.id;
      image.className='character-poster';
      image.removeAttribute('id');
      this.host.addEventListener('click',()=>this.fire(this.options.tap || 'trick1'));
      byElement.set(this.host,this); instances.add(this);
      visibility.observe(this.host); resize.observe(this.host);
    }
    active() {return this.visible && !document.hidden && !reduce.matches;}
    async load() {
      if (this.loading || this.rive || reduce.matches) return;
      this.loading=true;
      const generation=this.generation;
      try {
        const [R,manifest]=await Promise.all([runtime(),manifestPromise]);
        if (generation!==this.generation || reduce.matches) {this.loading=false;return;}
        const canvas=document.createElement('canvas');
        canvas.setAttribute('aria-hidden','true'); this.host.append(canvas); this.canvas=canvas;
        this.rive=new R.Rive({
          src:`rive/${this.id}.riv?v=${manifest[this.id].rive}`,
          canvas, stateMachine:'Character', autoBind:true, autoplay:true,
          useOffscreenRenderer:true,
          layout:new R.Layout({fit:R.Fit.Contain,alignment:R.Alignment.BottomCenter}),
          onLoad:()=> {
            if(generation!==this.generation)return;
            this.loading=false; this.ready=true;
            this.rive.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio || 1,2));
            this.mode(this.options.mode || 0);
            this.host.dataset.state='preparing';
            this.update();
          },
          onLoadError:()=>this.fail(generation),
          onAdvance:event=> {
            if(!this.ready || !this.active())return;
            this.elapsed+=Number(event.data) || 0;
            // Keep the poster until the exported file has finished its startup sequence.
            // Use advanced animation time: a slow load or a paused tab cannot reveal it early.
            if (!this.prepared && this.elapsed >= 3.5) {
              this.prepared=true;
              this.host.classList.add('live');
              this.host.dataset.state='ready';
              this.update();
            }
          }
        });
      } catch (_) {this.fail(generation);}
    }
    fail(generation) {
      if(generation!==this.generation)return;
      this.dispose();this.host.dataset.state='fallback';
    }
    mode(value) {this.rive?.viewModelInstance?.number('mode') && (this.rive.viewModelInstance.number('mode').value=value);}
    fire(name, immediate=false) {
      if(!this.prepared || !this.active())return;
      const now=performance.now();
      if(!immediate && this.lastShot && now-this.lastShot<1300)return;
      const trigger=this.rive.viewModelInstance?.trigger(name);
      if(!trigger)return;
      this.lastShot=now; trigger.trigger(); this.host.dataset.lastShot=name;
    }
    update() {
      clearTimeout(this.timer);
      if (!this.active()) {this.rive?.pause();return;}
      if (!this.rive) {this.load();return;}
      if(!this.ready)return;
      this.rive.play();
      if (!this.prepared) return;
      // Time belongs to the visible scene; hidden tabs never accumulate queued actions.
      const first=!this.entered;
      this.timer=setTimeout(()=> {
        if(!this.active())return;
        if(first) {this.entered=true;this.fire(this.options.enter || 'tap');}
        else if (this.options.cycle) {
          const shot=this.options.cycle[this.turn++ % this.options.cycle.length]; this.fire(shot);
        }
        this.schedule();
      }, first ? (this.options.delay || 500) : 8500);
    }
    schedule() {
      clearTimeout(this.timer);
      if(!this.options.cycle || !this.active())return;
      this.timer=setTimeout(()=> {
        if(!this.active())return;
        this.fire(this.options.cycle[this.turn++ % this.options.cycle.length]);
        this.schedule();
      },11000 + (this.options.delay || 0));
    }
    dispose() {
      this.generation++;clearTimeout(this.timer);this.rive?.cleanup();this.rive=null;
      this.canvas?.remove();this.canvas=null;this.loading=false;this.ready=false;
      this.host.classList.remove('live');this.elapsed=0;this.prepared=false;
    }
    async change(id,name) {
      this.dispose();this.id=id;this.entered=false;this.turn=0;
      this.host.dataset.character=id;this.host.setAttribute('aria-label',`${name}: показать сценку`);
      this.image.alt=name;
      // An old async load cannot replace a newer selection.
      const generation=this.generation;
      try {
        const manifest=await manifestPromise;
        if(generation!==this.generation)return;
        this.image.src=`img/${id}.png?v=${manifest[id].poster}`;
      } catch (_) {if(generation===this.generation)this.image.src=`img/${id}.png`;}
      if(generation===this.generation)this.update();
    }
  }
  const visibility=new IntersectionObserver(entries=>entries.forEach(entry=> {
    const character=byElement.get(entry.target);
    character.visible=entry.isIntersecting;character.update();
  }),{threshold:0.05});
  const resize=new ResizeObserver(entries=>entries.forEach(entry=> {
    const character=byElement.get(entry.target);
    if(character.ready)character.rive.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio || 1,2));
  }));

  const add=(selector,options)=> {
    const image=document.querySelector(selector);
    return image ? new Character(image,options) : null;
  };
  add('.hero-friend.center img',{enter:'trick2',tap:'trick2',cycle:['trick1','tap','trick2'],delay:500});
  add('.hero-friend.left img',{enter:'tap',tap:'trick1',cycle:['trick1','trick2'],delay:2100});
  add('.hero-friend.right img',{enter:'tap',tap:'trick1',cycle:['trick1','trick2'],delay:3600});
  add('.lesson-teacher',{mode:0,enter:'trick1',tap:'trick2',cycle:['trick1','tap']});
  const teacher=add('#teacher-image',{mode:3,enter:'tap',tap:'trick1'});
  const bait=add('.demo-bait',{mode:3,enter:'tap',tap:'trick2'});
  add('.phone-tea',{mode:3,enter:'tap',tap:'trick1'});
  document.querySelectorAll('.lineup img').forEach((image,index)=>new Character(image,{
    enter:'clap',tap:'joy',delay:700+index*350
  }));
  // Demo interaction is semantic; no renderer state leaks into home.js.
  document.addEventListener('gofi:answer',event=>bait?.fire(event.detail.correct?'triumph':'miss',true));
  document.addEventListener('gofi:teacher',event=>teacher?.change(event.detail.id,event.detail.name));
  document.addEventListener('visibilitychange',()=>instances.forEach(character=>character.update()));
  reduce.addEventListener('change',()=>instances.forEach(character=> {
    if(reduce.matches)character.dispose();else character.update();
  }));
  addEventListener('pagehide',()=>instances.forEach(character=>character.dispose()));
  addEventListener('pageshow',()=>instances.forEach(character=>character.update()));
})();
