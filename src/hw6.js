// hw6.js – HW06 start: Phases 1–3 (movement, power, basic shoot+gravity)
// After you verify this runs, we'll add: rim collisions, rotation, scoring, UI polish.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
/* -------------------- 1) Scene / Camera / Renderer -------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;

/* -------------------- 2) Lighting -------------------- */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 15);
dirLight.castShadow = true;
scene.add(dirLight);

/* -------------------- 3) Constants -------------------- */
const COURT_LENGTH = 28;
const COURT_WIDTH = 15;
const COURT_HEIGHT = 0.2;

const THREE_POINT_RADIUS = 6.75;
const RIM_HEIGHT = 3.05;
const RIM_RADIUS = 0.45;
const BACKBOARD_WIDTH = 1.8;
const BACKBOARD_HEIGHT = 1.05;
const BACKBOARD_THICKNESS = 0.05;
const RIM_TO_BASELINE = 1.575;

const FT_RADIUS = 1.8;

// Physics & control
const BALL_RADIUS = 0.375;
const GRAVITY = -9.8;        // m/s^2 (we can scale later if needed)
const RESTITUTION = 0.6;     // energy kept after bounce
const FLOOR_Y = 0;           // floor top is y=0 in our setup
const MOVE_SPEED = 6;        // m/s when dragging with arrows (while ball is on ground)
const POWER_MIN = 0.05;
const POWER_MAX = 1.0;
const DEFAULT_POWER = 0.5;
const H_POWER = 12;          // horizontal speed scale
const V_POWER = 9;           // vertical speed scale

/* -------------------- 4) Helpers -------------------- */
function createLine(points, color = 0xffffff, lineWidth = 2) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, linewidth: lineWidth });
  return new THREE.Line(geometry, material);
}

function generateArcPoints(radius, angleStart, angleEnd, segments = 64) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = angleStart + t * (angleEnd - angleStart);
    pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius));
  }
  return pts;
}

/* -------------------- 5) Court -------------------- */
function createFloor() {
  const geometry = new THREE.BoxGeometry(COURT_LENGTH, COURT_HEIGHT, COURT_WIDTH);
  const material = new THREE.MeshPhongMaterial({ color: 0xc68642, shininess: 40 });
  const floor = new THREE.Mesh(geometry, material);
  floor.position.y = -COURT_HEIGHT / 2; // put floor top at y = 0
  floor.receiveShadow = true;
  scene.add(floor);
}

function addCourtMarkings() {
  const markings = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

  const buildLine = (pts) =>
    new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);

  const buildCircle = (r, segments = 64) => {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.01, Math.sin(a) * r));
    }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
  };

  const buildArc = (cx, r, start, end, segments = 64) => {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = start + (i / segments) * (end - start);
      pts.push(new THREE.Vector3(cx + Math.cos(t) * r, 0.01, Math.sin(t) * r));
    }
    return buildLine(pts);
  };

  // Three-point arcs
  markings.add(
    buildArc(-COURT_LENGTH / 2 + RIM_TO_BASELINE, THREE_POINT_RADIUS, -Math.PI / 2, Math.PI / 2)
  );
  markings.add(
    buildArc(COURT_LENGTH / 2 - RIM_TO_BASELINE, THREE_POINT_RADIUS, Math.PI / 2, 3 * Math.PI / 2)
  );

  // Center line & circle
  markings.add(
    buildLine([
      new THREE.Vector3(0, 0.01, COURT_WIDTH / 2),
      new THREE.Vector3(0, 0.01, -COURT_WIDTH / 2),
    ])
  );
  markings.add(buildCircle(FT_RADIUS));

  scene.add(markings);
}

