const { Engine, Render, Runner, Bodies, Body, Composite, Events } = Matter;

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const WALL_THICKNESS = 20;
const DEATH_LINE_Y = 80;
const DROP_Y = 50;
const DROP_COOLDOWN = 500;

const CLAWDS = [
  { level: 0,  radius: 15, name: '小克蟹',     accessory: 'none' },
  { level: 1,  radius: 20, name: '爱心克蟹',   accessory: 'heart' },
  { level: 2,  radius: 28, name: '咖啡克蟹',   accessory: 'coffee' },
  { level: 3,  radius: 35, name: '眼镜克蟹',   accessory: 'glasses' },
  { level: 4,  radius: 42, name: '墨镜克蟹',   accessory: 'sunglasses' },
  { level: 5,  radius: 50, name: '礼帽克蟹',   accessory: 'tophat' },
  { level: 6,  radius: 58, name: '滑板克蟹',   accessory: 'skateboard' },
  { level: 7,  radius: 66, name: '牛仔克蟹',   accessory: 'cowboy' },
  { level: 8,  radius: 75, name: '忍者克蟹',   accessory: 'ninja' },
  { level: 9,  radius: 85, name: '魔法克蟹',   accessory: 'wizard' },
  { level: 10, radius: 95, name: '大克蟹',     accessory: 'king' },
];

const BODY_COLOR = '#D4845A';
const BODY_DARK = '#B5704C';
const EYE_COLOR = '#1a1a1a';

let engine, render, runner;
let score = 0;
let gameOver = false;
let canDrop = true;
let nextLevel = 0;
let currentDropX = GAME_WIDTH / 2;
let merging = new Set();
let gameOverTimer = null;
let gameOverCheckId = null;
let mergeIntervalId = null;
let droppedBodies = new Set();

