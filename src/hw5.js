// hw5.js – Updated implementation for HW05 infrastructure
// NOTE: This file completely replaces the original starter file.
// --------------------------------------------------------------
// 1. Scene / Camera / Renderer boilerplate (kept from starter)
// --------------------------------------------------------------
import { OrbitControls } from "./OrbitControls.js";

// Three.js is expected as a global (via script tag) or bundled via a module system.
// If you are using modules, uncomment the next line:
// import * as THREE from "three";

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;

// --------------------------------------------------------------
// 2. Lighting
// --------------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 15);
dirLight.castShadow = true;
scene.add(dirLight);

// --------------------------------------------------------------
// 3. Constants – Court sizing (in meters, approximated to real court)
// --------------------------------------------------------------
const COURT_LENGTH = 28; // full court length
const COURT_WIDTH = 15; // full court width
const COURT_HEIGHT = 0.2; // thickness of floor box
const THREE_POINT_RADIUS = 6.75; // radius of 3‑pt arc (FIBA spec)
const RIM_HEIGHT = 3.05; // 10 ft ≈ 3.05 m
const RIM_RADIUS = 0.45; // inner radius (45 cm)
const BACKBOARD_WIDTH = 1.8;
const BACKBOARD_HEIGHT = 1.05;
const BACKBOARD_THICKNESS = 0.05;

// --------------------------------------------------------------
// 4. Helpers
// --------------------------------------------------------------
/** Utility to create a continuous line from an array of Vector3 points */
function createLine(points, color = 0xffffff, lineWidth = 2) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, linewidth: lineWidth });
  return new THREE.Line(geometry, material);
}

/** Generates arc points from angleStart to angleEnd (radians) */
function generateArcPoints(radius, angleStart, angleEnd, segments = 64) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = angleStart + t * (angleEnd - angleStart);
    pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius));
  }
  return pts;
}

// --------------------------------------------------------------
// 5. Court – Floor & Markings
// --------------------------------------------------------------
const RIM_TO_BASELINE = 1.575;   // m  distance from baseline to rim
const FT_RADIUS       = 1.8;     // m  radius of centre circle (1 .80 m)

function createFloor() {
  const geometry = new THREE.BoxGeometry(COURT_LENGTH, COURT_HEIGHT, COURT_WIDTH);
  const material = new THREE.MeshPhongMaterial({ color: 0xc68642, shininess: 40 });
  const floor    = new THREE.Mesh(geometry, material);
  floor.position.y = -COURT_HEIGHT / 2;      // put floor top at y = 0
  floor.receiveShadow = true;
  scene.add(floor);
}

function addCourtMarkings() {
  const markings = new THREE.Group();
  const lineMat  = new THREE.LineBasicMaterial({ color: 0xffffff });

  /* ── helper builders ───────────────────────────────────── */
  const buildLine = pts =>
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

  /* ---------- three-point arcs ---------- */
  const TP_RADIUS = 6.75; // FIBA spec
  // left baseline (−x) : arc opens toward +x
  markings.add(
    buildArc(-COURT_LENGTH / 2 + RIM_TO_BASELINE,
             TP_RADIUS,
             -Math.PI / 2, Math.PI / 2)
  );
  // right baseline (+x) : mirrored
  markings.add(
    buildArc( COURT_LENGTH / 2 - RIM_TO_BASELINE,
              TP_RADIUS,
              Math.PI / 2, 3 * Math.PI / 2)
  );

  /* ---------- centre line & circle ---------- */
  markings.add(
    buildLine([
      new THREE.Vector3(0, 0.01,  COURT_WIDTH / 2),
      new THREE.Vector3(0, 0.01, -COURT_WIDTH / 2)
    ])
  );
  markings.add(buildCircle(FT_RADIUS));   // centre circle

  scene.add(markings);
}

