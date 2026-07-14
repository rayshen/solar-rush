import * as THREE from "three";
import { Body as AstronomyBody, HelioState, HelioVector, MakeTime, RotateState, RotateVector } from "astronomy-engine";
import { planetEphemerisElements } from "../solarData.js";
import { halleyOrbit, satelliteMeanElements } from "../astronomyData.js";
import { halleyHorizonsEphemeris } from "../data/halleyHorizons.js";
import { ECLIPTIC_NORTH_SCENE, EQJ_TO_ECL, HALLEY_ORBIT_PERIOD_DAYS, HALLEY_PERIHELION_MS, HALLEY_SEMI_MAJOR_AXIS_AU, HALLEY_VISUAL_SEMI_MAJOR_AXIS, J2000_MS } from "./sceneConstants.js";
import { DAY_MS } from "../config/appConfig.js";
const orbitNormalPosition = new THREE.Vector3();
const orbitNormalVelocity = new THREE.Vector3();
const halleyEclipticPosition = new THREE.Vector3();
const halleyEclipticVelocity = new THREE.Vector3();
const halleySegmentCache = new Map();
const J2000_JD_TT = 2_451_545;
const astronomyPlanetBodies = {
  mercury: AstronomyBody.Mercury,
  venus: AstronomyBody.Venus,
  earth: AstronomyBody.Earth,
  mars: AstronomyBody.Mars,
  jupiter: AstronomyBody.Jupiter,
  saturn: AstronomyBody.Saturn,
  uranus: AstronomyBody.Uranus,
  neptune: AstronomyBody.Neptune
};
function bodyPhase(id) {
  const phaseOverrides = {
    mercury: 5,
    venus: 25,
    earth: 135,
    mars: 50,
    jupiter: 230,
    saturn: 210,
    uranus: 305,
    neptune: 20
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
    longitudeNode: THREE.MathUtils.degToRad(values[5])
  };
}
function solveEccentricAnomaly(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const correction = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-10) break;
  }
  return eccentricAnomaly;
}

function decodeHalleySegment(segment) {
  const cached = halleySegmentCache.get(segment);
  if (cached) return cached;
  const binary = atob(segment.statesBase64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const states = new Int32Array(bytes.byteLength / Int32Array.BYTES_PER_ELEMENT);
  for (let index = 0; index < states.length; index += 1) {
    states[index] = view.getInt32(index * Int32Array.BYTES_PER_ELEMENT, true);
  }
  halleySegmentCache.set(segment, states);
  return states;
}

function segmentStopJd(segment) {
  return segment.startJdTdb + (segment.sampleCount - 1) * segment.stepDays;
}

function findHalleySegment(jdTdb) {
  const fine = halleyHorizonsEphemeris.fine.find(segment => jdTdb >= segment.startJdTdb && jdTdb <= segmentStopJd(segment));
  if (fine) return fine;
  const coarse = halleyHorizonsEphemeris.coarse;
  return jdTdb >= coarse.startJdTdb && jdTdb <= segmentStopJd(coarse) ? coarse : null;
}

function setHalleyHorizonsState(jdTdb, positionOut, velocityOut = null) {
  const segment = findHalleySegment(jdTdb);
  if (!segment) return false;
  const states = decodeHalleySegment(segment);
  const samplePosition = (jdTdb - segment.startJdTdb) / segment.stepDays;
  const lowerIndex = Math.min(Math.floor(samplePosition), segment.sampleCount - 2);
  const progress = THREE.MathUtils.clamp(samplePosition - lowerIndex, 0, 1);
  const progress2 = progress * progress;
  const progress3 = progress2 * progress;
  const h00 = 2 * progress3 - 3 * progress2 + 1;
  const h10 = progress3 - 2 * progress2 + progress;
  const h01 = -2 * progress3 + 3 * progress2;
  const h11 = progress3 - progress2;
  const first = lowerIndex * 6;
  const second = first + 6;
  const position = [0, 0, 0];
  const velocity = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    const p0 = states[first + axis] * halleyHorizonsEphemeris.positionScaleAu;
    const v0 = states[first + axis + 3] * halleyHorizonsEphemeris.velocityScaleAuPerDay;
    const p1 = states[second + axis] * halleyHorizonsEphemeris.positionScaleAu;
    const v1 = states[second + axis + 3] * halleyHorizonsEphemeris.velocityScaleAuPerDay;
    position[axis] = h00 * p0 + h10 * segment.stepDays * v0 + h01 * p1 + h11 * segment.stepDays * v1;
    if (velocityOut) {
      velocity[axis] = (6 * progress2 - 6 * progress) / segment.stepDays * p0 +
        (3 * progress2 - 4 * progress + 1) * v0 +
        (-6 * progress2 + 6 * progress) / segment.stepDays * p1 +
        (3 * progress2 - 2 * progress) * v1;
    }
  }
  positionOut.set(position[0], position[1], position[2]);
  if (velocityOut) velocityOut.set(velocity[0], velocity[1], velocity[2]);
  return true;
}

