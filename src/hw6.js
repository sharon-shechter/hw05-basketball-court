// HW06 – Full version (Phases 1–7) + Aim% + STRICT scoring + visual feedback
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* -------------------- 1) Scene / Camera / Renderer -------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
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
const GRAVITY = -9.8;
const RESTITUTION = 0.45;
const BACKBOARD_BOUNCE = 0.30;
const AIR_FRICTION = 0.995;
const FLOOR_Y = 0;
const MOVE_SPEED = 6;
const POWER_MIN = 0.05;
const POWER_MAX = 1.0;
const DEFAULT_POWER = 0.5;
const H_POWER = 12;
const V_POWER = 9;

// Rim collision tweak
const RIM_BALL_BUFFER = 0.06;
const RIM_RESTITUTION = 0.10;

/* -------------------- 4) Helpers -------------------- */
function createLine(points, color = 0xffffff, lineWidth = 2) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, linewidth: lineWidth });
  return new THREE.Line(geometry, material);
}
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* -------------------- 5) Court -------------------- */
function createFloor() {
  const geometry = new THREE.BoxGeometry(COURT_LENGTH, COURT_HEIGHT, COURT_WIDTH);
  const material = new THREE.MeshPhongMaterial({ color: 0xc68642, shininess: 40 });
  const floor = new THREE.Mesh(geometry, material);
  floor.position.y = -COURT_HEIGHT / 2; // floor top == 0
  floor.receiveShadow = true;
  scene.add(floor);
}

function addCourtMarkings() {
  const markings = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

  const buildLine = (pts) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
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

  markings.add(buildArc(-COURT_LENGTH / 2 + RIM_TO_BASELINE, THREE_POINT_RADIUS, -Math.PI / 2, Math.PI / 2));
  markings.add(buildArc(COURT_LENGTH / 2 - RIM_TO_BASELINE, THREE_POINT_RADIUS, Math.PI / 2, 3 * Math.PI / 2));
  markings.add(buildLine([new THREE.Vector3(0, 0.01, COURT_WIDTH / 2), new THREE.Vector3(0, 0.01, -COURT_WIDTH / 2)]));
  markings.add(buildCircle(FT_RADIUS));

  scene.add(markings);
}

/* -------------------- 6) Hoops -------------------- */
function addBackboardSquare(boardMesh, color = 0xff0000) {
  const w = 0.59, h = 0.45, topOffset = 0.15;
  const halfW = w / 2, halfH = h / 2;
  const pts = [
    new THREE.Vector3(-halfW, halfH, BACKBOARD_THICKNESS / 2 + 0.001),
    new THREE.Vector3(halfW, halfH, BACKBOARD_THICKNESS / 2 + 0.001),
    new THREE.Vector3(halfW, -halfH, BACKBOARD_THICKNESS / 2 + 0.001),
    new THREE.Vector3(-halfW, -halfH, BACKBOARD_THICKNESS / 2 + 0.001),
  ];
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

  const backboard = new THREE.Mesh(
    new THREE.BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_THICKNESS),
    new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
  );
  backboard.position.set(0, RIM_HEIGHT + BACKBOARD_HEIGHT / 2 - 0.15, -0.5);
  hoopGroup.add(backboard);
  addBackboardSquare(backboard);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_RADIUS, 0.03, 12, 24),
    new THREE.MeshPhongMaterial({ color: 0xff5900, emissive: 0x000000 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_HEIGHT, 0);
  hoopGroup.add(rim);

  const netGroup = new THREE.Group();
  const netSegments = 12, netHeight = 0.45;
  for (let i = 0; i < netSegments; i++) {
    const a = (i / netSegments) * Math.PI * 2;
    const p1 = new THREE.Vector3(Math.cos(a) * RIM_RADIUS * 0.95, RIM_HEIGHT - 0.02, Math.sin(a) * RIM_RADIUS * 0.95);
    const p2 = p1.clone().setY(RIM_HEIGHT - netHeight);
    netGroup.add(createLine([p1, p2], 0xffffff));
  }
  hoopGroup.add(netGroup);

  const poleMat = new THREE.MeshPhongMaterial({ color: 0x999999 });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, RIM_HEIGHT + BACKBOARD_HEIGHT, 16),
    poleMat
  );
  pole.position.set(0, (RIM_HEIGHT + BACKBOARD_HEIGHT) / 2 - 0.15, -1.25);
  hoopGroup.add(pole);

  const armLen = 1.25 - 0.3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, armLen), poleMat);
  arm.position.set(0, RIM_HEIGHT, -(0.3 + armLen / 2));
  hoopGroup.add(arm);

  scene.add(hoopGroup);

  const rimWorldPos = new THREE.Vector3();
  rim.getWorldPosition(rimWorldPos);
  const backboardBox = new THREE.Box3().setFromObject(backboard);

  return { hoopGroup, rim, rimWorldPos, backboard, backboardBox };
}