// --------------------------------------------------------------
// 6. Hoops (Backboard, Rim, Net, Support)
// --------------------------------------------------------------
function createHoop(isLeftSide) {
  const hoopGroup = new THREE.Group();

  /* orientation */
  hoopGroup.rotation.y = isLeftSide ?  Math.PI / 2 : -Math.PI / 2;

  /* --- place hoop flush with baseline --- */
  const BOARD_FRONT_LOCAL_Z = -1.5 + BACKBOARD_THICKNESS / 2; // board’s front z
  const baselineX           = isLeftSide ? -COURT_LENGTH / 2 :  COURT_LENGTH / 2
  const groupX = baselineX - BOARD_FRONT_LOCAL_Z * (isLeftSide ? 1 : -1);
  hoopGroup.position.set(groupX, 0, 0);
  /* ---------- backboard ---------- */
  const backboard = new THREE.Mesh(
    new THREE.BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_THICKNESS),
    new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
  );
  backboard.position.set(0, RIM_HEIGHT + BACKBOARD_HEIGHT / 2 - 0.15, -0.30);
  hoopGroup.add(backboard);

  /* ---------- rim ---------- */
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_RADIUS, 0.03, 12, 24),
    new THREE.MeshPhongMaterial({ color: 0xff5900 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_HEIGHT, 0);
  hoopGroup.add(rim);

  /* ---------- net ---------- */
  const netGroup = new THREE.Group();
  const netSegments = 12, netHeight = 0.45;
  for (let i = 0; i < netSegments; i++) {
    const a = (i / netSegments) * Math.PI * 2;
    const p1 = new THREE.Vector3(Math.cos(a) * RIM_RADIUS * 0.95, RIM_HEIGHT - 0.02, Math.sin(a) * RIM_RADIUS * 0.95);
    const p2 = p1.clone().setY(RIM_HEIGHT - netHeight);
    netGroup.add(createLine([p1, p2], 0xffffff));
  }
  hoopGroup.add(netGroup);

  /* ---------- support pole ---------- */
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x999999 });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, RIM_HEIGHT + BACKBOARD_HEIGHT, 16),
    poleMat
  );
  pole.position.set(0, (RIM_HEIGHT + BACKBOARD_HEIGHT) / 2 - 0.15, -1.25);
  hoopGroup.add(pole);

  /* ---------- support arm ---------- */
  const armLen = 1.25 - 0.30; // pole→board distance minus board offset
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, armLen),
    poleMat
  );
  arm.position.set(0, RIM_HEIGHT, -(0.30 + armLen / 2));
  hoopGroup.add(arm);

  /* push to scene */
  scene.add(hoopGroup);
}

// --------------------------------------------------------------
// 7. Basketball (Static)
// --------------------------------------------------------------
function createBasketball() {
  const ballGeo = new THREE.SphereGeometry(0.375, 32, 32);
  const ballMat = new THREE.MeshPhongMaterial({ color: 0xd35400 }); // orange
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.set(0, 0.375 + COURT_HEIGHT / 2, 0);
  ball.castShadow = true;
  scene.add(ball);

  // Basic black seam lines (longitude/latitude circles)
  const seamMat = new THREE.LineBasicMaterial({ color: 0x000000 });

  // Equator line
  const equatorPts = generateArcPoints(0.375 + 0.001, 0, Math.PI * 2, 128);
  const equator = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(equatorPts),
    seamMat
  );
  equator.rotation.y = Math.PI / 2;
  equator.position.copy(ball.position);
  scene.add(equator);

  // Longitudinal line
  const longPts = generateArcPoints(0.375 + 0.001, 0, Math.PI * 2, 128);
  const longitude = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(longPts),
    seamMat
  );
  longitude.position.copy(ball.position);
  scene.add(longitude);
}

// --------------------------------------------------------------
// 8. UI Containers
// --------------------------------------------------------------
function setupUI() {
  // Score container
  const scoreDiv = document.createElement("div");
  scoreDiv.id = "score";
  scoreDiv.innerText = "Score: 0";
  document.body.appendChild(scoreDiv);

  // Controls container (already contains O key info)
  const controlsDiv = document.createElement("div");
  controlsDiv.id = "controls";
  controlsDiv.innerHTML = `<h3>Controls (HW05)</h3><p>O – Toggle Orbit Controls</p>`;
  document.body.appendChild(controlsDiv);

  // Basic CSS (inline for simplicity – you may move to external CSS)
  const style = document.createElement("style");
  style.textContent = `
      #score, #controls {
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
    `;
  document.head.appendChild(style);
}

// --------------------------------------------------------------
// 9. Initialisation sequence
// --------------------------------------------------------------
function initScene() {
  createFloor();
  addCourtMarkings();
  createHoop(true);   // left baseline (−x)
createHoop(false);  // right baseline (+x)

  createBasketball();
  setupUI();
}

// Execute once
initScene();

// --------------------------------------------------------------
// 10. Camera & Controls configuration
// --------------------------------------------------------------
// Place camera at slight diagonal looking toward center
camera.position.set(0, 12, 24);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
let orbitEnabled = true;

// Handle O key toggle
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "o") {
    orbitEnabled = !orbitEnabled;
    controls.enabled = orbitEnabled;
  }
});

// --------------------------------------------------------------
// 11. Animation loop
// --------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  if (orbitEnabled) controls.update();
  renderer.render(scene, camera);
}

animate();

// --------------------------------------------------------------
// End of file
