// JavaScript code for Frogger
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// load frog sprites
const frogSprites = {};
['front', 'left', 'right', 'dead', 'victory'].forEach(name => {
  frogSprites[name] = new Image();
  frogSprites[name].src = `sprites/${name}.png`;
});
// Audio context for procedural 8-bit sounds
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // auto-resume if suspended (e.g., after modal or inactivity)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}
// play a single oscillator beep
function playSound(frequency = 440, type = 'square', duration = 0.1, volume = 0.2) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}
// simple move sound
function playMoveSound() {
  playSound(800, 'square', 0.05, 0.15);
}
// game over sound: descending tones
function playGameOverSound() {
  const ctx = getAudioCtx();
  const freqs = [600, 400, 200, 100];
  freqs.forEach((f, i) => {
    const now = ctx.currentTime + i * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, now);
    gain.gain.setValueAtTime(0.2, now);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  });
}
// win sound: ascending tones
function playWinSound() {
  const ctx = getAudioCtx();
  const freqs = [200, 400, 600, 800];
  freqs.forEach((f, i) => {
    const now = ctx.currentTime + i * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, now);
    gain.gain.setValueAtTime(0.2, now);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  });
}
// track game state to avoid multiple triggers
let gameState = 'playing';

const TILE_SIZE = 50;
const FROG_SIZE = 40;
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
// for frame rate–independent movement
let lastTimestamp = null;

let frog = {
  x: (CANVAS_WIDTH - FROG_SIZE) / 2,
  y: CANVAS_HEIGHT - FROG_SIZE - 5,
  width: FROG_SIZE,
  height: FROG_SIZE,
  direction: 'front'
};

class Car {
  constructor(x, y, width, height, speed, color, direction, spriteName) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.color = color;
    this.direction = direction; // 1 = right, -1 = left
    this.spriteName = spriteName;
  }

  // dt is elapsed time in seconds since last frame
  update(dt) {
    // original speed values are in px per frame at 60fps
    this.x += this.speed * 60 * dt * this.direction;
    if (this.direction === 1 && this.x > CANVAS_WIDTH) {
      this.x = -this.width;
    } else if (this.direction === -1 && this.x + this.width < 0) {
      this.x = CANVAS_WIDTH;
    }
  }

  draw() {
    const img = vehicleSprites[this.spriteName];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      if (this.direction === 1) {
        // flip horizontally for right-moving vehicles
        ctx.translate(this.x + this.width, this.y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, this.width, this.height);
      } else {
        // normal draw for left-moving vehicles
        ctx.drawImage(img, this.x, this.y, this.width, this.height);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}

let cars = [];
const laneYs = [300, 250, 200, 150, 100];
const speeds = [2, 3, 2.5, 3.5, 2.2];
const directions = [1, -1, 1, -1, 1];
const colors = ['red', 'yellow', 'orange', 'blue', 'purple'];
// load numeric vehicle sprites vehicle_1..vehicle_12 (fallback to colored rectangles)
const vehicleSprites = {};
for (let i = 1; i <= 12; i++) {
  const name = `vehicle_${i}`;
  const img = new Image();
  img.src = `sprites/${name}.png`;
  vehicleSprites[name] = img;
}

function initCars() {
  cars = [];
  let spriteCounter = 0;
  const CAR_COUNT = 3;
  laneYs.forEach((y, idx) => {
    const width = 60;
    const height = 40;
    // evenly space vehicles so they don't overlap
    const totalCarWidth = CAR_COUNT * width;
    const totalGap = CANVAS_WIDTH - totalCarWidth;
    const gap = totalGap / (CAR_COUNT + 1);
    const speed = speeds[idx];
    const direction = directions[idx];
    const color = colors[idx];
    for (let i = 0; i < CAR_COUNT; i++) {
      const x = gap + i * (width + gap);
      const spriteName = `vehicle_${(spriteCounter % 12) + 1}`;
      spriteCounter++;
      cars.push(new Car(x, y, width, height, speed, color, direction, spriteName));
    }
  });
}

function drawFrog() {
  let spriteName;
  if (gameState === 'gameover') {
    spriteName = 'dead';
  } else if (gameState === 'win') {
    spriteName = 'victory';
  } else {
    spriteName = frog.direction || 'front';
  }
  const img = frogSprites[spriteName];
  if (img && img.complete) {
    ctx.drawImage(img, frog.x, frog.y, frog.width, frog.height);
  } else {
    ctx.fillStyle = 'lime';
    ctx.fillRect(frog.x, frog.y, frog.width, frog.height);
  }
}

function clearCanvas() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawRoad() {
  ctx.fillStyle = '#555';
  laneYs.forEach(y => {
    ctx.fillRect(0, y - 5, CANVAS_WIDTH, TILE_SIZE);
  });
}

function detectCollision(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.y + rect1.height > rect2.y;
}

// update game state; dt is elapsed time in seconds
function update(dt) {
  if (gameState !== 'playing') return;
  // move cars only when playing (frame rate–independent)
  cars.forEach(car => car.update(dt));
  // collision detection
  for (const car of cars) {
    if (detectCollision(frog, car)) {
      gameState = 'gameover';
      playGameOverSound();
      break;
    }
  }
  // win detection
  if (gameState === 'playing' && frog.y < TILE_SIZE) {
    gameState = 'win';
    playWinSound();
  }
}

function draw() {
  clearCanvas();
  drawRoad();
  cars.forEach(car => car.draw());
  // if game over or win, draw semi-transparent backdrop first
  if (gameState !== 'playing') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  // draw the otter sprite (in front of backdrop)
  drawFrog();
  // if game over or win, draw overlay text
  if (gameState !== 'playing') {
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '48px sans-serif';
    const title = gameState === 'gameover' ? 'Game Over' : 'You Win!';
    ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.font = '24px sans-serif';
    ctx.fillText('Press Enter to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
  }
}

// draw translucent overlay with message
function drawOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '48px sans-serif';
  const title = gameState === 'gameover' ? 'Game Over' : 'You Win!';
  ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
  ctx.font = '24px sans-serif';
  ctx.fillText('Press Enter to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
}

function reset() {
  frog.x = (CANVAS_WIDTH - FROG_SIZE) / 2;
  frog.y = CANVAS_HEIGHT - FROG_SIZE - 5;
  frog.direction = 'front';
  initCars();
  gameState = 'playing';
  // reset timing for consistent speed
  lastTimestamp = null;
}

// main loop: timestamp is provided by requestAnimationFrame (ms)
function gameLoop(timestamp) {
  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
  }
  const dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', e => {
  // if not playing, allow restart on Enter
  if (gameState !== 'playing') {
    if (e.key === 'Enter') {
      reset();
    }
    return;
  }
  const step = TILE_SIZE;
  switch (e.key) {
    case 'ArrowLeft':
      if (frog.x - step >= 0) {
        frog.x -= step;
        frog.direction = 'left';
        playMoveSound();
      }
      break;
    case 'ArrowRight':
      if (frog.x + step + frog.width <= CANVAS_WIDTH) {
        frog.x += step;
        frog.direction = 'right';
        playMoveSound();
      }
      break;
    case 'ArrowUp':
      if (frog.y - step >= 0) {
        frog.y -= step;
        frog.direction = 'front';
        playMoveSound();
      }
      break;
    case 'ArrowDown':
      if (frog.y + step + frog.height <= CANVAS_HEIGHT) {
        frog.y += step;
        frog.direction = 'front';
        playMoveSound();
      }
      break;
  }
});

// start game loop with frame timing
reset();
lastTimestamp = null;
requestAnimationFrame(gameLoop);