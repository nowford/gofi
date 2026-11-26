/* Real Rive puppets, authored in tools/rive; this layer only schedules their activities.
   Posters remain usable on failures, without JS and with reduced motion. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const instances = new Set();
  const byElement = new WeakMap();
  let runtimePromise;
  const manifestPromise = fetch('characters.json?v=12008dd653fe')
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
      this.near=false; this.visible=false; this.ready=false; this.generation=0; this.turn=0; this.elapsed=0; this.prepared=false;
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
      this.host.addEventListener('click',()=> {
        const shots=this.options.taps || ['wave|tap','laugh|tap'];
        if(!shots.length)return;
        this.fire(shots[this.turn++ % shots.length]);
      });
      byElement.set(this.host,this); instances.add(this);
      visibility.observe(this.host); preload.observe(this.host); resize.observe(this.host);
    }
    // A parked hero (a teacher waiting to be picked) only warms up near the screen, then pauses unseen.
    active() {return this.visible && !this.options.parked && !document.hidden && !reduce.matches;}
    shouldRun() {
      if(document.hidden || reduce.matches)return false;
      if(this.options.parked)return this.near && !this.prepared;
      return this.visible || (this.near && !this.prepared);
    }
    async load() {
      if (this.loading || this.rive || reduce.matches) return;
      this.loading=true;
      const generation=this.generation;
      try {
        const [R,manifest]=await Promise.all([runtime(),manifestPromise]);
        if (generation!==this.generation) return;
        if (reduce.matches) {this.loading=false;return;}
        this.clips=manifest[this.id].clips || {};
        const canvas=document.createElement('canvas');
        canvas.setAttribute('aria-hidden','true'); this.host.append(canvas); this.canvas=canvas;
        this.rive=new R.Rive({
          src:`rive/${this.id}.riv?v=${manifest[this.id].rive}`,
          canvas, stateMachine:'Character', autoBind:true, autoplay:true,
          useOffscreenRenderer:true, shouldDisableRiveListeners:true, shouldDisableGamepad:true,
          layout:new R.Layout({fit:R.Fit.Contain,alignment:R.Alignment.BottomCenter}),
          onLoad:()=> {
            if(generation!==this.generation)return;
            this.loading=false; this.ready=true; this.running=true;
            this.rive.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio || 1,2));
            this.mode(this.options.mode || 0);
            this.loopT=0;
            this.host.dataset.state='preparing';
            this.update();
          },
          onLoadError:()=>this.fail(generation),
          onAdvance:event=> {
            if(generation!==this.generation || !this.ready || !this.shouldRun())return;
            const delta=Number(event.data) || 0;
            this.elapsed+=delta;
            if(this.options.pokes)this.beat(delta);
            if (!this.prepared) {
              // Warm nearby scenes before scrolling reaches them. Export startup remains covered.
              if(this.elapsed<3.5)return;
              this.prepared=true;
              this.host.dataset.state='ready';
              this.host.classList.add('live');
              this.update();
            }
            if(!this.active())return;
            this.shotRemaining=Math.max(0,(this.shotRemaining || 0)-delta);
            if(this.shotRemaining>0)return;
            if(this.pendingShot) {
              const pending=this.pendingShot;this.pendingShot=null;this.fire(pending);
            } else if(this.options.cycle) {
              this.untilNext=(this.untilNext ?? this.options.gap ?? 3)-delta;
              if(this.untilNext<=0)this.fire(this.options.cycle[this.cycleTurn++ % this.options.cycle.length]);
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
    setMode(value) {this.options.mode=value;this.mode(value);}
    // The press loop (rig.py POKES, 4.8 s) announces each fingertip contact, so the drawn phone presses
    // exactly the key under the finger, on the same frame clock as the animation.
    beat(delta) {
      const {loop,times}=this.options.pokes;
      const before=this.loopT || 0, after=before+delta;
      this.loopT=after % loop;
      const say=n=>this.host.dispatchEvent(new CustomEvent('gofi:poke',{bubbles:true,detail:{n}}));
      if(after>=loop)say(-1);
      times.forEach((time,n)=> {if((before<time && after>=time) || (after>=loop && this.loopT>=time))say(n);});
    }
    fire(name, immediate=false) {
      if(reduce.matches)return;
      // Keep the latest request; never cut a gesture in half on repeated taps.
      if(!this.prepared || !this.active() || (!immediate && this.shotRemaining>0)) {
        this.pendingShot=name;return;
      }
      const vm=this.rive.viewModelInstance;
      name=name.split('|').find(option=>vm?.trigger(option)) || name;
      const trigger=vm?.trigger(name);
      if(!trigger) {this.pendingShot=null;this.untilNext=this.options.gap ?? 3;return;}
      this.pendingShot=null;
      this.shotRemaining=(this.clips[name] || 5)+.35;
      this.untilNext=this.options.gap ?? 3;
      trigger.trigger();this.host.dataset.lastShot=name;
    }
    update() {
      if (!this.shouldRun()) {if(this.running)this.rive?.pause();this.running=false;return;}
      if (!this.rive) {this.load();return;}
      if(!this.ready)return;
      if(!this.running) {this.running=true;this.rive.play();}
      if(!this.prepared || !this.visible || this.entered)return;
      this.entered=true;
      this.cycleTurn=0;
      // Activities stay in their continuous read loop, without an interrupting greeting.
      const first=this.pendingShot || this.options.enter;
      if(first)this.fire(first);
    }
    dispose() {
      this.generation++;this.rive?.cleanup();this.rive=null;
      this.canvas?.remove();this.canvas=null;this.loading=false;this.ready=false;
      this.host.classList.remove('live');this.elapsed=0;this.prepared=false;
      this.running=false;this.entered=false;this.shotRemaining=0;this.pendingShot=null;this.untilNext=null;
      this.host.dataset.state='preparing';
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
  const preload=new IntersectionObserver(entries=>entries.forEach(entry=> {
    const character=byElement.get(entry.target);
    character.near=entry.isIntersecting;character.update();
  }),{rootMargin:'650px 0px',threshold:0});
  const resize=new ResizeObserver(entries=>entries.forEach(entry=> {
    const character=byElement.get(entry.target);
    if(character.ready)character.rive.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio || 1,2));
  }));

  const add=(selector,options)=> {
    const image=document.querySelector(selector);
    return image ? new Character(image,options) : null;
  };
  // Heroes live their own lives (Rive activity mode 3: latte, newspaper, laptop, bulb…), not app reactions.
  // A tap answers with a site-only emotion; heroes without it fall back to their own tap gesture.
  const ACT=3, PEEK=4, BOARD=7, PRESS=8;
  const TAPS=['wave|tap','laugh|tap','wow|tap','think|tap'];
  // Gofi rides a phone like a snowboard; Bait solves a task on a big phone himself (site-only Rive loops).
  add('.rider-gofi',{mode:BOARD,taps:['laugh|tap','wow|tap']});
  // No tap gestures for Bait: a one-shot would desync his finger from the phone.
  add('.press-bait',{mode:PRESS,taps:[],pokes:{loop:4.8,times:[0.6,1.8,3.0]}});
  // Meeting a teacher: all ten warm up ahead of time (the free-plan Rive splash needs 3.5 s hidden under the
  // poster), wait paused and unseen; a pick shows the chosen one already alive and starts their own trick at once.
  const TEACHER_TAPS=['trick2','trick1','wave|tap','laugh|tap'];
  const teachers=new Map();
  let teacher=null;
  const firstImage=document.querySelector('#teacher-image');
  if(firstImage) {
    const slots=document.createElement('div');
    slots.className='teacher-slots';
    firstImage.before(slots);slots.append(firstImage);
    teacher=new Character(firstImage,{mode:ACT,enter:'trick1',taps:TEACHER_TAPS});
    teacher.host.classList.add('picked');
    teachers.set(teacher.id,teacher);
    manifestPromise.then(manifest=>document.querySelectorAll('.subject[data-teacher]').forEach(button=> {
      const id=button.dataset.teacher;
      if(teachers.has(id) || !manifest[id])return;
      const image=new Image(360,580);
      image.className='character';image.alt=button.dataset.name;image.loading='lazy';
      image.src=`img/${id}.png?v=${manifest[id].poster}`;
      slots.append(image);
      const hero=new Character(image,{mode:ACT,taps:TEACHER_TAPS,parked:true});
      hero.host.tabIndex=-1;
      teachers.set(id,hero);
    })).catch(()=>{});
  }
  const pickTeacher=id=> {
    const next=teachers.get(id);
    if(!next || next===teacher)return;
    teacher.options.parked=true;teacher.host.classList.remove('picked');teacher.host.tabIndex=-1;teacher.update();
    next.options.parked=false;next.host.classList.add('picked');next.host.tabIndex=0;
    teacher=next;next.update();
    next.fire('trick1',true);
  };
  const bait=add('.demo-bait',{mode:ACT,taps:TAPS});
  add('.audio-tea',{mode:ACT,taps:TAPS});
  add('.reward-kolba',{mode:ACT,taps:TAPS});
  add('.habit-kletka',{mode:ACT,taps:TAPS});
  add('.pocket-letopisets',{mode:ACT,taps:TAPS});
  add('.faq-sudya',{mode:ACT,taps:TAPS});
  document.querySelectorAll('.lineup img').forEach(image=>new Character(image,{mode:ACT,taps:TAPS}));

  const random=(min,max)=>min+Math.random()*(max-min);
  // Peekers slide out from behind a section edge, look around, hide again.
  document.querySelectorAll('.peeker img').forEach(image=> {
    const hero=new Character(image,{mode:PEEK,taps:TAPS});
    const loop=()=> {
      const out=!hero.host.classList.contains('out');
      // The hidden hero sits outside its clip box, so ask whether the box itself is on screen.
      const box=hero.host.parentElement.getBoundingClientRect();
      const onScreen=box.bottom>0 && box.top<innerHeight && !document.hidden && !reduce.matches;
      if(onScreen || !out) hero.host.classList.toggle('out',out);
      setTimeout(loop,out ? random(5000,8000) : random(6000,11000));
    };
    setTimeout(loop,random(1500,4000));
  });
  // A correct demo answer earns delight, a wrong one a sigh (Volt keeps his own tears).
  document.addEventListener('gofi:answer',event=>bait?.fire(event.detail.correct?'wow|joy':(bait.id==='volt'?'miss':'sigh|miss'),true));
  // Demo interaction is semantic; no renderer state leaks into home.js.
  document.addEventListener('gofi:teacher',event=>pickTeacher(event.detail.id));
  document.addEventListener('visibilitychange',()=>instances.forEach(character=>character.update()));
  reduce.addEventListener('change',()=>instances.forEach(character=> {
    if(reduce.matches)character.dispose();else character.update();
  }));
  addEventListener('pagehide',()=>instances.forEach(character=>character.dispose()));
  addEventListener('pageshow',()=>instances.forEach(character=>character.update()));
})();
