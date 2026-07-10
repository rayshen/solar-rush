import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bodies, bodyMap, planetEphemerisElements } from './solarData.js';

const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const SYSTEM_TRAVEL_Z = 1;
const BACKGROUND_TRAVEL_Z = -SYSTEM_TRAVEL_Z;
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
const DEFAULT_SPEED_INDEX = simulationSpeeds.findIndex(({ label }) => label === '7d/s');
const DEFAULT_VIEW_MODE = 'helical';

const viewModeLabels = {
  orbit: 'Orbit',
  helical: '3D Spiral',
  follow: 'Follow',
};

const viewModeDescriptions = {
  orbit: '俯视完整轨道结构，适合比较行星位置与系统尺度。',
  helical: '太阳系向右推进，左侧光迹记录各天体经过的空间路径。',
  follow: '跟随选中天体，仅突出它的主轨迹与局部系统。',
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

function formatDistance(value) {
  if (value >= 1_000_000_000) return `${formatFixed(value / 1_000_000_000, 2)}B km`;
  if (value >= 1_000_000) return `${formatFixed(value / 1_000_000, 1)}M km`;
  return formatNumber(value, ' km');
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

function getPlanetElementsAtDate(id, date) {
  const source = planetEphemerisElements[id];
  if (!source) return null;
  const centuries = (date.getTime() - J2000_MS) / DAY_MS / 36_525;
  const values = source.base.map((value, index) => value + source.rate[index] * centuries);
  return {
    a: values[0],
    e: values[1],
    inclination: THREE.MathUtils.degToRad(values[2]),
    meanLongitude: values[3],
    longitudePerihelion: values[4],
    longitudeNode: THREE.MathUtils.degToRad(values[5]),
  };
}

function solveEccentricAnomaly(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const correction = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
      / (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-10) break;
  }
  return eccentricAnomaly;
}

function setPlanetScenePosition(id, date, sceneSemiMajorAxis, out, orbitEccentricAnomaly = null) {
  const elements = getPlanetElementsAtDate(id, date);
  if (!elements) return out.set(0, 0, 0);
  const meanAnomalyDegrees = THREE.MathUtils.euclideanModulo(
    elements.meanLongitude - elements.longitudePerihelion + 180,
    360,
  ) - 180;
  const eccentricAnomaly = orbitEccentricAnomaly ?? solveEccentricAnomaly(
    THREE.MathUtils.degToRad(meanAnomalyDegrees),
    elements.e,
  );
  const orbitalX = elements.a * (Math.cos(eccentricAnomaly) - elements.e);
  const orbitalY = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(eccentricAnomaly);
  const argumentPerihelion = THREE.MathUtils.degToRad(elements.longitudePerihelion) - elements.longitudeNode;
  const cosPerihelion = Math.cos(argumentPerihelion);
  const sinPerihelion = Math.sin(argumentPerihelion);
  const cosNode = Math.cos(elements.longitudeNode);
  const sinNode = Math.sin(elements.longitudeNode);
  const cosInclination = Math.cos(elements.inclination);
  const sinInclination = Math.sin(elements.inclination);
  const eclipticX = (cosPerihelion * cosNode - sinPerihelion * sinNode * cosInclination) * orbitalX
    + (-sinPerihelion * cosNode - cosPerihelion * sinNode * cosInclination) * orbitalY;
  const eclipticY = (cosPerihelion * sinNode + sinPerihelion * cosNode * cosInclination) * orbitalX
    + (-sinPerihelion * sinNode + cosPerihelion * cosNode * cosInclination) * orbitalY;
  const eclipticZ = sinPerihelion * sinInclination * orbitalX
    + cosPerihelion * sinInclination * orbitalY;
  const sceneScale = sceneSemiMajorAxis / elements.a;
  // Map the JPL ecliptic frame into Three.js without mirroring its handedness:
  // ecliptic +X -> scene +X, +Y -> scene -Z, +Z -> scene +Y.
  return out.set(eclipticX * sceneScale, eclipticZ * sceneScale, -eclipticY * sceneScale);
}

function createPlanetOrbitLine(body, date, color, opacity = 0.28) {
  const points = [];
  const point = new THREE.Vector3();
  for (let index = 0; index <= 240; index += 1) {
    setPlanetScenePosition(body.id, date, body.orbitRadius, point, (index / 240) * Math.PI * 2);
    points.push(point.clone());
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
    const intensity = 0.008 + Math.pow(progress, 2.7) * 1.06;
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
    size: 0.24,
    sizeAttenuation: true,
    transparent: true,
    opacity: opacity * 0.46,
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
    size: 0.66,
    sizeAttenuation: true,
    transparent: true,
    opacity: opacity * 0.18,
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

function createSunMotionLine(glowTexture) {
  const pointCount = 1600;
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
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;

  const glowMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    vertexColors: true,
    size: 0.34,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Points(geometry, glowMaterial);
  glow.frustumCulled = false;

  const outerGlowMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    vertexColors: true,
    size: 0.82,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const outerGlow = new THREE.Points(geometry, outerGlowMaterial);
  outerGlow.frustumCulled = false;

  const group = new THREE.Group();
  group.add(outerGlow, glow, line);
  return {
    group,
    line,
    glow,
    outerGlow,
    positions,
    colors,
    geometry,
    material,
    glowMaterial,
    outerGlowMaterial,
    pointCount,
  };
}

function getRushingTrailPoint(body, currentPosition, sunPosition, progress, mode, out) {
  const tail = 1 - progress;
  const currentAngle = Math.atan2(currentPosition.y - sunPosition.y, currentPosition.x - sunPosition.x);
  const turns = THREE.MathUtils.clamp(2.7 - body.orbitRadius * 0.055, 1.2, 2.65);
  const angle = currentAngle - tail * turns * Math.PI * 2;
  const depth = mode === 'follow' ? 32 : 52;
  const currentRadius = Math.hypot(currentPosition.x - sunPosition.x, currentPosition.y - sunPosition.y);
  const radius = Math.max(currentRadius, body.orbitRadius * 0.8);
  const pinch = Math.pow(tail, 0.82);
  const curl = Math.sin(tail * Math.PI) * 0.52 + 0.48;
  const coilRadius = currentRadius + radius * pinch * curl * 0.18;

  out.set(
    sunPosition.x + Math.cos(angle) * coilRadius,
    sunPosition.y + Math.sin(angle) * coilRadius,
    currentPosition.z - SYSTEM_TRAVEL_Z * tail * depth + Math.sin(angle) * radius * pinch,
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
      size: 0.17,
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      alphaTest: 0.02,
    }),
  );
}

function createMilkyWayBand(starTexture) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  for (let i = 0; i < 8500; i += 1) {
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
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    alphaTest: 0.02,
  });
  const band = new THREE.Points(geometry, material);
  band.rotation.z = THREE.MathUtils.degToRad(-14);
  band.rotation.x = THREE.MathUtils.degToRad(10);
  return band;
}

