import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bodies, bodyMap } from './solarData.js';

const DAY_MS = 86_400_000;
const START_DATE = new Date();
const simulationSpeeds = [
  { label: '1.00x', secondsPerSecond: 1 },
  { label: '60x', secondsPerSecond: 60 },
  { label: '1h/s', secondsPerSecond: 3600 },
  { label: '1d/s', secondsPerSecond: 86400 },
  { label: '7d/s', secondsPerSecond: 604_800 },
  { label: '30d/s', secondsPerSecond: 2_592_000 },
  { label: '1y/s', secondsPerSecond: 31_557_600 },
  { label: '10y/s', secondsPerSecond: 315_576_000 },
  { label: 'Orbit/10s', orbitSeconds: 10 },
];

const viewModeLabels = {
  orbit: 'Orbit',
  helical: '3D Spiral',
  follow: 'Follow',
};

const trailBodyIds = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const trailColors = {
  mercury: '#d9d2c8',
  venus: '#ffd57a',
  earth: '#4da3ff',
  mars: '#ff744a',
  jupiter: '#ffd45f',
  saturn: '#f0d08a',
  uranus: '#68f1ff',
  neptune: '#4f7cff',
};

function formatNumber(value, unit = '') {
  return `${new Intl.NumberFormat('zh-CN').format(Math.round(value))}${unit}`;
}

function formatFixed(value, digits = 2) {
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatLunarDate(date) {
  try {
    return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return '当前浏览器不支持农历格式';
  }
}

function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function estimateEscapeVelocity(body) {
  const gravity = Number.parseFloat(body.gravity);
  if (!Number.isFinite(gravity)) return '—';
  const velocity = Math.sqrt(2 * gravity * body.radiusKm * 1000) / 1000;
  return `${formatFixed(velocity, 1)} km/s`;
}

function pseudoSkyCoordinate(body, type) {
  const seed = [...body.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  if (type === 'ra') {
    const hours = seed % 24;
    const minutes = (seed * 7) % 60;
    const seconds = (seed * 13) % 60;
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  const sign = seed % 2 ? '+' : '-';
  const degrees = (seed * 3) % 80;
  const minutes = (seed * 5) % 60;
  const seconds = (seed * 11) % 60;
  return `${sign}${String(degrees).padStart(2, '0')}° ${String(minutes).padStart(2, '0')}′ ${String(seconds).padStart(2, '0')}″`;
}

function bodyPhase(id) {
  const phaseOverrides = {
    mercury: 5,
    venus: 25,
    earth: 135,
    mars: 50,
    jupiter: 230,
    saturn: 210,
    uranus: 305,
    neptune: 20,
  };
  if (phaseOverrides[id] !== undefined) return THREE.MathUtils.degToRad(phaseOverrides[id]);
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return THREE.MathUtils.degToRad(hash);
}

function createOrbitLine(radius, eccentricity, color, opacity = 0.32) {
  const points = [];
  const segments = 240;
  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    const x = Math.cos(theta) * radius * (1 + eccentricity);
    const z = Math.sin(theta) * radius * (1 - eccentricity);
    points.push(new THREE.Vector3(x, 0, z));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.Line(geometry, material);
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.34)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.32, 'rgba(255,255,255,0.86)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHelicalTrail(color, pointCount = 300, opacity = 0.74, glowTexture) {
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, pointCount);
  const baseColor = new THREE.Color(color);
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1);
    const intensity = 0.012 + Math.pow(progress, 2.45) * 1.85;
    colors[index * 3] = baseColor.r * intensity;
    colors[index * 3 + 1] = baseColor.g * intensity;
    colors[index * 3 + 2] = baseColor.b * intensity;
  }
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;

  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', geometry.getAttribute('position'));
  glowGeometry.setAttribute('color', geometry.getAttribute('color'));
  glowGeometry.setDrawRange(0, pointCount);
  const glowMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    vertexColors: true,
    size: 0.3,
    sizeAttenuation: true,
    transparent: true,
    opacity: opacity * 0.56,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowLine = new THREE.Points(glowGeometry, glowMaterial);
  glowLine.frustumCulled = false;

  const outerGlowGeometry = new THREE.BufferGeometry();
  outerGlowGeometry.setAttribute('position', geometry.getAttribute('position'));
  outerGlowGeometry.setAttribute('color', geometry.getAttribute('color'));
  outerGlowGeometry.setDrawRange(0, pointCount);
  const outerGlowMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    vertexColors: true,
    size: 0.82,
    sizeAttenuation: true,
    transparent: true,
    opacity: opacity * 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const outerGlowLine = new THREE.Points(outerGlowGeometry, outerGlowMaterial);
  outerGlowLine.frustumCulled = false;

  const group = new THREE.Group();
  group.add(outerGlowLine, glowLine, line);
  return {
    line,
    group,
    glowLine,
    outerGlowLine,
    positions,
    colors,
    geometry,
    glowGeometry,
    outerGlowGeometry,
    material,
    glowMaterial,
    outerGlowMaterial,
    pointCount,
  };
}