/* -------------------- 7) Basketball -------------------- */
function createBasketball() {
  const ballMat = new THREE.MeshPhongMaterial({ color: 0xd35400 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 48, 48), ballMat);
  ball.position.set(0, BALL_RADIUS + COURT_HEIGHT / 2, 0);
  ball.castShadow = true;
  scene.add(ball);
  return ball;
}

/* -------------------- 8) UI -------------------- */
function setupUI() {
  const scoreDiv = document.createElement("div");
  scoreDiv.id = "score";
  scoreDiv.innerHTML = `
    <div><b>Score</b>: <span id="scoreValue">0</span></div>
    <div>Attempts: <span id="attemptsValue">0</span></div>
    <div>Makes: <span id="makesValue">0</span></div>
    <div>Accuracy: <span id="accuracyValue">0%</span></div>
    <div>Last Aim: <span id="lastAimValue">-</span></div>
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
      transition: box-shadow 0.15s ease, background 0.15s ease;
    }
    #score { top: 20px; left: 20px; }
    #controls { bottom: 20px; left: 20px; }
    #power { bottom: 20px; right: 20px; min-width: 180px; }
    #powerBarWrapper {
      height: 8px; width: 100%; background: rgba(255,255,255,0.15);
      margin-top: 6px; border-radius: 4px; overflow: hidden;
    }
    #powerBar { height: 100%; width: 50%; background: #27ae60; transition: width 0.05s linear; }
    #msg { top: 20px; right: 20px; font-weight: bold; text-shadow: 0 0 6px #000; }
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
  stats: { score: 0, attempts: 0, made: 0 },
  hoops: { left: null, right: null },
  currentShot: null,
  prevPos: new THREE.Vector3(),
};

/* -------------------- 10) Init -------------------- */
function initScene() {
  createFloor();
  addCourtMarkings();
  state.hoops.left = createHoop(true);
  state.hoops.right = createHoop(false);
  state.ball = createBasketball();
  setupUI();
  updateStatsUI();
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
  if (e.code === "Space" && !state.inAir) shoot();
  if (e.code === "KeyR") resetBall();
});
window.addEventListener("keyup", (e) => (keys[e.code] = false));

/* -------------------- 13) Core mechanics -------------------- */
function nearestHoop() {
  const leftPos = state.hoops.left.rimWorldPos;
  const rightPos = state.hoops.right.rimWorldPos;
  const b = state.ball.position;
  return leftPos.distanceToSquared(b) < rightPos.distanceToSquared(b) ? state.hoops.left : state.hoops.right;
}

function shoot() {
  state.stats.attempts++;
  updateStatsUI();

  const targetHoop = nearestHoop();
  const target = targetHoop.rimWorldPos.clone();

  const dir = new THREE.Vector3().subVectors(target, state.ball.position);
  dir.y = 0;
  dir.normalize();

  const hp = state.power * H_POWER;
  const vp = state.power * V_POWER;

  state.vel.set(dir.x * hp, vp, dir.z * hp);
  state.inAir = true;

  state.currentShot = {
    made: false,
    scored: false,
    finished: false,
    hoop: targetHoop,
    minDistToCenter: Infinity,
    aimPct: 0
  };

  showMsg("SHOOT!", 1000, "#ffffff");
}

function resetBall() {
  state.ball.position.set(0, BALL_RADIUS + COURT_HEIGHT / 2, 0);
  state.vel.set(0, 0, 0);
  state.inAir = false;
  state.power = DEFAULT_POWER;
  updatePowerUI();
  updateStatsUI();
  showMsg("Reset", 800, "#ffffff");
}

/* -------------------- 14) UI helpers -------------------- */
function updatePowerUI() {
  const bar = document.getElementById("powerBar");
  if (bar) bar.style.width = Math.round(state.power * 100) + "%";
}
function updateStatsUI() {
  const s = state.stats;
  const scoreElem = document.getElementById("scoreValue");
  const attemptsElem = document.getElementById("attemptsValue");
  const makesElem = document.getElementById("makesValue");
  const accElem = document.getElementById("accuracyValue");

  if (scoreElem) scoreElem.textContent = s.score;
  if (attemptsElem) attemptsElem.textContent = s.attempts;
  if (makesElem) makesElem.textContent = s.made;
  if (accElem) {
    const pct = s.attempts > 0 ? ((s.made / s.attempts) * 100).toFixed(1) : "0.0";
    accElem.textContent = pct + "%";
  }
}
function updateLastAimUI(pct) {
  const el = document.getElementById("lastAimValue");
  if (el) el.textContent = pct + "%";
}

let msgTimeout = null;
function showMsg(text, ms = 1200, color = "#fff") {
  const div = document.getElementById("msg");
  if (!div) return;
  div.textContent = text;
  div.style.color = color;
  if (msgTimeout) clearTimeout(msgTimeout);
  msgTimeout = setTimeout(() => (div.textContent = ""), ms);
}

function flashScorePanel(color) {
  const el = document.getElementById("score");
  if (!el) return;
  const oldBG = el.style.background;
  const oldShadow = el.style.boxShadow;
  el.style.background = color === "green" ? "rgba(0,255,0,0.15)" : "rgba(255,0,0,0.15)";
  el.style.boxShadow = color === "green" ? "0 0 20px rgba(0,255,0,0.7)" : "0 0 20px rgba(255,0,0,0.7)";
  setTimeout(() => {
    el.style.background = oldBG || "rgba(0,0,0,0.4)";
    el.style.boxShadow = oldShadow || "none";
  }, 400);
}

function rimFlash(hoop, colorHex) {
  if (!hoop || !hoop.rim || !hoop.rim.material || !hoop.rim.material.emissive) return;
  const mat = hoop.rim.material;
  const old = mat.emissive.clone();
  mat.emissive.setHex(colorHex);
  setTimeout(() => mat.emissive.copy(old), 250);
}

/* -------------------- 15) Collision helpers -------------------- */
function resolveSphereAABBCollision(center, radius, box, vel, restitution) {
  const closest = new THREE.Vector3(
    clamp(center.x, box.min.x, box.max.x),
    clamp(center.y, box.min.y, box.max.y),
    clamp(center.z, box.min.z, box.max.z)
  );
  const diff = new THREE.Vector3().subVectors(center, closest);
  const distSq = diff.lengthSq();

  if (distSq < radius * radius) {
    const dist = Math.sqrt(distSq);
    let normal;
    if (dist === 0) {
      normal = vel.lengthSq() > 0 ? vel.clone().normalize().negate() : new THREE.Vector3(1, 0, 0);
    } else {
      normal = diff.multiplyScalar(1 / dist);
    }

    const penetration = radius - dist;
    center.addScaledVector(normal, penetration + 1e-4);

    const vn = normal.dot(vel);
    const vt = vel.clone().sub(normal.clone().multiplyScalar(vn));
    const vNew = vt.clone().add(normal.multiplyScalar(-vn * restitution));
    vel.copy(vNew);
    return true;
  }
  return false;
}

// Let the ball pass the rim if falling; bounce (soft) only if rising into it
function resolveRimCollision(ballPos, vel, hoop) {
  const rimPos = hoop.rimWorldPos;
  const horizontalDist = Math.hypot(ballPos.x - rimPos.x, ballPos.z - rimPos.z);

  const nearVert = Math.abs(ballPos.y - RIM_HEIGHT) < BALL_RADIUS * 2.0;
  const minDist = RIM_RADIUS + BALL_RADIUS - RIM_BALL_BUFFER;

  if (nearVert && horizontalDist < minDist) {
    if (vel.y <= 0) return false;

    const normal = new THREE.Vector3(
      (ballPos.x - rimPos.x) / (horizontalDist || 1),
      0,
      (ballPos.z - rimPos.z) / (horizontalDist || 1)
    );

    const penetration = minDist - horizontalDist;
    ballPos.addScaledVector(normal, penetration + 1e-4);

    const vHoriz = new THREE.Vector3(vel.x, 0, vel.z);
    const vn = normal.dot(vHoriz);
    if (vn < 0) {
      const vt = vHoriz.clone().sub(normal.clone().multiplyScalar(vn));
      const vHorizNew = vt.clone().add(normal.multiplyScalar(-vn * RIM_RESTITUTION));
      vel.x = vHorizNew.x;
      vel.z = vHorizNew.z;
    }

    vel.y *= 0.9;
    return true;
  }
  return false;
}

/* -------------------- 16) Scoring (STRICT) + Aim% -------------------- */
function computeAimPct(minDist) {
  const maxBad = RIM_RADIUS + BALL_RADIUS;
  const norm = 1 - clamp(minDist / maxBad, 0, 1);
  return Math.round(norm * 100);
}

function finalizeShotAsMiss() {
  if (state.currentShot && !state.currentShot.finished) {
    state.currentShot.finished = true;
    const aimPct = computeAimPct(state.currentShot.minDistToCenter);
    state.currentShot.aimPct = aimPct;
    updateLastAimUI(aimPct);
    showMsg(`MISSED SHOT (aim ${aimPct}%)`, 1500, "#ff4d4d");
    flashScorePanel("red");
    rimFlash(state.currentShot.hoop, 0xff0000);
    updateStatsUI();
  }
}

function finalizeShotAsMake() {
  if (state.currentShot && !state.currentShot.finished) {
    state.currentShot.finished = true;
    const aimPct = computeAimPct(state.currentShot.minDistToCenter);
    state.currentShot.aimPct = aimPct;
    updateLastAimUI(aimPct);
    showMsg(`SHOT MADE! +2 (aim ${aimPct}%)`, 1500, "#00ff88");
    flashScorePanel("green");
    rimFlash(state.currentShot.hoop, 0x00ff00);
    updateStatsUI();
  }
}

// STRICT: must be going DOWN, cross rim plane top->bottom, center inside ring (with margin)
function checkScoreStrict(prevPos, currPos, vel, hoop) {
  if (!state.currentShot || state.currentShot.made) return;
  if (vel.y >= 0) return; // must be downward

  const rimPos = hoop.rimWorldPos;
  const wasAbove = prevPos.y > RIM_HEIGHT;
  const nowBelow = currPos.y <= RIM_HEIGHT;
  if (!wasAbove || !nowBelow) return;

  const horizDist = Math.hypot(currPos.x - rimPos.x, currPos.z - rimPos.z);
  const inside = horizDist <= (RIM_RADIUS - BALL_RADIUS * 0.10);

  if (inside) {
    state.stats.score += 2;
    state.stats.made += 1;
    state.currentShot.made = true;
    state.currentShot.scored = true;
    finalizeShotAsMake();
  }
}

/* -------------------- 17) Rotation animation -------------------- */
function applyBallRotation(dt) {
  const speed = state.vel.length();
  if (speed < 1e-4) return;
  const v = state.vel.clone();
  const axis = new THREE.Vector3(-v.z, 0, v.x);
  if (axis.lengthSq() < 1e-6) return;
  axis.normalize();
  const angularSpeed = speed / BALL_RADIUS;
  state.ball.rotateOnAxis(axis, angularSpeed * dt);
}

/* -------------------- 18) Game Loop -------------------- */
function update(dt) {
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

  if (!state.inAir) {
    let dx = 0, dz = 0;
    if (keys["ArrowLeft"]) dx -= 1;
    if (keys["ArrowRight"]) dx += 1;
    if (keys["ArrowUp"]) dz -= 1;
    if (keys["ArrowDown"]) dz += 1;

    if (dx !== 0 || dz !== 0) {
      const dir = new THREE.Vector3(dx, 0, dz).normalize();
      const step = MOVE_SPEED * dt;
      state.ball.position.addScaledVector(dir, step);

      const minX = -COURT_LENGTH / 2 + BALL_RADIUS;
      const maxX = COURT_LENGTH / 2 - BALL_RADIUS;
      const minZ = -COURT_WIDTH / 2 + BALL_RADIUS;
      const maxZ = COURT_WIDTH / 2 - BALL_RADIUS;

      state.ball.position.x = clamp(state.ball.position.x, minX, maxX);
      state.ball.position.z = clamp(state.ball.position.z, minZ, maxZ);
    }
  }

  const prevPos = state.prevPos.clone();

  if (state.inAir) {
    state.vel.y += GRAVITY * dt;
    state.vel.multiplyScalar(AIR_FRICTION);
    state.ball.position.addScaledVector(state.vel, dt);

    // Aim% tracking
    if (state.currentShot && state.currentShot.hoop) {
      const rimPos = state.currentShot.hoop.rimWorldPos;
      const d = Math.hypot(state.ball.position.x - rimPos.x, state.ball.position.z - rimPos.z);
      if (d < state.currentShot.minDistToCenter) state.currentShot.minDistToCenter = d;
    }

    // collisions
    resolveRimCollision(state.ball.position, state.vel, state.hoops.left);
    resolveRimCollision(state.ball.position, state.vel, state.hoops.right);
    resolveSphereAABBCollision(state.ball.position, BALL_RADIUS, state.hoops.left.backboardBox, state.vel, BACKBOARD_BOUNCE);
    resolveSphereAABBCollision(state.ball.position, BALL_RADIUS, state.hoops.right.backboardBox, state.vel, BACKBOARD_BOUNCE);

    // ground
    const bottomY = state.ball.position.y - BALL_RADIUS;
    if (bottomY <= FLOOR_Y) {
      state.ball.position.y = FLOOR_Y + BALL_RADIUS;
      if (Math.abs(state.vel.y) < 0.6 && state.vel.length() < 0.6) {
        state.vel.set(0, 0, 0);
        state.inAir = false;
        if (state.currentShot && !state.currentShot.made && !state.currentShot.finished) {
          finalizeShotAsMiss();
        }
      } else {
        state.vel.y = -state.vel.y * RESTITUTION;
        state.vel.x *= 0.8;
        state.vel.z *= 0.8;
      }
    }

    // strict scoring check
    checkScoreStrict(prevPos, state.ball.position, state.vel, state.hoops.left);
    checkScoreStrict(prevPos, state.ball.position, state.vel, state.hoops.right);
  }

  applyBallRotation(dt);

  state.prevPos.copy(state.ball.position);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (orbitEnabled) controls.update();
  update(dt);
  renderer.render(scene, camera);
}
animate();

/* -------------------- 19) Resize -------------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