function createSunMaterial() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vSurfacePosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vSurfacePosition = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = cameraPosition - worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vSurfacePosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + vec3(7.1, 3.4, 5.7);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 flow = vec3(uTime * 0.035, -uTime * 0.018, uTime * 0.024);
        float broad = fbm(vSurfacePosition * 3.8 + flow);
        float cells = fbm(vSurfacePosition * 12.0 - flow * 1.7);
        float filaments = 1.0 - smoothstep(0.035, 0.2, abs(fbm(vSurfacePosition * 7.0 + flow * 2.2) - 0.52));
        float heat = clamp(broad * 0.82 + cells * 0.42 + filaments * 0.3, 0.0, 1.35);

        vec3 deepOrange = vec3(0.42, 0.012, 0.0);
        vec3 moltenOrange = vec3(1.0, 0.12, 0.002);
        vec3 solarGold = vec3(1.0, 0.58, 0.025);
        vec3 whiteHot = vec3(1.0, 0.96, 0.58);
        vec3 color = mix(deepOrange, moltenOrange, smoothstep(0.22, 0.62, heat));
        color = mix(color, solarGold, smoothstep(0.55, 0.9, heat));
        color = mix(color, whiteHot, smoothstep(0.88, 1.2, heat));

        float facing = clamp(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0, 1.0);
        float limb = pow(facing, 0.42);
        color *= mix(0.55, 1.26, limb);
        color += vec3(1.0, 0.18, 0.0) * filaments * 0.22;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  material.userData.animatedSun = true;
  return material;
}

