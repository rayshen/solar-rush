// Compact, browser-friendly scientific catalogues. These are deliberately
// curated subsets: shipping the full Gaia DR3 catalogue is not practical in a
// client bundle. Coordinates are ICRS; magnitudes are visual/G-band proxies.
export const brightStarCatalog = [
  { hip: 32349, name: 'Sirius', ra: 101.2872, dec: -16.7161, mag: -1.46, bv: 0.00 },
  { hip: 30438, name: 'Canopus', ra: 95.9879, dec: -52.6957, mag: -0.74, bv: 0.15 },
  { hip: 69673, name: 'Arcturus', ra: 213.9153, dec: 19.1824, mag: -0.05, bv: 1.23 },
  { hip: 71683, name: 'Alpha Centauri', ra: 219.9021, dec: -60.8339, mag: -0.01, bv: 0.71 },
  { hip: 91262, name: 'Vega', ra: 279.2347, dec: 38.7837, mag: 0.03, bv: 0.00 },
  { hip: 24608, name: 'Capella', ra: 79.1723, dec: 45.9980, mag: 0.08, bv: 0.80 },
  { hip: 24436, name: 'Rigel', ra: 78.6345, dec: -8.2016, mag: 0.13, bv: -0.03 },
  { hip: 37279, name: 'Procyon', ra: 114.8255, dec: 5.2250, mag: 0.34, bv: 0.42 },
  { hip: 27989, name: 'Betelgeuse', ra: 88.7929, dec: 7.4071, mag: 0.42, bv: 1.85 },
  { hip: 7588, name: 'Achernar', ra: 24.4286, dec: -57.2368, mag: 0.46, bv: -0.16 },
  { hip: 68702, name: 'Hadar', ra: 210.9559, dec: -60.3730, mag: 0.61, bv: -0.23 },
  { hip: 97649, name: 'Altair', ra: 297.6958, dec: 8.8683, mag: 0.76, bv: 0.22 },
  { hip: 60718, name: 'Acrux', ra: 186.6496, dec: -63.0991, mag: 0.77, bv: -0.24 },
  { hip: 21421, name: 'Aldebaran', ra: 68.9800, dec: 16.5093, mag: 0.85, bv: 1.54 },
  { hip: 65474, name: 'Spica', ra: 201.2983, dec: -11.1613, mag: 0.97, bv: -0.23 },
  { hip: 80763, name: 'Antares', ra: 247.3519, dec: -26.4320, mag: 1.06, bv: 1.83 },
  { hip: 37826, name: 'Pollux', ra: 116.3289, dec: 28.0262, mag: 1.14, bv: 1.00 },
  { hip: 113368, name: 'Fomalhaut', ra: 344.4128, dec: -29.6222, mag: 1.16, bv: 0.09 },
  { hip: 102098, name: 'Deneb', ra: 310.3580, dec: 45.2803, mag: 1.25, bv: 0.09 },
  { hip: 49669, name: 'Regulus', ra: 152.0936, dec: 11.9672, mag: 1.35, bv: -0.11 },
];

// Observed radio position of Sagittarius A*, used as the physical dynamical
// center anchor. This is intentionally distinct from the conventional
// Galactic-coordinate origin (l=0°, b=0°).
// Source: Reid & Brunthaler 2004, ApJ 616, 872.
export const sagittariusAStar = {
  icrsRightAscensionDeg: 266.4168371,
  icrsDeclinationDeg: -29.0078106,
  galacticLongitudeDeg: -0.0557489,
  galacticLatitudeDeg: -0.0461649,
  j2000EclipticLongitudeDeg: 266.8517,
  j2000EclipticLatitudeDeg: -5.6077,
};

