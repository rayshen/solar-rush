import * as THREE from "three";
import { bodyMap, planetEphemerisElements } from "../solarData.js";
import { setHalleyKeplerScenePosition, setPlanetScenePosition, solveEccentricAnomaly } from "./astronomy.js";
import { DAY_MS, START_DATE } from "../config/appConfig.js";
import { HALLEY_SEMI_MAJOR_AXIS_AU, HALLEY_VISUAL_SEMI_MAJOR_AXIS, J2000_MS, PHYSICAL_AU_PER_UNIT } from "./sceneConstants.js";
function createPlanetOrbitLine(body, date, color, opacity = 0.28) {
  const points = [];
  const point = new THREE.Vector3();
  for (let index = 0; index <= 240; index += 1) {
    setPlanetScenePosition(body.id, date, body.orbitRadius, point, index / 240 * Math.PI * 2);
    points.push(point.clone());
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
  return new THREE.Line(geometry, material);
}
function createHalleyOrbitLine({
  physicalScale = false
} = {}) {
  const points = [];
  const point = new THREE.Vector3();
  const sceneSemiMajorAxis = physicalScale
    ? HALLEY_SEMI_MAJOR_AXIS_AU * PHYSICAL_AU_PER_UNIT
    : HALLEY_VISUAL_SEMI_MAJOR_AXIS;
  const segments = 1440;
  for (let index = 0; index <= segments; index += 1) {
    const eccentricAnomaly = index / segments * Math.PI * 2;
    setHalleyKeplerScenePosition(START_DATE, sceneSemiMajorAxis, point, eccentricAnomaly);
    points.push(point.clone());
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({
    color: '#8dcbe8',
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  }));
}
function createCometTailLine(color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  return new THREE.Line(geometry, material);
}
function createOrbitLine(radius, eccentricity, color, opacity = 0.32) {
  const points = [];
  const segments = 240;
  for (let i = 0; i <= segments; i += 1) {
    const theta = i / segments * Math.PI * 2;
    const x = Math.cos(theta) * radius * (1 + eccentricity);
    const z = Math.sin(theta) * radius * (1 - eccentricity);
    points.push(new THREE.Vector3(x, 0, z));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
  return new THREE.Line(geometry, material);
}
function createSmallBodyBelt(starTexture, options) {
  const {
    count
  } = options;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const semiMajorAxes = new Float32Array(count);
  const visualSemiMajorAxes = new Float32Array(count);
  const eccentricities = new Float32Array(count);
  const inclinations = new Float32Array(count);
  const nodes = new Float32Array(count);
  const periapses = new Float32Array(count);
  const meanAnomalies = new Float32Array(count);
  const meanMotions = new Float32Array(count);
  let seed = options.seed;
  const random = () => {
    seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
    return seed / 4294967296;
  };
  let index = 0;
  while (index < count) {
    const orbit = options.sampleOrbit(random);
    if (!orbit) continue;
    const {
      semiMajorAxis,
      eccentricity,
      inclination
    } = orbit;
    semiMajorAxes[index] = semiMajorAxis;
    visualSemiMajorAxes[index] = options.visualSemiMajorAxisFor(semiMajorAxis);
    eccentricities[index] = eccentricity;
    inclinations[index] = inclination;
    nodes[index] = random() * Math.PI * 2;
    periapses[index] = random() * Math.PI * 2;
    meanAnomalies[index] = random() * Math.PI * 2;
    meanMotions[index] = Math.PI * 2 / (365.256 * Math.pow(semiMajorAxis, 1.5));
    const color = options.sampleColor(random);
    const colorIndex = index * 3;
    colors[colorIndex] = color[0];
    colors[colorIndex + 1] = color[1];
    colors[colorIndex + 2] = color[2];
    index += 1;
  }
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: starTexture,
    size: options.visualSize,
    vertexColors: true,
    transparent: true,
    opacity: options.visualOpacity,
    alphaTest: 0.08,
    depthWrite: false,
    toneMapped: false
  });
  const belt = new THREE.Points(geometry, material);
  belt.frustumCulled = false;
  belt.renderOrder = -1;
  belt.userData.orbits = {
    count,
    positions,
    semiMajorAxes,
    visualSemiMajorAxes,
    eccentricities,
    inclinations,
    nodes,
    periapses,
    meanAnomalies,
    meanMotions,
    visualSize: options.visualSize,
    physicalSize: options.physicalSize,
    visualOpacity: options.visualOpacity,
    physicalOpacity: options.physicalOpacity
  };
  return belt;
}
function rayleighInclination(random, sigmaDegrees, maximumDegrees) {
  return Math.min(THREE.MathUtils.degToRad(maximumDegrees), Math.sqrt(-2 * Math.log(Math.max(1e-6, 1 - random()))) * THREE.MathUtils.degToRad(sigmaDegrees));
}
function createAsteroidBelt(starTexture) {
  const marsAxis = planetEphemerisElements.mars.base[0];
  const jupiterAxis = planetEphemerisElements.jupiter.base[0];
  return createSmallBodyBelt(starTexture, {
    count: 3_200,
    seed: 0xa57e10d,
    visualSize: 0.13,
    physicalSize: 0.24,
    visualOpacity: 0.76,
    physicalOpacity: 0.86,
    visualSemiMajorAxisFor: semiMajorAxis => THREE.MathUtils.lerp(bodyMap.mars.orbitRadius, bodyMap.jupiter.orbitRadius, (semiMajorAxis - marsAxis) / (jupiterAxis - marsAxis)),
    sampleOrbit: random => {
      // The main belt is concentrated between roughly 2.06 and 3.27 au. Reject
      // particles near the strongest Kirkwood resonances so it reads as a
      // structured population rather than a perfectly uniform decorative ring.
      const semiMajorAxis = 2.06 + random() * 1.21;
      const kirkwoodGapStrength = Math.max(Math.exp(-Math.pow((semiMajorAxis - 2.50) / 0.018, 2)), Math.exp(-Math.pow((semiMajorAxis - 2.82) / 0.022, 2)), Math.exp(-Math.pow((semiMajorAxis - 2.96) / 0.018, 2)));
      const radialDensity = 0.72 + 0.28 * Math.exp(-Math.pow((semiMajorAxis - 2.72) / 0.42, 2));
      if (random() > radialDensity * (1 - kirkwoodGapStrength * 0.9)) return null;
      const highInclination = random() < 0.08;
      return {
        semiMajorAxis,
        eccentricity: THREE.MathUtils.clamp(0.018 - Math.log(Math.max(1e-6, 1 - random())) * 0.065, 0.01, 0.27),
        inclination: rayleighInclination(random, highInclination ? 9 : 4.5, 24)
      };
    },
    sampleColor: random => {
      const brightness = 0.58 + random() * 0.34;
      const warmth = random();
      return [brightness * THREE.MathUtils.lerp(0.84, 1, warmth), brightness * THREE.MathUtils.lerp(0.82, 0.9, warmth), brightness * THREE.MathUtils.lerp(0.78, 0.68, warmth)];
    }
  });
}
function createKuiperBelt(starTexture) {
  const neptuneAxis = planetEphemerisElements.neptune.base[0];
  return createSmallBodyBelt(starTexture, {
    count: 3_600,
    seed: 0x4b1f3a9d,
    visualSize: 0.18,
    physicalSize: 0.46,
    visualOpacity: 0.64,
    physicalOpacity: 0.76,
    visualSemiMajorAxisFor: semiMajorAxis => THREE.MathUtils.lerp(bodyMap.neptune.orbitRadius + 0.7, bodyMap.neptune.orbitRadius + 9.2, (semiMajorAxis - neptuneAxis) / (50 - neptuneAxis)),
    sampleOrbit: random => {
      const population = random();
      if (population < 0.2) {
        // Plutinos cluster around Neptune's 3:2 mean-motion resonance.
        return {
          semiMajorAxis: 39.15 + random() * 0.5,
          eccentricity: 0.08 + random() * 0.17,
          inclination: rayleighInclination(random, 9, 32)
        };
      }
      if (population < 0.7) {
        // The dynamically cold classical belt forms the thin 42–47 au core.
        return {
          semiMajorAxis: 42 + random() * 5.2,
          eccentricity: 0.025 + random() * 0.09,
          inclination: rayleighInclination(random, 2.2, 8)
        };
      }
      if (population < 0.95) {
        // The hot classical population is radially broader and more inclined.
        return {
          semiMajorAxis: 36 + random() * 12,
          eccentricity: 0.06 + random() * 0.18,
          inclination: rayleighInclination(random, 12, 38)
        };
      }
      // A smaller concentration occupies Neptune's outer 2:1 resonance.
      return {
        semiMajorAxis: 47.45 + random() * 0.55,
        eccentricity: 0.08 + random() * 0.16,
        inclination: rayleighInclination(random, 8, 28)
      };
    },
    sampleColor: random => {
      const brightness = 0.46 + random() * 0.34;
      const ice = random();
      return [brightness * THREE.MathUtils.lerp(0.72, 0.9, ice), brightness * THREE.MathUtils.lerp(0.78, 0.91, ice), brightness * THREE.MathUtils.lerp(0.82, 1, ice)];
    }
  });
}
function updateSmallBodyBelt(belt, date, physicalScale) {
  const elapsedDays = (date.getTime() - J2000_MS) / DAY_MS;
  const {
    count,
    positions,
    semiMajorAxes,
    visualSemiMajorAxes,
    eccentricities,
    inclinations,
    nodes,
    periapses,
    meanAnomalies,
    meanMotions,
    visualSize,
    physicalSize,
    visualOpacity,
    physicalOpacity
  } = belt.userData.orbits;
  for (let index = 0; index < count; index += 1) {
    const semiMajorAxis = semiMajorAxes[index];
    const eccentricity = eccentricities[index];
    const meanAnomaly = THREE.MathUtils.euclideanModulo(meanAnomalies[index] + elapsedDays * meanMotions[index], Math.PI * 2);
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, eccentricity);
    const orbitalX = semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);
    const orbitalY = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
    const periapsis = periapses[index];
    const node = nodes[index];
    const inclination = inclinations[index];
    const cosA = Math.cos(periapsis);
    const sinA = Math.sin(periapsis);
    const cosN = Math.cos(node);
    const sinN = Math.sin(node);
    const cosI = Math.cos(inclination);
    const sinI = Math.sin(inclination);
    const eclipticX = (cosA * cosN - sinA * sinN * cosI) * orbitalX + (-sinA * cosN - cosA * sinN * cosI) * orbitalY;
    const eclipticY = (cosA * sinN + sinA * cosN * cosI) * orbitalX + (-sinA * sinN + cosA * cosN * cosI) * orbitalY;
    const eclipticZ = sinA * sinI * orbitalX + cosA * sinI * orbitalY;
    const sceneScale = physicalScale ? PHYSICAL_AU_PER_UNIT : visualSemiMajorAxes[index] / semiMajorAxis;
    const positionIndex = index * 3;
    positions[positionIndex] = eclipticX * sceneScale;
    positions[positionIndex + 1] = eclipticZ * sceneScale;
    positions[positionIndex + 2] = -eclipticY * sceneScale;
  }
  belt.geometry.attributes.position.needsUpdate = true;
  belt.material.size = physicalScale ? physicalSize : visualSize;
  belt.material.opacity = physicalScale ? physicalOpacity : visualOpacity;
}
export { createPlanetOrbitLine, createHalleyOrbitLine, createCometTailLine, createOrbitLine, createSmallBodyBelt, rayleighInclination, createAsteroidBelt, createKuiperBelt, updateSmallBodyBelt };
