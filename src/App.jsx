import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Body as AstronomyBody,
  HelioVector,
  RotateVector,
  Rotation_EQJ_ECL,
} from 'astronomy-engine';
import { bodies, bodyMap, planetEphemerisElements } from './solarData.js';
import { brightStarCatalog, satelliteMeanElements } from './astronomyData.js';
import { getBodyDetails, textureForBody } from './bodyDetails.js';

const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const SYSTEM_TRAVEL_Z = 1;
const BACKGROUND_TRAVEL_Z = -SYSTEM_TRAVEL_Z;
const START_DATE = new Date();
const PHYSICAL_KM_PER_UNIT = 50_000_000;
const PHYSICAL_ORBIT_CAMERA_BIAS = new THREE.Vector3(0, 135, 125);
const EQJ_TO_ECL = Rotation_EQJ_ECL();
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
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
  helical: 'Artistic Spiral',
  follow: 'Follow',
};

const viewModeDescriptions = {
  orbit: '俯视完整轨道结构，适合比较行星位置与系统尺度。',
  helical: '艺术化银河惯性视图；光迹用于表达运动，不代表精确银河轨道。',
  follow: '跟随选中天体，仅突出它的主轨迹与局部系统。',
};

const ui = {
  en: {
    celestialBodies: 'Celestial Bodies', search: 'Search bodies', star: 'Star', planets: 'Planets',
    noMatches: 'No matching celestial bodies.', beijingTime: 'Beijing Time', lunar: 'Chinese Lunar',
    simSpeed: 'Sim Speed', reset: 'Reset view', pause: 'Pause', play: 'Play', overview: 'Overview',
    physical: 'Physical', composition: 'Composition', atmosphere: 'Atmosphere', radius: 'Radius',
    distance: 'Distance to Parent', orbitPeriod: 'Orbit Period', rotationPeriod: 'Rotation Period',
    velocity: 'Orbital Velocity', axialTilt: 'Axial Tilt', observation: 'Observation Mode',
    center: 'System barycenter', days: 'days', hours: 'hours', additional: 'Additional Data',
    gravity: 'Surface Gravity', escape: 'Escape Velocity', mass: 'Mass', moons: 'Moons',
    magnitude: 'Visual Magnitude', reference: 'Reference Frame', positionModel: 'Position Model',
    scaleModel: 'Scale Model', catalogue: 'Star Catalogue', lighting: 'Lighting', source: 'NASA source',
    trueScale: 'True physical scale (1 unit = 50M km)', keepCentered: 'Keep selected body centered',
    orbitView: 'Orbit View', spiralView: 'Artistic Spiral', followView: 'Follow View', elapsed: 'Elapsed',
    drift: 'Forward drift', wheel: 'Wheel', zoom: 'Zoom', leftClick: 'Left drag', rotate: 'Rotate',
    rightClick: 'Right drag', pan: 'Pan', select: 'Select', focusBody: 'Focus body',
    inRange: 'EPHEMERIS IN RANGE', outRange: 'EPHEMERIS OUT OF RANGE',
    physicalScale: 'Unified scale: 1 scene unit = 50 million km.', visualScale: 'Visual scale: sizes and distances are compressed separately.',
    orbitDescription: 'Top-down system view for comparing positions and orbital scale.',
    helicalDescription: 'Artistic galactic-frame view; trails express motion, not a precise galactic orbit.',
    followDescription: 'Follow the selected body and emphasize its local system and trajectory.',
  },
  zh: {
    celestialBodies: '天体列表', search: '搜索天体', star: '恒星', planets: '行星', noMatches: '没有匹配的天体。',
    beijingTime: '北京时间', lunar: '中国农历', simSpeed: '模拟速度', reset: '重置视角', pause: '暂停', play: '播放',
    overview: '概览', physical: '物理参数', composition: '组成', atmosphere: '大气', radius: '半径',
    distance: '距母天体', orbitPeriod: '公转周期', rotationPeriod: '自转周期', velocity: '轨道速度',
    axialTilt: '轴倾角', observation: '观察模式', center: '系统质心', days: '天', hours: '小时',
    additional: '更多数据', gravity: '表面重力', escape: '逃逸速度', mass: '质量', moons: '卫星数',
    magnitude: '视星等', reference: '参考系', positionModel: '位置模型', scaleModel: '比例模型',
    catalogue: '恒星目录', lighting: '光照模型', source: 'NASA 资料来源',
    trueScale: '真实物理比例（1 单位 = 5000 万 km）', keepCentered: '保持选中天体居中',
    orbitView: '轨道视图', spiralView: '艺术螺旋', followView: '跟随视图', elapsed: '已运行',
    drift: '前进距离', wheel: '滚轮', zoom: '缩放', leftClick: '左键拖动', rotate: '旋转',
    rightClick: '右键拖动', pan: '平移', select: '选择', focusBody: '聚焦天体',
    inRange: '星历有效范围内', outRange: '超出星历有效范围',
    physicalScale: '统一比例：1 场景单位 = 5000 万 km。', visualScale: '视觉比例：尺寸与距离分别压缩。',
    orbitDescription: '俯视完整轨道结构，适合比较行星位置与系统尺度。',
    helicalDescription: '艺术化银河惯性视图；光迹用于表达运动，不代表精确银河轨道。',
    followDescription: '跟随选中天体，仅突出它的主轨迹与局部系统。',
  },
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

const astronomyPlanetBodies = {
  mercury: AstronomyBody.Mercury,
  venus: AstronomyBody.Venus,
  earth: AstronomyBody.Earth,
  mars: AstronomyBody.Mars,
  jupiter: AstronomyBody.Jupiter,
  saturn: AstronomyBody.Saturn,
  uranus: AstronomyBody.Uranus,
  neptune: AstronomyBody.Neptune,
};

function formatNumber(value, unit = '', locale = 'zh-CN') {
  return `${new Intl.NumberFormat(locale).format(Math.round(value))}${unit}`;
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
  const astronomyBody = astronomyPlanetBodies[id];
  if (astronomyBody && orbitEccentricAnomaly === null) {
    const equatorial = HelioVector(astronomyBody, date);
    const ecliptic = RotateVector(EQJ_TO_ECL, equatorial);
    const sceneScale = sceneSemiMajorAxis / elements.a;
    return out.set(ecliptic.x * sceneScale, ecliptic.z * sceneScale, -ecliptic.y * sceneScale);
  }
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

function setSatelliteScenePosition(body, date, sceneSemiMajorAxis, out) {
  const elements = satelliteMeanElements[body.id];
  if (!elements) return out.set(sceneSemiMajorAxis, 0, 0);
  const elapsedDays = (date.getTime() - J2000_MS) / DAY_MS;
  const meanAnomaly = THREE.MathUtils.degToRad(elements.meanAnomaly)
    + elapsedDays / elements.period * Math.PI * 2;
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, elements.e);
  const x = elements.a * (Math.cos(eccentricAnomaly) - elements.e);
  const y = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(eccentricAnomaly);
  const argument = THREE.MathUtils.degToRad(elements.periapsis);
  const node = THREE.MathUtils.degToRad(elements.node);
  const inclination = THREE.MathUtils.degToRad(elements.inclination);
  const cosA = Math.cos(argument); const sinA = Math.sin(argument);
  const cosN = Math.cos(node); const sinN = Math.sin(node);
  const cosI = Math.cos(inclination); const sinI = Math.sin(inclination);
  const px = (cosA * cosN - sinA * sinN * cosI) * x + (-sinA * cosN - cosA * sinN * cosI) * y;
  const py = (cosA * sinN + sinA * cosN * cosI) * x + (-sinA * sinN + cosA * cosN * cosI) * y;
  const pz = sinA * sinI * x + cosA * sinI * y;
  const scale = sceneSemiMajorAxis / elements.a;
  return out.set(px * scale, pz * scale, -py * scale);
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

function trailFade(distanceProgress, brightHold = 0.12) {
  const normalized = THREE.MathUtils.clamp(
    (distanceProgress - brightHold) / (1 - brightHold),
    0,
    1,
  );
  const smootherStep = normalized * normalized * normalized
    * (normalized * (normalized * 6 - 15) + 10);
  return 1 - smootherStep;
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
    const intensity = trailFade(1 - progress);
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
    opacity: opacity * 0.58,
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
    size: 0.86,
    sizeAttenuation: true,
    transparent: true,
    opacity: opacity * 0.22,
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
  const pointCount = 2200;
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const baseColor = new THREE.Color('#ffbf47');
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1);
    const intensity = trailFade(progress, 0.1);
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
  const depth = mode === 'follow' ? 58 : 96;
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
  const brightPositions = [];
  const brightColors = [];
  for (let i = 0; i < 22_000; i += 1) {
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
    if (i % 23 === 0) {
      brightPositions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
      const warm = Math.random() > 0.72;
      brightColors.push(1, warm ? 0.88 : 0.96, warm ? 0.7 : 1);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const brightGeometry = new THREE.BufferGeometry();
  brightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(brightPositions, 3));
  brightGeometry.setAttribute('color', new THREE.Float32BufferAttribute(brightColors, 3));
  const field = new THREE.Group();
  field.add(
    new THREE.Points(geometry, new THREE.PointsMaterial({
      map: starTexture,
      size: 0.23,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      alphaTest: 0.02,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })),
    new THREE.Points(brightGeometry, new THREE.PointsMaterial({
      map: starTexture,
      size: 0.72,
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      alphaTest: 0.025,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })),
  );
  return field;
}

function starColorFromBv(bv) {
  if (bv < -0.05) return new THREE.Color('#a9c8ff');
  if (bv < 0.35) return new THREE.Color('#e3edff');
  if (bv < 0.9) return new THREE.Color('#fff4dc');
  if (bv < 1.5) return new THREE.Color('#ffd39b');
  return new THREE.Color('#ff9d72');
}

function createCatalogStarField(starTexture) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const star of brightStarCatalog) {
    const ra = THREE.MathUtils.degToRad(star.ra);
    const dec = THREE.MathUtils.degToRad(star.dec);
    const radius = 205;
    positions.push(
      radius * Math.cos(dec) * Math.cos(ra),
      radius * Math.sin(dec),
      -radius * Math.cos(dec) * Math.sin(ra),
    );
    const color = starColorFromBv(star.bv);
    colors.push(color.r, color.g, color.b);
    sizes.push(THREE.MathUtils.clamp(1.65 - star.mag * 0.24, 0.65, 2.1));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // WebGL PointsMaterial has one size per draw call, so magnitude is encoded
  // primarily as luminance; the catalogue layer remains distinct and stable.
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    map: starTexture,
    size: 1.15,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
}

function createMilkyWayBand(starTexture) {
  // Galactic coordinates transformed into the J2000 equatorial frame. This
  // keeps the bright Galactic center and plane aligned with the catalogue sky.
  const galacticToScene = (longitude, latitude, radius, target) => {
    const cosLatitude = Math.cos(latitude);
    const gx = radius * cosLatitude * Math.cos(longitude);
    const gy = radius * cosLatitude * Math.sin(longitude);
    const gz = radius * Math.sin(latitude);
    const eqX = -0.0548755604 * gx + 0.4941094279 * gy - 0.8676661490 * gz;
    const eqY = -0.8734370902 * gx - 0.4448296300 * gy - 0.1980763734 * gz;
    const eqZ = -0.4838350155 * gx + 0.7469822445 * gy + 0.4559837762 * gz;
    target.push(eqX, eqZ, -eqY);
  };
  let seed = 0x7f4a7c15;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions = [];
  const colors = [];
  for (let i = 0; i < 42_000; i += 1) {
    // Concentrate stars toward the Galactic center while retaining the full band.
    const centerBiased = random() < 0.34;
    const longitude = centerBiased
      ? (random() - random()) * 0.72
      : random() * Math.PI * 2 - Math.PI;
    const centerStrength = Math.exp(-Math.pow(longitude / 0.62, 2));
    const bandWidth = 0.035 + centerStrength * 0.115;
    const latitude = (random() - random()) * bandWidth
      + Math.sin(longitude * 2.0 + 0.5) * 0.012;
    const radius = 182 + random() * 34;
    galacticToScene(longitude, latitude, radius, positions);

    // A dim mid-plane creates the split dust lane; longitudinal modulation
    // breaks the synthetic uniform stripe into recognizable star-cloud patches.
    const dustLane = 0.34 + 0.66 * (1 - Math.exp(-Math.pow(latitude / 0.018, 2)));
    const cloud = 0.68
      + 0.18 * Math.sin(longitude * 5.0 + 0.7)
      + 0.12 * Math.sin(longitude * 17.0 - latitude * 90.0);
    const brightness = Math.max(0.12, (0.52 + centerStrength * 0.68) * dustLane * cloud)
      * (0.72 + random() * 0.34);
    const warmCenter = centerStrength * 0.2;
    colors.push(brightness, brightness * (0.9 + warmCenter), brightness * (1.08 - warmCenter));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: starTexture,
    size: 0.52,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glowMaterial = new THREE.PointsMaterial({
    map: starTexture,
    size: 1.9,
    vertexColors: true,
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const band = new THREE.Group();
  band.add(new THREE.Points(geometry, glowMaterial), new THREE.Points(geometry, material));
  return band;
}

function createSunMaterial() {
  const surfaceTexture = loadBodyTexture(assetUrl('/textures/bodies/sun.jpg'), { color: true });
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSurfaceMap: { value: surfaceTexture },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vSurfacePosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vUv = uv;
        vSurfacePosition = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = cameraPosition - worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uSurfaceMap;
      varying vec2 vUv;
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
        vec3 observedSurface = texture2D(uSurfaceMap, vUv).rgb;
        vec3 surfaceDetail = pow(max(observedSurface, vec3(0.015)), vec3(0.55));
        vec3 flow = vec3(uTime * 0.035, -uTime * 0.018, uTime * 0.024);
        float broad = fbm(vSurfacePosition * 3.8 + flow);
        float cells = fbm(vSurfacePosition * 12.0 - flow * 1.7);
        float filaments = 1.0 - smoothstep(0.035, 0.2, abs(fbm(vSurfacePosition * 7.0 + flow * 2.2) - 0.52));
        float heat = clamp(broad * 0.82 + cells * 0.42 + filaments * 0.3, 0.0, 1.35);
        float granules = smoothstep(0.48, 0.78, cells + filaments * 0.28);

        vec3 color = vec3(0.82, 0.075, 0.002) + surfaceDetail * vec3(0.92, 0.32, 0.055);
        color *= mix(0.88, 1.28, smoothstep(0.24, 1.02, heat));
        color += vec3(1.55, 0.72, 0.08) * granules * 0.82;
        color = mix(color, vec3(1.72, 0.88, 0.2), filaments * 0.28);

        float facing = clamp(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0, 1.0);
        float limb = pow(facing, 0.42);
        color *= mix(0.88, 1.12, limb);
        color += vec3(1.25, 0.42, 0.015) * filaments * 0.24;
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

function loadBodyTexture(path, { color = false } = {}) {
  const assetPath = path.startsWith(import.meta.env.BASE_URL)
    ? path
    : assetUrl(path);
  const texture = new THREE.TextureLoader().load(assetPath);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

const bodyTextureProfiles = {
  mercury: { map: 'mercury.jpg', normal: 'mercury-normal.jpg' },
  venus: { map: 'venus.jpg', normal: 'venus-normal.jpg' },
  moon: { map: 'moon.jpg', normal: 'moon-normal.jpg' },
  mars: { map: 'mars.jpg', normal: 'mars-normal.jpg' },
  phobos: { map: 'phobos.jpg', monochrome: true },
  deimos: { map: 'deimos.jpg', monochrome: true },
  jupiter: { map: 'jupiter.jpg', atmosphere: true },
  io: { map: 'io.jpg' },
  europa: { map: 'europa.jpg', tint: '#d6cbb8' },
  ganymede: { map: 'ganymede.jpg', monochrome: true },
  callisto: { map: 'callisto.jpg', monochrome: true },
  saturn: { map: 'saturn.jpg', atmosphere: true },
  titan: { map: 'titan.jpg', atmosphere: true },
  rhea: { map: 'rhea.jpg', monochrome: true },
  iapetus: { map: 'iapetus.jpg', monochrome: true },
  dione: { map: 'dione.jpg', monochrome: true },
  uranus: { map: 'uranus.jpg', atmosphere: true },
  titania: { map: 'titania.jpg', monochrome: true },
  oberon: { map: 'oberon.jpg', monochrome: true },
  neptune: { map: 'neptune.jpg', atmosphere: true },
  triton: { map: 'triton.jpg' },
};

const atmosphereProfiles = {
  venus: { color: '#e8ad5d', opacity: 0.68, scale: 1.045, power: 2.35 },
  earth: { color: '#4c89d9', opacity: 0.72, scale: 1.035, power: 2.65 },
  mars: { color: '#d7835f', opacity: 0.18, scale: 1.025, power: 2.8 },
  jupiter: { color: '#e2bd91', opacity: 0.3, scale: 1.025, power: 2.65 },
  saturn: { color: '#e6ce9a', opacity: 0.3, scale: 1.025, power: 2.65 },
  titan: { color: '#d8882d', opacity: 0.76, scale: 1.075, power: 2.15 },
  uranus: { color: '#8fdbe0', opacity: 0.38, scale: 1.03, power: 2.55 },
  neptune: { color: '#4779ff', opacity: 0.42, scale: 1.03, power: 2.5 },
};

function createEarthNightMaterial() {
  const nightTexture = loadBodyTexture(assetUrl('/textures/earth/night.png'), { color: true });
  return new THREE.ShaderMaterial({
    uniforms: {
      uNightMap: { value: nightTexture },
      uSunPosition: { value: new THREE.Vector3() },
      uIntensity: { value: 1.15 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uNightMap;
      uniform vec3 uSunPosition;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 lights = texture2D(uNightMap, vUv).rgb;
        vec3 sunDirection = normalize(uSunPosition - vWorldPosition);
        float daylight = dot(normalize(vWorldNormal), sunDirection);
        float night = 1.0 - smoothstep(-0.18, 0.16, daylight);
        float luminance = dot(lights, vec3(0.2126, 0.7152, 0.0722));
        float alpha = smoothstep(0.025, 0.48, luminance) * night;
        gl_FragColor = vec4(lights * uIntensity, alpha * 0.92);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function addEarthSurfaceLayers(mesh, radius) {
  const detailGeometry = new THREE.SphereGeometry(radius, 144, 72);
  const nightMaterial = createEarthNightMaterial();
  const nightLights = new THREE.Mesh(detailGeometry, nightMaterial);
  nightLights.scale.setScalar(1.0015);
  nightLights.renderOrder = 1;
  mesh.add(nightLights);

  const cloudTexture = loadBodyTexture(assetUrl('/textures/earth/clouds.png'), { color: true });
  const clouds = new THREE.Mesh(
    detailGeometry.clone(),
    new THREE.MeshPhongMaterial({
      map: cloudTexture,
      alphaMap: cloudTexture,
      color: '#eef7ff',
      transparent: true,
      opacity: 0.72,
      alphaTest: 0.025,
      depthWrite: false,
      side: THREE.DoubleSide,
      shininess: 4,
    }),
  );
  clouds.scale.setScalar(1.011);
  clouds.renderOrder = 2;
  mesh.add(clouds);

  return { clouds, nightMaterial };
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
  if (body.id === 'saturn') {
    const texture = loadBodyTexture(assetUrl('/textures/bodies/saturn-rings.png'), { color: true });
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(0.5, 1);
    return new THREE.MeshBasicMaterial({
      map: texture,
      color: '#eee1bd',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
      alphaTest: 0.015,
      depthWrite: false,
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const center = 256;
  const inner = 176;
  const outer = 226;
  const random = createSeededRandom(`${body.id}-rings`);
  ctx.clearRect(0, 0, 512, 512);
  for (let radius = inner; radius <= outer; radius += 1) {
    const progress = (radius - inner) / (outer - inner);
    const alpha = 0.2 + random() * 0.5;
    ctx.strokeStyle = `rgba(145,215,222,${alpha * 0.34})`;
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
    opacity: 0.42,
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
    return new THREE.MeshPhongMaterial({
      map: loadBodyTexture(assetUrl('/textures/earth/day.jpg'), { color: true }),
      normalMap: loadBodyTexture(assetUrl('/textures/earth/normal.jpg')),
      normalScale: new THREE.Vector2(0.62, 0.62),
      specularMap: loadBodyTexture(assetUrl('/textures/earth/specular.jpg')),
      specular: new THREE.Color('#4d7189'),
      shininess: 14,
    });
  }

  const profile = bodyTextureProfiles[body.id];
  if (profile) {
    const map = loadBodyTexture(assetUrl(`/textures/bodies/${profile.map}`), { color: true });
    const materialOptions = {
      map,
      color: profile.tint ?? (profile.monochrome ? body.color : '#ffffff'),
      roughness: profile.atmosphere ? 0.78 : 0.92,
      metalness: 0,
    };
    if (profile.normal) {
      materialOptions.normalMap = loadBodyTexture(assetUrl(`/textures/bodies/${profile.normal}`));
      materialOptions.normalScale = new THREE.Vector2(0.52, 0.52);
    } else if (!profile.atmosphere) {
      materialOptions.bumpMap = map;
      materialOptions.bumpScale = body.type === 'moon' ? 0.014 : 0.01;
    }
    return new THREE.MeshStandardMaterial(materialOptions);
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 240;
  controls.panSpeed = 0.72;
  controls.rotateSpeed = 0.66;
  if (options.getState().viewMode === 'helical') controls.target.set(0, 0, -11);

  // Keep a small cool floor so texture detail survives in space without
  // flattening the day/night boundary created by the Sun.
  const ambient = new THREE.AmbientLight('#71819a', 0.035);
  scene.add(ambient);
  // Orbit radii are compressed for navigation, so inverse-square falloff made
  // the outer planets almost black. A gentler falloff preserves the radial Sun
  // direction while keeping every planet's illuminated hemisphere readable.
  const sunLight = new THREE.PointLight('#fff4dc', 160, 0, 1.2);
  // Point-light shadow maps self-shadow the compressed, highly tessellated
  // planet meshes and cover their textures with large faceted artifacts.
  // The material normals still produce the correct Sun-facing terminator.
  sunLight.castShadow = false;
  scene.add(sunLight);
  // Only a trace of camera fill: enough for silhouettes, not enough to turn the
  // hemisphere facing away from the Sun into another lit face.
  const cameraLight = new THREE.PointLight('#b8c9e6', 0.12, 0, 2);
  scene.add(cameraLight);

  const starTexture = createStarTexture();
  const galaxy = createStarField(starTexture);
  scene.add(galaxy);
  const catalogStars = createCatalogStarField(starTexture);
  scene.add(catalogStars);
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
    pivot.rotation.x = 0;
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
    else if (body.type === 'moon') setSatelliteScenePosition(body, START_DATE, body.orbitRadius, group.position);
    else group.position.x = body.orbitRadius;
    pivot.add(group);

    const geometry = new THREE.SphereGeometry(
      body.scaleRadius,
      ['sun', 'earth'].includes(body.id) ? 144 : body.type === 'moon' ? 96 : 128,
      ['sun', 'earth'].includes(body.id) ? 72 : body.type === 'moon' ? 48 : 64,
    );
    const material = body.id === 'sun'
      ? createSunMaterial()
      : createPlanetMaterial(body);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = THREE.MathUtils.degToRad(body.axialTilt);
    if (body.id === 'phobos') mesh.scale.set(1.38, 0.9, 0.78);
    if (body.id === 'deimos') mesh.scale.set(1.24, 0.92, 0.82);
    mesh.castShadow = body.type !== 'star';
    mesh.receiveShadow = body.type !== 'star';
    group.add(mesh);

    const earthLayers = body.id === 'earth'
      ? addEarthSurfaceLayers(mesh, body.scaleRadius)
      : null;

    if (body.id === 'sun') {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: trailGlowTexture,
        color: '#ff7a12',
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      halo.scale.setScalar(body.scaleRadius * 4.8);
      halo.renderOrder = -1;
      group.add(halo);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 1.2, 96, 48),
        createRimGlowMaterial('#ffb52e', 0.76, 1.55),
      );
      group.add(glow);
      const corona = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * 1.48, 96, 48),
        createRimGlowMaterial('#ff6a0a', 0.16, 2.45),
      );
      group.add(corona);
    }

    const atmosphereProfile = atmosphereProfiles[body.id];
    if (atmosphereProfile) {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(body.scaleRadius * atmosphereProfile.scale, 96, 48),
        createRimGlowMaterial(
          atmosphereProfile.color,
          atmosphereProfile.opacity,
          atmosphereProfile.power,
        ),
      );
      group.add(atmosphere);
      if (body.id === 'earth') {
        const outerAtmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(body.scaleRadius * 1.075, 64, 32),
          createRimGlowMaterial('#4d9fff', 0.18, 3.4),
        );
        group.add(outerAtmosphere);
      }
    }

    if (body.id === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 2.35, 128),
        createPlanetRingMaterial(body),
      );
      ring.rotation.set(Math.PI / 2, 0, THREE.MathUtils.degToRad(body.axialTilt));
      ring.castShadow = true;
      ring.receiveShadow = true;
      group.add(ring);
    }

    if (body.id === 'uranus') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 1.65, 96),
        createPlanetRingMaterial(body),
      );
      ring.rotation.set(Math.PI / 2, 0, THREE.MathUtils.degToRad(body.axialTilt));
      ring.castShadow = true;
      ring.receiveShadow = true;
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

    const physicalLocator = new THREE.Sprite(new THREE.SpriteMaterial({
      map: trailGlowTexture,
      color: body.color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }));
    const locatorSize = body.type === 'star'
      ? 2.6
      : body.type === 'moon'
        ? 0.24
        : 1.05;
    physicalLocator.scale.setScalar(locatorSize);
    physicalLocator.renderOrder = 20;
    group.add(physicalLocator);

    const label = createLabelSprite(body);
    group.add(label);

    // Labels and locator overlays are navigational aids, not physical geometry.
    // Keeping them out of this list prevents true scale from shrinking them away.
    const helperVisuals = new Set([label, marker, physicalLocator].filter(Boolean));
    const visuals = group.children
      .filter((object) => !helperVisuals.has(object))
      .map((object) => ({ object, scale: object.scale.clone() }));
    const labelScale = label.scale.clone();
    bodyNodes.set(body.id, {
      body, pivot, group, mesh, marker, physicalLocator, label, labelScale, earthLayers, visuals,
    });
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
  const physicalRadiusFor = (body) => body.radiusKm / PHYSICAL_KM_PER_UNIT;
  const physicalOrbitFor = (body) => body.distanceKm / PHYSICAL_KM_PER_UNIT;

  const updateSunMotionLine = (mode, selectedId) => {
    const sunPosition = worldPositions.get('sun') ?? targetPosition;
    const visible = (mode === 'helical' || mode === 'follow')
      && !(mode === 'follow' && selectedId === 'sun');
    sunMotionLine.group.visible = visible;
    if (!visible) return;

    const nearTail = sunBody.scaleRadius * 1.18;
    const farTail = mode === 'follow' ? 96 : 150;
    const highlighted = selectedId === 'sun';
    sunMotionLine.material.opacity = highlighted ? 0.82 : 0.34;
    sunMotionLine.glowMaterial.opacity = highlighted ? 0.52 : 0.12;
    sunMotionLine.outerGlowMaterial.opacity = highlighted ? 0.16 : 0.03;
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
      const hideSelectedCloseUpTrail = mode === 'follow' && id === selectedTrailId;
      if (hideSelectedCloseUpTrail) {
        trail.group.visible = false;
        continue;
      }
      const baseOpacity = selectedTrail ? 0.9 : mode === 'follow' ? 0.12 : selectedTrailId ? 0.42 : 0.52;
      trail.group.visible = true;
      trail.material.opacity = baseOpacity;
      trail.glowMaterial.opacity = baseOpacity * (selectedTrail ? 0.52 : 0.38);
      trail.outerGlowMaterial.opacity = baseOpacity * (selectedTrail ? 0.2 : 0.11);
      trail.glowMaterial.size = selectedTrail ? 0.4 : 0.31;
      trail.outerGlowMaterial.size = selectedTrail ? 0.96 : 0.8;

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
    sunLight.intensity = state.scaleMode === 'physical' ? 5.2 : 52;
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
      const physicalScale = state.scaleMode === 'physical';
      const sceneOrbitRadius = physicalScale ? physicalOrbitFor(node.body) : node.body.orbitRadius;
      const sceneRadius = physicalScale ? physicalRadiusFor(node.body) : node.body.scaleRadius;
      const radiusRatio = sceneRadius / node.body.scaleRadius;
      for (const visual of node.visuals) visual.object.scale.copy(visual.scale).multiplyScalar(radiusRatio);
      if (node.body.type === 'planet') {
        setPlanetScenePosition(id, simulationDate, sceneOrbitRadius, node.group.position);
      } else if (node.body.type === 'moon') {
        setSatelliteScenePosition(node.body, simulationDate, sceneOrbitRadius, node.group.position);
      }
      if (node.body.rotationHours && node.body.type !== 'moon') {
        node.mesh.rotation.y += (delta * state.secondsPerSecond / 3600) * (Math.PI * 2 / Math.abs(node.body.rotationHours)) * Math.sign(node.body.rotationHours);
      }
      if (node.mesh.material.userData.animatedSun) {
        node.mesh.material.uniforms.uTime.value = visualTime;
      }
      if (node.earthLayers) {
        node.earthLayers.clouds.rotation.y += delta * 0.0045;
        node.earthLayers.nightMaterial.uniforms.uSunPosition.value.copy(worldPositions.get('sun'));
      }
      if (node.marker) {
        const hideCloseUpMarker = id === state.selectedId && state.viewMode === 'follow';
        node.marker.material.opacity = id === state.selectedId && !hideCloseUpMarker
          ? 0.85 + Math.sin(performance.now() * 0.005) * 0.15
          : 0;
      }
      if (node.physicalLocator) {
        const selectedLocator = id === state.selectedId;
        const hideLocatorForPhysicalCloseUp = physicalScale
          && state.viewMode === 'follow'
          && selectedLocator;
        node.physicalLocator.material.opacity = physicalScale && !hideLocatorForPhysicalCloseUp
          ? selectedLocator || node.body.type === 'star'
            ? 1
            : node.body.type === 'moon'
              ? 0.38
              : 0.82
          : 0;
      }
      const selectedBody = bodyMap[state.selectedId] ?? bodyMap.sun;
      const moonInSelectedSystem = node.body.type === 'moon' && node.body.parent === selectedBody.id;
      const selectedSystemCloseUp = state.viewMode === 'follow'
        && (id === state.selectedId || node.body.parent === state.selectedId);
      node.label.material.opacity = selectedSystemCloseUp
        ? 0
        : id === state.selectedId
        ? 0.96
        : moonInSelectedSystem
          ? 0.34
          : node.body.type === 'moon'
            ? 0.06
            : physicalScale
              ? 0.88
            : state.viewMode === 'follow'
              ? 0.18
              : state.viewMode === 'helical'
                ? 0.5
                : 0.72;
      const physicalLabelScale = physicalScale
        ? node.body.type === 'moon' ? 1.35 : 2.1
        : 1;
      node.label.scale.copy(node.labelScale).multiplyScalar(physicalLabelScale);
      node.group.getWorldPosition(worldPositions.get(id));
      if (node.body.type === 'moon') {
        const parentPosition = worldPositions.get(node.body.parent);
        if (parentPosition) {
          node.mesh.lookAt(parentPosition);
          node.mesh.rotateY(Math.PI / 2);
        }
      }
    }
    for (const item of orbitLines) {
      const orbitBody = bodyMap[item.id];
      const ratio = state.scaleMode === 'physical'
        ? physicalOrbitFor(orbitBody) / orbitBody.orbitRadius
        : 1;
      item.orbit.scale.setScalar(ratio);
    }
    updateSunMotionLine(state.viewMode, state.selectedId);
    updateHelicalTrails(state.viewMode, state.selectedId);

    sunLight.position.copy(worldPositions.get('sun'));
    const selected = bodyNodes.get(state.selectedId) ?? bodyNodes.get('sun');
    selected.group.getWorldPosition(targetPosition);
    cameraFocusPosition.copy(state.viewMode === 'orbit' ? worldPositions.get('sun') : targetPosition);

    const selectedBody = selected.body;
    const selectedSceneRadius = state.scaleMode === 'physical'
      ? physicalRadiusFor(selectedBody)
      : selectedBody.scaleRadius;
    const distance = selectedBody.type === 'star'
      ? 40
      : selectedBody.type === 'planet'
        ? 18
        : 4.2;
    let cameraBias;
    if (state.viewMode === 'orbit') {
      cameraBias = state.scaleMode === 'physical'
        ? PHYSICAL_ORBIT_CAMERA_BIAS
        : selectedBody.type === 'star'
          ? new THREE.Vector3(0, 42, 38)
        : new THREE.Vector3(distance * 1.25, distance * 0.72, distance * 1.35);
    } else if (state.viewMode === 'helical') {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(-20, 14, 43)
        : new THREE.Vector3(-distance * 0.96, distance * 0.44, distance * 0.92);
    } else {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(-8, 6.5, 15)
        : new THREE.Vector3(selectedSceneRadius * 7 + 7, selectedSceneRadius * 2.2 + 2.4, selectedSceneRadius * 4.4 + 7);
    }
    controls.minDistance = selectedSceneRadius * (selectedBody.type === 'star' ? 1.68 : 1.18);
    if (state.viewMode === 'follow' && selectedBody.type !== 'star') {
      const sunPosition = worldPositions.get('sun') ?? targetPosition;
      followSunVector.copy(sunPosition).sub(targetPosition).normalize();
      followSideVector.set(-followSunVector.z, 0, followSunVector.x).normalize();
      cameraGoal.copy(targetPosition)
        .addScaledVector(followSunVector, selectedSceneRadius * 3.8)
        .addScaledVector(followSideVector, selectedSceneRadius * 1.45);
      cameraGoal.y += selectedSceneRadius * 0.72;
    } else if (state.viewMode === 'follow') {
      cameraGoal.copy(targetPosition).add(new THREE.Vector3(
        -selectedSceneRadius * 3.45,
        selectedSceneRadius * 1.25,
        selectedSceneRadius * 3.05,
      ));
    } else {
      cameraGoal.copy(cameraFocusPosition).add(cameraBias);
    }
    lookAtGoal.copy(cameraFocusPosition);
    if (state.viewMode === 'helical') lookAtGoal.z -= selectedBody.type === 'star' ? 11 : 6.5;

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
        if (cameraTransition <= 0.01) {
          camera.position.copy(cameraGoal);
          currentLook.copy(lookAtGoal);
          controls.target.copy(lookAtGoal);
          cameraTransition = 0;
        }
      } else {
        targetDelta.copy(cameraFocusPosition).sub(previousTarget);
        camera.position.add(targetDelta);
        controls.target.add(targetDelta);
      }
      previousTarget.copy(cameraFocusPosition);
    }

    controls.update();
    const physicalCloseUp = state.scaleMode === 'physical' && state.viewMode === 'follow';
    cameraLight.intensity = physicalCloseUp ? 0 : 0.35;
    const nextNearPlane = physicalCloseUp
      ? Math.max(selectedSceneRadius * 0.08, 0.0000001)
      : 0.05;
    if (camera.near !== nextNearPlane) {
      camera.near = nextNearPlane;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    const exposureOrbitBody = selectedBody.type === 'planet'
      ? selectedBody
      : selectedBody.parent && bodyMap[selectedBody.parent]?.type === 'planet'
        ? bodyMap[selectedBody.parent]
        : bodyMap.earth;
    const observationExposure = state.viewMode === 'follow'
      ? THREE.MathUtils.clamp(
        Math.sqrt(exposureOrbitBody.orbitRadius / bodyMap.earth.orbitRadius),
        0.95,
        1.8,
      )
      : 1;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      renderer.toneMappingExposure,
      1.05 * observationExposure,
      1 - Math.pow(0.02, delta),
    );
    const starDepthDrift = rushingMode ? THREE.MathUtils.euclideanModulo(forward * 2.4, 120) : 0;
    galaxy.position.copy(camera.position).addScaledVector(backgroundTravelDirection, starDepthDrift);
    catalogStars.position.copy(camera.position);
    milkyWay.position.copy(camera.position);
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

function BodyButton({ body, selectedId, onSelect, locale, language, expanded = false, nested = false }) {
  const parent = body.parent ? bodyMap[body.parent] : null;
  return (
    <button
      type="button"
      className={`body-row ${nested ? 'nested' : ''} ${selectedId === body.id ? 'selected' : ''}`}
      onClick={() => onSelect(body.id)}
    >
      <span className="body-dot body-texture" style={{ backgroundImage: `url(${textureForBody(body.id)})` }} />
      <span>
        <strong>{language === 'zh' ? body.zh : body.name}</strong>
        <small>{language === 'zh' ? body.name : body.zh}</small>
      </span>
      <em>
        {expanded ? '⌄' : body.type === 'moon' ? (language === 'zh' ? parent?.zh : parent?.name) : body.type === 'star' ? (language === 'zh' ? '中心' : 'center') : formatDistance(body.distanceKm)}
      </em>
    </button>
  );
}

function AtmosphereIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.2 15.8h10.9a3.4 3.4 0 0 0 .2-6.8A5.7 5.7 0 0 0 6.6 7.4a4.2 4.2 0 0 0-.4 8.4Z" />
      <path d="M3.5 18.5h11.2M7.5 21h9" />
    </svg>
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
  const [scaleMode, setScaleMode] = useState('visual');
  const [language, setLanguage] = useState(() => localStorage.getItem('solar-rush-language') || 'zh');
  const [detailTab, setDetailTab] = useState('overview');
  const [additionalDataOpen, setAdditionalDataOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const copy = ui[language];
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  const bodyDetails = getBodyDetails(selectedBody);
  const ephemerisYear = telemetry.date.getUTCFullYear();
  const ephemerisInRange = ephemerisYear >= 1800 && ephemerisYear <= 2050;
  const referenceFrame = selectedBody.type === 'planet'
    ? 'J2000 mean ecliptic'
    : selectedBody.type === 'moon'
      ? 'JPL local Laplace/equatorial plane'
      : 'Heliocentric origin';
  const ephemerisModel = selectedBody.type === 'planet'
    ? 'Astronomy Engine VSOP87 / J2000'
    : selectedBody.type === 'moon'
      ? 'JPL J2000 mean elements'
      : 'Scene origin';
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
    setCameraRevision((value) => value + 1);
    setMobileMenuOpen(false);
  };
  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem('solar-rush-language', nextLanguage);
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
    scaleMode,
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

  const beijingFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const utcFormatter = new Intl.DateTimeFormat(locale, {
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
    <main className={`app-shell ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      <section ref={mountRef} className="space-stage" aria-label={language === 'zh' ? '3D 太阳系模拟器' : '3D Solar System Simulator'} />

      <header className="top-bar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Solar Rush</h1>
        </div>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={language === 'zh' ? (mobileMenuOpen ? '关闭菜单' : '打开菜单') : (mobileMenuOpen ? 'Close menu' : 'Open menu')}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          <span aria-hidden="true">
            {mobileMenuOpen ? '×' : (
              <svg className="mobile-menu-icon" viewBox="0 0 24 24">
                <path d="M7 7h10M5 12h14M8 17h8" />
              </svg>
            )}
          </span>
          {language === 'zh' ? '菜单' : 'Menu'}
        </button>
        <div className="time-strip">
          <div>
            <span>UTC</span>
            <strong>{utcFormatter.format(telemetry.date)}</strong>
          </div>
          <div>
            <span>{copy.beijingTime}</span>
            <strong>{beijingFormatter.format(telemetry.date)}</strong>
          </div>
          <div>
            <span>{copy.lunar}</span>
            <strong>{language === 'zh' ? formatLunarDate(telemetry.date) : new Intl.DateTimeFormat('en-US-u-ca-chinese', { month: 'long', day: 'numeric' }).format(telemetry.date)}</strong>
          </div>
        </div>
        <div className="controls">
          <div className="transport-controls" aria-label="time controls">
            <button type="button" aria-label={copy.reset} onClick={() => setCameraRevision((value) => value + 1)}>↺</button>
            <button type="button" aria-label={playing ? copy.pause : copy.play} className={playing ? 'active' : ''} onClick={() => setPlaying((value) => !value)}>
              {playing ? 'Ⅱ' : '▶'}
            </button>
          </div>
          <label className="speed-control">
            <span>{copy.simSpeed}</span>
            <select value={speedIndex} onChange={(event) => setSpeedIndex(Number(event.target.value))}>
              {simulationSpeeds.map((item, index) => (
                <option value={index} key={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="language-switcher" aria-label="Language">
            <button type="button" className={language === 'zh' ? 'active' : ''} onClick={() => changeLanguage('zh')}>中</button>
            <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => changeLanguage('en')}>EN</button>
          </div>
        </div>
      </header>

      <aside className="left-panel glass-panel">
        <div className="panel-title">
          <span>{copy.celestialBodies}</span>
          <strong>{bodies.length}</strong>
        </div>
        <label className="search-box">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={copy.search}
          />
        </label>
        {visibleIds.has('sun') && (
          <div className="body-group">
            <h2>{copy.star}</h2>
            <BodyButton body={bodyMap.sun} selectedId={selectedId} language={language} locale={locale} onSelect={(id) => {
              setSelectedId(id);
              setAutoFollow(true);
              setCameraRevision((value) => value + 1);
              setMobileMenuOpen(false);
            }} />
          </div>
        )}
        <div className="body-group">
          <h2>{copy.planets}</h2>
          {planets.map((planet) => {
            const planetVisible = visibleIds.has(planet.id);
            const visibleMoons = planet.moons.map((moonId) => bodyMap[moonId]).filter((moon) => moon && visibleIds.has(moon.id));
            if (!planetVisible && visibleMoons.length === 0) return null;
            return (
              <div className="tree-node" key={planet.id}>
                {planetVisible && (
                  <BodyButton body={planet} selectedId={selectedId} language={language} locale={locale} expanded={planet.moons.length > 0} onSelect={(id) => {
                    setSelectedId(id);
                    setAutoFollow(true);
                    setCameraRevision((value) => value + 1);
                    setMobileMenuOpen(false);
                  }} />
                )}
                {visibleMoons.length > 0 && (
                  <div className="moon-branch">
                    {visibleMoons.map((moon) => (
                      <BodyButton key={moon.id} body={moon} selectedId={selectedId} language={language} locale={locale} nested onSelect={(id) => {
                        setSelectedId(id);
                        setAutoFollow(true);
                        setCameraRevision((value) => value + 1);
                        setMobileMenuOpen(false);
                      }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {visibleBodies.length === 0 && (
          <p className="empty-state">{copy.noMatches}</p>
        )}
      </aside>

      <aside className="right-panel glass-panel">
        <div className="body-hero">
          <span className="body-preview body-texture" style={{ backgroundImage: `url(${textureForBody(selectedBody.id)})` }} />
          <div>
            <strong>{language === 'zh' ? selectedBody.zh : selectedBody.name}</strong>
            <small>{language === 'zh' ? selectedBody.name : selectedBody.zh}</small>
          </div>
        </div>
        <div className="selected-heading">
          <span>{selectedBody.type.toUpperCase()}</span>
          <h2>{language === 'zh' ? selectedBody.zh : selectedBody.name}</h2>
          <p>
            {copy[`${viewMode}Description`]}
          </p>
          <div className={`science-status ${ephemerisInRange ? '' : 'warning'}`}>
            <span>{ephemerisInRange ? copy.inRange : copy.outRange}</span>
            <small>{scaleMode === 'physical' ? copy.physicalScale : copy.visualScale}</small>
          </div>
        </div>

        <div className="detail-tabs">
          {['overview', 'physical', 'composition', 'atmosphere'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={detailTab === tab ? 'active' : ''}
              aria-pressed={detailTab === tab}
              onClick={() => setDetailTab(tab)}
            >
              {tab === 'atmosphere' && <AtmosphereIcon className="tab-atmosphere-icon" />}
              {copy[tab]}
            </button>
          ))}
        </div>

        {detailTab === 'overview' && (
          <div className="detail-copy">
            <p>{bodyDetails.overview[language === 'zh' ? 1 : 0]}</p>
            <a href={bodyDetails.source} target="_blank" rel="noreferrer">{copy.source} ↗</a>
          </div>
        )}
        {detailTab === 'composition' && <div className="detail-copy"><p>{bodyDetails.composition[language === 'zh' ? 1 : 0]}</p><a href={bodyDetails.source} target="_blank" rel="noreferrer">{copy.source} ↗</a></div>}
        {detailTab === 'atmosphere' && (
          <div className="detail-copy atmosphere-detail">
            <span className="detail-icon atmosphere-icon" aria-hidden="true"><AtmosphereIcon /></span>
            <p>{bodyDetails.atmosphere[language === 'zh' ? 1 : 0]}</p>
            <a href={bodyDetails.source} target="_blank" rel="noreferrer">{copy.source} ↗</a>
          </div>
        )}

        {(detailTab === 'overview' || detailTab === 'physical') && <div className="stat-list">
          <div>
            <span>{copy.radius}</span>
            <strong>{formatNumber(selectedBody.radiusKm, ' km', locale)}</strong>
          </div>
          <div>
            <span>{copy.distance}</span>
            <strong>{selectedBody.parent ? formatDistance(selectedBody.distanceKm) : copy.center}</strong>
          </div>
          <div>
            <span>{copy.orbitPeriod}</span>
            <strong>{selectedBody.orbitDays ? `${formatFixed(Math.abs(selectedBody.orbitDays), 3)} ${copy.days}` : 'N/A'}</strong>
          </div>
          <div>
            <span>{copy.rotationPeriod}</span>
            <strong>{formatFixed(Math.abs(selectedBody.rotationHours), 2)} {copy.hours}</strong>
          </div>
          <div>
            <span>{copy.velocity}</span>
            <strong>{formatFixed(selectedBody.speedKmS, 2)} km/s</strong>
          </div>
          <div>
            <span>{copy.axialTilt}</span>
            <strong>{formatFixed(selectedBody.axialTilt, 2)}°</strong>
          </div>
          <div>
            <span>{copy.observation}</span>
            <strong>{copy[viewMode === 'orbit' ? 'orbitView' : viewMode === 'helical' ? 'spiralView' : 'followView']}</strong>
          </div>
        </div>}

        <button
          type="button"
          className="additional-data"
          aria-expanded={additionalDataOpen}
          onClick={() => setAdditionalDataOpen((value) => !value)}
        >
          <span>{copy.additional}</span>
          <strong>{additionalDataOpen ? '⌃' : '⌄'}</strong>
        </button>
        {additionalDataOpen && (
          <div className="stat-list additional-stat-list">
            <div><span>{copy.gravity}</span><strong>{selectedBody.gravity}</strong></div>
            <div><span>{copy.escape}</span><strong>{estimateEscapeVelocity(selectedBody)}</strong></div>
            <div><span>{copy.mass}</span><strong>{selectedBody.mass}</strong></div>
            <div><span>{copy.moons}</span><strong>{selectedBody.moons.length}</strong></div>
            <div><span>{copy.magnitude}</span><strong>{selectedBody.type === 'star' ? '-26.74' : '—'}</strong></div>
            <div><span>{copy.reference}</span><strong>{referenceFrame}</strong></div>
            <div><span>{copy.positionModel}</span><strong>{ephemerisModel}</strong></div>
            <div><span>{copy.scaleModel}</span><strong>{scaleMode === 'physical' ? 'Unified physical ratio' : 'Compressed visual scale'}</strong></div>
            <div><span>{copy.catalogue}</span><strong>Hipparcos bright subset / ICRS</strong></div>
            <div><span>{copy.lighting}</span><strong>Geometric eclipse + ring shadows</strong></div>
          </div>
        )}

        <div className="follow-control">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={scaleMode === 'physical'}
              onChange={(event) => {
                setScaleMode(event.target.checked ? 'physical' : 'visual');
                setViewMode('orbit');
                setCameraRevision((value) => value + 1);
              }}
            />
            <span>{copy.trueScale}</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={autoFollow} onChange={(event) => setAutoFollow(event.target.checked)} />
            <span>{copy.keepCentered}</span>
          </label>
        </div>
      </aside>

      <div className="center-time-chip">
        {utcFormatter.format(telemetry.date)} UTC
      </div>

      <div className="view-switcher">
        <button type="button" className={viewMode === 'orbit' ? 'active' : ''} onClick={() => switchViewMode('orbit')}>
          ◎ {copy.orbitView}
        </button>
        <button type="button" className={viewMode === 'helical' ? 'active' : ''} onClick={() => switchViewMode('helical')}>
          ◈ {copy.spiralView}
        </button>
        <button type="button" className={viewMode === 'follow' ? 'active' : ''} onClick={() => switchViewMode('follow')}>
          △ {copy.followView}
        </button>
      </div>

      <footer className="bottom-bar">
        <div className="timeline">
          <span>{copy.elapsed} {formatElapsed(telemetry.elapsedSeconds)}</span>
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
          <span>{copy.drift} {formatFixed(telemetry.forward, 4)} scene</span>
        </div>
        <div className="hint-strip">
          <kbd>{copy.wheel}</kbd> {copy.zoom}
          <kbd>{copy.leftClick}</kbd> {copy.rotate}
          <kbd>{copy.rightClick}</kbd> {copy.pan}
          <kbd>{copy.select}</kbd> {copy.focusBody}
        </div>
      </footer>
    </main>
  );
}

export default App;