function createRimGlowMaterial(color, opacity, power = 2.4) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = cameraPosition - worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPower;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        float facing = clamp(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0, 1.0);
        float rim = pow(1.0 - facing, uPower);
        gl_FragColor = vec4(uColor, rim * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function createSeededRandom(seedText) {
  let seed = [...seedText].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 2654435761), 2166136261) >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createProceduralPlanetTexture(body) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = createSeededRandom(body.id);
  const base = new THREE.Color(body.color);
  const palette = {
    mercury: ['#6d6964', '#a49a8f', '#d0c2ad'],
    venus: ['#8e5f2d', '#d89b52', '#f1cb82'],
    mars: ['#6f2f1f', '#bf5b38', '#e09a62'],
    moon: ['#65635f', '#aaa69c', '#d4d0c4'],
    phobos: ['#493b32', '#796354', '#a18b77'],
    deimos: ['#51463e', '#88776a', '#b3a18f'],
    io: ['#b78b16', '#f1d45a', '#fff2a5'],
    europa: ['#71604e', '#d3c8aa', '#f4edcf'],
    ganymede: ['#514b44', '#8f8171', '#c0ad94'],
    callisto: ['#282521', '#5b5349', '#9a8c78'],
    titan: ['#7d4016', '#ca7628', '#efb85b'],
    rhea: ['#777b7c', '#b5b9b7', '#e2e5df'],
    iapetus: ['#302a24', '#766b5d', '#c4b59b'],
    dione: ['#777d80', '#bac0c0', '#edf0eb'],
    titania: ['#5c5a57', '#94918b', '#c6c1b8'],
    oberon: ['#403a37', '#716763', '#a59a90'],
    triton: ['#765f63', '#b79ca0', '#dfc7c0'],
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
      ctx.strokeStyle = `rgba(235,255,255,${0.06 + random() * 0.08})`;
      ctx.lineWidth = 2 + random() * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 18) {
        ctx.lineTo(x, y + Math.sin(x * 0.025 + y * 0.09) * 7);
      }
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 96; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + random() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(random() * 512, random() * 256, 8 + random() * 36, 3 + random() * 16, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + random() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(random() * 512, random() * 256, 5 + random() * 22, 2 + random() * 12, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const isRocky = ['mercury', 'moon', 'mars', 'phobos', 'deimos', 'ganymede', 'callisto', 'rhea', 'iapetus', 'dione', 'titania', 'oberon', 'triton'].includes(body.id);
  if (isRocky) {
    for (let i = 0; i < 74; i += 1) {
      const x = random() * 512;
      const y = random() * 256;
      const radius = 2 + random() * (body.id === 'callisto' ? 15 : 10);
      const crater = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.22, radius * 0.12, x, y, radius);
      crater.addColorStop(0, 'rgba(255,255,255,0.12)');
      crater.addColorStop(0.38, 'rgba(12,8,5,0.2)');
      crater.addColorStop(0.72, 'rgba(20,12,8,0.3)');
      crater.addColorStop(1, 'rgba(255,238,210,0.08)');
      ctx.fillStyle = crater;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (body.id === 'venus') {
    ctx.globalCompositeOperation = 'screen';
    for (let y = 4; y < 256; y += 9) {
      ctx.strokeStyle = `rgba(255,232,174,${0.1 + random() * 0.12})`;
      ctx.lineWidth = 4 + random() * 7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 14) ctx.lineTo(x, y + Math.sin(x * 0.022 + y * 0.08) * 8);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  if (body.id === 'io') {
    for (let i = 0; i < 58; i += 1) {
      const x = random() * 512;
      const y = random() * 256;
      const radius = 3 + random() * 14;
      const volcano = ctx.createRadialGradient(x, y, 0, x, y, radius);
      volcano.addColorStop(0, 'rgba(28,20,12,0.92)');
      volcano.addColorStop(0.34, 'rgba(116,35,13,0.82)');
      volcano.addColorStop(0.7, 'rgba(235,105,16,0.44)');
      volcano.addColorStop(1, 'rgba(255,215,54,0)');
      ctx.fillStyle = volcano;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (['europa', 'dione', 'rhea'].includes(body.id)) {
    const crackColor = body.id === 'europa' ? 'rgba(91,43,27,0.9)' : 'rgba(62,83,98,0.62)';
    for (let i = 0; i < 46; i += 1) {
      let x = random() * 512;
      let y = random() * 256;
      ctx.strokeStyle = crackColor;
      ctx.lineWidth = 1.4 + random() * 2.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 9; step += 1) {
        x += 8 + random() * 16;
        y += (random() - 0.5) * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  if (body.id === 'titan') {
    ctx.globalCompositeOperation = 'screen';
    for (let y = 0; y < 256; y += 12) {
      ctx.fillStyle = `rgba(255,187,77,${0.08 + random() * 0.1})`;
      ctx.fillRect(0, y, 512, 5 + random() * 8);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  if (body.id === 'iapetus') {
    const albedo = ctx.createLinearGradient(190, 0, 330, 0);
    albedo.addColorStop(0, 'rgba(16,13,11,0.72)');
    albedo.addColorStop(0.55, 'rgba(44,34,26,0.48)');
    albedo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = albedo;
    ctx.fillRect(0, 0, 360, 256);
  }

  if (body.id === 'mars') {
    const northCap = ctx.createLinearGradient(0, 0, 0, 34);
    northCap.addColorStop(0, 'rgba(245,238,218,0.95)');
    northCap.addColorStop(1, 'rgba(245,238,218,0)');
    ctx.fillStyle = northCap;
    ctx.fillRect(0, 0, 512, 34);
    const southCap = ctx.createLinearGradient(0, 222, 0, 256);
    southCap.addColorStop(0, 'rgba(245,238,218,0)');
    southCap.addColorStop(1, 'rgba(245,238,218,0.86)');
    ctx.fillStyle = southCap;
    ctx.fillRect(0, 222, 512, 34);
  }

  if (body.id === 'triton') {
    for (let i = 0; i < 32; i += 1) {
      ctx.fillStyle = `rgba(119,61,67,${0.12 + random() * 0.16})`;
      ctx.fillRect(random() * 512, random() * 170, 1 + random() * 3, 18 + random() * 46);
    }
  }

  if (body.id === 'neptune') {
    ctx.fillStyle = 'rgba(4,18,68,0.58)';
    ctx.beginPath();
    ctx.ellipse(340, 142, 34, 13, -0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function createPlanetRingMaterial(body) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const center = 256;
  const inner = body.id === 'saturn' ? 142 : 176;
  const outer = body.id === 'saturn' ? 250 : 226;
  const random = createSeededRandom(`${body.id}-rings`);
  ctx.clearRect(0, 0, 512, 512);
  for (let radius = inner; radius <= outer; radius += 1) {
    const progress = (radius - inner) / (outer - inner);
    const gap = body.id === 'saturn' && progress > 0.56 && progress < 0.63;
    const alpha = gap ? 0.04 : 0.2 + random() * 0.5;
    ctx.strokeStyle = body.id === 'saturn'
      ? `rgba(${190 + Math.floor(random() * 45)},${170 + Math.floor(random() * 40)},${125 + Math.floor(random() * 40)},${alpha})`
      : `rgba(145,215,222,${alpha * 0.34})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: body.id === 'saturn' ? 0.88 : 0.42,
    depthWrite: false,
  });
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
    const random = createSeededRandom('earth');
    const gradient = ctx.createLinearGradient(0, 0, 512, 256);
    gradient.addColorStop(0, '#0d3b78');
    gradient.addColorStop(0.55, '#2d7fd6');
    gradient.addColorStop(1, '#081f3f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#2c8b5d';
    for (let i = 0; i < 28; i += 1) {
      const x = random() * 512;
      const y = 24 + random() * 208;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + random() * 46, 6 + random() * 22, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(184,151,83,0.42)';
    for (let i = 0; i < 18; i += 1) {
      ctx.beginPath();
      ctx.ellipse(random() * 512, 45 + random() * 166, 8 + random() * 28, 4 + random() * 14, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 34; i += 1) {
      const x = random() * 512;
      const y = random() * 256;
      ctx.beginPath();
      ctx.ellipse(x, y, 14 + random() * 60, 3 + random() * 9, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const polarCaps = ctx.createLinearGradient(0, 0, 0, 256);
    polarCaps.addColorStop(0, 'rgba(245,250,255,0.96)');
    polarCaps.addColorStop(0.12, 'rgba(245,250,255,0)');
    polarCaps.addColorStop(0.88, 'rgba(245,250,255,0)');
    polarCaps.addColorStop(1, 'rgba(245,250,255,0.94)');
    ctx.fillStyle = polarCaps;
    ctx.fillRect(0, 0, 512, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
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
    const random = createSeededRandom(body.id);
    const bandPalette = body.id === 'jupiter'
      ? ['#6f4934', '#b97e55', '#e5c79f', '#f1dfbd', '#a65e3f', '#d8aa79']
      : ['#8f7a56', '#c3ad7e', '#e2cf9f', '#d4bd87', '#f0dfb5'];
    for (let y = 0; y < 256; y += 1) {
      const band = Math.floor((y + Math.sin(y * 0.11) * 4) / (body.id === 'jupiter' ? 13 : 10));
      const bandColor = new THREE.Color(bandPalette[Math.abs(band) % bandPalette.length]);
      const tone = 0.86 + Math.sin(y * 0.21) * 0.08 + Math.sin(y * 0.047) * 0.06;
      ctx.fillStyle = `rgb(${Math.floor(bandColor.r * tone * 255)}, ${Math.floor(bandColor.g * tone * 255)}, ${Math.floor(bandColor.b * tone * 255)})`;
      ctx.fillRect(0, y, 512, 1);
    }
    for (let y = 0; y < 256; y += 10) {
      ctx.strokeStyle = `rgba(255, 245, 220, ${0.14 + random() * 0.16})`;
      ctx.lineWidth = 2 + random() * 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.028 + y * 0.06) * 5);
      }
      ctx.stroke();
    }
    if (body.id === 'jupiter') {
      ctx.fillStyle = 'rgba(129, 47, 31, 0.88)';
      ctx.beginPath();
      ctx.ellipse(350, 140, 38, 19, -0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 173, 116, 0.62)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.wrapS = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.72,
      metalness: 0,
      emissive: body.color,
      emissiveIntensity: 0.13,
    });
  }

  const texture = createProceduralPlanetTexture(body);
  texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: body.type === 'moon' ? 0.055 : 0.025,
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
  if (options.getState().viewMode === 'helical') camera.position.set(-20, 14, 43);
  else camera.position.set(0, 42, 38);

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
  if (options.getState().viewMode === 'helical') controls.target.set(0, 0, -11);

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
  const trailGlowTexture = createGlowTexture();
  const sunMotionLine = createSunMotionLine(trailGlowTexture);
  scene.add(sunMotionLine.group);

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
    pivot.rotation.x = body.type === 'planet' ? 0 : THREE.MathUtils.degToRad(body.inclination);
    parentGroup.add(pivot);
    orbitPivots.set(body.id, pivot);

    if (body.parent && body.orbitRadius > 0) {
      const orbit = body.type === 'planet'
        ? createPlanetOrbitLine(body, START_DATE, '#4e6f9e', 0.28)
        : createOrbitLine(body.orbitRadius, body.eccentricity, '#6f7e99', 0.22);
      if (body.type === 'moon') orbit.rotation.x = THREE.MathUtils.degToRad(body.inclination);
      parentGroup.add(orbit);
      orbitLines.push({
        id: body.id,
        parent: body.parent,
        orbit,
        type: body.type,
        defaultOpacity: body.type === 'moon' ? 0.22 : 0.28,
      });
    }

    const group = new THREE.Group();
    if (body.type === 'planet') setPlanetScenePosition(body.id, START_DATE, body.orbitRadius, group.position);
    else group.position.x = body.orbitRadius;
    pivot.add(group);

    const geometry = new THREE.SphereGeometry(body.scaleRadius, body.type === 'moon' ? 36 : 72, body.type === 'moon' ? 18 : 36);
    const material = body.id === 'sun'
      ? createSunMaterial()
      : createPlanetMaterial(body);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = THREE.MathUtils.degToRad(body.axialTilt);
    if (body.id === 'phobos') mesh.scale.set(1.38, 0.9, 0.78);
    if (body.id === 'deimos') mesh.scale.set(1.24, 0.92, 0.82);
    group.add(mesh);

    if (body.id === 'sun') {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 1.24, 96, 48),
        createRimGlowMaterial('#ff8a1d', 0.42, 1.8),
      );
      group.add(glow);
      const corona = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 1.52, 96, 48),
        createRimGlowMaterial('#ff4c0a', 0.07, 2.8),
      );
      group.add(corona);
    }

    if (body.type === 'planet' || body.id === 'titan') {
      const atmosphereColor = body.id === 'titan' ? '#d8882d' : body.color;
      const atmosphereOpacity = body.id === 'earth' ? 0.72 : body.id === 'titan' ? 0.66 : 0.42;
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 1.08, 64, 32),
        createRimGlowMaterial(atmosphereColor, atmosphereOpacity, 2.2),
      );
      group.add(atmosphere);
    }

    if (body.id === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 2.35, 128),
        createPlanetRingMaterial(body),
      );
      ring.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(26.7);
      group.add(ring);
    }

    if (body.id === 'uranus') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 1.65, 96),
        createPlanetRingMaterial(body),
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
  const cameraFocusPosition = new THREE.Vector3();
  const currentLook = new THREE.Vector3();
  const previousTarget = new THREE.Vector3();
  const targetDelta = new THREE.Vector3();
  const followSunVector = new THREE.Vector3();
  const followSideVector = new THREE.Vector3();
  const backgroundOffset = new THREE.Vector3();
  const backgroundTravelDirection = new THREE.Vector3(0, 0, BACKGROUND_TRAVEL_Z);
  let simDays = 0;
  let elapsedSeconds = 0;
  let visualTime = 0;
  let raf = 0;
  let cameraTransition = 1;
  let lastSelectedId = '';
  let lastViewMode = '';
  let lastCameraRevision = -1;
  const trailPoint = new THREE.Vector3();

  const updateSunMotionLine = (mode, selectedId) => {
    const sunPosition = worldPositions.get('sun') ?? targetPosition;
    const visible = mode === 'helical' || mode === 'follow';
    sunMotionLine.group.visible = visible;
    if (!visible) return;

    const nearTail = sunBody.scaleRadius * 1.18;
    const farTail = mode === 'follow' ? 56 : 88;
    const highlighted = selectedId === 'sun';
    sunMotionLine.material.opacity = highlighted ? 0.96 : 0.42;
    sunMotionLine.glowMaterial.opacity = highlighted ? 0.7 : 0.16;
    sunMotionLine.outerGlowMaterial.opacity = highlighted ? 0.24 : 0.04;
    for (let index = 0; index < sunMotionLine.pointCount; index += 1) {
      const progress = index / (sunMotionLine.pointCount - 1);
      const distance = nearTail + progress * farTail;
      const pointIndex = index * 3;
      sunMotionLine.positions[pointIndex] = sunPosition.x;
      sunMotionLine.positions[pointIndex + 1] = sunPosition.y;
      sunMotionLine.positions[pointIndex + 2] = sunPosition.z - SYSTEM_TRAVEL_Z * distance;
    }
    sunMotionLine.geometry.attributes.position.needsUpdate = true;
  };

  const updateHelicalTrails = (mode, selectedId) => {
    const trailsVisible = mode === 'helical' || mode === 'follow';
    helicalTrailGroup.visible = trailsVisible;
    const selectedBody = bodyMap[selectedId] ?? bodyMap.sun;
    const selectedTrailId = selectedBody.type === 'planet'
      ? selectedBody.id
      : selectedBody.parent && bodyMap[selectedBody.parent]?.type === 'planet'
        ? selectedBody.parent
        : null;
    for (const item of orbitLines) {
      const selectedOrbit = item.id === selectedTrailId;
      const selectedMoonSystem = item.type === 'moon' && item.parent === selectedBody.id;
      if (mode === 'orbit') {
        item.orbit.material.opacity = selectedOrbit
          ? 0.48
          : selectedMoonSystem
            ? 0.3
            : item.type === 'planet'
              ? selectedTrailId ? 0.2 : 0.28
              : 0.1;
      } else {
        item.orbit.material.opacity = selectedOrbit ? 0.12 : item.defaultOpacity * 0.08;
      }
    }
    if (!trailsVisible) return;

    const sunPosition = worldPositions.get('sun') ?? targetPosition;

    for (const [id, trail] of trailNodes) {
      const body = bodyMap[id];
      const selectedTrail = id === selectedTrailId;
      const baseOpacity = selectedTrail ? 0.98 : mode === 'follow' ? 0.09 : selectedTrailId ? 0.36 : 0.42;
      trail.group.visible = true;
      trail.material.opacity = baseOpacity;
      trail.glowMaterial.opacity = baseOpacity * (selectedTrail ? 0.54 : 0.32);
      trail.outerGlowMaterial.opacity = baseOpacity * (selectedTrail ? 0.2 : 0.1);
      trail.glowMaterial.size = selectedTrail ? 0.32 : 0.2;
      trail.outerGlowMaterial.size = selectedTrail ? 0.78 : 0.54;

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
    visualTime += delta;
    const state = options.getState();
    if (state.playing) {
      const elapsedDelta = delta * state.secondsPerSecond;
      elapsedSeconds += elapsedDelta;
      simDays += elapsedDelta / 86_400;
    }

    const forward = simDays * 0.18;
    const simulationDate = new Date(START_DATE.getTime() + simDays * DAY_MS);
    const rushingMode = state.viewMode === 'helical' || state.viewMode === 'follow';
    const targetRootTilt = rushingMode ? Math.PI / 2 : 0;
    systemRoot.rotation.x = THREE.MathUtils.lerp(systemRoot.rotation.x, targetRootTilt, 1 - Math.pow(0.001, delta));
    systemRoot.position.set(0, rushingMode ? 0 : Math.sin(simDays * 0.25) * 0.08, forward * SYSTEM_TRAVEL_Z);
    for (const [id, node] of bodyNodes) {
      const orbitDays = node.body.orbitDays || 1;
      const direction = orbitDays < 0 ? -1 : 1;
      if (node.body.type === 'planet') {
        setPlanetScenePosition(id, simulationDate, node.body.orbitRadius, node.group.position);
      } else if (node.body.parent) {
        node.pivot.rotation.y = direction * ((simDays / Math.abs(orbitDays)) * Math.PI * 2 + bodyPhase(id));
      }
      if (node.body.rotationHours) {
        node.mesh.rotation.y += (delta * state.secondsPerSecond / 3600) * (Math.PI * 2 / Math.abs(node.body.rotationHours)) * Math.sign(node.body.rotationHours);
      }
      if (node.mesh.material.userData.animatedSun) {
        node.mesh.material.uniforms.uTime.value = visualTime;
      }
      if (node.marker) {
        node.marker.material.opacity = id === state.selectedId ? 0.85 + Math.sin(performance.now() * 0.005) * 0.15 : 0;
      }
      const selectedBody = bodyMap[state.selectedId] ?? bodyMap.sun;
      const moonInSelectedSystem = node.body.type === 'moon' && node.body.parent === selectedBody.id;
      node.label.material.opacity = id === state.selectedId
        ? 0.96
        : moonInSelectedSystem
          ? 0.34
          : node.body.type === 'moon'
            ? 0.06
            : state.viewMode === 'follow'
              ? 0.18
              : state.viewMode === 'helical'
                ? 0.5
                : 0.72;
      node.group.getWorldPosition(worldPositions.get(id));
    }
    updateSunMotionLine(state.viewMode, state.selectedId);
    updateHelicalTrails(state.viewMode, state.selectedId);

    sunLight.position.copy(worldPositions.get('sun'));
    const selected = bodyNodes.get(state.selectedId) ?? bodyNodes.get('sun');
    selected.group.getWorldPosition(targetPosition);
    cameraFocusPosition.copy(state.viewMode === 'orbit' ? worldPositions.get('sun') : targetPosition);

    const selectedBody = selected.body;
    const distance = selectedBody.type === 'star'
      ? 40
      : selectedBody.type === 'planet'
        ? 18
        : 4.2;
    let cameraBias;
    if (state.viewMode === 'orbit') {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(0, 42, 38)
        : new THREE.Vector3(distance * 1.25, distance * 0.72, distance * 1.35);
    } else if (state.viewMode === 'helical') {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(-20, 14, 43)
        : new THREE.Vector3(-distance * 0.96, distance * 0.44, distance * 0.92);
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
      cameraGoal.copy(cameraFocusPosition).add(cameraBias);
    }
    lookAtGoal.copy(cameraFocusPosition);
    if (state.viewMode === 'helical') lookAtGoal.z -= selectedBody.type === 'star' ? 11 : 6.5;
    if (state.viewMode === 'follow' && selectedBody.type === 'star') lookAtGoal.z -= 3;

    const cameraTargetChanged = state.selectedId !== lastSelectedId
      || state.viewMode !== lastViewMode
      || state.cameraRevision !== lastCameraRevision;
    if (cameraTargetChanged) {
      cameraTransition = 1;
      lastSelectedId = state.selectedId;
      lastViewMode = state.viewMode;
      lastCameraRevision = state.cameraRevision;
      previousTarget.copy(cameraFocusPosition);
    }

    if (state.autoFollow) {
      if (cameraTransition > 0.01) {
        camera.position.lerp(cameraGoal, 1 - Math.pow(0.022, delta));
        currentLook.lerp(lookAtGoal, 1 - Math.pow(0.014, delta));
        controls.target.copy(currentLook);
        cameraTransition -= delta * 1.65;
      } else {
        targetDelta.copy(cameraFocusPosition).sub(previousTarget);
        camera.position.add(targetDelta);
        controls.target.add(targetDelta);
      }
      previousTarget.copy(cameraFocusPosition);
    }

    controls.update();
    camera.updateMatrixWorld();
    const starDepthDrift = rushingMode ? THREE.MathUtils.euclideanModulo(forward * 0.9, 96) : 0;
    const dustDepthDrift = rushingMode ? THREE.MathUtils.euclideanModulo(forward * 0.58, 78) : 0;
    galaxy.position.copy(camera.position).addScaledVector(backgroundTravelDirection, starDepthDrift);
    milkyWay.position.copy(camera.position)
      .addScaledVector(backgroundTravelDirection, dustDepthDrift)
      .add(backgroundOffset.set(0, -20, -44));
    cameraLight.position.copy(camera.position);
    renderer.render(scene, camera);

    options.onTick({
      simDays,
      elapsedSeconds,
      date: simulationDate,
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
        {expanded ? '⌄' : body.type === 'moon' ? parent?.name : body.type === 'star' ? 'center' : formatDistance(body.distanceKm)}
      </em>
    </button>
  );
}

function App() {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const [selectedId, setSelectedId] = useState('sun');
  const [filter, setFilter] = useState('');
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [playing, setPlaying] = useState(true);
  const [autoFollow, setAutoFollow] = useState(true);
  const [viewMode, setViewMode] = useState(DEFAULT_VIEW_MODE);
  const [additionalDataOpen, setAdditionalDataOpen] = useState(false);
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
          <div className="transport-controls" aria-label="time controls">
            <button type="button" aria-label="Reset view" onClick={() => setCameraRevision((value) => value + 1)}>↺</button>
            <button type="button" aria-label={playing ? 'Pause' : 'Play'} className={playing ? 'active' : ''} onClick={() => setPlaying((value) => !value)}>
              {playing ? 'Ⅱ' : '▶'}
            </button>
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
            {viewModeDescriptions[viewMode]}
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
            <strong>{selectedBody.parent ? formatDistance(selectedBody.distanceKm) : '系统质心'}</strong>
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
            <span>Observation Mode</span>
            <strong>{viewModeLabels[viewMode]}</strong>
          </div>
        </div>

        <button
          type="button"
          className="additional-data"
          aria-expanded={additionalDataOpen}
          onClick={() => setAdditionalDataOpen((value) => !value)}
        >
          <span>Additional Data</span>
          <strong>{additionalDataOpen ? '⌃' : '⌄'}</strong>
        </button>
        {additionalDataOpen && (
          <div className="stat-list additional-stat-list">
            <div><span>Surface Gravity</span><strong>{selectedBody.gravity}</strong></div>
            <div><span>Escape Velocity</span><strong>{estimateEscapeVelocity(selectedBody)}</strong></div>
            <div><span>Mass</span><strong>{selectedBody.mass}</strong></div>
            <div><span>Moons</span><strong>{selectedBody.moons.length}</strong></div>
            <div><span>Visual Magnitude</span><strong>{selectedBody.type === 'star' ? '-26.74' : '—'}</strong></div>
            <div><span>Right Ascension</span><strong>{pseudoSkyCoordinate(selectedBody, 'ra')}</strong></div>
            <div><span>Declination</span><strong>{pseudoSkyCoordinate(selectedBody, 'dec')}</strong></div>
          </div>
        )}

        <div className="follow-control">
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