function createSunMotionLine() {
  const pointCount = 72;
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const baseColor = new THREE.Color('#ffbf47');
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1);
    const intensity = 1 - Math.pow(progress, 0.72) * 0.94;
    colors[index * 3] = baseColor.r * intensity;
    colors[index * 3 + 1] = baseColor.g * intensity;
    colors[index * 3 + 2] = baseColor.b * intensity;
  }
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  return { line, positions, colors, geometry, material, pointCount };
}

function getRushingTrailPoint(body, currentPosition, sunPosition, progress, mode, out) {
  const tail = 1 - progress;
  const currentAngle = Math.atan2(currentPosition.y - sunPosition.y, currentPosition.x - sunPosition.x);
  const turns = THREE.MathUtils.clamp(3.15 - body.orbitRadius * 0.075, 1.15, 3.05);
  const angle = currentAngle - tail * turns * Math.PI * 2;
  const depth = mode === 'follow' ? 42 : 62;
  const currentRadius = Math.hypot(currentPosition.x - sunPosition.x, currentPosition.y - sunPosition.y);
  const radius = Math.max(currentRadius, body.orbitRadius * 0.8);
  const pinch = Math.pow(tail, 0.82);
  const curl = Math.sin(tail * Math.PI) * 0.52 + 0.48;
  const coilRadius = currentRadius + radius * pinch * curl * 0.28;

  out.set(
    sunPosition.x + Math.cos(angle) * coilRadius,
    sunPosition.y + Math.sin(angle) * coilRadius,
    currentPosition.z - tail * depth + Math.sin(angle) * radius * pinch,
  );
  return out;
}

function createStarField(starTexture) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  for (let i = 0; i < 18000; i += 1) {
    const radius = THREE.MathUtils.randFloat(36, 230);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
    const brightness = THREE.MathUtils.randFloat(0.7, 1);
    colors.push(brightness, brightness, THREE.MathUtils.randFloat(0.86, 1));
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: starTexture,
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      alphaTest: 0.02,
    }),
  );
}

function createMilkyWayBand(starTexture) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  for (let i = 0; i < 12000; i += 1) {
    const x = THREE.MathUtils.randFloatSpread(180);
    const y = THREE.MathUtils.randFloatSpread(8) + Math.sin(x * 0.035) * 4;
    const z = THREE.MathUtils.randFloat(-150, -55) + Math.cos(x * 0.018) * 14;
    positions.push(x, y, z);
    const warmth = THREE.MathUtils.randFloat(0.62, 1);
    colors.push(warmth * 0.72, warmth * 0.82, warmth);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: starTexture,
    size: 0.19,
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    alphaTest: 0.02,
  });
  const band = new THREE.Points(geometry, material);
  band.rotation.z = THREE.MathUtils.degToRad(-14);
  band.rotation.x = THREE.MathUtils.degToRad(10);
  return band;
}

function createSunMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, '#9f3b11');
  gradient.addColorStop(0.35, '#ff9d24');
  gradient.addColorStop(0.7, '#ffd66d');
  gradient.addColorStop(1, '#f15f16');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 240; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = 4 + Math.random() * 28;
    const spot = ctx.createRadialGradient(x, y, 0, x, y, r);
    spot.addColorStop(0, 'rgba(255, 252, 175, 0.9)');
    spot.addColorStop(0.36, 'rgba(255, 132, 22, 0.36)');
    spot.addColorStop(1, 'rgba(140, 36, 8, 0)');
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 180; i += 1) {
    ctx.fillStyle = `rgba(92, 18, 5, ${0.08 + Math.random() * 0.11})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, Math.random() * 256, 2 + Math.random() * 8, 1 + Math.random() * 5, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let y = 0; y < 256; y += 5) {
    ctx.strokeStyle = `rgba(255, 238, 150, ${0.08 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 12) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + y * 0.12) * 5 + Math.sin(x * 0.021) * 3);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, color: '#ffbd48' });
}

