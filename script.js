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
// frog start position
const START_X = (CANVAS_WIDTH - FROG_SIZE) / 2;
const START_Y = CANVAS_HEIGHT - FROG_SIZE - 5;
// for frame rate–independent movement
// for frame rate–independent movement
let lastTimestamp = null;
// dynamic speed multiplier: slower start, increases per win
// dynamic speed multiplier: slower start (easier) increases per win
let gameSpeedMultiplier = 0.6;
const SPEED_INCREMENT = 0.05;
// victory state duration and timing
const VICTORY_DURATION = 1000; // ms to display victory
let victoryStartTime = null;
// movement repeat throttle for arrow keys (ms)
const MOVE_INTERVAL = 150;
let lastMoveTime = 0;

// main character: frog (otter) with direction state
let frog = {
  x: START_X,
  y: START_Y,
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
    // original speed in px per frame @60fps, scaled by dynamic multiplier
    this.x += this.speed * 60 * dt * gameSpeedMultiplier * this.direction;
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
// load prize sprites (prize_1..prize_4)
const prizeSprites = {};
for (let i = 1; i <= 4; i++) {
  const name = `prize_${i}`;
  const img = new Image();
  img.src = `sprites/${name}.png`;
  prizeSprites[name] = img;
}

// HUD layout constants
const HUD_MARGIN_X = 10;
const HEART_SIZE = 30;
const HEART_SPACING = 5;
const HUD_PADDING = 10;

// scoring & lives system
const maxLives = 3;
let lives = maxLives;
let score = 0;
let highScore = parseInt(localStorage.getItem('highScore'), 10) || 0;
// load heart sprites
const heartSprites = { full: new Image(), empty: new Image() };
heartSprites.full.src = 'sprites/heart_full.png';
heartSprites.empty.src = 'sprites/heart_empty.png';
// draw HUD: hearts and scores
function drawHUD() {
  for (let i = 0; i < maxLives; i++) {
    const x = HUD_MARGIN_X + i * (HEART_SIZE + HEART_SPACING);
    const y = HUD_MARGIN_X;
    const img = i < lives ? heartSprites.full : heartSprites.empty;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, HEART_SIZE, HEART_SIZE);
    } else {
      ctx.fillStyle = i < lives ? 'red' : 'gray';
      ctx.fillRect(x, y, HEART_SIZE, HEART_SIZE);
    }
  }
  // draw score and high score
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Score: ${score}`, HUD_MARGIN_X, HEART_SIZE + HUD_MARGIN_X);
  ctx.textAlign = 'right';
  ctx.fillText(`High: ${highScore}`, CANVAS_WIDTH - HUD_MARGIN_X, HUD_MARGIN_X);
}
// prize object
let prize = { x: 0, y: 0, width: FROG_SIZE, height: FROG_SIZE, spriteName: '' };

// position the prize randomly within the top row
function placePrize() {
  const initX = (CANVAS_WIDTH - FROG_SIZE) / 2;
  const maxK = Math.floor((CANVAS_WIDTH - FROG_SIZE - initX) / TILE_SIZE);
  const minK = -Math.floor(initX / TILE_SIZE);
  const allowedXs = [];
  for (let k = minK; k <= maxK; k++) {
    allowedXs.push(initX + k * TILE_SIZE);
  }
  // restrict spawn to avoid HUD covering (hearts and score)
  const heartRegionWidth = maxLives * HEART_SIZE + (maxLives - 1) * HEART_SPACING;
  const heartsEndX = HUD_MARGIN_X + heartRegionWidth;
  const sidePadding = heartsEndX + HUD_PADDING;
  const safeXs = allowedXs.filter(x => x >= sidePadding && x <= CANVAS_WIDTH - FROG_SIZE - sidePadding);
  const xChoices = safeXs.length > 0 ? safeXs : allowedXs;
  prize.x = xChoices[Math.floor(Math.random() * xChoices.length)];
  prize.y = (TILE_SIZE - FROG_SIZE) / 2;
  prize.width = FROG_SIZE;
  prize.height = FROG_SIZE;
  const idx = Math.floor(Math.random() * 4) + 1;
  prize.spriteName = `prize_${idx}`;
}

// draw the prize
function drawPrize() {
  const img = prizeSprites[prize.spriteName];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, prize.x, prize.y, prize.width, prize.height);
  } else {
    ctx.fillStyle = 'gold';
    ctx.fillRect(prize.x, prize.y, prize.width, prize.height);
  }
}

function initCars() {
  cars = [];
  let spriteCounter = 0;
  // determine number of cars per lane based on current level (score): easier first two levels
  let CAR_COUNT = score < 2 ? 2 : 3;
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
  // choose sprite based on state
  const isVictory = gameState === 'victory';
  let spriteName;
  if (gameState === 'gameover') {
    spriteName = 'dead';
  } else if (isVictory) {
    spriteName = 'victory';
  } else {
    spriteName = frog.direction || 'front';
  }
  const img = frogSprites[spriteName];
  if (img && img.complete) {
    if (isVictory && victoryStartTime !== null) {
      // animate victory sprite with a bounce/scale
      const elapsed = performance.now() - victoryStartTime;
      const scale = 1 + 0.2 * Math.sin((2 * Math.PI * elapsed) / 300);
      const cx = frog.x + frog.width / 2;
      const cy = frog.y + frog.height / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -frog.width / 2, -frog.height / 2, frog.width, frog.height);
      ctx.restore();
    } else {
      ctx.drawImage(img, frog.x, frog.y, frog.width, frog.height);
    }
  } else {
    ctx.fillStyle = 'lime';
    ctx.fillRect(frog.x, frog.y, frog.width, frog.height);
  }
}

function clearCanvas() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawRoad() {
  ctx.fillStyle = '#333';
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
  // move cars (frame rate–independent)
  cars.forEach(car => car.update(dt));
  // collision detection with cars
  for (const car of cars) {
    if (detectCollision(frog, car)) {
      // lose a life
      lives--;
      playGameOverSound();
      if (lives > 0) {
        // reset positions for next attempt
        frog.x = START_X;
        frog.y = START_Y;
        frog.direction = 'front';
        initCars();
      } else {
        // no lives left: game over
        gameState = 'gameover';
        // update and persist high score
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('highScore', highScore);
        }
      }
      return;
    }
  }
  // prize collection detection -> trigger victory state
  if (detectCollision(frog, prize)) {
    gameState = 'victory';
    // mark victory start time for animation
    victoryStartTime = performance.now();
    playWinSound();
    // after a delay, award score and reset for next prize
    setTimeout(() => {
      // increase difficulty for next round
      gameSpeedMultiplier += SPEED_INCREMENT;
      // award score
      score++;
      // update and persist high score
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
      }
      // reset frog position and new prize
      frog.x = START_X;
      frog.y = START_Y;
      frog.direction = 'front';
      placePrize();
      // regenerate cars for new level with updated count and speed
      initCars();
      // allow movement after victory and clear victory state
      lastMoveTime = Date.now();
      victoryStartTime = null;
      gameState = 'playing';
    }, VICTORY_DURATION);
    return;
  }
}

function draw() {
  clearCanvas();
  // draw prize in top row
  drawPrize();
  // draw road and vehicles
  drawRoad();
  cars.forEach(car => car.draw());
  // draw the otter sprite
  drawFrog();
  // draw HUD during play or victory
  if (gameState === 'playing' || gameState === 'victory') drawHUD();
  if (gameState === 'gameover') {
    // overlay on game over
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '48px sans-serif';
    ctx.fillText('Game Over', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);
    ctx.font = '30px sans-serif';
    ctx.fillText(`Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillText(`High Score: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    ctx.font = '24px sans-serif';
    ctx.fillText('Press Enter to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
  }
}


function reset() {
  // reset lives, score, and difficulty multiplier
  lives = maxLives;
  score = 0;
  gameSpeedMultiplier = 0.6;
  // reset frog position
  frog.x = START_X;
  frog.y = START_Y;
  frog.direction = 'front';
  initCars();
  // place a new prize
  placePrize();
  gameState = 'playing';
  // reset timing for consistent speed
  lastTimestamp = null;
  // prevent immediate movement after reset (throttle)
  lastMoveTime = Date.now();
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
  // throttle only auto-repeat moves, allow fresh presses regardless of rate
  const now = Date.now();
  if (e.repeat && now - lastMoveTime < MOVE_INTERVAL) return;
  const step = TILE_SIZE;
  switch (e.key) {
    case 'ArrowLeft':
      if (frog.x - step >= 0) {
        frog.x -= step;
        frog.direction = 'left';
        playMoveSound();
        lastMoveTime = now;
      }
      break;
    case 'ArrowRight':
      if (frog.x + step + frog.width <= CANVAS_WIDTH) {
        frog.x += step;
        frog.direction = 'right';
        playMoveSound();
        lastMoveTime = now;
      }
      break;
    case 'ArrowUp':
      if (frog.y - step >= 0) {
        frog.y -= step;
        frog.direction = 'front';
        playMoveSound();
        lastMoveTime = now;
      }
      break;
    case 'ArrowDown':
      if (frog.y + step + frog.height <= CANVAS_HEIGHT) {
        frog.y += step;
        frog.direction = 'front';
        playMoveSound();
        lastMoveTime = now;
      }
      break;
  }
});
// touch controls for mobile: tap to move forward, swipe to move in any direction
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
canvas.style.touchAction = 'none';

/**
 * Handler for touchstart events. Captures initial touch position and time.
 */
function handleTouchStart(e) {
  if (gameState !== 'playing') return;
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
  }
  e.preventDefault();
}

/**
 * Handler for touchend events. Determines swipe or tap and moves frog.
 */
function handleTouchEnd(e) {
  if (gameState !== 'playing') return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  const now = Date.now();
  const step = TILE_SIZE;
  // tap (short distance & quick)
  if (absDx < 10 && absDy < 10 && (now - touchStartTime) < 200) {
    if (frog.y - step >= 0) {
      frog.y -= step;
      frog.direction = 'front';
      playMoveSound();
      lastMoveTime = now;
    }
  } else {
    if (absDx > absDy) {
      // horizontal swipe
      if (dx > 0 && frog.x + step + frog.width <= CANVAS_WIDTH) {
        frog.x += step;
        frog.direction = 'right';
        playMoveSound();
        lastMoveTime = now;
      } else if (dx < 0 && frog.x - step >= 0) {
        frog.x -= step;
        frog.direction = 'left';
        playMoveSound();
        lastMoveTime = now;
      }
    } else {
      // vertical swipe
      if (dy < 0 && frog.y - step >= 0) {
        frog.y -= step;
        frog.direction = 'front';
        playMoveSound();
        lastMoveTime = now;
      } else if (dy > 0 && frog.y + step + frog.height <= CANVAS_HEIGHT) {
        frog.y += step;
        frog.direction = 'front';
        playMoveSound();
        lastMoveTime = now;
      }
    }
  }
  e.preventDefault();
}

// Attach touch handlers to both the canvas and document to capture swipes below the game area
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
document.addEventListener('touchstart', handleTouchStart, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: false });
// start game loop with frame timing
reset();
lastTimestamp = null;
requestAnimationFrame(gameLoop);