/* -------------------- 6) Hoops -------------------- */
function addBackboardSquare(boardMesh, color = 0xff0000) {
  const w = 0.59;
  const h = 0.45;
  const topOffset = 0.15;

  const halfW = w / 2;
  const halfH = h / 2;

  const pts = [
    new THREE.Vector3(-halfW, halfH, BACKBOARD_THICKNESS / 2 + 0.001),
    new THREE.Vector3(halfW, halfH, BACKBOARD_THICKNESS / 2 + 0.001),
    new THREE.Vector3(halfW, -halfH, BACKBOARD_THICKNESS / 2 + 0.001),
    new THREE.Vector3(-halfW, -halfH, BACKBOARD_THICKNESS / 2 + 0.001),
  ];

  // Shift rectangle down
  pts.forEach((p) => (p.y -= BACKBOARD_HEIGHT / 2 - topOffset - halfH));

  const square = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  );

  boardMesh.add(square);
}

function createHoop(isLeftSide) {
  const hoopGroup = new THREE.Group();
  hoopGroup.rotation.y = isLeftSide ? Math.PI / 2 : -Math.PI / 2;

  const BOARD_FRONT_LOCAL_Z = -1.5 + BACKBOARD_THICKNESS / 2;
  const baselineX = isLeftSide ? -COURT_LENGTH / 2 : COURT_LENGTH / 2;
  const groupX = baselineX - BOARD_FRONT_LOCAL_Z * (isLeftSide ? 1 : -1);
  hoopGroup.position.set(groupX, 0, 0);

  // backboard
  const backboard = new THREE.Mesh(
    new THREE.BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_THICKNESS),
    new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
  );
  backboard.position.set(0, RIM_HEIGHT + BACKBOARD_HEIGHT / 2 - 0.15, -0.5);
  hoopGroup.add(backboard);
  addBackboardSquare(backboard);

  // rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_RADIUS, 0.03, 12, 24),
    new THREE.MeshPhongMaterial({ color: 0xff5900 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_HEIGHT, 0);
  hoopGroup.add(rim);

  // net (simple straight lines)
  const netGroup = new THREE.Group();
  const netSegments = 12,
    netHeight = 0.45;
  for (let i = 0; i < netSegments; i++) {
    const a = (i / netSegments) * Math.PI * 2;
    const p1 = new THREE.Vector3(Math.cos(a) * RIM_RADIUS * 0.95, RIM_HEIGHT - 0.02, Math.sin(a) * RIM_RADIUS * 0.95);
    const p2 = p1.clone().setY(RIM_HEIGHT - netHeight);
    netGroup.add(createLine([p1, p2], 0xffffff));
  }
  hoopGroup.add(netGroup);

  // support pole
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x999999 });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, RIM_HEIGHT + BACKBOARD_HEIGHT, 16),
    poleMat
  );
  pole.position.set(0, (RIM_HEIGHT + BACKBOARD_HEIGHT) / 2 - 0.15, -1.25);
  hoopGroup.add(pole);

  // support arm
  const armLen = 1.25 - 0.3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, armLen), poleMat);
  arm.position.set(0, RIM_HEIGHT, -(0.3 + armLen / 2));
  hoopGroup.add(arm);

  scene.add(hoopGroup);

  // return the world-space rim position approximation we will use for now
  const rimWorldPos = new THREE.Vector3();
  rim.getWorldPosition(rimWorldPos);

  return { hoopGroup, rim, rimWorldPos };
}

/* -------------------- 7) Basketball -------------------- */
function createBasketball() {
  const ballMat = new THREE.MeshPhongMaterial({ color: 0xd35400 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 48, 48), ballMat);
  ball.position.set(0, BALL_RADIUS + COURT_HEIGHT / 2, 0);
  ball.castShadow = true;
  scene.add(ball);

  // (Keeping seams simple for now – not required for HW06)

  return ball;
}