function createProceduralPlanetTexture(body) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(body.color);
  const palette = {
    mercury: ['#6d6964', '#a49a8f', '#d0c2ad'],
    venus: ['#8e5f2d', '#d89b52', '#f1cb82'],
    mars: ['#6f2f1f', '#bf5b38', '#e09a62'],
    moon: ['#65635f', '#aaa69c', '#d4d0c4'],
    uranus: ['#74dce5', '#a7f2f4', '#5bb8c7'],
    neptune: ['#163f9c', '#2c75ff', '#7aa5ff'],
  };
  const colors = palette[body.id] ?? [body.color, base.clone().offsetHSL(0, 0, 0.16).getStyle(), base.clone().offsetHSL(0, 0, -0.14).getStyle()];
  const gradient = ctx.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, colors[2]);
  gradient.addColorStop(0.48, colors[1]);
  gradient.addColorStop(1, colors[0]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);

  const isIce = ['uranus', 'neptune'].includes(body.id);
  if (isIce) {
    for (let y = 0; y < 256; y += 6) {
      ctx.strokeStyle = `rgba(235,255,255,${0.06 + Math.random() * 0.08})`;
      ctx.lineWidth = 2 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 18) {
        ctx.lineTo(x, y + Math.sin(x * 0.025 + y * 0.09) * 7);
      }
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 96; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 256, 8 + Math.random() * 36, 3 + Math.random() * 16, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 256, 5 + Math.random() * 22, 2 + Math.random() * 12, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLabelSprite(body) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 34px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(3, 8, 17, 0.64)';
  ctx.strokeStyle = 'rgba(125, 248, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(12, 22, 330, 74, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(245, 248, 255, 0.94)';
  ctx.fillText(body.name, 34, 58);
  ctx.font = '500 22px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(157, 177, 207, 0.88)';
  ctx.fillText(body.zh, 34, 84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: body.type === 'moon' ? 0.48 : 0.78,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const labelScale = body.type === 'moon' ? 1.72 : 2.9;
  sprite.scale.set(labelScale, labelScale * 0.33, 1);
  sprite.position.set(body.scaleRadius * 1.2 + 0.42, body.scaleRadius * 1.08 + 0.28, 0);
  return sprite;
}

function createPlanetMaterial(body) {
  if (body.id === 'earth') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 512, 256);
    gradient.addColorStop(0, '#0d3b78');
    gradient.addColorStop(0.55, '#2d7fd6');
    gradient.addColorStop(1, '#081f3f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#2c8b5d';
    for (let i = 0; i < 28; i += 1) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + Math.random() * 46, 6 + Math.random() * 22, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 34; i += 1) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.ellipse(x, y, 14 + Math.random() * 60, 3 + Math.random() * 9, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.02,
      emissive: '#1b2d4a',
      emissiveIntensity: 0.16,
    });
  }

  if (['jupiter', 'saturn'].includes(body.id)) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const base = new THREE.Color(body.color);
    for (let y = 0; y < 256; y += 1) {
      const tone = 0.76 + Math.sin(y * 0.13) * 0.16 + Math.sin(y * 0.031) * 0.1;
      ctx.fillStyle = `rgb(${Math.floor(base.r * tone * 255)}, ${Math.floor(base.g * tone * 255)}, ${Math.floor(base.b * tone * 255)})`;
      ctx.fillRect(0, y, 512, 1);
    }
    for (let y = 0; y < 256; y += 10) {
      ctx.strokeStyle = `rgba(255, 245, 210, ${0.08 + Math.random() * 0.1})`;
      ctx.lineWidth = 2 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.028 + y * 0.06) * 5);
      }
      ctx.stroke();
    }
    if (body.id === 'jupiter') {
      ctx.fillStyle = 'rgba(170, 72, 48, 0.78)';
      ctx.beginPath();
      ctx.ellipse(350, 140, 34, 18, -0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.72,
      metalness: 0,
      emissive: body.color,
      emissiveIntensity: 0.13,
    });
  }

  const texture = createProceduralPlanetTexture(body);
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: body.type === 'moon' ? 0.94 : 0.78,
    metalness: 0.02,
    emissive: body.color,
    emissiveIntensity: body.type === 'moon' ? 0.08 : 0.11,
  });
}