function dateToJdTdb(date) {
  // Astronomy Engine supplies TT from civil UTC. TT and TDB differ by less
  // than 2 ms, well below the temporal resolution of the sampled ephemeris.
  return J2000_JD_TT + MakeTime(date).tt;
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
  const meanAnomalyDegrees = THREE.MathUtils.euclideanModulo(elements.meanLongitude - elements.longitudePerihelion + 180, 360) - 180;
  const eccentricAnomaly = orbitEccentricAnomaly ?? solveEccentricAnomaly(THREE.MathUtils.degToRad(meanAnomalyDegrees), elements.e);
  const orbitalX = elements.a * (Math.cos(eccentricAnomaly) - elements.e);
  const orbitalY = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(eccentricAnomaly);
  const argumentPerihelion = THREE.MathUtils.degToRad(elements.longitudePerihelion) - elements.longitudeNode;
  const cosPerihelion = Math.cos(argumentPerihelion);
  const sinPerihelion = Math.sin(argumentPerihelion);
  const cosNode = Math.cos(elements.longitudeNode);
  const sinNode = Math.sin(elements.longitudeNode);
  const cosInclination = Math.cos(elements.inclination);
  const sinInclination = Math.sin(elements.inclination);
  const eclipticX = (cosPerihelion * cosNode - sinPerihelion * sinNode * cosInclination) * orbitalX + (-sinPerihelion * cosNode - cosPerihelion * sinNode * cosInclination) * orbitalY;
  const eclipticY = (cosPerihelion * sinNode + sinPerihelion * cosNode * cosInclination) * orbitalX + (-sinPerihelion * sinNode + cosPerihelion * cosNode * cosInclination) * orbitalY;
  const eclipticZ = sinPerihelion * sinInclination * orbitalX + cosPerihelion * sinInclination * orbitalY;
  const sceneScale = sceneSemiMajorAxis / elements.a;
  // Map the JPL ecliptic frame into Three.js without mirroring its handedness:
  // ecliptic +X -> scene +X, +Y -> scene -Z, +Z -> scene +Y.
  return out.set(eclipticX * sceneScale, eclipticZ * sceneScale, -eclipticY * sceneScale);
}
function setPlanetOrbitNormal(id, date, out) {
  if (id === 'halley') {
    if (setHalleyHorizonsState(dateToJdTdb(date), halleyEclipticPosition, halleyEclipticVelocity)) {
      out.crossVectors(halleyEclipticPosition, halleyEclipticVelocity).normalize();
      const eclipticX = out.x;
      const eclipticY = out.y;
      const eclipticZ = out.z;
      return out.set(eclipticX, eclipticZ, -eclipticY);
    }
    const inclination = THREE.MathUtils.degToRad(halleyOrbit.inclinationDeg);
    const node = THREE.MathUtils.degToRad(halleyOrbit.ascendingNodeDeg);
    const sinInclination = Math.sin(inclination);
    return out.set(sinInclination * Math.sin(node), Math.cos(inclination), sinInclination * Math.cos(node)).normalize();
  }
  const astronomyBody = astronomyPlanetBodies[id];
  if (astronomyBody) {
    const eclipticState = RotateState(EQJ_TO_ECL, HelioState(astronomyBody, date));
    orbitNormalPosition.set(eclipticState.x, eclipticState.z, -eclipticState.y);
    orbitNormalVelocity.set(eclipticState.vx, eclipticState.vz, -eclipticState.vy);
    return out.crossVectors(orbitNormalPosition, orbitNormalVelocity).normalize();
  }
  const elements = getPlanetElementsAtDate(id, date);
  if (!elements) return out.copy(ECLIPTIC_NORTH_SCENE);
  const sinInclination = Math.sin(elements.inclination);
  return out.set(sinInclination * Math.sin(elements.longitudeNode), Math.cos(elements.inclination), sinInclination * Math.cos(elements.longitudeNode)).normalize();
}
function getPlanetOrbitOrientation(id, date) {
  const normal = setPlanetOrbitNormal(id, date, new THREE.Vector3());
  const inclination = Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1));
  const ascendingNode = inclination > 1e-10 ? THREE.MathUtils.euclideanModulo(Math.atan2(normal.x, normal.z), Math.PI * 2) : 0;
  return {
    inclination,
    ascendingNode
  };
}
function setSatelliteScenePosition(body, date, sceneSemiMajorAxis, out) {
  const elements = satelliteMeanElements[body.id];
  if (!elements) return out.set(sceneSemiMajorAxis, 0, 0);
  const elapsedDays = (date.getTime() - J2000_MS) / DAY_MS;
  const meanAnomaly = THREE.MathUtils.degToRad(elements.meanAnomaly) + elapsedDays / elements.period * Math.PI * 2;
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, elements.e);
  const x = elements.a * (Math.cos(eccentricAnomaly) - elements.e);
  const y = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(eccentricAnomaly);
  const argument = THREE.MathUtils.degToRad(elements.periapsis);
  const node = THREE.MathUtils.degToRad(elements.node);
  const inclination = THREE.MathUtils.degToRad(elements.inclination);
  const cosA = Math.cos(argument);
  const sinA = Math.sin(argument);
  const cosN = Math.cos(node);
  const sinN = Math.sin(node);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const px = (cosA * cosN - sinA * sinN * cosI) * x + (-sinA * cosN - cosA * sinN * cosI) * y;
  const py = (cosA * sinN + sinA * cosN * cosI) * x + (-sinA * sinN + cosA * cosN * cosI) * y;
  const pz = sinA * sinI * x + cosA * sinI * y;
  const scale = sceneSemiMajorAxis / elements.a;
  return out.set(px * scale, pz * scale, -py * scale);
}
function setHalleyKeplerScenePosition(date, sceneSemiMajorAxis, out, orbitEccentricAnomaly = null) {
  const meanAnomaly = (date.getTime() - HALLEY_PERIHELION_MS) / DAY_MS / HALLEY_ORBIT_PERIOD_DAYS * Math.PI * 2;
  const eccentricAnomaly = orbitEccentricAnomaly ?? solveEccentricAnomaly(THREE.MathUtils.euclideanModulo(meanAnomaly, Math.PI * 2), halleyOrbit.eccentricity);
  const orbitalX = HALLEY_SEMI_MAJOR_AXIS_AU * (Math.cos(eccentricAnomaly) - halleyOrbit.eccentricity);
  const orbitalY = HALLEY_SEMI_MAJOR_AXIS_AU * Math.sqrt(1 - halleyOrbit.eccentricity * halleyOrbit.eccentricity) * Math.sin(eccentricAnomaly);
  const argument = THREE.MathUtils.degToRad(halleyOrbit.argumentPerihelionDeg);
  const node = THREE.MathUtils.degToRad(halleyOrbit.ascendingNodeDeg);
  const inclination = THREE.MathUtils.degToRad(halleyOrbit.inclinationDeg);
  const cosA = Math.cos(argument);
  const sinA = Math.sin(argument);
  const cosN = Math.cos(node);
  const sinN = Math.sin(node);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const eclipticX = (cosA * cosN - sinA * sinN * cosI) * orbitalX + (-sinA * cosN - cosA * sinN * cosI) * orbitalY;
  const eclipticY = (cosA * sinN + sinA * cosN * cosI) * orbitalX + (-sinA * sinN + cosA * cosN * cosI) * orbitalY;
  const eclipticZ = sinA * sinI * orbitalX + cosA * sinI * orbitalY;
  const sceneScale = sceneSemiMajorAxis / HALLEY_SEMI_MAJOR_AXIS_AU;
  return out.set(eclipticX * sceneScale, eclipticZ * sceneScale, -eclipticY * sceneScale);
}

