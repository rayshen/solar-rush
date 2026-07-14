import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bodies, bodyMap } from '../solarData.js';
import { DAY_MS, START_DATE } from "../config/appConfig.js";
import { galaxyFeatures } from "../data/galaxyData.js";
import { PHYSICAL_KM_PER_UNIT, PHYSICAL_AU_PER_UNIT, PHYSICAL_ORBIT_CAMERA_BIAS, HALLEY_SEMI_MAJOR_AXIS_AU, HALLEY_BODY, ECLIPTIC_NORTH_SCENE, GALACTIC_TRAVEL_DIRECTION, GALACTIC_TRAVEL_UP, GALACTIC_BACKGROUND_ROTATION, galacticFrameVector, trailBodyIds, trailColors } from "./sceneConstants.js";
import { setPlanetScenePosition, setPlanetOrbitNormal, setSatelliteScenePosition, setHalleyScenePosition, setHalleyVisualScenePosition } from "./astronomy.js";
import { createPlanetOrbitLine, createHalleyOrbitLine, createCometTailLine, createOrbitLine, createAsteroidBelt, createKuiperBelt, updateSmallBodyBelt } from "./orbitObjects.js";
import { createGlowTexture, createStarTexture, createHelicalTrail, createSunMotionLine, getRushingTrailPoint } from "./trails.js";
import { createGalaxyMap, createStarField, createCatalogStarField, createMilkyWaySphere, getGalaxyCameraBias } from "./galaxy.js";
import { createSunMaterial, createRimGlowMaterial, atmosphereProfiles, addEarthSurfaceLayers, createPlanetRingMaterial, createLabelSprite, createPlanetMaterial } from "./materials.js";
function buildSolarScene(mount, options) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03060d');
  const camera = new THREE.PerspectiveCamera(54, mount.clientWidth / mount.clientHeight, 0.05, 2400);
  if (options.getState().viewMode === 'helical') {
    camera.position.copy(options.getState().helicalView === 'rear' ? galacticFrameVector(32, 22, -70) : galacticFrameVector(-20, 14, 43));
  } else camera.position.set(0, 42, 38);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);
  const createCameraControls = up => {
    camera.up.copy(up);
    const nextControls = new OrbitControls(camera, renderer.domElement);
    nextControls.enableDamping = true;
    nextControls.dampingFactor = 0.06;
    nextControls.minDistance = 1.2;
    nextControls.maxDistance = 240;
    nextControls.panSpeed = 0.72;
    nextControls.rotateSpeed = 0.66;
    return nextControls;
  };
  let controlFrame = options.getState().viewMode === 'helical' ? 'galactic' : 'ecliptic';
  let controls = createCameraControls(controlFrame === 'galactic' ? GALACTIC_TRAVEL_UP : ECLIPTIC_NORTH_SCENE);
  if (options.getState().viewMode === 'helical') {
    controls.target.copy(GALACTIC_TRAVEL_DIRECTION).multiplyScalar(options.getState().helicalView === 'rear' ? 11 : -11);
  }
  const initialCameraPose = options.getState().cameraPose;
  if (initialCameraPose) {
    camera.position.fromArray(initialCameraPose.position);
    controls.target.fromArray(initialCameraPose.target);
    camera.fov = THREE.MathUtils.clamp(initialCameraPose.fov, 20, 100);
    camera.updateProjectionMatrix();
  }

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
  galaxy.quaternion.copy(GALACTIC_BACKGROUND_ROTATION);
  scene.add(galaxy);
  const catalogStars = createCatalogStarField(starTexture);
  scene.add(catalogStars);
  const milkyWay = createMilkyWaySphere(renderer);
  scene.add(milkyWay);
  const galaxyMap = createGalaxyMap();
  scene.add(galaxyMap.group);
  const systemRoot = new THREE.Group();
  scene.add(systemRoot);
  const asteroidBelt = createAsteroidBelt(starTexture);
  updateSmallBodyBelt(asteroidBelt, START_DATE, false);
  asteroidBelt.visible = false;
  systemRoot.add(asteroidBelt);
  const kuiperBelt = createKuiperBelt(starTexture);
  updateSmallBodyBelt(kuiperBelt, START_DATE, false);
  kuiperBelt.visible = false;
  systemRoot.add(kuiperBelt);
  const halleyVisualOrbitLine = createHalleyOrbitLine();
  halleyVisualOrbitLine.visible = false;
  systemRoot.add(halleyVisualOrbitLine);
  const halleyPhysicalOrbitLine = createHalleyOrbitLine({
    physicalScale: true
  });
  halleyPhysicalOrbitLine.visible = false;
  systemRoot.add(halleyPhysicalOrbitLine);
  const helicalTrailGroup = new THREE.Group();
  scene.add(helicalTrailGroup);
  const trailGlowTexture = createGlowTexture();
  const halleyGroup = new THREE.Group();
  const halleyNucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), new THREE.MeshStandardMaterial({
    color: '#292a28',
    roughness: 0.98,
    metalness: 0,
    emissive: '#37434a',
    emissiveIntensity: 0.16
  }));
  halleyNucleus.scale.set(1.7, 0.82, 0.72);
  halleyGroup.add(halleyNucleus);
  const halleyComa = new THREE.Sprite(new THREE.SpriteMaterial({
    map: trailGlowTexture,
    color: '#d7f5ff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  halleyComa.scale.setScalar(1.8);
  halleyGroup.add(halleyComa);
  const halleyLocator = new THREE.Sprite(new THREE.SpriteMaterial({
    map: trailGlowTexture,
    color: '#9de9ff',
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  }));
  halleyLocator.scale.setScalar(0.86);
  halleyLocator.renderOrder = 20;
  halleyGroup.add(halleyLocator);
  const halleyLabel = createLabelSprite({
    name: '1P/Halley',
    zh: '哈雷彗星',
    type: 'comet',
    scaleRadius: 0.22
  });
  halleyLabel.scale.multiplyScalar(1.05);
  halleyLabel.material.depthTest = false;
  halleyLabel.renderOrder = 22;
  halleyGroup.add(halleyLabel);
  const halleyDustTail = createCometTailLine('#ffe0a3');
  const halleyIonTail = createCometTailLine('#8be8ff');
  const halleyDustCone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1, 24, 1, true), new THREE.MeshBasicMaterial({
    color: '#ffd79a',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }));
  const halleyIonCone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1, 18, 1, true), new THREE.MeshBasicMaterial({
    color: '#78e6ff',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }));
  halleyGroup.add(halleyDustCone, halleyIonCone, halleyDustTail, halleyIonTail);
  halleyGroup.visible = false;
  systemRoot.add(halleyGroup);
  const sunMotionLine = createSunMotionLine(trailGlowTexture);
  scene.add(sunMotionLine.group);
  const bodyNodes = new Map();
  const bodyHitTargets = [];
  halleyNucleus.userData.bodyId = 'halley';
  bodyHitTargets.push(halleyNucleus);
  const orbitPivots = new Map();
  const worldPositions = new Map();
  const orbitLines = [];
  const trailNodes = new Map();
  const sunBody = bodyMap.sun;
  worldPositions.set('halley', new THREE.Vector3());
  for (const id of trailBodyIds) {
    const trail = createHelicalTrail(trailColors[id], ['jupiter', 'saturn', 'uranus', 'neptune'].includes(id) ? 2400 : 1900, id === 'jupiter' ? 0.96 : 0.86, trailGlowTexture);
    trail.group.visible = false;
    helicalTrailGroup.add(trail.group);
    trailNodes.set(id, trail);
  }
  for (const body of bodies) {
    if (body.type === 'comet') continue;
    const parentGroup = body.parent ? bodyNodes.get(body.parent)?.group : systemRoot;
    if (!parentGroup) continue;
    const pivot = new THREE.Group();
    pivot.rotation.x = 0;
    parentGroup.add(pivot);
    orbitPivots.set(body.id, pivot);
    if (body.parent && body.orbitRadius > 0) {
      const orbit = body.type === 'planet' ? createPlanetOrbitLine(body, START_DATE, '#4e6f9e', 0.28) : createOrbitLine(body.orbitRadius, body.eccentricity, '#6f7e99', 0.22);
      if (body.type === 'moon') orbit.rotation.x = THREE.MathUtils.degToRad(body.inclination);
      parentGroup.add(orbit);
      orbitLines.push({
        id: body.id,
        parent: body.parent,
        orbit,
        type: body.type,
        defaultOpacity: body.type === 'moon' ? 0.22 : 0.28
      });
    }
    const group = new THREE.Group();
    if (body.type === 'planet') setPlanetScenePosition(body.id, START_DATE, body.orbitRadius, group.position);else if (body.type === 'moon') setSatelliteScenePosition(body, START_DATE, body.orbitRadius, group.position);else group.position.x = body.orbitRadius;
    pivot.add(group);
    const geometry = new THREE.SphereGeometry(body.scaleRadius, ['sun', 'earth'].includes(body.id) ? 144 : body.type === 'moon' ? 96 : 128, ['sun', 'earth'].includes(body.id) ? 72 : body.type === 'moon' ? 48 : 64);
    const material = body.id === 'sun' ? createSunMaterial() : createPlanetMaterial(body);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.bodyId = body.id;
    bodyHitTargets.push(mesh);
    mesh.rotation.z = THREE.MathUtils.degToRad(body.axialTilt);
    if (body.id === 'phobos') mesh.scale.set(1.38, 0.9, 0.78);
    if (body.id === 'deimos') mesh.scale.set(1.24, 0.92, 0.82);
    mesh.castShadow = body.type !== 'star';
    mesh.receiveShadow = body.type !== 'star';
    group.add(mesh);
    const earthLayers = body.id === 'earth' ? addEarthSurfaceLayers(mesh, body.scaleRadius) : null;
    if (body.id === 'sun') {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: trailGlowTexture,
        color: '#ff7a12',
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      halo.scale.setScalar(body.scaleRadius * 4.8);
      halo.renderOrder = -1;
      group.add(halo);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(body.scaleRadius * 1.2, 96, 48), createRimGlowMaterial('#ffb52e', 0.76, 1.55));
      group.add(glow);
      const corona = new THREE.Mesh(new THREE.SphereGeometry(body.scaleRadius * 1.48, 96, 48), createRimGlowMaterial('#ff6a0a', 0.16, 2.45));
      group.add(corona);
    }
    const atmosphereProfile = atmosphereProfiles[body.id];
    if (atmosphereProfile) {
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(body.scaleRadius * atmosphereProfile.scale, 96, 48), createRimGlowMaterial(atmosphereProfile.color, atmosphereProfile.opacity, atmosphereProfile.power));
      group.add(atmosphere);
      if (body.id === 'earth') {
        const outerAtmosphere = new THREE.Mesh(new THREE.SphereGeometry(body.scaleRadius * 1.075, 64, 32), createRimGlowMaterial('#4d9fff', 0.18, 3.4));
        group.add(outerAtmosphere);
      }
    }
    if (body.id === 'saturn') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 2.35, 128), createPlanetRingMaterial(body));
      ring.rotation.set(Math.PI / 2, 0, THREE.MathUtils.degToRad(body.axialTilt));
      ring.castShadow = true;
      ring.receiveShadow = true;
      group.add(ring);
    }
    if (body.id === 'uranus') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(body.scaleRadius * 1.35, body.scaleRadius * 1.65, 96), createPlanetRingMaterial(body));
      ring.rotation.set(Math.PI / 2, 0, THREE.MathUtils.degToRad(body.axialTilt));
      ring.castShadow = true;
      ring.receiveShadow = true;
      group.add(ring);
    }
    const marker = body.type === 'star' ? null : new THREE.Mesh(new THREE.RingGeometry(body.scaleRadius * 1.22, body.scaleRadius * 1.3, 72), new THREE.MeshBasicMaterial({
      color: '#7df8ff',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    }));
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
      blending: THREE.AdditiveBlending
    }));
    const locatorSize = body.type === 'star' ? 2.6 : body.type === 'moon' ? 0.24 : 1.05;
    physicalLocator.scale.setScalar(locatorSize);
    physicalLocator.renderOrder = 20;
    group.add(physicalLocator);
    const label = createLabelSprite(body);
    group.add(label);

    // Labels and locator overlays are navigational aids, not physical geometry.
    // Keeping them out of this list prevents true scale from shrinking them away.
    const helperVisuals = new Set([label, marker, physicalLocator].filter(Boolean));
    const visuals = group.children.filter(object => !helperVisuals.has(object)).map(object => ({
      object,
      scale: object.scale.clone()
    }));
    const labelScale = label.scale.clone();
    bodyNodes.set(body.id, {
      body,
      pivot,
      group,
      mesh,
      marker,
      physicalLocator,
      label,
      labelScale,
      earthLayers,
      visuals
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
  let simDays = 0;
  let elapsedSeconds = 0;
  let visualTime = 0;
  let raf = 0;
  let cameraTransition = 1;
  let lastSelectedId = '';
  let lastViewMode = '';
  let lastOrbitScope = '';
  let lastHelicalView = '';
  let lastCameraRevision = -1;
  let viewportRevision = 0;
  let lastViewportRevision = -1;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerStart = new THREE.Vector2();
  const trailPoint = new THREE.Vector3();
  const trailOrbitNormal = new THREE.Vector3();
  const halleyNextPosition = new THREE.Vector3();
  const halleyTruePosition = new THREE.Vector3();
  const halleyAntiSolar = new THREE.Vector3();
  const halleyVelocity = new THREE.Vector3();
  const halleyDustDirection = new THREE.Vector3();
  const halleyTailRotationAxis = new THREE.Vector3(0, 1, 0);
  const halleyTailReverseDirection = new THREE.Vector3();
  const physicalRadiusFor = body => body.radiusKm / PHYSICAL_KM_PER_UNIT;
  const physicalOrbitFor = body => body.distanceKm / PHYSICAL_KM_PER_UNIT;
  const updatePointer = event => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
  };
  const pickSceneTarget = (event, commit = false) => {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const state = options.getState();
    const galaxyView = state.viewMode === 'orbit' && state.orbitScope === 'galaxy';
    const hits = raycaster.intersectObjects(galaxyView ? galaxyMap.hitTargets : bodyHitTargets, false);
    const hit = hits[0]?.object;
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    if (!commit || !hit) return;
    if (galaxyView) options.onSelectGalaxyFeature?.(hit.userData.galaxyFeatureId);else options.onSelectBody?.(hit.userData.bodyId);
  };
  const onPointerDown = event => pointerStart.set(event.clientX, event.clientY);
  const onPointerMove = event => pickSceneTarget(event);
  const onPointerUp = event => {
    if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 5) {
      pickSceneTarget(event, true);
    }
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  const updateSunMotionLine = (mode, selectedId) => {
    const sunPosition = worldPositions.get('sun') ?? targetPosition;
    const visible = (mode === 'helical' || mode === 'follow') && !(mode === 'follow' && selectedId === 'sun');
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
      sunMotionLine.positions[pointIndex] = sunPosition.x - GALACTIC_TRAVEL_DIRECTION.x * distance;
      sunMotionLine.positions[pointIndex + 1] = sunPosition.y - GALACTIC_TRAVEL_DIRECTION.y * distance;
      sunMotionLine.positions[pointIndex + 2] = sunPosition.z - GALACTIC_TRAVEL_DIRECTION.z * distance;
    }
    sunMotionLine.geometry.attributes.position.needsUpdate = true;
  };
  const updateHelicalTrails = (mode, selectedId, simulationDate) => {
    const trailsVisible = mode === 'helical' || mode === 'follow';
    helicalTrailGroup.visible = trailsVisible;
    const selectedBody = bodyMap[selectedId] ?? bodyMap.sun;
    const selectedTrailId = ['planet', 'comet'].includes(selectedBody.type) ? selectedBody.id : selectedBody.parent && bodyMap[selectedBody.parent]?.type === 'planet' ? selectedBody.parent : null;
    for (const item of orbitLines) {
      const selectedOrbit = item.id === selectedTrailId;
      const selectedMoonSystem = item.type === 'moon' && item.parent === selectedBody.id;
      if (mode === 'orbit') {
        item.orbit.material.opacity = selectedOrbit ? 0.48 : selectedMoonSystem ? 0.3 : item.type === 'planet' ? selectedTrailId ? 0.2 : 0.28 : 0.1;
      } else {
        item.orbit.material.opacity = selectedOrbit ? 0.12 : item.defaultOpacity * 0.08;
      }
    }
    if (!trailsVisible) return;
    const sunPosition = worldPositions.get('sun') ?? targetPosition;
    for (const [id, trail] of trailNodes) {
      const body = id === 'halley' ? HALLEY_BODY : bodyMap[id];
      const selectedTrail = id === selectedTrailId;
      const hideSelectedCloseUpTrail = mode === 'follow' && id === selectedTrailId;
      if (hideSelectedCloseUpTrail) {
        trail.group.visible = false;
        continue;
      }
      const baseOpacity = selectedTrail ? 0.9 : mode === 'follow' ? 0.12 : selectedTrailId ? 0.42 : 0.52;
      trail.group.visible = true;
      trail.material.opacity = baseOpacity;
      const continuousCometTrail = id === 'halley';
      trail.glowMaterial.opacity = continuousCometTrail ? 0 : baseOpacity * (selectedTrail ? 0.52 : 0.38);
      trail.outerGlowMaterial.opacity = continuousCometTrail ? 0 : baseOpacity * (selectedTrail ? 0.2 : 0.11);
      trail.glowMaterial.size = selectedTrail ? 0.4 : 0.31;
      trail.outerGlowMaterial.size = selectedTrail ? 0.96 : 0.8;
      const currentPosition = worldPositions.get(id) ?? targetPosition;
      setPlanetOrbitNormal(id, simulationDate, trailOrbitNormal);
      for (let index = 0; index < trail.pointCount; index += 1) {
        const progress = index / (trail.pointCount - 1);
        getRushingTrailPoint(body, currentPosition, sunPosition, trailOrbitNormal, progress, mode, trailPoint);
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
    const nextControlFrame = state.viewMode === 'helical' ? 'galactic' : 'ecliptic';
    if (nextControlFrame !== controlFrame) {
      // OrbitControls captures camera.up when constructed. Recreate it when
      // crossing reference frames so the helical view does not sit near the
      // ecliptic control pole and lose most of its vertical drag range.
      const preservedTarget = controls.target.clone();
      controls.dispose();
      controls = createCameraControls(nextControlFrame === 'galactic' ? GALACTIC_TRAVEL_UP : ECLIPTIC_NORTH_SCENE);
      controls.target.copy(preservedTarget);
      controls.update();
      controlFrame = nextControlFrame;
    }
    sunLight.intensity = state.scaleMode === 'physical' ? 5.2 : 52;
    if (state.playing) {
      const elapsedDelta = delta * state.secondsPerSecond;
      elapsedSeconds += elapsedDelta;
      simDays += elapsedDelta / 86_400;
    }
    const forward = simDays * 0.18;
    const simulationDate = new Date(START_DATE.getTime() + simDays * DAY_MS);
    const rushingMode = state.viewMode === 'helical' || state.viewMode === 'follow';
    const smallBodyBeltsVisible = state.viewMode === 'orbit' && state.orbitScope === 'solar';
    asteroidBelt.visible = smallBodyBeltsVisible;
    kuiperBelt.visible = smallBodyBeltsVisible;
    if (smallBodyBeltsVisible) {
      const physicalScale = state.scaleMode === 'physical';
      updateSmallBodyBelt(asteroidBelt, simulationDate, physicalScale);
      updateSmallBodyBelt(kuiperBelt, simulationDate, physicalScale);
    }
    systemRoot.rotation.x = THREE.MathUtils.lerp(systemRoot.rotation.x, 0, 1 - Math.pow(0.001, delta));
    systemRoot.position.copy(GALACTIC_TRAVEL_DIRECTION).multiplyScalar(forward);
    if (!rushingMode) systemRoot.position.y += Math.sin(simDays * 0.25) * 0.08;
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
        node.mesh.rotation.y += delta * state.secondsPerSecond / 3600 * (Math.PI * 2 / Math.abs(node.body.rotationHours)) * Math.sign(node.body.rotationHours);
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
        node.marker.material.opacity = id === state.selectedId && !hideCloseUpMarker ? 0.85 + Math.sin(performance.now() * 0.005) * 0.15 : 0;
      }
      if (node.physicalLocator) {
        const selectedLocator = id === state.selectedId;
        const hideLocatorForPhysicalCloseUp = physicalScale && state.viewMode === 'follow' && selectedLocator;
        node.physicalLocator.material.opacity = physicalScale && !hideLocatorForPhysicalCloseUp ? selectedLocator || node.body.type === 'star' ? 1 : node.body.type === 'moon' ? 0.38 : 0.82 : 0;
      }
      const selectedBody = bodyMap[state.selectedId] ?? bodyMap.sun;
      const moonInSelectedSystem = node.body.type === 'moon' && node.body.parent === selectedBody.id;
      const selectedSystemCloseUp = state.viewMode === 'follow' && (id === state.selectedId || node.body.parent === state.selectedId);
      node.label.material.opacity = selectedSystemCloseUp ? 0 : id === state.selectedId ? 0.96 : moonInSelectedSystem ? 0.34 : node.body.type === 'moon' ? 0.06 : physicalScale ? 0.88 : state.viewMode === 'follow' ? 0.18 : state.viewMode === 'helical' ? 0.5 : 0.72;
      const physicalLabelScale = physicalScale ? node.body.type === 'moon' ? 1.35 : 2.1 : 1;
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
    const physicalScale = state.scaleMode === 'physical';
    if (physicalScale) {
      const physicalSemiMajorAxis = HALLEY_SEMI_MAJOR_AXIS_AU * PHYSICAL_AU_PER_UNIT;
      setHalleyScenePosition(simulationDate, physicalSemiMajorAxis, halleyGroup.position);
      setHalleyScenePosition(new Date(simulationDate.getTime() + DAY_MS), physicalSemiMajorAxis, halleyNextPosition);
    } else {
      setHalleyVisualScenePosition(simulationDate, halleyGroup.position);
      setHalleyVisualScenePosition(new Date(simulationDate.getTime() + DAY_MS), halleyNextPosition);
    }
    setHalleyScenePosition(simulationDate, HALLEY_SEMI_MAJOR_AXIS_AU, halleyTruePosition);
    const halleyDistanceAu = halleyTruePosition.length();
    const halleyActivity = 1 - THREE.MathUtils.smoothstep(halleyDistanceAu, 1.2, 5);
    const halleySelected = state.selectedId === 'halley';
    const halleyVisible = state.viewMode === 'orbit' && state.orbitScope === 'solar' || state.viewMode === 'helical' || state.viewMode === 'follow' && halleySelected;
    halleyGroup.visible = halleyVisible;
    const halleyOrbitVisible = state.viewMode === 'orbit' && state.orbitScope === 'solar';
    halleyVisualOrbitLine.visible = halleyOrbitVisible && !physicalScale;
    halleyPhysicalOrbitLine.visible = halleyOrbitVisible && physicalScale;
    halleyNucleus.scale.set(1.7, 0.82, 0.72).multiplyScalar(physicalScale ? 5.5 / PHYSICAL_KM_PER_UNIT / 0.22 : 1);
    halleyLabel.material.opacity = halleyVisible && !(state.viewMode === 'follow' && halleySelected) ? (halleySelected ? 0.98 : 0.8) : 0;
    halleyLocator.material.opacity = halleyVisible && !(state.viewMode === 'follow' && halleySelected) ? (halleySelected ? 1 : 0.62) : 0;
    halleyComa.material.opacity = halleyActivity * 0.66;
    halleyComa.scale.setScalar((physicalScale ? 1.1 : 1.8) * (0.72 + halleyActivity * 0.72));
    halleyAntiSolar.copy(halleyGroup.position).normalize();
    halleyVelocity.copy(halleyNextPosition).sub(halleyGroup.position).normalize();
    halleyDustDirection.copy(halleyAntiSolar).addScaledVector(halleyVelocity, -0.28).normalize();
    const tailLength = halleyActivity * (physicalScale ? 2.2 : 4.8);
    const dustPositions = halleyDustTail.geometry.attributes.position.array;
    dustPositions[3] = halleyDustDirection.x * tailLength;
    dustPositions[4] = halleyDustDirection.y * tailLength;
    dustPositions[5] = halleyDustDirection.z * tailLength;
    halleyDustTail.geometry.attributes.position.needsUpdate = true;
    const ionPositions = halleyIonTail.geometry.attributes.position.array;
    ionPositions[3] = halleyAntiSolar.x * tailLength * 1.28;
    ionPositions[4] = halleyAntiSolar.y * tailLength * 1.28;
    ionPositions[5] = halleyAntiSolar.z * tailLength * 1.28;
    halleyIonTail.geometry.attributes.position.needsUpdate = true;
    halleyDustTail.material.opacity = halleyActivity * 0.58;
    halleyIonTail.material.opacity = halleyActivity * 0.72;
    halleyDustCone.position.copy(halleyDustDirection).multiplyScalar(tailLength * 0.5);
    halleyDustCone.quaternion.setFromUnitVectors(halleyTailRotationAxis, halleyTailReverseDirection.copy(halleyDustDirection).negate());
    halleyDustCone.scale.set(1, tailLength, 1);
    halleyDustCone.material.opacity = halleyActivity * 0.2;
    halleyIonCone.position.copy(halleyAntiSolar).multiplyScalar(tailLength * 0.64);
    halleyIonCone.quaternion.setFromUnitVectors(halleyTailRotationAxis, halleyTailReverseDirection.copy(halleyAntiSolar).negate());
    halleyIonCone.scale.set(0.72, tailLength * 1.28, 0.72);
    halleyIonCone.material.opacity = halleyActivity * 0.26;
    halleyGroup.getWorldPosition(worldPositions.get('halley'));
    for (const item of orbitLines) {
      const orbitBody = bodyMap[item.id];
      const ratio = state.scaleMode === 'physical' ? physicalOrbitFor(orbitBody) / orbitBody.orbitRadius : 1;
      item.orbit.scale.setScalar(ratio);
    }
    const galaxyView = state.viewMode === 'orbit' && state.orbitScope === 'galaxy';
    systemRoot.visible = !galaxyView;
    helicalTrailGroup.visible = !galaxyView;
    sunMotionLine.group.visible = !galaxyView && sunMotionLine.group.visible;
    galaxyMap.group.visible = galaxyView;
    const selectedMapFeature = galaxyFeatures.find(feature => feature.id === state.selectedGalaxyFeature);
    const [selectionX, selectionZ] = selectedMapFeature?.map ?? [0, 0];
    const selectionAtGalacticCenter = selectionX === 0 && selectionZ === 0;
    const selectionAtSolarNeighborhood = selectionX === 4.7 && selectionZ === 53.1;
    galaxyMap.selectionMarker.position.set(selectionX, 3.1, selectionZ);
    galaxyMap.selectionMarker.visible = galaxyView;
    const markerPulse = 1 + Math.sin(visualTime * 3.2) * 0.08;
    galaxyMap.selectionMarker.scale.setScalar(markerPulse);
    for (const [labelLanguage, label] of Object.entries(galaxyMap.labels.sun)) {
      label.visible = galaxyView && labelLanguage === state.language && (!selectionAtSolarNeighborhood || state.selectedGalaxyFeature === 'solar-neighborhood');
      label.material.opacity = state.selectedGalaxyFeature === 'solar-neighborhood' ? 1 : 0.72;
      label.scale.copy(label.userData.baseScale).multiplyScalar(state.selectedGalaxyFeature === 'solar-neighborhood' ? 1.1 : 1);
    }
    for (const [labelLanguage, label] of Object.entries(galaxyMap.labels.center)) {
      label.visible = galaxyView && labelLanguage === state.language && !selectionAtGalacticCenter;
      label.material.opacity = 0.72;
      label.scale.copy(label.userData.baseScale);
    }
    for (const [featureId, labels] of Object.entries(galaxyMap.labels.features)) {
      const labelFeature = galaxyFeatures.find(feature => feature.id === featureId);
      const labelAtGalacticCenter = labelFeature?.map?.[0] === 0 && labelFeature?.map?.[1] === 0;
      const labelAtSolarNeighborhood = labelFeature?.map?.[0] === 4.7 && labelFeature?.map?.[1] === 53.1;
      for (const [labelLanguage, label] of Object.entries(labels)) {
        label.visible = galaxyView && labelLanguage === state.language && (!labelAtGalacticCenter || featureId === state.selectedGalaxyFeature) && (!labelAtSolarNeighborhood || featureId === state.selectedGalaxyFeature);
        label.material.opacity = featureId === state.selectedGalaxyFeature ? 0.96 : 0.56;
        label.scale.copy(label.userData.baseScale).multiplyScalar(featureId === state.selectedGalaxyFeature ? 1.12 : 1);
      }
    }
    galaxy.visible = !galaxyView;
    milkyWay.visible = !galaxyView;
    catalogStars.visible = !galaxyView;
    updateSunMotionLine(state.viewMode, state.selectedId);
    updateHelicalTrails(state.viewMode, state.selectedId, simulationDate);
    if (galaxyView) {
      sunMotionLine.group.visible = false;
      helicalTrailGroup.visible = false;
    }
    sunLight.position.copy(worldPositions.get('sun'));
    const selected = state.selectedId === 'halley'
      ? { group: halleyGroup, body: bodyMap.halley }
      : bodyNodes.get(state.selectedId) ?? bodyNodes.get('sun');
    selected.group.getWorldPosition(targetPosition);
    if (galaxyView) galaxyMap.group.getWorldPosition(cameraFocusPosition);else cameraFocusPosition.copy(targetPosition);
    const selectedBody = selected.body;
    const selectedSceneRadius = state.scaleMode === 'physical' ? physicalRadiusFor(selectedBody) : selectedBody.scaleRadius;
    const distance = selectedBody.type === 'star' ? 40 : selectedBody.type === 'planet' ? 18 : 4.2;
    let cameraBias;
    if (galaxyView) {
      cameraBias = getGalaxyCameraBias(camera, mount.clientWidth);
    } else if (state.viewMode === 'orbit') {
      cameraBias = state.scaleMode === 'physical' ? PHYSICAL_ORBIT_CAMERA_BIAS : selectedBody.type === 'star' ? new THREE.Vector3(0, 82, 76) : selectedBody.type === 'planet' ? new THREE.Vector3(8, 5.2, 9.5) : new THREE.Vector3(3.8, 2.4, 4.6);
    } else if (state.viewMode === 'helical') {
      const viewDirection = state.helicalView === 'rear' ? -1 : 1;
      cameraBias = selectedBody.type === 'star' ? state.helicalView === 'rear' ? galacticFrameVector(32, 22, -70) : galacticFrameVector(-20, 14, 43) : galacticFrameVector(-distance * (state.helicalView === 'rear' ? 1.55 : 0.96) * viewDirection, distance * (state.helicalView === 'rear' ? 0.7 : 0.44), distance * (state.helicalView === 'rear' ? 1.5 : 0.92) * viewDirection);
    } else {
      cameraBias = selectedBody.type === 'star' ? new THREE.Vector3(-8, 6.5, 15) : new THREE.Vector3(selectedSceneRadius * 7 + 7, selectedSceneRadius * 2.2 + 2.4, selectedSceneRadius * 4.4 + 7);
    }
    controls.minDistance = galaxyView ? cameraBias.length() * 0.56 : selectedSceneRadius * (selectedBody.type === 'star' ? 1.68 : 1.18);
    controls.maxDistance = galaxyView ? Math.max(310, cameraBias.length() * 1.8) : state.scaleMode === 'physical' && state.viewMode === 'orbit' ? 440 : 240;
    controls.minPolarAngle = galaxyView ? 0.08 : 0;
    controls.maxPolarAngle = galaxyView ? 0.52 : Math.PI;
    if (state.viewMode === 'follow' && selectedBody.type !== 'star') {
      const sunPosition = worldPositions.get('sun') ?? targetPosition;
      followSunVector.copy(sunPosition).sub(targetPosition).normalize();
      followSideVector.set(-followSunVector.z, 0, followSunVector.x).normalize();
      cameraGoal.copy(targetPosition).addScaledVector(followSunVector, selectedSceneRadius * 3.8).addScaledVector(followSideVector, selectedSceneRadius * 1.45);
      cameraGoal.y += selectedSceneRadius * 0.72;
    } else if (state.viewMode === 'follow') {
      cameraGoal.copy(targetPosition).add(new THREE.Vector3(-selectedSceneRadius * 3.45, selectedSceneRadius * 1.25, selectedSceneRadius * 3.05));
    } else {
      cameraGoal.copy(cameraFocusPosition).add(cameraBias);
    }
    lookAtGoal.copy(cameraFocusPosition);
    if (state.viewMode === 'helical') {
      const lookDistance = selectedBody.type === 'star' ? 11 : 6.5;
      lookAtGoal.addScaledVector(GALACTIC_TRAVEL_DIRECTION, state.helicalView === 'rear' ? lookDistance : -lookDistance);
    }
    const cameraTargetChanged = state.selectedId !== lastSelectedId || state.viewMode !== lastViewMode || state.orbitScope !== lastOrbitScope || state.helicalView !== lastHelicalView || state.cameraRevision !== lastCameraRevision || viewportRevision !== lastViewportRevision;
    if (cameraTargetChanged) {
      if (state.cameraPose) {
        camera.position.fromArray(state.cameraPose.position);
        controls.target.fromArray(state.cameraPose.target);
        currentLook.copy(controls.target);
        camera.fov = THREE.MathUtils.clamp(state.cameraPose.fov, 20, 100);
        camera.updateProjectionMatrix();
        cameraTransition = 0;
      } else {
        cameraTransition = 1;
      }
      lastSelectedId = state.selectedId;
      lastViewMode = state.viewMode;
      lastOrbitScope = state.orbitScope;
      lastHelicalView = state.helicalView;
      lastCameraRevision = state.cameraRevision;
      lastViewportRevision = viewportRevision;
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
    const nextNearPlane = physicalCloseUp ? Math.max(selectedSceneRadius * 0.08, 0.0000001) : 0.05;
    if (camera.near !== nextNearPlane) {
      camera.near = nextNearPlane;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    const exposureOrbitBody = selectedBody.type === 'planet' ? selectedBody : selectedBody.parent && bodyMap[selectedBody.parent]?.type === 'planet' ? bodyMap[selectedBody.parent] : bodyMap.earth;
    const observationExposure = state.viewMode === 'follow' ? THREE.MathUtils.clamp(Math.sqrt(exposureOrbitBody.orbitRadius / bodyMap.earth.orbitRadius), 0.95, 1.8) : 1;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, 1.05 * observationExposure, 1 - Math.pow(0.02, delta));
    galaxy.userData.depthDrift.value = rushingMode ? -forward * 2.4 : 0;
    galaxy.position.copy(camera.position);
    catalogStars.position.copy(camera.position);
    milkyWay.position.copy(camera.position);
    // Moving through the Solar System produces no measurable Milky Way
    // parallax, so keep its angular size fixed. A restrained contrast response
    // still gives dolly motion some depth: close views are subdued by local
    // light, while wide views reveal slightly more integrated Galactic light.
    const viewDistance = camera.position.distanceTo(controls.target);
    const distanceResponse = THREE.MathUtils.smoothstep(viewDistance, 6, 120);
    const targetVisibilityScale = THREE.MathUtils.lerp(0.85, 1.15, distanceResponse);
    milkyWay.userData.visibilityScale = THREE.MathUtils.lerp(milkyWay.userData.visibilityScale, targetVisibilityScale, 1 - Math.pow(0.015, delta));
    // NASA's HDR sky map preserves faint integrated light for visualization;
    // render it as low-surface-brightness sky rather than a photographic
    // exposure. Changing sphere radius would not alter angular size from its
    // center and compressing latitude would corrupt the J2000 sky geometry.
    milkyWay.userData.material.opacity = milkyWay.userData.textureReady ? Math.min(0.28 * milkyWay.userData.visibilityScale, 0.34) : 0;
    cameraLight.position.copy(camera.position);
    renderer.render(scene, camera);
    options.onTick({
      simDays,
      elapsedSeconds,
      date: simulationDate,
      selectedPosition: targetPosition.clone(),
      forward,
      cameraDistance: camera.position.distanceTo(targetPosition)
    });
    raf = requestAnimationFrame(animate);
  };
  const resize = () => {
    const {
      clientWidth,
      clientHeight
    } = mount;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
    viewportRevision += 1;
  };
  window.addEventListener('resize', resize);
  animate();
  return {
    getCameraPose() {
      return {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        fov: camera.fov
      };
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach(item => item.dispose());else object.material.dispose();
        }
      });
    }
  };
}
export { buildSolarScene };