function drawClawd(ctx, cx, cy, size, level, angle) {
  const s = size;
  const acc = CLAWDS[level].accessory;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle || 0);

  const bw = s * 1.6;
  const bh = s * 1.3;

  // legs
  const legW = s * 0.2;
  const legH = s * 0.35;
  const legSpacing = bw * 0.35;
  ctx.fillStyle = BODY_DARK;
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      ctx.fillRect(i * legSpacing - legW / 2, bh * 0.3, legW, legH);
    }
  }

  // claws (pincers)
  const clawArmW = s * 0.15;
  const clawArmH = s * 0.35;
  const clawPincerW = s * 0.22;
  const clawPincerH = s * 0.18;
  const clawY = -bh * 0.15;
  for (const side of [-1, 1]) {
    const clawX = side * (bw / 2 + clawArmW * 0.5);
    // arm
    ctx.fillStyle = BODY_DARK;
    ctx.fillRect(clawX - clawArmW / 2, clawY, clawArmW, clawArmH);
    // upper pincer
    ctx.fillStyle = BODY_COLOR;
    const pincerX = clawX + side * clawArmW * 0.3;
    ctx.fillRect(pincerX - clawPincerW / 2, clawY - clawPincerH * 0.3, clawPincerW, clawPincerH);
    // lower pincer
    ctx.fillRect(pincerX - clawPincerW / 2, clawY + clawArmH - clawPincerH * 0.7, clawPincerW, clawPincerH);
  }

  // body
  ctx.fillStyle = BODY_COLOR;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = BODY_DARK;
  ctx.fillRect(-bw / 2, -bh / 2, bw, s * 0.06);
  ctx.fillRect(-bw / 2, bh / 2 - s * 0.06, bw, s * 0.06);

  // eyes
  const eyeSize = Math.max(2, s * 0.18);
  const eyeSpacing = bw * 0.22;
  const eyeY = -bh * 0.08;
  ctx.fillStyle = EYE_COLOR;
  ctx.fillRect(-eyeSpacing - eyeSize / 2, eyeY - eyeSize / 2, eyeSize, eyeSize);
  ctx.fillRect(eyeSpacing - eyeSize / 2, eyeY - eyeSize / 2, eyeSize, eyeSize);

  // accessories
  switch (acc) {
    case 'heart': {
      const hs = s * 0.3;
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-bw / 2 - hs * 0.3, -bh / 2 - hs * 0.8, hs, hs);
      ctx.fillRect(-bw / 2 - hs * 0.3 + hs * 0.3, -bh / 2 - hs * 0.5, hs * 0.4, hs * 0.4);
      break;
    }
    case 'coffee': {
      const mw = s * 0.25, mh = s * 0.3;
      ctx.fillStyle = '#888';
      ctx.fillRect(bw / 2 + s * 0.05, eyeY - mh * 0.2, mw, mh);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(bw / 2 + mw + s * 0.05, eyeY + mh * 0.1, mw * 0.3, mh * 0.4);
      break;
    }
    case 'glasses': {
      const gw = eyeSpacing * 2.8;
      const gh = eyeSize * 1.8;
      ctx.strokeStyle = '#5B3A1A';
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.strokeRect(-gw / 2, eyeY - gh / 2, gw * 0.42, gh);
      ctx.strokeRect(gw * 0.08, eyeY - gh / 2, gw * 0.42, gh);
      ctx.beginPath();
      ctx.moveTo(-gw / 2, eyeY);
      ctx.lineTo(-gw / 2 - s * 0.15, eyeY - s * 0.05);
      ctx.moveTo(gw / 2, eyeY);
      ctx.lineTo(gw / 2 + s * 0.15, eyeY - s * 0.05);
      ctx.stroke();
      break;
    }
    case 'sunglasses': {
      const sw = eyeSpacing * 3.2;
      const sh = eyeSize * 2.2;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-sw / 2, eyeY - sh / 2, sw * 0.42, sh);
      ctx.fillRect(sw * 0.08, eyeY - sh / 2, sw * 0.42, sh);
      ctx.fillRect(-sw / 2, eyeY - sh * 0.15, sw, sh * 0.3);
      ctx.fillRect(-sw / 2 - s * 0.15, eyeY - sh * 0.1, s * 0.15, sh * 0.2);
      ctx.fillRect(sw / 2, eyeY - sh * 0.1, s * 0.15, sh * 0.2);
      break;
    }
    case 'tophat': {
      const tw = bw * 0.5, th = s * 0.45;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-bw * 0.4, -bh / 2 - s * 0.08, bw * 0.8, s * 0.1);
      ctx.fillRect(-tw / 2, -bh / 2 - th - s * 0.08, tw, th);
      ctx.fillStyle = '#333';
      ctx.fillRect(-tw / 2, -bh / 2 - th * 0.35, tw, th * 0.12);
      break;
    }
    case 'skateboard': {
      const skW = bw * 1.1, skH = s * 0.12;
      ctx.fillStyle = '#6B2D5B';
      const skY = bh * 0.3 + s * 0.35;
      ctx.beginPath();
      ctx.moveTo(-skW / 2 + skH, skY);
      ctx.lineTo(skW / 2 - skH, skY);
      ctx.lineTo(skW / 2, skY + skH);
      ctx.lineTo(-skW / 2, skY + skH);
      ctx.fill();
      ctx.fillStyle = '#f39c12';
      const wheelR = s * 0.08;
      ctx.beginPath();
      ctx.arc(-skW * 0.3, skY + skH + wheelR, wheelR, 0, Math.PI * 2);
      ctx.arc(skW * 0.3, skY + skH + wheelR, wheelR, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cowboy': {
      const cw = bw * 0.9, ch = s * 0.3;
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(-cw / 2, -bh / 2 - s * 0.06, cw, s * 0.08);
      ctx.fillRect(-cw * 0.3, -bh / 2 - ch - s * 0.06, cw * 0.6, ch);
      ctx.fillStyle = '#C49A6C';
      ctx.fillRect(-cw * 0.25, -bh / 2 - ch * 0.4, cw * 0.5, ch * 0.1);
      // lasso
      ctx.strokeStyle = '#C49A6C';
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath();
      ctx.arc(bw * 0.3, -bh / 2 - ch - s * 0.2, s * 0.15, 0, Math.PI * 1.6);
      ctx.stroke();
      break;
    }
    case 'ninja': {
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(-bw / 2 - s * 0.05, eyeY - eyeSize * 1.5, bw + s * 0.1, eyeSize * 3);
      ctx.fillStyle = '#f5e6c8';
      const ninjaEyeW = eyeSize * 1.2;
      const ninjaEyeH = eyeSize * 0.6;
      ctx.fillRect(-eyeSpacing - ninjaEyeW / 2, eyeY - ninjaEyeH / 2, ninjaEyeW, ninjaEyeH);
      ctx.fillRect(eyeSpacing - ninjaEyeW / 2, eyeY - ninjaEyeH / 2, ninjaEyeW, ninjaEyeH);
      ctx.fillStyle = EYE_COLOR;
      ctx.fillRect(-eyeSpacing - eyeSize * 0.3, eyeY - eyeSize * 0.3, eyeSize * 0.6, eyeSize * 0.6);
      ctx.fillRect(eyeSpacing - eyeSize * 0.3, eyeY - eyeSize * 0.3, eyeSize * 0.6, eyeSize * 0.6);
      // tail
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(bw / 2, eyeY - s * 0.04, s * 0.4, s * 0.08);
      ctx.fillRect(bw / 2 + s * 0.3, eyeY - s * 0.12, s * 0.15, s * 0.08);
      break;
    }
    case 'wizard': {
      const ww = bw * 0.6, wh = s * 0.7;
      ctx.fillStyle = '#5B48A2';
      ctx.beginPath();
      ctx.moveTo(0, -bh / 2 - wh);
      ctx.lineTo(-ww / 2, -bh / 2);
      ctx.lineTo(ww / 2, -bh / 2);
      ctx.fill();
      ctx.fillStyle = '#7B68C2';
      ctx.fillRect(-ww * 0.35, -bh / 2 - wh * 0.5, ww * 0.08, ww * 0.08);
      ctx.fillRect(ww * 0.1, -bh / 2 - wh * 0.7, ww * 0.06, ww * 0.06);
      ctx.fillRect(-ww * 0.1, -bh / 2 - wh * 0.3, ww * 0.06, ww * 0.06);
      // wand
      ctx.fillStyle = '#5B48A2';
      ctx.fillRect(bw / 2 + s * 0.05, -bh * 0.3, s * 0.06, s * 0.6);
      ctx.fillStyle = '#f1c40f';
      const starY = -bh * 0.3 - s * 0.1;
      ctx.fillRect(bw / 2 + s * 0.02, starY, s * 0.12, s * 0.12);
      break;
    }
    case 'king': {
      const kw = bw * 0.6, kh = s * 0.35;
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-kw / 2, -bh / 2 - kh, kw, kh);
      // crown points
      ctx.fillRect(-kw / 2 - s * 0.05, -bh / 2 - kh - s * 0.12, s * 0.12, s * 0.12);
      ctx.fillRect(-s * 0.06, -bh / 2 - kh - s * 0.15, s * 0.12, s * 0.15);
      ctx.fillRect(kw / 2 - s * 0.07, -bh / 2 - kh - s * 0.12, s * 0.12, s * 0.12);
      // jewels
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-kw * 0.2, -bh / 2 - kh * 0.6, s * 0.1, s * 0.1);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(kw * 0.1, -bh / 2 - kh * 0.6, s * 0.1, s * 0.1);
      break;
    }
  }

  ctx.restore();
}

