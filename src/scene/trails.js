import * as THREE from "three";
import { GALACTIC_TRAVEL_DIRECTION } from "./sceneConstants.js";
const rushingTrailRelative = new THREE.Vector3();
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
  const normalized = THREE.MathUtils.clamp((distanceProgress - brightHold) / (1 - brightHold), 0, 1);
  const smootherStep = normalized * normalized * normalized * (normalized * (normalized * 6 - 15) + 10);
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
    blending: THREE.AdditiveBlending
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
    blending: THREE.AdditiveBlending
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
    blending: THREE.AdditiveBlending
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
    pointCount
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
    blending: THREE.AdditiveBlending
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
    blending: THREE.AdditiveBlending
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
    blending: THREE.AdditiveBlending
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
    pointCount
  };
}
function getRushingTrailPoint(body, currentPosition, sunPosition, orbitNormal, progress, mode, out) {
  const tail = 1 - progress;
  const turns = THREE.MathUtils.clamp(2.7 - body.orbitRadius * 0.055, 1.2, 2.65);
  const depth = mode === 'follow' ? 58 : 96;
  rushingTrailRelative.copy(currentPosition).sub(sunPosition);
  const currentRadius = rushingTrailRelative.length();
  const radius = Math.max(currentRadius, body.orbitRadius * 0.8);
  const pinch = Math.pow(tail, 0.82);
  const curl = Math.sin(tail * Math.PI) * 0.52 + 0.48;
  const coilRadius = currentRadius + radius * pinch * curl * 0.18;
  rushingTrailRelative.applyAxisAngle(orbitNormal, -tail * turns * Math.PI * 2).multiplyScalar(currentRadius > 0 ? coilRadius / currentRadius : 1);
  out.copy(sunPosition).add(rushingTrailRelative).addScaledVector(GALACTIC_TRAVEL_DIRECTION, -tail * depth);
  return out;
}
export { rushingTrailRelative, createGlowTexture, createStarTexture, trailFade, createHelicalTrail, createSunMotionLine, getRushingTrailPoint };
