// JavaScript code for Frogger
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 50;
const FROG_SIZE = 40;
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

let frog = {
  x: (CANVAS_WIDTH - FROG_SIZE) / 2,
  y: CANVAS_HEIGHT - FROG_SIZE - 5,
  width: FROG_SIZE,
  height: FROG_SIZE,
  color: 'lime'
};

class Car {
  constructor(x, y, width, height, speed, color, direction) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.color = color;
    this.direction = direction; // 1 = right, -1 = left
  }

  update() {
    this.x += this.speed * this.direction;
    if (this.direction === 1 && this.x > CANVAS_WIDTH) {
      this.x = -this.width;
    } else if (this.direction === -1 && this.x + this.width < 0) {
      this.x = CANVAS_WIDTH;
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

let cars = [];
const laneYs = [300, 250, 200, 150, 100];
const speeds = [2, 3, 2.5, 3.5, 2.2];
const directions = [1, -1, 1, -1, 1];
const colors = ['red', 'yellow', 'orange', 'blue', 'purple'];

function initCars() {
  cars = [];
  laneYs.forEach((y, idx) => {
    for (let i = 0; i < 3; i++) {
      const width = 60;
      const height = 40;
      const x = Math.random() * CANVAS_WIDTH;
      const speed = speeds[idx];
      const direction = directions[idx];
      const color = colors[idx];
      cars.push(new Car(x, y, width, height, speed, color, direction));
    }
  });
}

function drawFrog() {
  ctx.fillStyle = frog.color;
  ctx.fillRect(frog.x, frog.y, frog.width, frog.height);
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

function update() {
  cars.forEach(car => car.update());
  cars.forEach(car => {
    if (detectCollision(frog, car)) {
      alert('Game Over!');
      reset();
    }
  });
  if (frog.y < TILE_SIZE) {
    alert('You Win!');
    reset();
  }
}

function draw() {
  clearCanvas();
  drawRoad();
  cars.forEach(car => car.draw());
  drawFrog();
}

function reset() {
  frog.x = (CANVAS_WIDTH - FROG_SIZE) / 2;
  frog.y = CANVAS_HEIGHT - FROG_SIZE - 5;
  initCars();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', e => {
  const step = TILE_SIZE;
  if (e.key === 'ArrowLeft' && frog.x - step >= 0) {
    frog.x -= step;
  } else if (e.key === 'ArrowRight' && frog.x + step + frog.width <= CANVAS_WIDTH) {
    frog.x += step;
  } else if (e.key === 'ArrowUp' && frog.y - step >= 0) {
    frog.y -= step;
  } else if (e.key === 'ArrowDown' && frog.y + step + frog.height <= CANVAS_HEIGHT) {
    frog.y += step;
  }
});

reset();
gameLoop();