function init() {
  score = 0;
  gameOver = false;
  canDrop = true;
  merging = new Set();
  mergeQueue = [];
  droppedBodies = new Set();
  gameOverTimer = null;
  if (gameOverCheckId) clearInterval(gameOverCheckId);
  if (mergeIntervalId) clearInterval(mergeIntervalId);
  nextLevel = randomLevel();
  updateScore();
  updateNextBallPreview();
  buildLegend();
  document.getElementById('game-over-overlay').classList.remove('show');
  document.querySelector('title').textContent = '合成大克蟹';
  document.getElementById('game-title').textContent = '合成大克蟹';

  if (engine) {
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    if (render) { Render.stop(render); render.canvas.remove(); }
    if (runner) Runner.stop(runner);
  }

  engine = Engine.create({ gravity: { x: 0, y: 1.5 } });

  const canvas = document.getElementById('game-canvas');
  render = Render.create({
    canvas,
    engine,
    options: {
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      wireframes: false,
      background: '#16213e',
    },
  });

  runner = Runner.create();

  addWalls();
  Runner.run(runner, engine);
  Render.run(render);

  Events.on(engine, 'collisionStart', onCollision);
  Events.on(render, 'afterRender', drawAllClawds);

  mergeIntervalId = setInterval(processMergeQueue, 50);
  gameOverCheckId = setInterval(checkGameOver, 500);
}

function addWalls() {
  const opts = { isStatic: true, render: { fillStyle: '#0f3460' }, friction: 0.3 };
  const floor = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + WALL_THICKNESS / 2, GAME_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, opts);
  const left = Bodies.rectangle(-WALL_THICKNESS / 2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, opts);
  const right = Bodies.rectangle(GAME_WIDTH + WALL_THICKNESS / 2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, opts);
  Composite.add(engine.world, [floor, left, right]);
}

function randomLevel() {
  const weights = [35, 25, 20, 12, 8];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

function createFruit(x, y, level) {
  const f = CLAWDS[level];
  const body = Bodies.circle(x, y, f.radius, {
    restitution: 0.3,
    friction: 0.5,
    density: 0.002,
    render: { visible: false },
  });
  body.fruitLevel = level;
  Composite.add(engine.world, body);
  return body;
}

function dropFruit(x) {
  if (!canDrop || gameOver) return;
  canDrop = false;

  const clamped = Math.max(CLAWDS[nextLevel].radius + 2, Math.min(GAME_WIDTH - CLAWDS[nextLevel].radius - 2, x));
  const body = createFruit(clamped, DROP_Y, nextLevel);
  droppedBodies.add(body.id);
  setTimeout(() => { droppedBodies.delete(body.id); }, 2000);

  nextLevel = randomLevel();
  updateNextBallPreview();

  setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);
}