// Present-day Solar Galactocentric velocity expressed in the standard
// Galactic (U, V, W) basis, then transformed to the J2000 ecliptic frame.
// U points toward the Galactic center, V follows Galactic rotation, and W
// points toward the north Galactic pole. The derived ecliptic direction is
// used as an orientation anchor; Artistic Spiral still compresses distance
// and trail pitch for legibility.
// Velocity model: https://academic.oup.com/mnras/article/530/1/710/7630218
// Coordinate transform: https://gea.esac.esa.int/archive/documentation/GDR3/Introduction/chap_cu0int/cu0int_sec_mission/cu0int_ssec_scanning_law_concepts.html
export const solarGalactocentricMotion = {
  velocityKmS: { u: 9.5, v: 250.7, w: 8.56 },
  j2000EclipticLongitudeDeg: 342.18,
  j2000EclipticLatitudeDeg: 60.98,
};

// Current JPL#75 osculating solution for 1P/Halley. These elements are retained
// only as an out-of-range fallback; the rendered 1800-2200 trajectory comes
// from sampled Horizons state vectors with planetary and non-gravitational
// perturbations included.
// Source: https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=1P&full-prec=true
export const halleyOrbit = {
  solution: 75,
  epochJdTdb: 2_439_875.5,
  perihelionDistanceAu: 0.5748638313743413,
  eccentricity: 0.9679359956953211,
  inclinationDeg: 162.1905300439129,
  argumentPerihelionDeg: 112.2414314637764,
  ascendingNodeDeg: 59.09894720612437,
  previousPerihelionJdTdb: 2_446_469.9736161465,
  nextPerihelionJdTdb: 2_474_034.220124185,
};

// JPL mean satellite elements. Epoch J2000.0 TDB. Angles are degrees.
// These are mean-element propagations, not a substitute for Horizons/SPICE.
export const satelliteMeanElements = {
  moon: { a: 384400, e: 0.0554, periapsis: 318.15, meanAnomaly: 135.27, inclination: 5.16, node: 125.08, period: 27.322 },
  phobos: { a: 9375, e: 0.015, periapsis: 216.3, meanAnomaly: 189.7, inclination: 1.1, node: 169.2, period: 0.3187 },
  deimos: { a: 23457, e: 0, periapsis: 0, meanAnomaly: 205, inclination: 1.8, node: 54.3, period: 1.2625 },
  io: { a: 421800, e: 0.004, periapsis: 49.1, meanAnomaly: 330.9, inclination: 0, node: 0, period: 1.762732 },
  europa: { a: 671100, e: 0.009, periapsis: 45, meanAnomaly: 345.4, inclination: 0.5, node: 184, period: 3.525463 },
  ganymede: { a: 1070400, e: 0.001, periapsis: 198.3, meanAnomaly: 324.8, inclination: 0.2, node: 58.5, period: 7.155588 },
  callisto: { a: 1882700, e: 0.007, periapsis: 43.8, meanAnomaly: 87.4, inclination: 0.3, node: 309.1, period: 16.69044 },
  dione: { a: 377700, e: 0.002, periapsis: 116, meanAnomaly: 212, inclination: 0, node: 0, period: 2.736916 },
  rhea: { a: 527200, e: 0.001, periapsis: 44.3, meanAnomaly: 31.5, inclination: 0.3, node: 133.7, period: 4.517503 },
  titan: { a: 1221900, e: 0.029, periapsis: 78.3, meanAnomaly: 11.7, inclination: 0.3, node: 78.6, period: 15.945448 },
  iapetus: { a: 3561700, e: 0.028, periapsis: 254.5, meanAnomaly: 74.8, inclination: 7.6, node: 86.5, period: 79.331002 },
  titania: { a: 436298, e: 0.002, periapsis: 184, meanAnomaly: 68.1, inclination: 0.1, node: 29.5, period: 8.705869 },
  oberon: { a: 583511, e: 0.002, periapsis: 132.2, meanAnomaly: 143.6, inclination: 0.1, node: 76.8, period: 13.463237 },
  triton: { a: 354800, e: 0, periapsis: 0, meanAnomaly: 63, inclination: 157.3, node: 178.1, period: -5.876994 },
};
