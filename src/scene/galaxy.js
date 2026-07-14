import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { brightStarCatalog } from "../astronomyData.js";
import { loadBodyTexture } from "./materials.js";
import { assetUrl } from "../config/appConfig.js";
import { EQJ_TO_ECL, GALAXY_DESKTOP_FILL, GALAXY_MAP_SIZE, GALAXY_MOBILE_FILL, MOBILE_LAYOUT_MAX_WIDTH } from "./sceneConstants.js";
import { galaxyFeatures } from "../data/galaxyData.js";
function createGalaxyLabel(text, accent = '#dceaff', displayHeight = 5.4) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 30;
  const horizontalPadding = 34;
  const verticalPadding = 24;
  ctx.font = `600 ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
  const textWidth = Math.ceil(ctx.measureText(text).width);
  canvas.width = textWidth + horizontalPadding * 2;
  canvas.height = fontSize + verticalPadding * 2;
  ctx.font = `600 ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(3, 8, 17, 0.78)';
  ctx.strokeStyle = 'rgba(125, 248, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, horizontalPadding, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  }));
  sprite.scale.set(displayHeight * (canvas.width / canvas.height), displayHeight, 1);
  return sprite;
}
function createGalaxyMap() {
  const group = new THREE.Group();
  group.visible = false;
  const galaxyTexture = loadBodyTexture(assetUrl('/textures/galaxy/gaia-milky-way-face-on.jpg'), {
    color: true
  });
  galaxyTexture.anisotropy = 8;
  const galaxyDisk = new THREE.Mesh(new THREE.PlaneGeometry(GALAXY_MAP_SIZE, GALAXY_MAP_SIZE), new THREE.MeshBasicMaterial({
    map: galaxyTexture,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
    side: THREE.DoubleSide
  }));
  galaxyDisk.rotation.x = -Math.PI / 2;
  galaxyDisk.position.y = -1.4;
  group.add(galaxyDisk);
  const selectionMarker = new THREE.Group();
  selectionMarker.position.y = 3.1;
  const selectionHalo = new THREE.Mesh(new THREE.RingGeometry(2.15, 2.48, 56), new THREE.MeshBasicMaterial({
    color: '#7df8ff',
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  selectionHalo.rotation.x = -Math.PI / 2;
  const selectionOuterHalo = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.16, 56), new THREE.MeshBasicMaterial({
    color: '#7df8ff',
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  selectionOuterHalo.rotation.x = -Math.PI / 2;
  selectionMarker.add(selectionHalo, selectionOuterHalo);
  group.add(selectionMarker);

  // Calibrated against the Sun marker in ESA/Gaia's annotated 4000 px map.
  // The marker is about (75, 850) px from the Galactic center, representing
  // the measured 8.2 kpc radius; the 250-unit plane maps that to (4.7, 53.1).
  const sunPosition = new THREE.Vector3(4.7, 1.8, 53.1);
  const marker = new THREE.Group();
  marker.position.copy(sunPosition);
  const markerDot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({
    color: '#fff2a8',
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  markerDot.rotation.x = -Math.PI / 2;
  const sunCrossGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.15, 0, 0), new THREE.Vector3(-0.42, 0, 0), new THREE.Vector3(0.42, 0, 0), new THREE.Vector3(1.15, 0, 0), new THREE.Vector3(0, 0, -1.15), new THREE.Vector3(0, 0, -0.42), new THREE.Vector3(0, 0, 0.42), new THREE.Vector3(0, 0, 1.15)]);
  const sunCross = new THREE.LineSegments(sunCrossGeometry, new THREE.LineBasicMaterial({
    color: '#7df8ff',
    transparent: true,
    opacity: 0.92
  }));
  marker.add(markerDot, sunCross);
  const sunLabels = {
    zh: createGalaxyLabel('太阳邻域 · 猎户支臂', '#eaffff', 4.8),
    en: createGalaxyLabel('Solar Neighborhood · Orion Spur', '#eaffff', 4.8)
  };
  for (const label of Object.values(sunLabels)) {
    label.position.set(label.scale.x / 2 + 1.1, 4.8, 0);
    label.userData.baseScale = label.scale.clone();
    marker.add(label);
  }
  group.add(marker);

  // This is a cartographic locator, not a physical rendering of Sagittarius A*.
  // The map texture already represents the luminous nuclear bulge and cluster.
  const centerMarker = new THREE.Group();
  centerMarker.position.y = 1;
  const centerRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 40), new THREE.MeshBasicMaterial({
    color: '#ffd27a',
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  centerRing.rotation.x = -Math.PI / 2;
  const centerCrossGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.65, 0, 0), new THREE.Vector3(-0.65, 0, 0), new THREE.Vector3(0.65, 0, 0), new THREE.Vector3(1.65, 0, 0), new THREE.Vector3(0, 0, -1.65), new THREE.Vector3(0, 0, -0.65), new THREE.Vector3(0, 0, 0.65), new THREE.Vector3(0, 0, 1.65)]);
  const centerCross = new THREE.LineSegments(centerCrossGeometry, new THREE.LineBasicMaterial({
    color: '#ffd27a',
    transparent: true,
    opacity: 0.82
  }));
  centerMarker.add(centerRing, centerCross);
  group.add(centerMarker);
  const centerLabels = {
    zh: createGalaxyLabel('银河系中心', '#ffe2a3', 5.1),
    en: createGalaxyLabel('Galactic Center', '#ffe2a3', 5.1)
  };
  for (const label of Object.values(centerLabels)) {
    label.position.set(label.scale.x / 2 + 1.25, 5.2, 0);
    label.userData.baseScale = label.scale.clone();
    group.add(label);
  }
  const featureLabels = {};
  const hitTargets = [];
  for (const feature of galaxyFeatures.filter(item => item.map && !item.suppressMapLabel)) {
    const labels = {
      zh: createGalaxyLabel(feature.zh, '#b9eaff', 2.7),
      en: createGalaxyLabel(feature.name, '#b9eaff', 2.7)
    };
    for (const label of Object.values(labels)) {
      label.position.set(feature.map[0], 2.5, feature.map[1]);
      label.userData.baseScale = label.scale.clone();
      group.add(label);
    }
    featureLabels[feature.id] = labels;
  }
  for (const feature of galaxyFeatures.filter(item => item.map)) {
    const hitTarget = new THREE.Mesh(new THREE.CircleGeometry(feature.group === 'locations' ? 3.8 : 3.2, 24), new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    }));
    hitTarget.rotation.x = -Math.PI / 2;
    hitTarget.position.set(feature.map[0], 3.25, feature.map[1]);
    hitTarget.userData.galaxyFeatureId = feature.id;
    group.add(hitTarget);
    hitTargets.push(hitTarget);
  }
  return {
    group,
    selectionMarker,
    hitTargets,
    labels: {
      sun: sunLabels,
      center: centerLabels,
      features: featureLabels
    }
  };
}
function createStarField(starTexture) {
  const depthDrift = {
    value: 0
  };
  const createDriftingMaterial = options => {
    const material = new THREE.PointsMaterial(options);
    material.onBeforeCompile = shader => {
      shader.uniforms.uDepthDrift = depthDrift;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uDepthDrift;').replace('#include <begin_vertex>', `#include <begin_vertex>
          // Wrap stars independently instead of snapping the whole field back
          // to its origin. The distributed wrap points keep the travel motion
          // continuous without a synchronized background flash.
          transformed.z = mod(transformed.z + uDepthDrift + 240.0, 480.0) - 240.0;`);
    };
    return material;
  };
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const brightPositions = [];
  const brightColors = [];
  for (let i = 0; i < 22_000; i += 1) {
    const radius = THREE.MathUtils.randFloat(36, 230);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    const brightness = THREE.MathUtils.randFloat(0.7, 1);
    colors.push(brightness, brightness, THREE.MathUtils.randFloat(0.86, 1));
    if (i % 23 === 0) {
      brightPositions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
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
  field.add(new THREE.Points(geometry, createDriftingMaterial({
    map: starTexture,
    size: 0.23,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })), new THREE.Points(brightGeometry, createDriftingMaterial({
    map: starTexture,
    size: 0.72,
    vertexColors: true,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    alphaTest: 0.025,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })));
  field.userData.depthDrift = depthDrift;
  return field;
}
function starColorFromBv(bv) {
  if (bv < -0.05) return new THREE.Color('#a9c8ff');
  if (bv < 0.35) return new THREE.Color('#e3edff');
  if (bv < 0.9) return new THREE.Color('#fff4dc');
  if (bv < 1.5) return new THREE.Color('#ffd39b');
  return new THREE.Color('#ff9d72');
}
function pushEquatorialToEclipticScene(x, y, z, target) {
  const rotation = EQJ_TO_ECL.rot;
  const eclipticX = rotation[0][0] * x + rotation[1][0] * y + rotation[2][0] * z;
  const eclipticY = rotation[0][1] * x + rotation[1][1] * y + rotation[2][1] * z;
  const eclipticZ = rotation[0][2] * x + rotation[1][2] * y + rotation[2][2] * z;
  target.push(eclipticX, eclipticZ, -eclipticY);
}
function createCatalogStarField(starTexture) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const star of brightStarCatalog) {
    const ra = THREE.MathUtils.degToRad(star.ra);
    const dec = THREE.MathUtils.degToRad(star.dec);
    const radius = 205;
    pushEquatorialToEclipticScene(radius * Math.cos(dec) * Math.cos(ra), radius * Math.cos(dec) * Math.sin(ra), radius * Math.sin(dec), positions);
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
    toneMapped: false
  }));
}
function createMilkyWaySphere(renderer) {
  const material = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(225, 128, 64), material);
  sphere.renderOrder = -1000;

  // The NASA texture is an ICRF/J2000 plate carrée map. Build an exact
  // equatorial-to-scene basis so its Milky Way aligns with the J2000 catalogue
  // stars already rendered in the ecliptic scene frame.
  const basisValues = [];
  pushEquatorialToEclipticScene(1, 0, 0, basisValues);
  pushEquatorialToEclipticScene(0, 0, 1, basisValues);
  pushEquatorialToEclipticScene(0, -1, 0, basisValues);
  const equatorialToScene = new THREE.Matrix4().makeBasis(new THREE.Vector3(...basisValues.slice(0, 3)), new THREE.Vector3(...basisValues.slice(3, 6)), new THREE.Vector3(...basisValues.slice(6, 9)));
  sphere.quaternion.setFromRotationMatrix(equatorialToScene);
  const textureResolution = '8k';
  const texturePath = resolution => assetUrl(`/textures/galaxy/sky/milkyway-nasa-2020-${resolution}.ktx2`);
  const loader = new KTX2Loader().setTranscoderPath(assetUrl('/basis/')).detectSupport(renderer);
  const applyTexture = (texture, resolution) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // NASA centers RA 0h and increases RA to the left. KTX2 textures are not
    // upload-flipped, so mirror both axes to match the sphere's inward UVs.
    texture.repeat.set(-1, -1);
    texture.offset.set(1, 1);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    material.map = texture;
    material.needsUpdate = true;
    sphere.userData.textureReady = true;
    sphere.userData.textureResolution = resolution;
    loader.dispose();
  };
  const loadTexture = resolution => {
    loader.load(texturePath(resolution), texture => applyTexture(texture, resolution), undefined, () => loader.dispose());
  };
  sphere.userData.material = material;
  sphere.userData.textureReady = false;
  sphere.userData.textureResolution = textureResolution;
  sphere.userData.visibilityScale = 1;
  loadTexture(textureResolution);
  return sphere;
}
function getGalaxyCameraBias(camera, viewportWidth) {
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const halfMapSize = GALAXY_MAP_SIZE / 2;
  const viewportFill = viewportWidth > MOBILE_LAYOUT_MAX_WIDTH ? GALAXY_DESKTOP_FILL : GALAXY_MOBILE_FILL;
  const cameraDistance = halfMapSize / (Math.tan(limitingFov / 2) * viewportFill);
  return new THREE.Vector3(0, 1, 18 / 94).normalize().multiplyScalar(cameraDistance);
}
export { createGalaxyLabel, createGalaxyMap, createStarField, starColorFromBv, pushEquatorialToEclipticScene, createCatalogStarField, createMilkyWaySphere, getGalaxyCameraBias };