/* -------------------- 8) UI -------------------- */
function setupUI() {
  const scoreDiv = document.createElement("div");
  scoreDiv.id = "score";
  scoreDiv.innerHTML = `
    <div><b>Score</b>: <span id="scoreValue">0</span></div>
    <div>Attempts: <span id="attemptsValue">0</span></div>
    <div>Accuracy: <span id="accuracyValue">0%</span></div>
  `;
  document.body.appendChild(scoreDiv);

  const powerDiv = document.createElement("div");
  powerDiv.id = "power";
  powerDiv.innerHTML = `
    <div>Power</div>
    <div id="powerBarWrapper"><div id="powerBar"></div></div>
  `;
  document.body.appendChild(powerDiv);

  const controlsDiv = document.createElement("div");
  controlsDiv.id = "controls";
  controlsDiv.innerHTML = `
    <b>Controls</b><br/>
    Arrow Keys – move ball on court<br/>
    W/S – power up/down<br/>
    Space – shoot<br/>
    R – reset ball<br/>
    O – toggle orbit camera
  `;
  document.body.appendChild(controlsDiv);

  const msgDiv = document.createElement("div");
  msgDiv.id = "msg";
  document.body.appendChild(msgDiv);

  const style = document.createElement("style");
  style.textContent = `
    #score, #controls, #power, #msg {
      position: absolute;
      color: #ffffff;
      font-family: Arial, sans-serif;
      background: rgba(0,0,0,0.4);
      padding: 8px 14px;
      border-radius: 8px;
      pointer-events: none;
    }
    #score { top: 20px; left: 20px; }
    #controls { bottom: 20px; left: 20px; }
    #power { bottom: 20px; right: 20px; min-width: 180px; }
    #powerBarWrapper {
      height: 8px; width: 100%; background: rgba(255,255,255,0.15);
      margin-top: 6px; border-radius: 4px; overflow: hidden;
    }
    #powerBar {
      height: 100%; width: 50%; background: #27ae60;
    }
    #msg {
      top: 20px; right: 20px; font-weight: bold;
    }
  `;
  document.head.appendChild(style);
}

/* -------------------- 9) State -------------------- */
const clock = new THREE.Clock();

let orbitEnabled = true;
const keys = {};

const state = {
  ball: null,
  vel: new THREE.Vector3(0, 0, 0),
  inAir: false,
  power: DEFAULT_POWER,
  stats: {
    score: 0,
    attempts: 0,
    made: 0,
  },
  hoops: {
    left: null,
    right: null,
  },
};

/* -------------------- 10) Init -------------------- */
function initScene() {
  createFloor();
  addCourtMarkings();

  state.hoops.left = createHoop(true);
  state.hoops.right = createHoop(false);

  state.ball = createBasketball();
  setupUI();
}
initScene();