function buildSolarScene(mount, options) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03060d');
  scene.fog = new THREE.FogExp2('#03060d', 0.008);

  const camera = new THREE.PerspectiveCamera(54, mount.clientWidth / mount.clientHeight, 0.05, 800);
  camera.position.set(0, 28, 46);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 130;
  controls.panSpeed = 0.72;
  controls.rotateSpeed = 0.66;

  const ambient = new THREE.AmbientLight('#6d88b7', 0.22);
  scene.add(ambient);
  const sunLight = new THREE.PointLight('#fff0c6', 8.5, 230, 1.18);
  scene.add(sunLight);
  const cameraLight = new THREE.PointLight('#dbeaff', 4.6, 120, 1.5);
  scene.add(cameraLight);

  const starTexture = createStarTexture();
  const galaxy = createStarField(starTexture);
  scene.add(galaxy);
  const milkyWay = createMilkyWayBand(starTexture);
  scene.add(milkyWay);

  const systemRoot = new THREE.Group();
  scene.add(systemRoot);
  const helicalTrailGroup = new THREE.Group();
  scene.add(helicalTrailGroup);
  const sunMotionLine = createSunMotionLine();
  scene.add(sunMotionLine.line);
  const trailGlowTexture = createGlowTexture();

  const bodyNodes = new Map();
  const orbitPivots = new Map();
  const worldPositions = new Map();
  const orbitLines = [];
  const trailNodes = new Map();
  const sunBody = bodyMap.sun;

  for (const id of trailBodyIds) {
    const trail = createHelicalTrail(
      trailColors[id],
      ['jupiter', 'saturn', 'uranus', 'neptune'].includes(id) ? 2400 : 1900,
      id === 'jupiter' ? 0.96 : 0.86,
      trailGlowTexture,
    );
    trail.group.visible = false;
    helicalTrailGroup.add(trail.group);
    trailNodes.set(id, trail);
  }

  for (const body of bodies) {
    const parentGroup = body.parent ? bodyNodes.get(body.parent)?.group : systemRoot;
    if (!parentGroup) continue;

    const pivot = new THREE.Group();
    pivot.rotation.x = THREE.MathUtils.degToRad(body.inclination);
    parentGroup.add(pivot);
    orbitPivots.set(body.id, pivot);

    if (body.parent && body.orbitRadius > 0) {
      const orbit = createOrbitLine(
        body.orbitRadius,
        body.eccentricity,
        body.type === 'moon' ? '#6f7e99' : '#4e6f9e',
        body.type === 'moon' ? 0.22 : 0.28,
      );
      orbit.rotation.x = THREE.MathUtils.degToRad(body.inclination);
      parentGroup.add(orbit);
      orbitLines.push({ orbit, type: body.type, defaultOpacity: body.type === 'moon' ? 0.22 : 0.28 });
    }

    const group = new THREE.Group();
    group.position.x = body.orbitRadius;
    pivot.add(group);

    const geometry = new THREE.SphereGeometry(body.scaleRadius, body.type === 'moon' ? 36 : 72, body.type === 'moon' ? 18 : 36);
    const material = body.id === 'sun'
      ? createSunMaterial()
      : createPlanetMaterial(body);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = THREE.MathUtils.degToRad(body.axialTilt);
    group.add(mesh);

    if (body.id === 'sun') {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 1.58, 96, 48),
        new THREE.MeshBasicMaterial({
          color: '#ff8a1d',
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      group.add(glow);
      const corona = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 2.05, 96, 48),
        new THREE.MeshBasicMaterial({
          color: '#ff5c14',
          transparent: true,
          opacity: 0.055,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      group.add(corona);
    }

    if (body.type === 'planet') {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 1.08, 64, 32),
        new THREE.MeshBasicMaterial({
          color: body.color,
          transparent: true,
          opacity: body.id === 'earth' ? 0.11 : 0.07,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      group.add(atmosphere);
    }

    if (body.id === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 2.35, 128),
        new THREE.MeshStandardMaterial({
          color: '#d6c79f',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.62,
          roughness: 0.9,
        }),
      );
      ring.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(26.7);
      group.add(ring);
    }

    if (body.id === 'uranus') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 1.65, 96),
        new THREE.MeshStandardMaterial({
          color: '#91d9df',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.18,
        }),
      );
      ring.rotation.x = THREE.MathUtils.degToRad(7);
      group.add(ring);
    }

    const marker = body.type === 'star'
      ? null
      : new THREE.Mesh(
        new THREE.RingGeometry(body.scaleRadius * 1.22, body.scaleRadius * 1.3, 72),
        new THREE.MeshBasicMaterial({
          color: '#7df8ff',
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
    if (marker) {
      marker.rotation.x = Math.PI / 2;
      group.add(marker);
    }

    const label = createLabelSprite(body);
    group.add(label);

    bodyNodes.set(body.id, { body, pivot, group, mesh, marker, label });
    worldPositions.set(body.id, new THREE.Vector3());
  }

  const clock = new THREE.Clock();
  const targetPosition = new THREE.Vector3();
  const cameraGoal = new THREE.Vector3();
  const lookAtGoal = new THREE.Vector3();
  const currentLook = new THREE.Vector3();
  const previousTarget = new THREE.Vector3();
  const targetDelta = new THREE.Vector3();
  const followSunVector = new THREE.Vector3();
  const followSideVector = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  const backgroundOffset = new THREE.Vector3();
  let simDays = 0;
  let elapsedSeconds = 0;
  let raf = 0;
  let cameraTransition = 1;
  let lastSelectedId = '';
  let lastViewMode = '';
  let lastCameraRevision = -1;
  const trailPoint = new THREE.Vector3();

  const updateSunMotionLine = (mode) => {
    const sunPosition = worldPositions.get('sun') ?? targetPosition;
    const visible = mode === 'helical' || mode === 'follow';
    sunMotionLine.line.visible = visible;
    if (!visible) return;

    const nearTail = sunBody.scaleRadius * 1.18;
    const farTail = mode === 'follow' ? 86 : 132;
    for (let index = 0; index < sunMotionLine.pointCount; index += 1) {
      const progress = index / (sunMotionLine.pointCount - 1);
      const distance = nearTail + progress * farTail;
      const pointIndex = index * 3;
      sunMotionLine.positions[pointIndex] = sunPosition.x;
      sunMotionLine.positions[pointIndex + 1] = sunPosition.y;
      sunMotionLine.positions[pointIndex + 2] = sunPosition.z - distance;
    }
    sunMotionLine.geometry.attributes.position.needsUpdate = true;
  };

  const updateHelicalTrails = (mode, selectedId) => {
    const trailsVisible = mode === 'helical' || mode === 'follow';
    helicalTrailGroup.visible = trailsVisible;
    for (const item of orbitLines) {
      item.orbit.material.opacity = mode === 'orbit' ? item.defaultOpacity : item.defaultOpacity * 0.18;
    }
    if (!trailsVisible) return;

    const selectedBody = bodyMap[selectedId] ?? bodyMap.sun;
    const selectedTrailId = selectedBody.type === 'planet'
      ? selectedBody.id
      : selectedBody.parent && bodyMap[selectedBody.parent]?.type === 'planet'
        ? selectedBody.parent
        : 'jupiter';
    const sunPosition = worldPositions.get('sun') ?? targetPosition;

    for (const [id, trail] of trailNodes) {
      const body = bodyMap[id];
      const selectedTrail = id === selectedTrailId;
      const baseOpacity = selectedTrail ? 1 : mode === 'follow' ? 0.78 : 0.9;
      trail.group.visible = true;
      trail.material.opacity = baseOpacity;
      trail.glowMaterial.opacity = baseOpacity * 0.6;
      trail.outerGlowMaterial.opacity = baseOpacity * 0.28;
      trail.glowMaterial.size = selectedTrail ? 0.38 : 0.3;
      trail.outerGlowMaterial.size = selectedTrail ? 1 : 0.82;

      const currentPosition = worldPositions.get(id) ?? targetPosition;
      for (let index = 0; index < trail.pointCount; index += 1) {
        const progress = index / (trail.pointCount - 1);
        getRushingTrailPoint(body, currentPosition, sunPosition, progress, mode, trailPoint);
        const pointIndex = index * 3;
        trail.positions[pointIndex] = trailPoint.x;
        trail.positions[pointIndex + 1] = trailPoint.y;
        trail.positions[pointIndex + 2] = trailPoint.z;
      }
      trail.geometry.attributes.position.needsUpdate = true;
      trail.glowGeometry.attributes.position.needsUpdate = true;
      trail.outerGlowGeometry.attributes.position.needsUpdate = true;
    }
  };

  const animate = () => {
    const delta = Math.min(clock.getDelta(), 0.05);
    const state = options.getState();
    if (state.playing) {
      const elapsedDelta = delta * state.secondsPerSecond;
      elapsedSeconds += elapsedDelta;
      simDays += elapsedDelta / 86_400;
    }

    const forward = simDays * 0.18;
    const rushingMode = state.viewMode === 'helical' || state.viewMode === 'follow';
    const targetRootTilt = rushingMode ? Math.PI / 2 : 0;
    systemRoot.rotation.x = THREE.MathUtils.lerp(systemRoot.rotation.x, targetRootTilt, 1 - Math.pow(0.001, delta));
    systemRoot.position.set(0, rushingMode ? 0 : Math.sin(simDays * 0.25) * 0.08, -forward);
    for (const [id, node] of bodyNodes) {
      const orbitDays = node.body.orbitDays || 1;
      const direction = orbitDays < 0 ? -1 : 1;
      if (node.body.parent) {
        node.pivot.rotation.y = direction * ((simDays / Math.abs(orbitDays)) * Math.PI * 2 + bodyPhase(id));
      }
      if (node.body.rotationHours) {
        node.mesh.rotation.y += (delta * state.secondsPerSecond / 3600) * (Math.PI * 2 / Math.abs(node.body.rotationHours)) * Math.sign(node.body.rotationHours);
      }
      if (node.marker) {
        node.marker.material.opacity = id === state.selectedId ? 0.85 + Math.sin(performance.now() * 0.005) * 0.15 : 0;
      }
      const selectedBody = bodyMap[state.selectedId] ?? bodyMap.sun;
      const moonInSelectedSystem = node.body.type === 'moon' && node.body.parent === selectedBody.id;
      node.label.material.opacity = id === state.selectedId
        ? 0.96
        : moonInSelectedSystem
          ? 0.28
          : node.body.type === 'moon'
            ? 0.08
            : 0.7;
      node.group.getWorldPosition(worldPositions.get(id));
    }
    updateSunMotionLine(state.viewMode);
    updateHelicalTrails(state.viewMode, state.selectedId);

    sunLight.position.copy(worldPositions.get('sun'));
    const selected = bodyNodes.get(state.selectedId) ?? bodyNodes.get('sun');
    selected.group.getWorldPosition(targetPosition);

    const selectedBody = selected.body;
    const distance = selectedBody.type === 'star'
      ? 40
      : selectedBody.type === 'planet'
        ? 18
        : 4.2;
    let cameraBias;
    if (state.viewMode === 'orbit') {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(0, 28, 46)
        : new THREE.Vector3(distance * 1.25, distance * 0.72, distance * 1.35);
    } else if (state.viewMode === 'helical') {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(-13, 9.5, 26)
        : new THREE.Vector3(-distance * 0.78, distance * 0.36, distance * 0.72);
    } else {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(-8, 6.5, 15)
        : new THREE.Vector3(selectedBody.scaleRadius * 7 + 7, selectedBody.scaleRadius * 2.2 + 2.4, selectedBody.scaleRadius * 4.4 + 7);
    }
    if (state.viewMode === 'follow' && selectedBody.type !== 'star') {
      const sunPosition = worldPositions.get('sun') ?? targetPosition;
      followSunVector.copy(sunPosition).sub(targetPosition).normalize();
      followSideVector.set(-followSunVector.z, 0, followSunVector.x).normalize();
      cameraGoal.copy(targetPosition)
        .addScaledVector(followSunVector, selectedBody.scaleRadius * 5.6 + 6.2)
        .addScaledVector(followSideVector, selectedBody.scaleRadius * 2.4 + 3.2);
      cameraGoal.y += selectedBody.scaleRadius * 1.8 + 2.2;
    } else {
      cameraGoal.copy(targetPosition).add(cameraBias);
    }
    lookAtGoal.copy(targetPosition);
    if (state.viewMode === 'helical') lookAtGoal.z -= selectedBody.type === 'star' ? 7 : 4.8;
    if (state.viewMode === 'follow' && selectedBody.type === 'star') lookAtGoal.z -= 3;

    const cameraTargetChanged = state.selectedId !== lastSelectedId
      || state.viewMode !== lastViewMode
      || state.cameraRevision !== lastCameraRevision;
    if (cameraTargetChanged) {
      cameraTransition = 1;
      lastSelectedId = state.selectedId;
      lastViewMode = state.viewMode;
      lastCameraRevision = state.cameraRevision;
      previousTarget.copy(targetPosition);
    }

    if (state.autoFollow) {
      if (cameraTransition > 0.01) {
        camera.position.lerp(cameraGoal, 1 - Math.pow(0.022, delta));
        currentLook.lerp(lookAtGoal, 1 - Math.pow(0.014, delta));
        controls.target.copy(currentLook);
        cameraTransition -= delta * 1.65;
      } else {
        targetDelta.copy(targetPosition).sub(previousTarget);
        camera.position.add(targetDelta);
        controls.target.add(targetDelta);
      }
      previousTarget.copy(targetPosition);
    }

    controls.update();
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const starScreenDrift = rushingMode ? THREE.MathUtils.euclideanModulo(forward * 0.9, 96) : 0;
    const dustScreenDrift = rushingMode ? THREE.MathUtils.euclideanModulo(forward * 0.58, 78) : 0;
    galaxy.position.copy(camera.position).addScaledVector(cameraRight, -starScreenDrift);
    milkyWay.position.copy(camera.position)
      .addScaledVector(cameraRight, -dustScreenDrift)
      .add(backgroundOffset.set(0, -20, -44));
    cameraLight.position.copy(camera.position);
    renderer.render(scene, camera);

    options.onTick({
      simDays,
      elapsedSeconds,
      date: new Date(START_DATE.getTime() + simDays * DAY_MS),
      selectedPosition: targetPosition.clone(),
      forward,
      cameraDistance: camera.position.distanceTo(targetPosition),
    });
    raf = requestAnimationFrame(animate);
  };

  const resize = () => {
    const { clientWidth, clientHeight } = mount;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  };
  window.addEventListener('resize', resize);
  animate();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
          else object.material.dispose();
        }
      });
    },
  };
}