function setHalleyScenePositionAtJdTdb(jdTdb, sceneSemiMajorAxis, out) {
  if (!setHalleyHorizonsState(jdTdb, halleyEclipticPosition)) return false;
  const sceneScale = sceneSemiMajorAxis / HALLEY_SEMI_MAJOR_AXIS_AU;
  out.set(
    halleyEclipticPosition.x * sceneScale,
    halleyEclipticPosition.z * sceneScale,
    -halleyEclipticPosition.y * sceneScale
  );
  return true;
}

function setHalleyScenePosition(date, sceneSemiMajorAxis, out) {
  if (setHalleyScenePositionAtJdTdb(dateToJdTdb(date), sceneSemiMajorAxis, out)) return out;
  return setHalleyKeplerScenePosition(date, sceneSemiMajorAxis, out);
}

function setHalleyVisualScenePosition(date, out) {
  return setHalleyKeplerScenePosition(date, HALLEY_VISUAL_SEMI_MAJOR_AXIS, out);
}
export { orbitNormalPosition, orbitNormalVelocity, astronomyPlanetBodies, bodyPhase, getPlanetElementsAtDate, solveEccentricAnomaly, setPlanetScenePosition, setPlanetOrbitNormal, getPlanetOrbitOrientation, setSatelliteScenePosition, setHalleyKeplerScenePosition, setHalleyScenePositionAtJdTdb, setHalleyScenePosition, setHalleyVisualScenePosition };
