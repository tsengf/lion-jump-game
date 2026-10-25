(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const GROUND = 285;
  const GRAVITY = 1850;
  const JUMP = -685;
  const STARTING_HAIR = 3;
  const LEVEL_DISTANCE = 6000;
  const STORAGE_KEY = 'francis-personal-best';
  let width = 1000, height = 365, scale = 1, lastTime = 0, time = 0;
  let state = 'ready', score = 0, distance = 0, snackPoints = 0, hair = STARTING_HAIR, level = 1;
  let speed = 300, spawnIn = 1.9, invulnerable = 0, eatTime = 0, toastTime = 0;
  let obstacles = [], foods = [], particles = [], sceneryOffset = 0, best = 0, startingBest = 0;
  let ducking = false, sound = false, audioContext;
  const duckSources = new Set();
  const lion = { x: 130, y: 0, vy: 0, grounded: true };
  try { best = Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch { /* Storage may be disabled. */ }
  best = Math.max(0, Math.floor(Number.isFinite(best) ? best : 0));
  $('best').textContent = String(best).padStart(5, '0');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const previousWidth = width;
    height = rect.height;
    // A consistent world height keeps the physics identical on every screen.
    scale = height / 365;
    width = rect.width / scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    lion.x = Math.min(130, width * .22);
    if (state === 'running' && previousWidth !== width) pause();
  }
  new ResizeObserver(resize).observe(canvas);

  function tone(frequency, duration = .09, type = 'sine', volume = .035) {
    if (!sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume().catch(() => {});
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch { /* Sound is optional. */ }
  }

  function announce(message) { $('announcer').textContent = message; }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); toastTime = 2.3; }
  function updateHUD() {
    $('score').textContent = String(score).padStart(5, '0');
    $('hair-label').textContent = `${hair} ${hair === 1 ? 'TUFT' : 'TUFTS'}`;
    $('mane').classList.toggle('low', hair <= 1);
    $('mane').setAttribute('aria-label', `Mane: ${hair} ${hair === 1 ? 'tuft' : 'tufts'}. Each hit removes one tuft.`);
    $('hair-fill').style.width = `${Math.min(100, hair / 6 * 100)}%`;
    $('level-label').textContent = `LEVEL ${level} · THE GOLDEN GRASSLANDS`;
  }
  function overlay(kicker, title, description, button, hint) {
    $('overlay-kicker').textContent = kicker;
    $('overlay-title').textContent = title;
    $('overlay-description').textContent = description;
    $('start-button').replaceChildren(document.createTextNode(button + ' '), Object.assign(document.createElement('span'), { textContent: '↗' }));
    $('start-hint').textContent = hint;
    $('overlay').classList.remove('hidden');
  }
  function start() {
    score = distance = snackPoints = 0; hair = STARTING_HAIR; level = 1;
    obstacles = []; foods = []; particles = [];
    speed = 300; spawnIn = 1.6; invulnerable = eatTime = 0;
    lion.y = lion.vy = 0; lion.grounded = true;
    duckSources.clear(); ducking = false;
    startingBest = best;
    state = 'running';
    $('overlay').classList.add('hidden');
    $('toast').classList.remove('visible');
    $('pause-button').disabled = false;
    $('pause-button').setAttribute('aria-label', 'Pause game');
    $('game-status').textContent = 'Find your rhythm. Follow your appetite.';
    updateHUD();
    announce('Game started. Space to jump, Down to duck. Touch broccoli to grow your mane. You start with three tufts.');
    canvas.focus({ preventScroll: true });
    tone(440);
  }
  function pause() {
    if (state !== 'running') return;
    state = 'paused'; duckSources.clear(); ducking = false;
    overlay('TAKE A BREATHER', 'Even little lions need a rest.', 'Your adventure will be right here.', 'Keep roaming', 'or press Space or P to resume');
    $('pause-button').setAttribute('aria-label', 'Resume game');
    $('game-status').textContent = 'Taking a little breather.';
    announce('Game paused.');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'running'; lastTime = performance.now();
    $('overlay').classList.add('hidden');
    $('pause-button').setAttribute('aria-label', 'Pause game');
    $('game-status').textContent = 'Find your rhythm. Follow your appetite.';
    canvas.focus({ preventScroll: true });
  }
  function gameOver() {
    state = 'over'; duckSources.clear(); ducking = false;
    if (score > best) {
      best = score;
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch { /* Keep the best score for this session. */ }
      $('best').textContent = String(best).padStart(5, '0');
    }
    overlay(score > startingBest ? 'A NEW PERSONAL BEST!' : 'A LITTLE TOO SQUEAKY CLEAN', 'All out of fluff. Another adventure?', `You scored ${score.toLocaleString()} points in level ${level}. Grow that mane again!`, 'Roam again', 'or press Space to try again');
    $('pause-button').disabled = true;
    $('game-status').textContent = 'Stay soft. There’s always another run.';
    announce(`Game over. Francis lost all his hair. Score ${score}. Personal best ${best}.`);
    tone(180, .3, 'triangle');
  }
  function jump() {
    if (state === 'ready' || state === 'over') { start(); return; }
    if (state === 'paused') { resume(); return; }
    if (!lion.grounded) return;
    duckSources.clear(); ducking = false;
    lion.vy = JUMP; lion.grounded = false;
    puff(lion.x, GROUND, '#c4b18e', 5);
    tone(360, .12, 'triangle');
  }
  function collect(food) {
    food.collected = true; snackPoints += 25; eatTime = .24;
    score = Math.floor(distance / 12) + snackPoints;
    puff(food.x, food.y, '#88a365', 8);
    hair++;
    tone(660 + Math.min(hair, 12) * 35, .13);
    toast(`Crunch! Your mane grew. ${hair} tufts!`);
    updateHUD();
  }
  function puff(x, y, color, count) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * 130, vy: -30 - Math.random() * 100, life: .5 + Math.random() * .3, color });
  }
  function spawn() {
    const x = width + 70;
    const branch = Math.random() < .4;
    obstacles.push(branch ? { x, w: 94, h: 40, y: GROUND - 100, type: 'branch' } : { x, w: 53, h: 57, y: GROUND, type: 'washer' });
    // Snacks appear in safe gaps. Some reward jumping; the rest are at mouth height.
    if (Math.random() < .95) {
      const foodX = x + speed * (.7 + Math.random() * .3);
      foods.push({ x: foodX, y: GROUND - (Math.random() < .28 ? 125 : 43), collected: false });
    }
    // At least 1.65 seconds between obstacles, including at maximum speed.
    spawnIn = 1.65 + Math.random() * .65;
  }
  function lionBounds() {
    const h = ducking && lion.grounded ? 41 : 73;
    return { x: lion.x - 23, y: GROUND + lion.y - h, w: 46, h: h - 4 };
  }
  function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function update(dt) {
    time += dt;
    if (toastTime > 0) { toastTime -= dt; if (toastTime <= 0) $('toast').classList.remove('visible'); }
    if (state !== 'running') return;
    distance += speed * dt;
    score = Math.floor(distance / 12) + snackPoints;
    speed = Math.min(630, 300 + distance / 160);
    const nextLevel = 1 + Math.floor(distance / LEVEL_DISTANCE);
    if (nextLevel > level) {
      level = nextLevel;
      toast(`Level ${level}! Keep that mane growing.`);
      announce(`Level ${level}. The grasslands are getting faster.`);
      updateHUD();
    }
    sceneryOffset += speed * dt;
    invulnerable = Math.max(0, invulnerable - dt); eatTime = Math.max(0, eatTime - dt);
    if (!lion.grounded) {
      lion.vy += GRAVITY * dt;
      lion.y += lion.vy * dt;
      if (lion.y >= 0) { lion.y = lion.vy = 0; lion.grounded = true; puff(lion.x, GROUND, '#c4b18e', 4); }
    }
    ducking = duckSources.size > 0 && lion.grounded;
    spawnIn -= dt;
    if (spawnIn <= 0) spawn();
    const bounds = lionBounds();
    for (const obstacle of obstacles) {
      obstacle.x -= speed * dt;
      const box = { x: obstacle.x + 5, y: obstacle.type === 'washer' ? GROUND - obstacle.h + 5 : obstacle.y + 4, w: obstacle.w - 10, h: obstacle.h - 8 };
      if (!obstacle.hit && overlaps(bounds, box)) {
        if (invulnerable > 0) continue;
        obstacle.hit = true; hair = Math.max(0, hair - 1); invulnerable = .85;
        puff(lion.x, GROUND + lion.y - 62, '#b87845', 16);
        tone(280, .2, 'triangle'); updateHUD();
        if (hair === 0) { gameOver(); return; }
        toast(`${obstacle.type === 'washer' ? 'Spin cycle' : 'Branch snag'}! One tuft lost. ${hair} left.`);
        announce(`One tuft lost. ${hair} remaining. Touch broccoli to regrow your mane.`);
      }
    }
    for (const food of foods) {
      food.x -= speed * dt;
      if (!food.collected && overlaps({ x: bounds.x - 8, y: bounds.y - 18, w: bounds.w + 16, h: bounds.h + 22 }, { x: food.x - 13, y: food.y - 14, w: 26, h: 28 })) collect(food);
    }
    obstacles = obstacles.filter(o => o.x + o.w > -60);
    foods = foods.filter(f => !f.collected && f.x > -30);
    for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; }
    particles = particles.filter(p => p.life > 0);
    $('score').textContent = String(score).padStart(5, '0');
  }

  function ellipse(x, y, rx, ry, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  function line(points, color, stroke = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  }
  function cloud(x, y, size) {
    ctx.fillStyle = '#fffcf2'; ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.moveTo(x - size, y); ctx.bezierCurveTo(x - size * 1.1, y - 12, x - size * .5, y - 18, x - size * .3, y - 10); ctx.bezierCurveTo(x - size * .1, y - 37, x + size * .55, y - 32, x + size * .6, y - 10); ctx.bezierCurveTo(x + size * 1.1, y - 17, x + size * 1.35, y, x + size, y + 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  function tree(x, ground, size, alpha) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(size, size); ctx.globalAlpha = alpha;
    line([[0,0],[2,-55],[-18,-79]], '#9d9670', 4);
    line([[2,-54],[23,-80]], '#9d9670', 3);
    ellipse(-19,-81,37,10,'#b4b18a'); ellipse(13,-86,45,12,'#b4b18a'); ellipse(39,-80,23,8,'#b4b18a');
    ctx.restore();
  }
  function drawBackground() {
    ctx.fillStyle = '#f2eddf'; ctx.fillRect(0, 0, width, 365);
    ellipse(width * .81, 71, 31, 31, '#e7d5a9');
    for (let i = 0; i < 4; i++) {
      const x = ((i * 320 + 90 - sceneryOffset * .055) % (width + 350) + width + 350) % (width + 350) - 120;
      cloud(x, 72 + i % 2 * 34, 32 + i * 4);
    }
    ctx.fillStyle = '#e8e3cd'; ctx.beginPath(); ctx.moveTo(0, 226);
    for (let x = 0; x <= width + 20; x += 20) ctx.lineTo(x, 214 + Math.sin((x + sceneryOffset * .11) / 155) * 19 + Math.sin((x + sceneryOffset * .11) / 80) * 7);
    ctx.lineTo(width, 310); ctx.lineTo(0, 310); ctx.fill();
    for (let i = 0; i < Math.ceil(width / 400) + 1; i++) {
      const x = ((i * 400 + 340 - sceneryOffset * .18) % (width + 400) + width + 400) % (width + 400) - 120;
      tree(x, 248, .68 + i % 2 * .22, .42);
    }
    ctx.fillStyle = '#e2dcc1'; ctx.beginPath(); ctx.moveTo(0, 262);
    for (let x = 0; x <= width + 20; x += 20) ctx.lineTo(x, 256 + Math.sin((x + sceneryOffset * .28) / 130) * 8);
    ctx.lineTo(width, 300); ctx.lineTo(0, 300); ctx.fill();
    ctx.fillStyle = '#eae0c7'; ctx.fillRect(0, GROUND, width, 80);
    line([[0,GROUND],[width,GROUND]], '#bcaf8b', 1);
    for (let i = 0; i < width / 85 + 2; i++) {
      const x = ((i * 85 - sceneryOffset) % (width + 85) + width + 85) % (width + 85);
      const y = GROUND + 13 + (i * 17 % 43);
      line([[x,y],[x + 6 + i % 8,y]], '#d4c7a8', 1);
      if (i % 3 === 0) {
        line([[x+30,GROUND-1],[x+26,GROUND-10],[x+31,GROUND-5],[x+34,GROUND-13]], '#b4ac86', 1);
      }
    }
    // Small wind strokes give the landscape a hand-drawn finish.
    line([[width * .71,130],[width * .71 + 23,130]], '#dfd5bf');
    line([[width * .71 + 30,130],[width * .71 + 38,130]], '#dfd5bf');
  }
  function drawLion() {
    const running = state === 'running';
    const stride = running && lion.grounded ? Math.sin(distance * .075) : 0;
    const bob = running && lion.grounded ? Math.abs(stride) * 2 : Math.sin(time * 2) * 1.3;
    const duck = ducking && lion.grounded;
    const y = GROUND + lion.y;
    ellipse(lion.x, GROUND + 3, 40 * (1 + lion.y / 500), 5 * (1 + lion.y / 500), '#b2a17b35');
    ctx.save(); ctx.translate(lion.x, y - bob);
    if (invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0) ctx.globalAlpha = .45;
    if (duck) { ctx.translate(0, 1); ctx.scale(1.18, .56); }
    // A swishy tail, tiny feet, and a plump pear-shaped plush body.
    ctx.strokeStyle = '#c99550'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-25,-26); ctx.quadraticCurveTo(-52,-18,-47,-43 + stride * 3); ctx.stroke();
    ellipse(-47,-44 + stride * 3,6,8,'#a7663e');
    ellipse(-15,-5 + stride * 3,13,7,'#c89652'); ellipse(16,-5 - stride * 3,13,7,'#c89652');
    ctx.fillStyle = '#d9ac68'; ctx.beginPath(); ctx.moveTo(-28,-20); ctx.bezierCurveTo(-37,-42,-30,-73,0,-81); ctx.bezierCurveTo(28,-76,35,-42,30,-20); ctx.bezierCurveTo(27,1,-26,1,-28,-20); ctx.fill();
    ellipse(1,-24,21,20,'#f2dfb6');
    // Broccoli grows the mane. Growth tapers visually while extra tufts keep counting.
    if (hair > 0) {
      const growth = 24 * (1 - Math.exp(-hair / 6));
      const radius = 23 + growth;
      ellipse(0,-62,radius+3,radius+3,'#bd7d47');
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        ellipse(Math.cos(a) * radius, -62 + Math.sin(a) * radius, 7 + growth * .4, 8 + growth * .4, i < 8 ? '#b87845' : '#b17141');
      }
    }
    ellipse(-24,-82,9,10,'#d9ab63'); ellipse(24,-82,9,10,'#d9ab63');
    ellipse(-24,-82,4.5,5,'#b67c50'); ellipse(24,-82,4.5,5,'#b67c50');
    ellipse(0,-62,26,27,'#e4bb77'); ellipse(-8,-72,13,12,'#e9c486');
    // Little stitched eyes, a cream muzzle, and rosy cheeks.
    ellipse(-11,-63,2.5,3.1,'#4c382b'); ellipse(12,-63,2.5,3.1,'#4c382b');
    ellipse(-11.5,-64,.7,.8,'#fff3d9'); ellipse(11.5,-64,.7,.8,'#fff3d9');
    ellipse(-17,-55,4.8,2.8,'#d9a180'); ellipse(18,-55,4.8,2.8,'#d9a180');
    ellipse(1,-51,15,10,'#f5e4c1');
    ctx.fillStyle = '#674634'; ctx.beginPath(); ctx.moveTo(-3,-56); ctx.quadraticCurveTo(1,-58,5,-56); ctx.quadraticCurveTo(5,-53,1,-51); ctx.quadraticCurveTo(-3,-53,-3,-56); ctx.fill();
    if (eatTime > 0) ellipse(1,-46,4,5,'#80533a');
    else { line([[1,-51],[1,-47]],'#674634',1.2); ctx.strokeStyle='#674634';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(-2,-48,3,0,Math.PI);ctx.stroke();ctx.beginPath();ctx.arc(4,-48,3,0,Math.PI);ctx.stroke(); }
    ellipse(-28,-28 + stride,7,11,'#dfb16b'); ellipse(29,-28 - stride,7,11,'#dfb16b');
    // A subtle seam and fabric speckles add to the plush silhouette.
    ctx.setLineDash([2,3]); line([[-11,-11],[0,-9],[12,-11]],'#d5bb90',.7); ctx.setLineDash([]);
    ellipse(13,-22,.8,.8,'#e2cba2'); ellipse(-8,-30,.7,.7,'#e2cba2');
    ctx.restore();
    if (eatTime > 0 && running) {
      ctx.save(); ctx.globalAlpha = eatTime * 1.5;
      line([[lion.x+45,y-48],[lion.x+57,y-52]],'#b78e51',1.5);
      line([[lion.x+46,y-40],[lion.x+63,y-40]],'#b78e51',1.5);
      ctx.restore();
    }
  }
  function drawWasher(o) {
    ctx.save(); ctx.translate(o.x, GROUND);
    if (o.hit) ctx.globalAlpha = .28;
    ellipse(o.w/2,2,o.w*.6,4,'#a39c6a25');
    ctx.fillStyle = '#f7f5ea'; ctx.strokeStyle = '#a9ada2'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(0,-o.h,o.w,o.h,5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e3e6dc'; ctx.fillRect(2,-o.h+2,o.w-4,12);
    line([[2,-o.h+15],[o.w-2,-o.h+15]],'#bfc4b7',1);
    ctx.fillStyle = '#a6b39b'; ctx.fillRect(7,-o.h+5,13,5);
    ellipse(o.w-10,-o.h+8,3,3,'#929e8a');
    ellipse(o.w/2,-22,17,17,'#a7b4aa');
    ellipse(o.w/2,-22,13,13,'#6f8f92');
    ctx.save(); ctx.translate(o.w/2,-22); ctx.rotate(time * 3);
    ellipse(-4,-2,7,4,'#b5cbd0'); ellipse(4,4,6,3,'#e4ede5');
    ctx.restore();
    line([[o.w/2-8,-29],[o.w/2-4,-32]],'#e2efeb',2);
    line([[5,0],[10,0]],'#919b8d',3); line([[o.w-10,0],[o.w-5,0]],'#919b8d',3);
    ctx.restore();
  }
  function drawBranch(o) {
    ctx.save(); ctx.translate(o.x,o.y); if(o.hit) ctx.globalAlpha=.28;
    line([[0,18],[o.w,15]],'#9e8058',8);
    line([[20,18],[30,3],[48,0]],'#9e8058',4);
    line([[61,17],[68,31],[84,35]],'#9e8058',4);
    ellipse(8,12,12,5,'#91956c');ellipse(37,3,13,5,'#adb082');ellipse(69,28,13,5,'#8d946a');ellipse(85,10,14,6,'#acac7b');
    ctx.restore();
  }
  function drawFood(f) {
    const bob = Math.sin(time * 4 + f.x * .01) * 2;
    ctx.save(); ctx.translate(f.x, f.y + bob);
    ellipse(0,1,18,18,'#e5edcf55');
    line([[0,12],[0,-2],[-7,-7]],'#97b46e',6);
    line([[0,3],[8,-6]],'#97b46e',5);
    ellipse(-9,-6,7,7,'#527b47'); ellipse(9,-7,7,7,'#527b47');
    ellipse(-4,-11,8,8,'#638d4d'); ellipse(5,-12,8,8,'#6f9955');
    ellipse(0,-5,9,7,'#60894a');
    for (const [x,y] of [[-10,-8],[-3,-14],[6,-15],[9,-7],[-1,-7]]) ellipse(x,y,1.5,1.5,'#8bab66');
    ctx.restore();
  }
  function render() {
    ctx.clearRect(0,0,width,365);
    drawBackground();
    for(const f of foods) if(!f.collected) drawFood(f);
    for(const o of obstacles) o.type==='washer'?drawWasher(o):drawBranch(o);
    // A couple of quiet details frame Francis before the first run.
    if(state==='ready') {drawWasher({x:width-95,w:53,h:57});drawFood({x:width*.72,y:GROUND-40});}
    drawLion();
    for(const p of particles) {ctx.globalAlpha=Math.max(0,Math.min(1,p.life*2));ellipse(p.x,p.y,2,2,p.color);}
    ctx.globalAlpha=1;
  }
  function frame(now) {
    const dt=Math.min((now-lastTime)/1000 || 0, .035);lastTime=now;
    update(dt);render();requestAnimationFrame(frame);
  }

  $('start-button').addEventListener('click',()=>state==='paused'?resume():start());
  $('pause-button').addEventListener('click',()=>state==='paused'?resume():pause());
  $('sound-toggle').addEventListener('click',()=>{
    sound=!sound;
    $('sound-toggle').setAttribute('aria-pressed',String(sound));
    $('sound-toggle').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');
    $('sound-toggle').title=sound?'Turn sound off':'Turn sound on';
    $('sound-label').textContent=sound?'Sound on':'Sound off';
    $('sound-waves').setAttribute('d',sound?'M15 8q4 4 0 8m3-11q7 7 0 14':'m16 9 5 6m0-6-5 6');
    if(sound) tone(550,.1);
  });
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey) return;
    if(event.target instanceof HTMLButtonElement && (event.code==='Space'||event.code==='Enter')) return;
    if(['Space','ArrowUp','ArrowDown','KeyW','KeyS','KeyP','Escape'].includes(event.code))event.preventDefault();
    if(event.repeat)return;
    if(['Space','ArrowUp','KeyW'].includes(event.code))jump();
    if(['ArrowDown','KeyS'].includes(event.code)&&state==='running')duckSources.add(event.code);
    if(event.code==='KeyP'||event.code==='Escape')state==='paused'?resume():pause();
  });
  document.addEventListener('keyup',event=>duckSources.delete(event.code));
  $('jump-control').addEventListener('pointerdown',event=>{event.preventDefault();jump();});
  $('duck-control').addEventListener('pointerdown',event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);if(state==='running')duckSources.add('touch');});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('duck-control').addEventListener(type,()=>duckSources.delete('touch'));
  canvas.addEventListener('pointerdown',event=>{event.preventDefault();jump();});
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  resize();updateHUD();requestAnimationFrame(frame);
})();