/* -------------------- 11) Camera & Orbit -------------------- */
camera.position.set(0, 12, 24);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* -------------------- 12) Input -------------------- */
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.key.toLowerCase() === "o") {
    orbitEnabled = !orbitEnabled;
    controls.enabled = orbitEnabled;
    return;
  }

  if (e.code === "Space") {
    if (!state.inAir) {
      shoot();
    }
  }

  if (e.code === "KeyR") {
    resetBall();
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

/* -------------------- 13) Core mechanics -------------------- */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function nearestHoopPos() {
  const leftPos = state.hoops.left.rimWorldPos;
  const rightPos = state.hoops.right.rimWorldPos;
  const b = state.ball.position;

  const leftDistSq = leftPos.distanceToSquared(b);
  const rightDistSq = rightPos.distanceToSquared(b);

  return leftDistSq < rightDistSq ? leftPos : rightPos;
}

function shoot() {
  state.stats.attempts++;
  updateStatsUI();

  const target = nearestHoopPos();

  // horizontal direction
  const dir = new THREE.Vector3().subVectors(target, state.ball.position);
  // we’ll manually set y velocity, so zero out y in dir for horizontal direction
  dir.y = 0;
  dir.normalize();

  // scale velocity by power
  const hp = state.power * H_POWER;
  const vp = state.power * V_POWER;

  state.vel.set(dir.x * hp, vp, dir.z * hp);
  state.inAir = true;

  showMsg("SHOOT!");
}

function resetBall() {
  state.ball.position.set(0, BALL_RADIUS + COURT_HEIGHT / 2, 0);
  state.vel.set(0, 0, 0);
  state.inAir = false;
  state.power = DEFAULT_POWER;
  updatePowerUI();
  showMsg("Reset");
}

/* -------------------- 14) UI helpers -------------------- */
function updatePowerUI() {
  const bar = document.getElementById("powerBar");
  if (!bar) return;
  bar.style.width = Math.round(state.power * 100) + "%";
}

function updateStatsUI() {
  const s = state.stats;
  const scoreElem = document.getElementById("scoreValue");
  const attemptsElem = document.getElementById("attemptsValue");
  const accElem = document.getElementById("accuracyValue");

  if (scoreElem) scoreElem.textContent = s.score;
  if (attemptsElem) attemptsElem.textContent = s.attempts;
  if (accElem) {
    const pct = s.attempts > 0 ? ((s.made / s.attempts) * 100).toFixed(1) : "0.0";
    accElem.textContent = pct + "%";
  }
}

let msgTimeout = null;
function showMsg(text, ms = 1000) {
  const div = document.getElementById("msg");
  if (!div) return;
  div.textContent = text;
  if (msgTimeout) clearTimeout(msgTimeout);
  msgTimeout = setTimeout(() => (div.textContent = ""), ms);
}

/* -------------------- 15) Game Loop -------------------- */
function update(dt) {
  // 1) Adjust shot power (Phase 2)
  if (!state.inAir) {
    if (keys["KeyW"]) {
      state.power = clamp(state.power + 0.75 * dt, POWER_MIN, POWER_MAX);
      updatePowerUI();
    }
    if (keys["KeyS"]) {
      state.power = clamp(state.power - 0.75 * dt, POWER_MIN, POWER_MAX);
      updatePowerUI();
    }
  }

  // 2) Move ball with arrows while it's not in the air (Phase 1)
  if (!state.inAir) {
    let dx = 0,
      dz = 0;
    if (keys["ArrowLeft"]) dx -= 1;
    if (keys["ArrowRight"]) dx += 1;
    if (keys["ArrowUp"]) dz -= 1; // forward
    if (keys["ArrowDown"]) dz += 1; // backward

    if (dx !== 0 || dz !== 0) {
      const dir = new THREE.Vector3(dx, 0, dz).normalize();
      const step = MOVE_SPEED * dt;
      state.ball.position.addScaledVector(dir, step);

      // clamp to court
      const minX = -COURT_LENGTH / 2 + BALL_RADIUS;
      const maxX = COURT_LENGTH / 2 - BALL_RADIUS;
      const minZ = -COURT_WIDTH / 2 + BALL_RADIUS;
      const maxZ = COURT_WIDTH / 2 - BALL_RADIUS;

      state.ball.position.x = clamp(state.ball.position.x, minX, maxX);
      state.ball.position.z = clamp(state.ball.position.z, minZ, maxZ);
    }
  }

  // 3) Physics for flight + ground bounce (Phase 3)
  if (state.inAir) {
    // integrate velocity
    state.vel.y += GRAVITY * dt;
    state.ball.position.addScaledVector(state.vel, dt);

    // ground collision
    const bottomY = state.ball.position.y - BALL_RADIUS;
    if (bottomY <= FLOOR_Y) {
      state.ball.position.y = FLOOR_Y + BALL_RADIUS;
      if (Math.abs(state.vel.y) < 0.5) {
        // stop after small bounces
        state.vel.set(0, 0, 0);
        state.inAir = false;
      } else {
        state.vel.y = -state.vel.y * RESTITUTION;
        state.vel.x *= 0.8;
        state.vel.z *= 0.8;
      }
    }

    // (Phase 4+6 later: rim collisions, scoring detection, etc.)
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (orbitEnabled) controls.update();
  update(dt);

  renderer.render(scene, camera);
}
animate();