function BodyButton({ body, selectedId, onSelect, expanded = false, nested = false }) {
  const parent = body.parent ? bodyMap[body.parent] : null;
  return (
    <button
      type="button"
      className={`body-row ${nested ? 'nested' : ''} ${selectedId === body.id ? 'selected' : ''}`}
      onClick={() => onSelect(body.id)}
    >
      <span className="body-dot" style={{ background: body.color }} />
      <span>
        <strong>{body.name}</strong>
        <small>{body.zh}</small>
      </span>
      <em>
        {expanded ? '⌄' : body.type === 'moon' ? parent?.name : body.type === 'star' ? 'center' : `${formatFixed(body.distanceKm / 1_000_000, 1)}M km`}
      </em>
    </button>
  );
}

function App() {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const [selectedId, setSelectedId] = useState('sun');
  const [filter, setFilter] = useState('');
  const [speedIndex, setSpeedIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [autoFollow, setAutoFollow] = useState(true);
  const [viewMode, setViewMode] = useState('orbit');
  const [cameraRevision, setCameraRevision] = useState(0);
  const [telemetry, setTelemetry] = useState({
    simDays: 0,
    elapsedSeconds: 0,
    date: START_DATE,
    selectedPosition: new THREE.Vector3(),
    forward: 0,
    cameraDistance: 0,
  });

  const selectedBody = bodyMap[selectedId] ?? bodyMap.sun;
  const selectedSpeed = simulationSpeeds[speedIndex];
  const selectedOrbitBody = selectedBody.type === 'planet'
    ? selectedBody
    : selectedBody.parent && bodyMap[selectedBody.parent]?.type === 'planet'
      ? bodyMap[selectedBody.parent]
      : bodyMap.earth;
  const secondsPerSecond = selectedSpeed.orbitSeconds
    ? Math.max(1, Math.abs(selectedOrbitBody.orbitDays || 365.256) * 86_400 / selectedSpeed.orbitSeconds)
    : selectedSpeed.secondsPerSecond;
  const visibleBodies = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    return bodies.filter((body) => {
      if (!normalizedFilter) return true;
      return `${body.name} ${body.zh} ${body.type}`.toLowerCase().includes(normalizedFilter);
    });
  }, [filter]);
  const visibleIds = useMemo(() => new Set(visibleBodies.map((body) => body.id)), [visibleBodies]);
  const planets = useMemo(() => bodies.filter((body) => body.type === 'planet'), []);
  const switchViewMode = (mode) => {
    setViewMode(mode);
    setAutoFollow(true);
    if (mode === 'follow' && selectedId === 'sun') setSelectedId('jupiter');
    setCameraRevision((value) => value + 1);
  };
  const timelineMarks = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const offset = index - 3;
      return {
        label: formatShortDate(addDays(telemetry.date, offset)),
        left: `${(index / 6) * 100}%`,
        active: offset === 0,
      };
    });
  }, [telemetry.date]);

  stateRef.current = {
    selectedId,
    secondsPerSecond,
    playing,
    autoFollow,
    viewMode,
    cameraRevision,
  };

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const scene = buildSolarScene(mountRef.current, {
      getState: () => stateRef.current,
      onTick: (nextTelemetry) => {
        setTelemetry((prev) => {
          if (Math.floor(prev.elapsedSeconds) === Math.floor(nextTelemetry.elapsedSeconds)) return prev;
          return nextTelemetry;
        });
      },
    });
    return () => scene.dispose();
  }, []);

  const beijingFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const utcFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <main className="app-shell">
      <section ref={mountRef} className="space-stage" aria-label="3D 太阳系模拟器" />

      <header className="top-bar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <h1>solar rushing</h1>
        </div>
        <div className="time-strip">
          <div>
            <span>UTC</span>
            <strong>{utcFormatter.format(telemetry.date)}</strong>
          </div>
          <div>
            <span>Beijing Time</span>
            <strong>{beijingFormatter.format(telemetry.date)}</strong>
          </div>
          <div>
            <span>中国农历</span>
            <strong>{formatLunarDate(telemetry.date)}</strong>
          </div>
        </div>
        <div className="controls">
          <button type="button" className={playing ? 'active' : ''} onClick={() => setPlaying((value) => !value)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={() => setCameraRevision((value) => value + 1)}>
            Reset
          </button>
          <div className="transport-controls" aria-label="time controls">
            <button type="button">⏮</button>
            <button type="button">◀</button>
            <button type="button" className="active" onClick={() => setPlaying((value) => !value)}>
              {playing ? 'Ⅱ' : '▶'}
            </button>
            <button type="button">▶</button>
            <button type="button">⟳</button>
          </div>
          <label>
            <span>Sim Speed</span>
            <select value={speedIndex} onChange={(event) => setSpeedIndex(Number(event.target.value))}>
              {simulationSpeeds.map((item, index) => (
                <option value={index} key={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="menu-button" aria-label="menu">☰</button>
        </div>
      </header>

      <aside className="left-panel glass-panel">
        <div className="panel-title">
          <span>Celestial Index</span>
          <strong>{bodies.length}</strong>
        </div>
        <label className="search-box">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search bodies"
          />
        </label>
        {visibleIds.has('sun') && (
          <div className="body-group">
            <h2>Star</h2>
            <BodyButton body={bodyMap.sun} selectedId={selectedId} onSelect={(id) => {
              setSelectedId(id);
              setAutoFollow(true);
              setCameraRevision((value) => value + 1);
            }} />
          </div>
        )}
        <div className="body-group">
          <h2>Planets</h2>
          {planets.map((planet) => {
            const planetVisible = visibleIds.has(planet.id);
            const visibleMoons = planet.moons.map((moonId) => bodyMap[moonId]).filter((moon) => moon && visibleIds.has(moon.id));
            if (!planetVisible && visibleMoons.length === 0) return null;
            return (
              <div className="tree-node" key={planet.id}>
                {planetVisible && (
                  <BodyButton body={planet} selectedId={selectedId} expanded={planet.moons.length > 0} onSelect={(id) => {
                    setSelectedId(id);
                    setAutoFollow(true);
                    setCameraRevision((value) => value + 1);
                  }} />
                )}
                {visibleMoons.length > 0 && (
                  <div className="moon-branch">
                    {visibleMoons.map((moon) => (
                      <BodyButton key={moon.id} body={moon} selectedId={selectedId} nested onSelect={(id) => {
                        setSelectedId(id);
                        setAutoFollow(true);
                        setCameraRevision((value) => value + 1);
                      }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {visibleBodies.length === 0 && (
          <p className="empty-state">没有匹配的天体。</p>
        )}
      </aside>

      <div className="left-tool-stack" aria-label="scene tools">
        <div className="tool-cluster">
          <button type="button">⌖</button>
          <button type="button">✋</button>
          <button type="button">✥</button>
          <button type="button">⛶</button>
        </div>
        <div className="tool-cluster">
          <button type="button">⌖</button>
          <button type="button">＋</button>
          <button type="button">−</button>
          <button type="button" onClick={() => setCameraRevision((value) => value + 1)}>↻</button>
        </div>
      </div>

      <aside className="right-panel glass-panel">
        <div className="body-hero">
          <span className="body-preview" style={{ background: selectedBody.color }} />
          <div>
            <strong>{selectedBody.name}</strong>
            <small>{selectedBody.zh}</small>
          </div>
        </div>
        <div className="selected-heading">
          <span>{selectedBody.type.toUpperCase()}</span>
          <h2>{selectedBody.name}</h2>
          <p>
            默认 1.00x 为真实时间：现实 1 秒，模拟推进 1 秒。切换目标后会归位一次，随后可自由旋转、缩放、平移。
          </p>
        </div>

        <div className="detail-tabs">
          <button type="button" className="active">Overview</button>
          <button type="button">Physical</button>
          <button type="button">Composition</button>
          <button type="button">Atmosphere</button>
        </div>

        <div className="stat-list">
          <div>
            <span>Radius</span>
            <strong>{formatNumber(selectedBody.radiusKm, ' km')}</strong>
          </div>
          <div>
            <span>Distance to Parent</span>
            <strong>{selectedBody.parent ? formatNumber(selectedBody.distanceKm, ' km') : '系统质心'}</strong>
          </div>
          <div>
            <span>Orbit Period</span>
            <strong>{selectedBody.orbitDays ? `${formatFixed(Math.abs(selectedBody.orbitDays), 3)} 天` : 'N/A'}</strong>
          </div>
          <div>
            <span>Rotation Period</span>
            <strong>{formatFixed(Math.abs(selectedBody.rotationHours), 2)} 小时</strong>
          </div>
          <div>
            <span>Orbital Velocity</span>
            <strong>{formatFixed(selectedBody.speedKmS, 2)} km/s</strong>
          </div>
          <div>
            <span>Axial Tilt</span>
            <strong>{formatFixed(selectedBody.axialTilt, 2)}°</strong>
          </div>
          <div>
            <span>Surface Gravity</span>
            <strong>{selectedBody.gravity}</strong>
          </div>
          <div>
            <span>Escape Velocity</span>
            <strong>{estimateEscapeVelocity(selectedBody)}</strong>
          </div>
          <div>
            <span>Mass</span>
            <strong>{selectedBody.mass}</strong>
          </div>
          <div>
            <span>Moons</span>
            <strong>{selectedBody.moons.length}</strong>
          </div>
          <div>
            <span>Visual Magnitude</span>
            <strong>{selectedBody.type === 'star' ? '-26.74' : '—'}</strong>
          </div>
          <div>
            <span>Right Ascension</span>
            <strong>{pseudoSkyCoordinate(selectedBody, 'ra')}</strong>
          </div>
          <div>
            <span>Declination</span>
            <strong>{pseudoSkyCoordinate(selectedBody, 'dec')}</strong>
          </div>
          <div>
            <span>Observation Mode</span>
            <strong>{viewModeLabels[viewMode]}</strong>
          </div>
        </div>

        <button type="button" className="additional-data">
          <span>Additional Data</span>
          <strong>⌄</strong>
        </button>

        <div className="mode-block">
          <span>Observation Mode</span>
          <div className="segmented">
            <button
              type="button"
              className={viewMode === 'orbit' ? 'active' : ''}
              onClick={() => switchViewMode('orbit')}
            >
              Orbit View
            </button>
            <button
              type="button"
              className={viewMode === 'helical' ? 'active' : ''}
              onClick={() => switchViewMode('helical')}
            >
              3D Spiral
            </button>
            <button
              type="button"
              className={viewMode === 'follow' ? 'active' : ''}
              onClick={() => switchViewMode('follow')}
            >
              Follow
            </button>
          </div>
          <label className="toggle-row">
            <input type="checkbox" checked={autoFollow} onChange={(event) => setAutoFollow(event.target.checked)} />
            <span>Keep selected body centered</span>
          </label>
        </div>
      </aside>

      <div className="center-time-chip">
        {utcFormatter.format(telemetry.date)} UTC
      </div>

      <div className="view-switcher">
        <button type="button" className={viewMode === 'orbit' ? 'active' : ''} onClick={() => switchViewMode('orbit')}>
          ◎ Orbit View
        </button>
        <button type="button" className={viewMode === 'helical' ? 'active' : ''} onClick={() => switchViewMode('helical')}>
          ◈ 3D Spiral
        </button>
        <button type="button" className={viewMode === 'follow' ? 'active' : ''} onClick={() => switchViewMode('follow')}>
          △ Follow View
        </button>
      </div>

      <footer className="bottom-bar">
        <div className="timeline-actions">
          <button type="button">↺</button>
          <button type="button">▶</button>
        </div>
        <div className="timeline">
          <span>Elapsed {formatElapsed(telemetry.elapsedSeconds)}</span>
          <div className="track">
            <div className="tick-rail">
              {Array.from({ length: 73 }, (_, index) => (
                <span
                  key={index}
                  className={index % 12 === 0 ? 'major' : ''}
                  style={{ left: `${(index / 72) * 100}%` }}
                />
              ))}
            </div>
            <i style={{ width: '50%' }} />
            <b style={{ left: '50%' }} />
            <div className="timeline-labels">
              {timelineMarks.map((mark) => (
                <span key={mark.label} className={mark.active ? 'active' : ''} style={{ left: mark.left }}>
                  {mark.label}
                </span>
              ))}
            </div>
          </div>
          <span>Forward drift {formatFixed(telemetry.forward, 4)} scene</span>
        </div>
        <div className="hint-strip">
          <kbd>滚轮</kbd> 缩放
          <kbd>左键</kbd> 旋转
          <kbd>右键</kbd> 平移
          <kbd>Select</kbd> Focus body
        </div>
      </footer>
    </main>
  );
}

export default App;
