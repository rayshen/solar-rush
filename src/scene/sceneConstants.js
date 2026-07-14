import * as THREE from "three";
import { Rotation_EQJ_ECL } from "astronomy-engine";
import { AU } from "../solarData.js";
import { halleyOrbit, solarGalactocentricMotion } from "../astronomyData.js";
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const PHYSICAL_KM_PER_UNIT = 50_000_000;
const PHYSICAL_AU_PER_UNIT = AU / PHYSICAL_KM_PER_UNIT;
const PHYSICAL_ORBIT_CAMERA_BIAS = new THREE.Vector3(0, 245, 225);
const HALLEY_SEMI_MAJOR_AXIS_AU = halleyOrbit.perihelionDistanceAu / (1 - halleyOrbit.eccentricity);
const HALLEY_ORBIT_PERIOD_DAYS = 365.2568983 * Math.pow(HALLEY_SEMI_MAJOR_AXIS_AU, 1.5);
const HALLEY_PERIHELION_MS = (halleyOrbit.previousPerihelionJdTdb - 2_440_587.5) * 86_400_000;
const HALLEY_VISUAL_SEMI_MAJOR_AXIS = 25.8;
const HALLEY_BODY = {
  id: 'halley',
  orbitRadius: HALLEY_VISUAL_SEMI_MAJOR_AXIS
};
const GALAXY_MAP_SIZE = 250;
// Keep the full galactic disk close to the reference desktop composition:
// large enough to dominate the canvas, with its outer arms still readable.
const GALAXY_DESKTOP_FILL = 1.6;
// Crop the square map beyond the short viewport edge so the galaxy disk fills
// mobile screens while retaining roughly 90% of its visible structure.
const GALAXY_MOBILE_FILL = 1.8;
const MOBILE_LAYOUT_MAX_WIDTH = 1240;
const EQJ_TO_ECL = Rotation_EQJ_ECL();
const ECLIPTIC_NORTH_SCENE = new THREE.Vector3(0, 1, 0);
const galacticTravelLongitude = THREE.MathUtils.degToRad(solarGalactocentricMotion.j2000EclipticLongitudeDeg);
const galacticTravelLatitude = THREE.MathUtils.degToRad(solarGalactocentricMotion.j2000EclipticLatitudeDeg);
// J2000 ecliptic +X maps to scene +X, +Y to scene -Z, and +Z to scene +Y.
const GALACTIC_TRAVEL_DIRECTION = new THREE.Vector3(Math.cos(galacticTravelLatitude) * Math.cos(galacticTravelLongitude), Math.sin(galacticTravelLatitude), -Math.cos(galacticTravelLatitude) * Math.sin(galacticTravelLongitude)).normalize();
const GALACTIC_TRAVEL_SIDE = new THREE.Vector3().crossVectors(ECLIPTIC_NORTH_SCENE, GALACTIC_TRAVEL_DIRECTION).normalize();
const GALACTIC_TRAVEL_UP = new THREE.Vector3().crossVectors(GALACTIC_TRAVEL_DIRECTION, GALACTIC_TRAVEL_SIDE).normalize();
const GALACTIC_BACKGROUND_ROTATION = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), GALACTIC_TRAVEL_DIRECTION);
function galacticFrameVector(side, up, forward) {
  return new THREE.Vector3().addScaledVector(GALACTIC_TRAVEL_SIDE, side).addScaledVector(GALACTIC_TRAVEL_UP, up).addScaledVector(GALACTIC_TRAVEL_DIRECTION, forward);
}
const trailBodyIds = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'halley'];
const trailColors = {
  mercury: '#d9d2c8',
  venus: '#ffd57a',
  earth: '#4da3ff',
  mars: '#ff744a',
  jupiter: '#ffd45f',
  saturn: '#f0d08a',
  uranus: '#68f1ff',
  neptune: '#4f7cff',
  halley: '#bcecff'
};
export { J2000_MS, PHYSICAL_KM_PER_UNIT, PHYSICAL_AU_PER_UNIT, PHYSICAL_ORBIT_CAMERA_BIAS, HALLEY_SEMI_MAJOR_AXIS_AU, HALLEY_ORBIT_PERIOD_DAYS, HALLEY_PERIHELION_MS, HALLEY_VISUAL_SEMI_MAJOR_AXIS, HALLEY_BODY, GALAXY_MAP_SIZE, GALAXY_DESKTOP_FILL, GALAXY_MOBILE_FILL, MOBILE_LAYOUT_MAX_WIDTH, EQJ_TO_ECL, ECLIPTIC_NORTH_SCENE, galacticTravelLongitude, galacticTravelLatitude, GALACTIC_TRAVEL_DIRECTION, GALACTIC_TRAVEL_SIDE, GALACTIC_TRAVEL_UP, GALACTIC_BACKGROUND_ROTATION, galacticFrameVector, trailBodyIds, trailColors };