function drawAllClawds() {
  const ctx = render.context;
  const bodies = Composite.allBodies(engine.world);

  for (const body of bodies) {
    if (body.fruitLevel === undefined) continue;
    const f = CLAWDS[body.fruitLevel];
    drawClawd(ctx, body.position.x, body.position.y, f.radius, body.fruitLevel, body.angle);
  }

  // preview
  if (!gameOver && canDrop) {
    const f = CLAWDS[nextLevel];
    const cx = Math.max(f.radius + 2, Math.min(GAME_WIDTH - f.radius - 2, currentDropX));
    ctx.save();
    ctx.globalAlpha = 0.4;
    drawClawd(ctx, cx, DROP_Y, f.radius, nextLevel, 0);
    ctx.restore();
  }

  // death line
  ctx.save();
  ctx.strokeStyle = 'rgba(233, 69, 96, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, DEATH_LINE_Y);
  ctx.lineTo(GAME_WIDTH, DEATH_LINE_Y);
  ctx.stroke();
  ctx.restore();
}

let mergeQueue = [];

function onCollision(event) {
  for (const pair of event.pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;

    if (a.fruitLevel === undefined || b.fruitLevel === undefined) continue;
    if (a.fruitLevel !== b.fruitLevel) continue;
    if (a.fruitLevel >= CLAWDS.length - 1) continue;
    if (merging.has(a.id) || merging.has(b.id)) continue;

    merging.add(a.id);
    merging.add(b.id);

    mergeQueue.push({
      a, b,
      newLevel: a.fruitLevel + 1,
      midX: (a.position.x + b.position.x) / 2,
      midY: (a.position.y + b.position.y) / 2,
    });
  }
}

function processMergeQueue() {
  if (mergeQueue.length === 0) return;

  const batch = mergeQueue.splice(0, 3);
  for (const m of batch) {
    if (!Composite.get(engine.world, m.a.id, 'body')) continue;

    Composite.remove(engine.world, m.a);
    Composite.remove(engine.world, m.b);

    createFruit(m.midX, m.midY, m.newLevel);

    score += (m.newLevel + 1) * 10;
    updateScore();

    merging.delete(m.a.id);
    merging.delete(m.b.id);
  }
}

function checkGameOver() {
  if (gameOver) return;
  const bodies = Composite.allBodies(engine.world);
  let overLine = false;

  for (const body of bodies) {
    if (body.isStatic || body.fruitLevel === undefined) continue;
    if (droppedBodies.has(body.id)) continue;
    if (body.speed > 0.5) continue;
    if (body.position.y - CLAWDS[body.fruitLevel].radius < DEATH_LINE_Y) {
      overLine = true;
      break;
    }
  }

  if (overLine) {
    if (!gameOverTimer) {
      gameOverTimer = Date.now();
    } else if (Date.now() - gameOverTimer > 1500) {
      triggerGameOver();
    }
  } else {
    gameOverTimer = null;
  }
}

function triggerGameOver() {
  gameOver = true;
  document.getElementById('final-score').textContent = `最终分数: ${score}`;
  document.getElementById('game-over-overlay').classList.add('show');
}

function updateScore() {
  document.getElementById('score').textContent = `分数: ${score}`;
}

function updateNextBallPreview() {
  const canvas = document.getElementById('next-ball-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawClawd(ctx, canvas.width / 2, canvas.height / 2, 12, nextLevel, 0);
}

function buildLegend() {
  const container = document.getElementById('legend');
  container.innerHTML = '';
  for (const c of CLAWDS) {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const cvs = document.createElement('canvas');
    const sz = 20;
    cvs.width = sz;
    cvs.height = sz;
    cvs.className = 'legend-clawd';
    const lctx = cvs.getContext('2d');
    drawClawd(lctx, sz / 2, sz / 2, 7, c.level, 0);
    item.appendChild(cvs);
    item.appendChild(document.createTextNode(c.name));
    container.appendChild(item);
  }
}

// --- Input ---

const container = document.getElementById('game-container');
const dropLine = document.getElementById('drop-line');

// Mouse
container.addEventListener('mousemove', (e) => {
  if (gameOver) return;
  const rect = container.getBoundingClientRect();
  currentDropX = e.clientX - rect.left;
  dropLine.style.left = currentDropX + 'px';
  dropLine.style.display = 'block';
});

container.addEventListener('mouseleave', () => {
  dropLine.style.display = 'none';
});

container.addEventListener('click', (e) => {
  if (gameOver) return;
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  dropFruit(x);
});

// Touch
container.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (gameOver) return;
  const rect = container.getBoundingClientRect();
  const touch = e.touches[0];
  currentDropX = touch.clientX - rect.left;
  dropLine.style.left = currentDropX + 'px';
  dropLine.style.display = 'block';
}, { passive: false });

container.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (gameOver) return;
  dropFruit(currentDropX);
  dropLine.style.display = 'none';
}, { passive: false });

document.getElementById('restart-btn').addEventListener('click', init);

init();
