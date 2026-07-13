import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Body as AstronomyBody,
  HelioState,
  HelioVector,
  RotateState,
  RotateVector,
  Rotation_EQJ_ECL,
} from 'astronomy-engine';
import { bodies, bodyMap, planetEphemerisElements } from './solarData.js';
import {
  brightStarCatalog,
  sagittariusAStar,
  satelliteMeanElements,
  solarGalactocentricMotion,
} from './astronomyData.js';
import { getBodyDetails, textureForBody } from './bodyDetails.js';

const DAY_MS = 86_400_000;
const MAX_UI_TIME_UPDATE_INTERVAL_MS = 1_000;
const MIN_UI_TIME_UPDATE_INTERVAL_MS = 16;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const START_DATE = new Date();
const PHYSICAL_KM_PER_UNIT = 50_000_000;
const PHYSICAL_ORBIT_CAMERA_BIAS = new THREE.Vector3(0, 135, 125);
const GALAXY_MAP_SIZE = 250;
// Crop the square map beyond the short viewport edge so the galaxy disk fills
// mobile screens while retaining roughly 90% of its visible structure.
const GALAXY_MOBILE_FILL = 1.8;
const MOBILE_LAYOUT_MAX_WIDTH = 1240;
const EQJ_TO_ECL = Rotation_EQJ_ECL();
const ECLIPTIC_NORTH_SCENE = new THREE.Vector3(0, 1, 0);
const galacticTravelLongitude = THREE.MathUtils.degToRad(
  solarGalactocentricMotion.j2000EclipticLongitudeDeg,
);
const galacticTravelLatitude = THREE.MathUtils.degToRad(
  solarGalactocentricMotion.j2000EclipticLatitudeDeg,
);
// J2000 ecliptic +X maps to scene +X, +Y to scene -Z, and +Z to scene +Y.
const GALACTIC_TRAVEL_DIRECTION = new THREE.Vector3(
  Math.cos(galacticTravelLatitude) * Math.cos(galacticTravelLongitude),
  Math.sin(galacticTravelLatitude),
  -Math.cos(galacticTravelLatitude) * Math.sin(galacticTravelLongitude),
).normalize();
const GALACTIC_TRAVEL_SIDE = new THREE.Vector3()
  .crossVectors(ECLIPTIC_NORTH_SCENE, GALACTIC_TRAVEL_DIRECTION)
  .normalize();
const GALACTIC_TRAVEL_UP = new THREE.Vector3()
  .crossVectors(GALACTIC_TRAVEL_DIRECTION, GALACTIC_TRAVEL_SIDE)
  .normalize();
const GALACTIC_BACKGROUND_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  GALACTIC_TRAVEL_DIRECTION,
);
const rushingTrailRelative = new THREE.Vector3();
const orbitNormalPosition = new THREE.Vector3();
const orbitNormalVelocity = new THREE.Vector3();

function galacticFrameVector(side, up, forward) {
  return new THREE.Vector3()
    .addScaledVector(GALACTIC_TRAVEL_SIDE, side)
    .addScaledVector(GALACTIC_TRAVEL_UP, up)
    .addScaledVector(GALACTIC_TRAVEL_DIRECTION, forward);
}

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const simulationSpeeds = [
  { label: 'Adaptive orbit', adaptiveOrbit: true },
  { label: '1s/s', multiplier: '1×', secondsPerSecond: 1 },
  { label: '1m/s', multiplier: '60×', secondsPerSecond: 60 },
  { label: '1h/s', multiplier: '3,600×', secondsPerSecond: 3600 },
  { label: '1d/s', multiplier: '86,400×', secondsPerSecond: 86400 },
  { label: '7d/s', multiplier: '604,800×', secondsPerSecond: 604_800 },
  { label: '30d/s', multiplier: '2,592,000×', secondsPerSecond: 2_592_000 },
  { label: '1y/s', multiplier: '31,557,600×', secondsPerSecond: 31_557_600 },
  { label: '10y/s', multiplier: '315,576,000×', secondsPerSecond: 315_576_000 },
];
const DEFAULT_SPEED_INDEX = simulationSpeeds.findIndex(({ adaptiveOrbit }) => adaptiveOrbit);
const DEFAULT_VIEW_MODE = 'helical';
const DEFAULT_ORBIT_SCOPE = 'solar';
const DEFAULT_HELICAL_VIEW = 'front';

const viewModeLabels = {
  orbit: 'Orbit',
  helical: 'Artistic Spiral',
  follow: 'Follow',
};

const viewModeDescriptions = {
  orbit: '俯视完整轨道结构，适合比较行星位置与系统尺度。',
  helical: '统一 J2000 黄道坐标；银道面—黄道面夹角 60.19°，各行星光迹遵循其瞬时 VSOP 轨道面。',
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
    orbitInclination: 'Orbital Inclination', ascendingNode: 'Ascending Node',
    center: 'System barycenter', days: 'days', hours: 'hours', additional: 'Additional Data',
    gravity: 'Surface Gravity', escape: 'Escape Velocity', mass: 'Mass', moons: 'Moons',
    magnitude: 'Visual Magnitude', reference: 'Reference Frame', positionModel: 'Position Model',
    scaleModel: 'Scale Model', catalogue: 'Star Catalogue', lighting: 'Lighting', source: 'NASA source',
    trueScale: 'True physical scale (1 unit = 50M km)', keepCentered: 'Keep selected body centered',
    orbitView: 'Orbit View', spiralView: 'Artistic Spiral', followView: 'Follow View', elapsed: 'Elapsed',
    solarSystemView: 'Solar System', galaxyView: 'Milky Way',
    spiralFrontView: 'Front View', spiralRearView: 'Rear View',
    reconstruction: 'ESA/Gaia data-informed model view', sunGalacticRadius: 'Sun–center distance',
    mapBoundary: 'Data-informed artist impression, not an external photograph or direct density map',
    drift: 'Forward drift', wheel: 'Wheel', zoom: 'Zoom', leftClick: 'Left drag', rotate: 'Rotate',
    rightClick: 'Right drag', pan: 'Pan', select: 'Select', focusBody: 'Focus body',
    share: 'Share', copySite: 'Site link', copyView: 'Current view',
    copySiteHint: 'Open Solar Rush from its default view', copyViewHint: 'Keep this body, speed and camera angle',
    copied: 'Link copied', copyFailed: 'Copy failed',
    inRange: 'EPHEMERIS IN RANGE', outRange: 'EPHEMERIS OUT OF RANGE',
    physicalScale: 'Unified scale: 1 scene unit = 50 million km.', visualScale: 'Visual scale: sizes and distances are compressed separately.',
    orbitDescription: 'Top-down system view for comparing positions and orbital scale.',
    galaxyDescription: 'ESA/Gaia data-informed artist impression. The Solar System lies in the Orion Spur, about 26,600 light-years from the Galactic center.',
    helicalDescription: 'Unified J2000 ecliptic frame: Galactic plane–ecliptic 60.19°; Sgr A* λ 266.8517°, β −5.6077°; present Galactocentric velocity λ 342.2°, β 61.0°. Trail scale is compressed.',
    followDescription: 'Follow the selected body and emphasize its local system and trajectory.',
  },
  zh: {
    celestialBodies: '天体列表', search: '搜索天体', star: '恒星', planets: '行星', noMatches: '没有匹配的天体。',
    beijingTime: '北京时间', lunar: '中国农历', simSpeed: '模拟速度', reset: '重置视角', pause: '暂停', play: '播放',
    overview: '概览', physical: '物理参数', composition: '组成', atmosphere: '大气', radius: '半径',
    distance: '距母天体', orbitPeriod: '公转周期', rotationPeriod: '自转周期', velocity: '轨道速度',
    axialTilt: '轴倾角', observation: '观察模式', center: '系统质心', days: '天', hours: '小时',
    orbitInclination: '轨道倾角', ascendingNode: '升交点经度',
    additional: '更多数据', gravity: '表面重力', escape: '逃逸速度', mass: '质量', moons: '卫星数',
    magnitude: '视星等', reference: '参考系', positionModel: '位置模型', scaleModel: '比例模型',
    catalogue: '恒星目录', lighting: '光照模型', source: 'NASA 资料来源',
    trueScale: '真实物理比例（1 单位 = 5000 万 km）', keepCentered: '保持选中天体居中',
    orbitView: '轨道视图', spiralView: '艺术螺旋', followView: '跟随视图', elapsed: '已运行',
    solarSystemView: '太阳系', galaxyView: '银河系',
    spiralFrontView: '前方回望', spiralRearView: '后方前望',
    reconstruction: 'ESA/Gaia 数据辅助模型图', sunGalacticRadius: '太阳—银心距离',
    mapBoundary: '基于数据的艺术重建图，并非系外实拍或直接恒星密度图',
    drift: '前进距离', wheel: '滚轮', zoom: '缩放', leftClick: '左键拖动', rotate: '旋转',
    rightClick: '右键拖动', pan: '平移', select: '选择', focusBody: '聚焦天体',
    share: '分享', copySite: '站点链接', copyView: '当前视角',
    copySiteHint: '从默认视角打开 Solar Rush', copyViewHint: '保留当前天体、速度与相机角度',
    copied: '链接已复制', copyFailed: '复制失败',
    inRange: '星历有效范围内', outRange: '超出星历有效范围',
    physicalScale: '统一比例：1 场景单位 = 5000 万 km。', visualScale: '视觉比例：尺寸与距离分别压缩。',
    orbitDescription: '俯视完整轨道结构，适合比较行星位置与系统尺度。',
    galaxyDescription: '基于 ESA/Gaia 数据制作的艺术重建俯视图：太阳系位于猎户支臂，距银心约 2.66 万光年。',
    helicalDescription: '统一 J2000 黄道坐标：银道面—黄道面 60.19°；Sgr A* 黄经 266.8517°、黄纬 −5.6077°；当前银心速度方向为黄经 342.2°、黄纬 61.0°。光迹尺度经过压缩。',
    followDescription: '跟随选中天体，仅突出它的主轨迹与局部系统。',
  },
};

// `map` values are approximate scene anchors transcribed from ESA/Gaia's
// annotated artist impression. Only the Solar System radius is numerically
// calibrated (8.2 kpc); arm anchors do not represent measured boundaries.
const galaxyFeatures = [
  { id: 'galactic-center', group: 'core', name: 'Galactic Center', zh: '银河系中心', kind: 'Galactic location', kindZh: '银河系中心位置', map: [0, 0] },
  { id: 'sgr-a', group: 'core', name: 'Sagittarius A*', zh: '人马座 A*', kind: 'Supermassive black hole', kindZh: '超大质量黑洞', map: [0, 0], nested: true },
  { id: 'nuclear-cluster', group: 'core', name: 'Nuclear Star Cluster', zh: '核星团', kind: 'Dense central star cluster', kindZh: '致密中央星团', map: [0, 0], nested: true },
  { id: 'bulge', group: 'core', name: 'Galactic Bulge', zh: '银河核球', kind: 'Dense stellar structure', kindZh: '致密恒星结构', map: [0, 0], nested: true },
  { id: 'bar', group: 'core', name: 'Central Bar', zh: '中央棒', kind: 'Barred structure', kindZh: '棒状结构', map: [3, -20] },
  { id: 'perseus', group: 'arms', name: 'Perseus Arm', zh: '英仙臂', kind: 'Major spiral arm', kindZh: '主要旋臂', map: [-44, 37] },
  { id: 'outer', group: 'arms', name: 'Outer Arm', zh: '外臂', kind: 'Outer spiral arm', kindZh: '外侧旋臂', map: [-62, 45] },
  { id: 'orion', group: 'arms', name: 'Orion Spur', zh: '猎户支臂', kind: 'Local spur · Sun', kindZh: '本地支臂 · 太阳', map: [-6, 54] },
  { id: 'sagittarius-carina', group: 'arms', name: 'Sagittarius–Carina Arm', zh: '人马—船底臂', kind: 'Spiral arm', kindZh: '旋臂', map: [50, 47] },
  { id: 'scutum-centaurus', group: 'arms', name: 'Scutum–Centaurus Arm', zh: '盾牌—半人马臂', kind: 'Major spiral arm', kindZh: '主要旋臂', map: [44, 31] },
  { id: 'norma', group: 'arms', name: 'Norma Arm', zh: '矩尺臂', kind: 'Inner spiral arm', kindZh: '内侧旋臂', map: [31, 19] },
  { id: 'near-3kpc', group: 'arms', name: 'Near 3 kpc Arm', zh: '近 3 kpc 臂', kind: 'Inner gas arm', kindZh: '内侧气体臂', map: [16, 14] },
  { id: 'far-3kpc', group: 'arms', name: 'Far 3 kpc Arm', zh: '远 3 kpc 臂', kind: 'Inner gas arm', kindZh: '内侧气体臂', map: [-15, -9] },
  { id: 'solar-neighborhood', group: 'locations', name: 'Solar Neighborhood', zh: '太阳邻域', kind: 'Local stellar neighborhood', kindZh: '本地恒星邻域', map: [4.7, 53.1], suppressMapLabel: true },
  { id: 'proxima-centauri', group: 'locations', name: 'Proxima Centauri System', zh: '比邻星系统', kind: 'Nearest known exoplanet system', kindZh: '最近的已知系外行星系统', map: [4.7, 53.1], nested: true },
  { id: 'trappist-1', group: 'locations', name: 'TRAPPIST-1 System', zh: 'TRAPPIST-1 系统', kind: 'Seven-planet system', kindZh: '七行星系统', map: [4.7, 53.1], nested: true },
  { id: '55-cancri', group: 'locations', name: '55 Cancri System', zh: '巨蟹座 55 系统', kind: 'Five-planet system', kindZh: '五行星系统', map: [4.7, 53.1], nested: true },
  { id: 'toi-700', group: 'locations', name: 'TOI-700 System', zh: 'TOI-700 系统', kind: 'Nearby M-dwarf system', kindZh: '邻近 M 型矮星系统', map: [4.7, 53.1], nested: true },
  { id: 'hr-8799', group: 'locations', name: 'HR 8799 System', zh: 'HR 8799 系统', kind: 'Directly imaged system', kindZh: '直接成像行星系统', map: [4.7, 53.1], nested: true },
  { id: 'solar-system', group: 'locations', name: 'Solar System', zh: '太阳系', kind: 'Our planetary system', kindZh: '我们的行星系统', map: [4.7, 53.1], nested: true },
];

const galaxyFeatureImages = {
  'galactic-center': { file: 'bulge-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  'sgr-a': { file: 'sagittarius-a-eht.jpg', type: ['Observation · EHT', '观测图 · EHT'] },
  'nuclear-cluster': { file: 'nuclear-star-cluster-hubble.jpg', type: ['Infrared observation · Hubble', '红外观测 · Hubble'] },
  bulge: { file: 'bulge-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  bar: { file: 'bar-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  perseus: { file: 'perseus-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  outer: { file: 'outer-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  orion: { file: 'orion-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  'sagittarius-carina': { file: 'sagittarius-carina-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  'scutum-centaurus': { file: 'scutum-centaurus-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  norma: { file: 'norma-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  'near-3kpc': { file: 'near-3kpc-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  'far-3kpc': { file: 'far-3kpc-model.jpg', type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia'] },
  'solar-neighborhood': { file: 'orion-model.jpg', type: ['Galaxy-scale locator', '银河尺度定位图'] },
  'proxima-centauri': { file: 'orion-model.jpg', type: ['Unresolved at this scale', '当前尺度不可分辨'] },
  'trappist-1': { file: 'orion-model.jpg', type: ['Unresolved at this scale', '当前尺度不可分辨'] },
  '55-cancri': { file: 'orion-model.jpg', type: ['Unresolved at this scale', '当前尺度不可分辨'] },
  'toi-700': { file: 'orion-model.jpg', type: ['Unresolved at this scale', '当前尺度不可分辨'] },
  'hr-8799': { file: 'orion-model.jpg', type: ['Unresolved at this scale', '当前尺度不可分辨'] },
  'solar-system': { file: 'orion-model.jpg', type: ['Calibrated model position · ESA/Gaia', '校准模型位置 · ESA/Gaia'] },
};

const galaxyFeatureDetails = {
  'galactic-center': {
    summary: ['The central region of the Milky Way, whose dynamical center is associated with Sagittarius A* and which contains nested structures at radically different scales.', '银河系中央区域；其动力学中心与人马座 A* 对应，并包含尺度差异巨大的嵌套结构。'],
    facts: [['动力学中心', '由 Sgr A* 观测位置锚定'], ['坐标约定', '银河坐标原点 l=0°、b=0°，与 Sgr A* 相差约 0.07°'], ['内部结构', 'Sgr A*、核星团、核球'], ['地图尺度', '在全银河视图中无法按比例分辨']],
    factsEn: [['Dynamical center', 'Anchored to the observed Sgr A* position'], ['Coordinate convention', 'Galactic origin l=0°, b=0° differs from Sgr A* by ~0.07°'], ['Nested structures', 'Sgr A*, nuclear cluster, bulge'], ['Map scale', 'Not resolvable to scale in a Galaxy-wide view']],
    source: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/',
  },
  'sgr-a': {
    summary: ['The compact radio source associated with the Milky Way’s central supermassive black hole.', '银河系中心超大质量黑洞对应的致密射电源。'],
    facts: [['估算质量', '约 400 万个太阳质量'], ['物理角色', '银河系动力学中心'], ['ICRS J2000', '赤经 266.4168° · 赤纬 −29.0078°'], ['J2000 黄道坐标', '黄经 266.8517° · 黄纬 −5.6077°'], ['地图表达', '定位符号，非比例实体']],
    factsEn: [['Estimated mass', '~4 million solar masses'], ['Physical role', 'Galactic dynamical center'], ['ICRS J2000', 'RA 266.4168° · Dec −29.0078°'], ['J2000 ecliptic', 'λ 266.8517° · β −5.6077°'], ['Map representation', 'Locator symbol; not to scale']],
    source: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/',
  },
  'nuclear-cluster': {
    summary: ['The Milky Way’s densest star cluster, surrounding Sagittarius A* and containing millions of stars.', '银河系最致密的星团，环绕人马座 A*，包含数百万颗恒星。'],
    facts: [['观测范围', 'Hubble 红外拼接图约 50 光年'], ['已分辨恒星', '超过 50 万颗'], ['估计总量', '约 1000 万颗更暗恒星']],
    factsEn: [['Observed field', 'Hubble infrared mosaic: ~50 ly'], ['Resolved stars', 'More than 500,000'], ['Estimated population', '~10 million fainter stars']],
    source: 'https://science.nasa.gov/asset/hubble/milky-way-nuclear-star-cluster/',
  },
  bulge: {
    summary: ['The vertically thick, box/peanut-shaped central stellar component associated with the Milky Way’s bar.', '与银河系中央棒相关、在侧视方向呈盒状/花生状的厚恒星结构。'],
    facts: [['恒星数量', '约 100 亿颗，以老年红色恒星为主'], ['形态', '盒状/花生状，并含 X 形子结构'], ['尺度', '半长约 1 万光年；边界渐变']],
    factsEn: [['Population', '~10 billion, mainly older red stars'], ['Morphology', 'Box/peanut-shaped with an X-shaped substructure'], ['Scale', 'Half-length ~10,000 ly; gradual boundary']],
    source: 'https://sci.esa.int/web/gaia/-/58206-anatomy-of-the-milky-way',
  },
  bar: {
    summary: ['The elongated stellar structure crossing the central bulge; its length and orientation remain model-dependent.', '穿过核球的拉长恒星结构；长度和方向仍依赖具体模型。'],
    facts: [['结构类型', '棒旋星系中央恒星棒'], ['Gaia 结果', '方向比早期模型更倾斜'], ['不确定性', '长度与端点并非精确边界']],
    factsEn: [['Structure', 'Central stellar bar'], ['Gaia result', 'More inclined than earlier models'], ['Uncertainty', 'Length and endpoints are model-dependent']],
    source: 'https://www.esa.int/ESA_Multimedia/Images/2023/12/Top-down_view_of_the_Milky_Way_annotated',
  },
  perseus: { summary: ['A prominent outer stellar arm and one of the Milky Way’s major arms in the two-major-arm interpretation.', '显著的外侧恒星臂；在“两条主要恒星臂”模型中属于主臂。'], relation: ['Outside the Orion Spur', '猎户支臂外侧'] },
  outer: { summary: ['A distant outer spiral feature whose far-side geometry remains comparatively uncertain.', '遥远的外侧旋臂结构，其银河背面几何形态仍有较大不确定性。'], relation: ['Outer Galactic disk', '银河盘外侧'] },
  orion: { summary: ['The local spur containing the Sun, between the Sagittarius–Carina and Perseus arms.', '包含太阳的本地支臂，位于人马—船底臂与英仙臂之间。'], relation: ['Sun at 8.2 kpc from center', '太阳距银心 8.2 kpc'] },
  'sagittarius-carina': { summary: ['A gas-rich spiral feature with active star-forming regions, also named Carina–Sagittarius when followed in the opposite direction.', '富含气体和恒星形成区的旋臂；按相反方向命名时也称“船底—人马臂”。'], relation: ['Inside the Orion Spur', '猎户支臂内侧'] },
  'scutum-centaurus': { summary: ['A prominent stellar arm commonly called Scutum–Centaurus; the ESA model labels its mapped continuation as the Centaurus Arm.', '通常称为盾牌—半人马臂的显著恒星臂；ESA 模型将图中延伸段标为“半人马臂”。'], relation: ['Prominent stellar arm', '显著恒星臂'] },
  norma: { summary: ['An inner spiral feature traced mainly by gas and young star-forming regions.', '主要由气体和年轻恒星形成区追踪的内侧旋臂结构。'], relation: ['Inner Galactic disk', '银河盘内侧'] },
  'near-3kpc': { summary: ['A rapidly expanding inner gas feature near the central bar, not a conventional outer stellar arm.', '中央棒附近快速膨胀的内侧气体结构，并非常规外侧恒星臂。'], relation: ['Inner gas structure', '内侧气体结构'] },
  'far-3kpc': { summary: ['The far-side counterpart to the Near 3 kpc Arm, identified through radio observations of Galactic gas.', '近 3 kpc 臂在银心远侧的对应结构，由银河气体射电观测识别。'], relation: ['Far-side inner gas structure', '远侧内层气体结构'] },
  'solar-neighborhood': {
    summary: ['The local region around the Sun. The representative planetary systems below are grouped at one locator because their separations cannot be resolved on a Galaxy-wide map.', '太阳周围的本地空间区域。下列代表性行星系统在银河全景尺度无法分开，因此共用一个定位点。'],
    facts: [['地图定位', '猎户支臂内，距银心约 8.2 kpc'], ['当前图比例', '约 1 场景单位 = 500 光年'], ['表达限制', '邻近系统不按像素级间距分散绘制']],
    factsEn: [['Map location', 'Orion Spur, ~8.2 kpc from center'], ['Current map scale', '~1 scene unit = 500 ly'], ['Representation', 'Nearby systems are not spread using false pixel-scale offsets']],
    source: 'https://science.nasa.gov/exoplanets/big-questions/',
  },
  'proxima-centauri': {
    summary: ['The nearest known exoplanet system, around Proxima Centauri, the closest star to the Sun and a member of the Alpha Centauri triple system.', '距离太阳最近的已知系外行星系统；其宿主比邻星是离太阳最近的恒星，也是南门二三星系统成员。'],
    facts: [['距太阳', '约 4.24 光年'], ['宿主恒星', '红矮星 · 南门二三星系统成员'], ['代表行星', '比邻星 b']],
    factsEn: [['Distance from Sun', '~4.24 ly'], ['Host star', 'Red dwarf · Alpha Centauri triple member'], ['Representative planet', 'Proxima b']],
    source: 'https://science.nasa.gov/universe/exoplanets/eso-discovers-earth-size-planet-in-habitable-zone-of-nearest-star/',
  },
  'trappist-1': {
    summary: ['An ultracool red-dwarf system with seven known Earth-sized rocky planets.', '一颗超冷红矮星及其七颗已知地球大小岩质行星组成的系统。'],
    facts: [['距太阳', '约 40 光年'], ['已知行星', '7 颗'], ['行星类型', '均为地球大小的岩质行星']],
    factsEn: [['Distance from Sun', '~40 ly'], ['Known planets', '7'], ['Planet type', 'All Earth-sized rocky worlds']],
    source: 'https://science.nasa.gov/exoplanets/trappist1/',
  },
  '55-cancri': {
    summary: ['A nearby binary-star system with at least five known planets orbiting the primary star, 55 Cancri A.', '邻近双星系统；至少五颗已知行星围绕主星巨蟹座 55 A 运行。'],
    facts: [['距太阳', '约 41 光年'], ['恒星结构', '双星系统'], ['已知行星', '至少 5 颗']],
    factsEn: [['Distance from Sun', '~41 ly'], ['Stellar structure', 'Binary system'], ['Known planets', 'At least 5']],
    source: 'https://science.nasa.gov/solar-system/skywatching/night-sky-network/dim-delights-in-cancer/',
  },
  'toi-700': {
    summary: ['A nearby M-dwarf planetary system containing the roughly Earth-sized planets TOI-700 d and e in the star’s habitable zone.', '邻近 M 型矮星行星系统，包含位于宜居带内、大小接近地球的 TOI-700 d 和 e。'],
    facts: [['距太阳', '约 100 光年'], ['宿主恒星', 'M 型矮星'], ['代表行星', '宜居带内的 TOI-700 d、e']],
    factsEn: [['Distance from Sun', '~100 ly'], ['Host star', 'M dwarf'], ['Representative planets', 'Habitable-zone TOI-700 d and e']],
    source: 'https://science.nasa.gov/exoplanet-catalog/toi-700-e/',
  },
  'hr-8799': {
    summary: ['A young nearby system famous for four giant exoplanets that have been directly imaged.', '一个年轻的邻近系统，以四颗已被直接成像的巨型系外行星闻名。'],
    facts: [['距太阳', '约 130 光年'], ['已成像行星', '4 颗巨型行星'], ['科学意义', '多行星直接成像基准系统']],
    factsEn: [['Distance from Sun', '~130 ly'], ['Imaged planets', '4 giant planets'], ['Scientific role', 'Benchmark directly imaged multiplanet system']],
    source: 'https://science.nasa.gov/missions/webb/nasas-webb-images-young-giant-exoplanets-detects-carbon-dioxide/',
  },
  'solar-system': {
    summary: ['Our planetary system’s location in the Orion Spur, calibrated to the ESA/Gaia map at a Galactocentric radius of about 8.2 kpc.', '太阳系位于猎户支臂；在 ESA/Gaia 地图中按约 8.2 kpc 的银心距离校准。'],
    facts: [['距银心距离', '约 8.2 kpc · 26,600 光年'], ['所在结构', '猎户支臂'], ['绕银心周期', '约 2.3 亿年']],
    factsEn: [['Galactocentric radius', '~8.2 kpc · 26,600 ly'], ['Local structure', 'Orion Spur'], ['Galactic orbital period', '~230 million years']],
    source: 'https://science.nasa.gov/solar-system/solar-system-facts/',
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
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Shanghai',
    }).formatToParts(date);
    const yearName = parts.find(({ type }) => type === 'yearName')?.value;
    const month = parts.find(({ type }) => type === 'month')?.value;
    const day = Number(parts.find(({ type }) => type === 'day')?.value);
    if (!yearName || !month || !Number.isInteger(day) || day < 1 || day > 30) {
      throw new Error('Unsupported Chinese calendar parts');
    }

    const dayNames = [
      '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
      '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
    ];
    return `${yearName}年${month}${dayNames[day - 1]}`;
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

function setPlanetOrbitNormal(id, date, out) {
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
  return out.set(
    sinInclination * Math.sin(elements.longitudeNode),
    Math.cos(elements.inclination),
    sinInclination * Math.cos(elements.longitudeNode),
  ).normalize();
}

function getPlanetOrbitOrientation(id, date) {
  const normal = setPlanetOrbitNormal(id, date, new THREE.Vector3());
  const inclination = Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1));
  const ascendingNode = inclination > 1e-10
    ? THREE.MathUtils.euclideanModulo(Math.atan2(normal.x, normal.z), Math.PI * 2)
    : 0;
  return { inclination, ascendingNode };
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
  rushingTrailRelative
    .applyAxisAngle(orbitNormal, -tail * turns * Math.PI * 2)
    .multiplyScalar(currentRadius > 0 ? coilRadius / currentRadius : 1);
  out.copy(sunPosition)
    .add(rushingTrailRelative)
    .addScaledVector(GALACTIC_TRAVEL_DIRECTION, -tail * depth);
  return out;
}

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
    depthWrite: false,
  }));
  sprite.scale.set(displayHeight * (canvas.width / canvas.height), displayHeight, 1);
  return sprite;
}

function createGalaxyMap() {
  const group = new THREE.Group();
  group.visible = false;
  const galaxyTexture = loadBodyTexture(assetUrl('/textures/galaxy/gaia-milky-way-face-on.jpg'), { color: true });
  galaxyTexture.anisotropy = 8;
  const galaxyDisk = new THREE.Mesh(
    new THREE.PlaneGeometry(GALAXY_MAP_SIZE, GALAXY_MAP_SIZE),
    new THREE.MeshBasicMaterial({
      map: galaxyTexture,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  galaxyDisk.rotation.x = -Math.PI / 2;
  galaxyDisk.position.y = -1.4;
  group.add(galaxyDisk);

  const selectionMarker = new THREE.Group();
  selectionMarker.position.y = 3.1;
  const selectionHalo = new THREE.Mesh(
    new THREE.RingGeometry(2.15, 2.48, 56),
    new THREE.MeshBasicMaterial({
      color: '#7df8ff',
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  selectionHalo.rotation.x = -Math.PI / 2;
  const selectionOuterHalo = new THREE.Mesh(
    new THREE.RingGeometry(3.05, 3.16, 56),
    new THREE.MeshBasicMaterial({
      color: '#7df8ff',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  selectionOuterHalo.rotation.x = -Math.PI / 2;
  selectionMarker.add(selectionHalo, selectionOuterHalo);
  group.add(selectionMarker);

  // Calibrated against the Sun marker in ESA/Gaia's annotated 4000 px map.
  // The marker is about (75, 850) px from the Galactic center, representing
  // the measured 8.2 kpc radius; the 250-unit plane maps that to (4.7, 53.1).
  const sunPosition = new THREE.Vector3(4.7, 1.8, 53.1);
  const marker = new THREE.Group();
  marker.position.copy(sunPosition);
  const markerDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 24),
    new THREE.MeshBasicMaterial({ color: '#fff2a8', side: THREE.DoubleSide, depthWrite: false }),
  );
  markerDot.rotation.x = -Math.PI / 2;
  const sunCrossGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.15, 0, 0), new THREE.Vector3(-0.42, 0, 0),
    new THREE.Vector3(0.42, 0, 0), new THREE.Vector3(1.15, 0, 0),
    new THREE.Vector3(0, 0, -1.15), new THREE.Vector3(0, 0, -0.42),
    new THREE.Vector3(0, 0, 0.42), new THREE.Vector3(0, 0, 1.15),
  ]);
  const sunCross = new THREE.LineSegments(
    sunCrossGeometry,
    new THREE.LineBasicMaterial({ color: '#7df8ff', transparent: true, opacity: 0.92 }),
  );
  marker.add(markerDot, sunCross);
  const sunLabels = {
    zh: createGalaxyLabel('太阳邻域 · 猎户支臂', '#eaffff', 4.8),
    en: createGalaxyLabel('Solar Neighborhood · Orion Spur', '#eaffff', 4.8),
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
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 1.05, 40),
    new THREE.MeshBasicMaterial({
      color: '#ffd27a',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  centerRing.rotation.x = -Math.PI / 2;
  const centerCrossGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.65, 0, 0), new THREE.Vector3(-0.65, 0, 0),
    new THREE.Vector3(0.65, 0, 0), new THREE.Vector3(1.65, 0, 0),
    new THREE.Vector3(0, 0, -1.65), new THREE.Vector3(0, 0, -0.65),
    new THREE.Vector3(0, 0, 0.65), new THREE.Vector3(0, 0, 1.65),
  ]);
  const centerCross = new THREE.LineSegments(
    centerCrossGeometry,
    new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.82 }),
  );
  centerMarker.add(centerRing, centerCross);
  group.add(centerMarker);
  const centerLabels = {
    zh: createGalaxyLabel('银河系中心', '#ffe2a3', 5.1),
    en: createGalaxyLabel('Galactic Center', '#ffe2a3', 5.1),
  };
  for (const label of Object.values(centerLabels)) {
    label.position.set(label.scale.x / 2 + 1.25, 5.2, 0);
    label.userData.baseScale = label.scale.clone();
    group.add(label);
  }
  const featureLabels = {};
  const hitTargets = [];
  for (const feature of galaxyFeatures.filter((item) => item.map && !item.suppressMapLabel)) {
    const labels = {
      zh: createGalaxyLabel(feature.zh, '#b9eaff', 2.7),
      en: createGalaxyLabel(feature.name, '#b9eaff', 2.7),
    };
    for (const label of Object.values(labels)) {
      label.position.set(feature.map[0], 2.5, feature.map[1]);
      label.userData.baseScale = label.scale.clone();
      group.add(label);
    }
    featureLabels[feature.id] = labels;
  }
  for (const feature of galaxyFeatures.filter((item) => item.map)) {
    const hitTarget = new THREE.Mesh(
      new THREE.CircleGeometry(feature.group === 'locations' ? 3.8 : 3.2, 24),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
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
    labels: { sun: sunLabels, center: centerLabels, features: featureLabels },
  };
}

function createStarField(starTexture) {
  const depthDrift = { value: 0 };
  const createDriftingMaterial = (options) => {
    const material = new THREE.PointsMaterial(options);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDepthDrift = depthDrift;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uDepthDrift;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          // Wrap stars independently instead of snapping the whole field back
          // to its origin. The distributed wrap points keep the travel motion
          // continuous without a synchronized background flash.
          transformed.z = mod(transformed.z + uDepthDrift + 240.0, 480.0) - 240.0;`,
        );
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
    new THREE.Points(geometry, createDriftingMaterial({
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
    new THREE.Points(brightGeometry, createDriftingMaterial({
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
    pushEquatorialToEclipticScene(
      radius * Math.cos(dec) * Math.cos(ra),
      radius * Math.cos(dec) * Math.sin(ra),
      radius * Math.sin(dec),
      positions,
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
  // Galactic coordinates pass through the J2000 equatorial frame into the
  // same J2000 ecliptic scene frame used by the planetary ephemerides.
  const galacticToScene = (longitude, latitude, radius, target) => {
    const cosLatitude = Math.cos(latitude);
    const gx = radius * cosLatitude * Math.cos(longitude);
    const gy = radius * cosLatitude * Math.sin(longitude);
    const gz = radius * Math.sin(latitude);
    const eqX = -0.0548755604 * gx + 0.4941094279 * gy - 0.8676661490 * gz;
    const eqY = -0.8734370902 * gx - 0.4448296300 * gy - 0.1980763734 * gz;
    const eqZ = -0.4838350155 * gx + 0.7469822445 * gy + 0.4559837762 * gz;
    pushEquatorialToEclipticScene(eqX, eqY, eqZ, target);
  };
  let seed = 0x7f4a7c15;
  const physicalCenterLongitude = THREE.MathUtils.degToRad(sagittariusAStar.galacticLongitudeDeg);
  const physicalCenterLatitude = THREE.MathUtils.degToRad(sagittariusAStar.galacticLatitudeDeg);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions = [];
  const colors = [];
  const glowColors = [];
  for (let i = 0; i < 42_000; i += 1) {
    const centerBiased = random() < 0.4;
    const longitudeOffset = centerBiased
      ? (random() - random()) * 0.82
      : random() * Math.PI * 2 - Math.PI;
    const longitude = physicalCenterLongitude + longitudeOffset;
    const centerStrength = Math.exp(-Math.pow(longitudeOffset / 0.68, 2));
    const innerBulge = Math.exp(-Math.pow(longitudeOffset / 0.27, 2));
    const bandWidth = 0.035 + centerStrength * 0.135;
    const latitudeCenter = centerStrength * physicalCenterLatitude
      + centerStrength * 0.006 * Math.sin(longitudeOffset * 5.5 + 0.4);
    const latitude = latitudeCenter + (random() - random()) * bandWidth;
    const radius = 182 + random() * 34;
    galacticToScene(longitude, latitude, radius, positions);

    // From Earth the nuclear star cluster itself is hidden at visible
    // wavelengths. The bright feature is the much broader Sagittarius bulge,
    // crossed by an irregular, slightly warped foreground dust lane.
    const dustLaneCenter = latitudeCenter
      + 0.005 * Math.sin(longitudeOffset * 6.5 - 0.8)
      + 0.003 * Math.sin(longitudeOffset * 17.0 + 1.7);
    const dustLaneLatitude = latitude - dustLaneCenter;
    const dustLaneWidth = 0.013 + centerStrength * 0.009;
    const dustLane = 0.18
      + 0.82 * (1 - Math.exp(-Math.pow(dustLaneLatitude / dustLaneWidth, 2)));
    const pipeCloud = Math.exp(
      -Math.pow((longitudeOffset + 0.29) / 0.16, 2)
      -Math.pow((dustLaneLatitude + 0.018) / 0.035, 2),
    );
    const centralCloud = Math.exp(
      -Math.pow((longitudeOffset - 0.07) / 0.11, 2)
      -Math.pow((dustLaneLatitude - 0.006) / 0.027, 2),
    );
    const patchyExtinction = 1 - 0.5 * Math.max(pipeCloud, centralCloud);
    const stellarCloud = THREE.MathUtils.clamp(
      0.76
        + 0.16 * Math.sin(longitudeOffset * 5.0 + 0.7)
        + 0.11 * Math.sin(longitudeOffset * 17.0 - dustLaneLatitude * 90.0),
      0.42,
      1.02,
    );
    const nuclearObscuration = innerBulge
      * Math.exp(-Math.pow(dustLaneLatitude / 0.032, 2));
    const brightness = Math.max(
      0.1,
      (0.5 + centerStrength * 0.63 + innerBulge * 0.12)
        * dustLane
        * patchyExtinction
        * stellarCloud
        * (1 - nuclearObscuration * 0.34),
    )
      * (0.72 + random() * 0.34);
    const dustProximity = Math.exp(-Math.pow(dustLaneLatitude / 0.032, 2));
    const reddening = THREE.MathUtils.clamp(
      dustProximity * (0.28 + centerStrength * 0.55),
      0,
      0.78,
    );
    const population = random();
    let coreColor;
    if (population < 0.1 * (1 - centerStrength * 0.45)) {
      coreColor = [0.7, 0.83, 1];
    } else if (population < 0.48 + centerStrength * 0.2) {
      coreColor = [1, 0.79, 0.56];
    } else {
      coreColor = [1, 0.95, 0.84];
    }
    colors.push(
      brightness * coreColor[0],
      brightness * coreColor[1] * (1 - reddening * 0.14),
      brightness * coreColor[2] * (1 - reddening * 0.42),
    );

    // Integrated Galactic light becomes warm tan/ochre where old stellar
    // populations and dust reddening dominate. Keep this diffuse glow separate
    // from the stellar cores so individual stars retain plausible colours.
    const glowWarmth = THREE.MathUtils.clamp(
      0.22 + centerStrength * 0.58 + dustProximity * 0.46,
      0,
      1,
    );
    const integratedLight = brightness * (0.78 + centerStrength * 0.68);
    glowColors.push(
      integratedLight * THREE.MathUtils.lerp(0.7, 0.9, glowWarmth),
      integratedLight * THREE.MathUtils.lerp(0.82, 0.58, glowWarmth),
      integratedLight * THREE.MathUtils.lerp(1.0, 0.3, glowWarmth),
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  glowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(glowColors, 3));
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
    size: 2.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const band = new THREE.Group();
  band.add(new THREE.Points(glowGeometry, glowMaterial), new THREE.Points(geometry, material));
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

        // Preserve the observed photosphere instead of tinting the whole star
        // deep orange. The warmer fringe is added separately below.
        vec3 photosphere = surfaceDetail * vec3(1.16, 0.86, 0.5);
        vec3 color = vec3(0.34, 0.055, 0.002) + photosphere;
        color *= mix(0.9, 1.18, smoothstep(0.24, 1.02, heat));
        color += vec3(1.18, 0.58, 0.09) * granules * 0.48;
        color = mix(color, vec3(1.5, 0.78, 0.22), filaments * 0.18);

        float facing = clamp(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0, 1.0);
        float limb = pow(facing, 0.42);
        color *= mix(0.76, 1.1, limb);
        color += vec3(1.1, 0.35, 0.012) * filaments * 0.16;
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

function getGalaxyCameraBias(camera, viewportWidth) {
  if (viewportWidth > MOBILE_LAYOUT_MAX_WIDTH) return new THREE.Vector3(0, 94, 18);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const halfMapSize = GALAXY_MAP_SIZE / 2;
  const cameraDistance = halfMapSize / (Math.tan(limitingFov / 2) * GALAXY_MOBILE_FILL);
  return new THREE.Vector3(0, 1, 18 / 94).normalize().multiplyScalar(cameraDistance);
}

function buildSolarScene(mount, options) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03060d');

  const camera = new THREE.PerspectiveCamera(54, mount.clientWidth / mount.clientHeight, 0.05, 2400);
  if (options.getState().viewMode === 'helical') {
    camera.position.copy(options.getState().helicalView === 'rear'
      ? galacticFrameVector(32, 22, -70)
      : galacticFrameVector(-20, 14, 43));
  }
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

  const createCameraControls = (up) => {
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
  let controls = createCameraControls(
    controlFrame === 'galactic' ? GALACTIC_TRAVEL_UP : ECLIPTIC_NORTH_SCENE,
  );
  if (options.getState().viewMode === 'helical') {
    controls.target.copy(GALACTIC_TRAVEL_DIRECTION).multiplyScalar(
      options.getState().helicalView === 'rear' ? 11 : -11,
    );
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
  const milkyWay = createMilkyWayBand(starTexture);
  scene.add(milkyWay);
  const galaxyMap = createGalaxyMap();
  scene.add(galaxyMap.group);

  const systemRoot = new THREE.Group();
  scene.add(systemRoot);
  const helicalTrailGroup = new THREE.Group();
  scene.add(helicalTrailGroup);
  const trailGlowTexture = createGlowTexture();
  const sunMotionLine = createSunMotionLine(trailGlowTexture);
  scene.add(sunMotionLine.group);

  const bodyNodes = new Map();
  const bodyHitTargets = [];
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
    mesh.userData.bodyId = body.id;
    bodyHitTargets.push(mesh);
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
  const physicalRadiusFor = (body) => body.radiusKm / PHYSICAL_KM_PER_UNIT;
  const physicalOrbitFor = (body) => body.distanceKm / PHYSICAL_KM_PER_UNIT;

  const updatePointer = (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
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
    if (galaxyView) options.onSelectGalaxyFeature?.(hit.userData.galaxyFeatureId);
    else options.onSelectBody?.(hit.userData.bodyId);
  };
  const onPointerDown = (event) => pointerStart.set(event.clientX, event.clientY);
  const onPointerMove = (event) => pickSceneTarget(event);
  const onPointerUp = (event) => {
    if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 5) {
      pickSceneTarget(event, true);
    }
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

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
      setPlanetOrbitNormal(id, simulationDate, trailOrbitNormal);
      for (let index = 0; index < trail.pointCount; index += 1) {
        const progress = index / (trail.pointCount - 1);
        getRushingTrailPoint(
          body,
          currentPosition,
          sunPosition,
          trailOrbitNormal,
          progress,
          mode,
          trailPoint,
        );
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
      controls = createCameraControls(
        nextControlFrame === 'galactic' ? GALACTIC_TRAVEL_UP : ECLIPTIC_NORTH_SCENE,
      );
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
    const galaxyView = state.viewMode === 'orbit' && state.orbitScope === 'galaxy';
    systemRoot.visible = !galaxyView;
    helicalTrailGroup.visible = !galaxyView;
    sunMotionLine.group.visible = !galaxyView && sunMotionLine.group.visible;
    galaxyMap.group.visible = galaxyView;
    const selectedMapFeature = galaxyFeatures.find((feature) => feature.id === state.selectedGalaxyFeature);
    const [selectionX, selectionZ] = selectedMapFeature?.map ?? [0, 0];
    const selectionAtGalacticCenter = selectionX === 0 && selectionZ === 0;
    const selectionAtSolarNeighborhood = selectionX === 4.7 && selectionZ === 53.1;
    galaxyMap.selectionMarker.position.set(selectionX, 3.1, selectionZ);
    galaxyMap.selectionMarker.visible = galaxyView;
    const markerPulse = 1 + Math.sin(visualTime * 3.2) * 0.08;
    galaxyMap.selectionMarker.scale.setScalar(markerPulse);
    for (const [labelLanguage, label] of Object.entries(galaxyMap.labels.sun)) {
      label.visible = galaxyView
        && labelLanguage === state.language
        && (!selectionAtSolarNeighborhood || state.selectedGalaxyFeature === 'solar-neighborhood');
      label.material.opacity = state.selectedGalaxyFeature === 'solar-neighborhood' ? 1 : 0.72;
      label.scale.copy(label.userData.baseScale).multiplyScalar(
        state.selectedGalaxyFeature === 'solar-neighborhood' ? 1.1 : 1,
      );
    }
    for (const [labelLanguage, label] of Object.entries(galaxyMap.labels.center)) {
      label.visible = galaxyView && labelLanguage === state.language && !selectionAtGalacticCenter;
      label.material.opacity = 0.72;
      label.scale.copy(label.userData.baseScale);
    }
    for (const [featureId, labels] of Object.entries(galaxyMap.labels.features)) {
      const labelFeature = galaxyFeatures.find((feature) => feature.id === featureId);
      const labelAtGalacticCenter = labelFeature?.map?.[0] === 0 && labelFeature?.map?.[1] === 0;
      const labelAtSolarNeighborhood = labelFeature?.map?.[0] === 4.7 && labelFeature?.map?.[1] === 53.1;
      for (const [labelLanguage, label] of Object.entries(labels)) {
        label.visible = galaxyView
          && labelLanguage === state.language
          && (!labelAtGalacticCenter || featureId === state.selectedGalaxyFeature)
          && (!labelAtSolarNeighborhood || featureId === state.selectedGalaxyFeature);
        label.material.opacity = featureId === state.selectedGalaxyFeature ? 0.96 : 0.56;
        label.scale.copy(label.userData.baseScale).multiplyScalar(
          featureId === state.selectedGalaxyFeature ? 1.12 : 1,
        );
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
    const selected = bodyNodes.get(state.selectedId) ?? bodyNodes.get('sun');
    selected.group.getWorldPosition(targetPosition);
    if (galaxyView) galaxyMap.group.getWorldPosition(cameraFocusPosition);
    else cameraFocusPosition.copy(targetPosition);

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
    if (galaxyView) {
      cameraBias = getGalaxyCameraBias(camera, mount.clientWidth);
    } else if (state.viewMode === 'orbit') {
      cameraBias = state.scaleMode === 'physical'
        ? PHYSICAL_ORBIT_CAMERA_BIAS
        : selectedBody.type === 'star'
          ? new THREE.Vector3(0, 42, 38)
          : selectedBody.type === 'planet'
            ? new THREE.Vector3(8, 5.2, 9.5)
            : new THREE.Vector3(3.8, 2.4, 4.6);
    } else if (state.viewMode === 'helical') {
      const viewDirection = state.helicalView === 'rear' ? -1 : 1;
      cameraBias = selectedBody.type === 'star'
        ? state.helicalView === 'rear'
          ? galacticFrameVector(32, 22, -70)
          : galacticFrameVector(-20, 14, 43)
        : galacticFrameVector(
          -distance * (state.helicalView === 'rear' ? 1.55 : 0.96) * viewDirection,
          distance * (state.helicalView === 'rear' ? 0.7 : 0.44),
          distance * (state.helicalView === 'rear' ? 1.5 : 0.92) * viewDirection,
        );
    } else {
      cameraBias = selectedBody.type === 'star'
        ? new THREE.Vector3(-8, 6.5, 15)
        : new THREE.Vector3(selectedSceneRadius * 7 + 7, selectedSceneRadius * 2.2 + 2.4, selectedSceneRadius * 4.4 + 7);
    }
    controls.minDistance = galaxyView ? cameraBias.length() * 0.56 : selectedSceneRadius * (selectedBody.type === 'star' ? 1.68 : 1.18);
    controls.maxDistance = galaxyView ? Math.max(310, cameraBias.length() * 1.8) : 240;
    controls.minPolarAngle = galaxyView ? 0.08 : 0;
    controls.maxPolarAngle = galaxyView ? 0.52 : Math.PI;
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
    if (state.viewMode === 'helical') {
      const lookDistance = selectedBody.type === 'star' ? 11 : 6.5;
      lookAtGoal.addScaledVector(
        GALACTIC_TRAVEL_DIRECTION,
        state.helicalView === 'rear' ? lookDistance : -lookDistance,
      );
    }

    const cameraTargetChanged = state.selectedId !== lastSelectedId
      || state.viewMode !== lastViewMode
      || state.orbitScope !== lastOrbitScope
      || state.helicalView !== lastHelicalView
      || state.cameraRevision !== lastCameraRevision
      || viewportRevision !== lastViewportRevision;
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
    galaxy.userData.depthDrift.value = rushingMode ? -forward * 2.4 : 0;
    galaxy.position.copy(camera.position);
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
    viewportRevision += 1;
  };
  window.addEventListener('resize', resize);
  animate();

  return {
    getCameraPose() {
      return {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        fov: camera.fov,
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

function BodyButton({ body, selectedId, onSelect, locale, language, nested = false }) {
  const parent = body.parent ? bodyMap[body.parent] : null;
  return (
    <button
      type="button"
      className={`body-row ${nested ? 'nested' : ''} ${selectedId === body.id ? 'selected' : ''}`}
      onClick={() => onSelect(body.id)}
    >
      <span className={`body-dot body-texture body-${body.id}`} style={{ backgroundImage: `url(${textureForBody(body.id)})` }} />
      <span>
        <strong>{language === 'zh' ? body.zh : body.name}</strong>
        <small>{language === 'zh' ? body.name : body.zh}</small>
      </span>
      <em>
        {body.type === 'moon' ? (language === 'zh' ? parent?.zh : parent?.name) : body.type === 'star' ? (language === 'zh' ? '中心' : 'center') : formatDistance(body.distanceKm)}
      </em>
    </button>
  );
}

function GalaxyFeatureButton({ feature, selectedId, language, onSelect }) {
  const image = galaxyFeatureImages[feature.id];
  return (
    <button
      type="button"
      className={`galaxy-feature-row ${feature.nested ? 'nested' : ''} ${selectedId === feature.id ? 'selected' : ''}`}
      onClick={() => onSelect(feature.id)}
    >
      <span
        className={`galaxy-feature-mark feature-${feature.group}`}
        style={{ backgroundImage: `url(${assetUrl(`/textures/galaxy/features/${image.file}`)})` }}
        aria-hidden="true"
      />
      <span>
        <strong>{language === 'zh' ? feature.zh : feature.name}</strong>
        <small>{language === 'zh' ? feature.name : feature.zh}</small>
      </span>
      <em>
        {language === 'zh' ? feature.kindZh : feature.kind}
        <small>{image.type[language === 'zh' ? 1 : 0]}</small>
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

function CopyIcon() {
  return (
    <svg className="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="19" r="2.4" />
      <path d="m8.2 10.9 7.6-4.7M8.2 13.1l7.6 4.7" />
    </svg>
  );
}

const SHARE_ROUTE_PREFIXES = {
  orbit: 'orbit',
  helical: 'artistic-spiral',
  follow: 'follow',
};

function readShareRoute(hash = window.location.hash) {
  const hashValue = hash.replace(/^#\/?/, '');
  const [route, query = ''] = hashValue.split('?');
  const params = new URLSearchParams(query);
  const segments = route.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return '';
    }
  });
  const fallback = {
    viewMode: DEFAULT_VIEW_MODE,
    orbitScope: DEFAULT_ORBIT_SCOPE,
    helicalView: DEFAULT_HELICAL_VIEW,
    selectedId: 'sun',
    selectedGalaxyFeature: 'solar-system',
    scaleMode: 'visual',
    speedIndex: DEFAULT_SPEED_INDEX,
    playing: true,
    autoFollow: true,
    cameraPose: null,
  };
  const speedIndex = simulationSpeeds.findIndex(({ label }) => label === params.get('speed'));
  const cameraValues = params.get('camera')?.split(',').map(Number);
  const cameraPose = cameraValues?.length === 7 && cameraValues.every(Number.isFinite)
    ? { position: cameraValues.slice(0, 3), target: cameraValues.slice(3, 6), fov: cameraValues[6] }
    : null;
  const sharedState = {
    speedIndex: speedIndex >= 0 ? speedIndex : fallback.speedIndex,
    playing: params.get('playing') !== 'false',
    autoFollow: cameraPose ? params.get('follow') === 'true' : true,
    cameraPose,
  };

  if (segments[0] === SHARE_ROUTE_PREFIXES.orbit) {
    const orbitScope = segments[1] === 'galaxy' ? 'galaxy' : 'solar';
    if (orbitScope === 'galaxy') {
      const selectedGalaxyFeature = galaxyFeatures.some(({ id }) => id === segments[2])
        ? segments[2]
        : fallback.selectedGalaxyFeature;
      return { ...fallback, ...sharedState, viewMode: 'orbit', orbitScope, selectedGalaxyFeature };
    }
    const selectedId = bodyMap[segments[2]] ? segments[2] : fallback.selectedId;
    return {
      ...fallback, ...sharedState,
      viewMode: 'orbit',
      selectedId,
      scaleMode: segments[3] === 'physical' ? 'physical' : 'visual',
    };
  }

  if (segments[0] === SHARE_ROUTE_PREFIXES.helical) {
    return {
      ...fallback, ...sharedState,
      viewMode: 'helical',
      helicalView: segments[1] === 'rear' ? 'rear' : 'front',
      selectedId: bodyMap[segments[2]] ? segments[2] : fallback.selectedId,
    };
  }

  if (segments[0] === SHARE_ROUTE_PREFIXES.follow) {
    return {
      ...fallback, ...sharedState,
      viewMode: 'follow',
      selectedId: bodyMap[segments[1]] ? segments[1] : fallback.selectedId,
    };
  }

  return fallback;
}

function createCurrentViewHash(state, cameraPose) {
  const baseHash = createShareHash(state);
  const params = new URLSearchParams({
    speed: simulationSpeeds[state.speedIndex]?.label ?? simulationSpeeds[DEFAULT_SPEED_INDEX].label,
    playing: String(state.playing),
    follow: String(state.autoFollow),
  });
  if (cameraPose) {
    const values = [...cameraPose.position, ...cameraPose.target, cameraPose.fov];
    params.set('camera', values.map((value) => Number(value.toFixed(4))).join(','));
  }
  return `${baseHash}?${params}`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for embedded browsers that expose Clipboard API without write permission.
    }
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

function createShareHash({
  viewMode,
  orbitScope,
  helicalView,
  selectedId,
  selectedGalaxyFeature,
  scaleMode,
}) {
  if (viewMode === 'orbit') {
    return orbitScope === 'galaxy'
      ? `#/orbit/galaxy/${encodeURIComponent(selectedGalaxyFeature)}`
      : `#/orbit/solar/${encodeURIComponent(selectedId)}/${scaleMode}`;
  }
  if (viewMode === 'follow') return `#/follow/${encodeURIComponent(selectedId)}`;
  return `#/artistic-spiral/${helicalView}/${encodeURIComponent(selectedId)}`;
}

function App() {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const sceneRef = useRef(null);
  const shareMenuRef = useRef(null);
  const shareMenuPanelRef = useRef(null);
  const initialShareRoute = useRef(null);
  if (!initialShareRoute.current) initialShareRoute.current = readShareRoute();
  const [selectedId, setSelectedId] = useState(initialShareRoute.current.selectedId);
  const [filter, setFilter] = useState('');
  const [speedIndex, setSpeedIndex] = useState(initialShareRoute.current.speedIndex);
  const [playing, setPlaying] = useState(initialShareRoute.current.playing);
  const [autoFollow, setAutoFollow] = useState(initialShareRoute.current.autoFollow);
  const [viewMode, setViewMode] = useState(initialShareRoute.current.viewMode);
  const [orbitScope, setOrbitScope] = useState(initialShareRoute.current.orbitScope);
  const [helicalView, setHelicalView] = useState(initialShareRoute.current.helicalView);
  const [scaleMode, setScaleMode] = useState(initialShareRoute.current.scaleMode);
  const [language, setLanguage] = useState(() => localStorage.getItem('solar-rush-language') || 'zh');
  const [detailTab, setDetailTab] = useState('overview');
  const [selectedGalaxyFeature, setSelectedGalaxyFeature] = useState(initialShareRoute.current.selectedGalaxyFeature);
  const [additionalDataOpen, setAdditionalDataOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [cameraPose, setCameraPose] = useState(initialShareRoute.current.cameraPose);
  const [shareNotice, setShareNotice] = useState('');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [telemetry, setTelemetry] = useState({
    simDays: 0,
    elapsedSeconds: 0,
    date: START_DATE,
    selectedPosition: new THREE.Vector3(),
    forward: 0,
    cameraDistance: 0,
  });

  const selectedBody = bodyMap[selectedId] ?? bodyMap.sun;
  const selectedGalacticStructure = galaxyFeatures.find((feature) => feature.id === selectedGalaxyFeature) ?? galaxyFeatures[0];
  const selectedGalacticDetails = galaxyFeatureDetails[selectedGalacticStructure.id];
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
  const selectedOrbitOrientation = selectedBody.type === 'planet'
    ? getPlanetOrbitOrientation(selectedBody.id, telemetry.date)
    : null;
  const selectedSpeed = simulationSpeeds[speedIndex];
  const selectedOrbitBody = selectedBody.orbitDays ? selectedBody : bodyMap.earth;
  const adaptiveOrbitDuration = THREE.MathUtils.clamp(
    60 * Math.sqrt(Math.abs(selectedOrbitBody.orbitDays || 365.256) / 365.256),
    60,
    180,
  );
  const secondsPerSecond = selectedSpeed.adaptiveOrbit
    ? Math.max(1, Math.abs(selectedOrbitBody.orbitDays || 365.256) * 86_400 / adaptiveOrbitDuration)
    : selectedSpeed.secondsPerSecond;
  const adaptiveSpeedLabel = selectedBody.orbitDays
    ? language === 'zh'
      ? `自适应公转 · ${selectedOrbitBody.zh}约${Math.round(adaptiveOrbitDuration)}s/周`
      : `Adaptive orbit · ${selectedOrbitBody.name} ~${Math.round(adaptiveOrbitDuration)}s/orbit`
    : language === 'zh'
      ? '太阳系演化 · 地球年基准'
      : 'Solar System evolution · Earth-year reference';
  const visibleBodies = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    return bodies.filter((body) => {
      if (!normalizedFilter) return true;
      return `${body.name} ${body.zh} ${body.type}`.toLowerCase().includes(normalizedFilter);
    });
  }, [filter]);
  const visibleIds = useMemo(() => new Set(visibleBodies.map((body) => body.id)), [visibleBodies]);
  const visibleGalaxyFeatures = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) return galaxyFeatures;
    return galaxyFeatures.filter((feature) => (
      `${feature.name} ${feature.zh} ${feature.kind} ${feature.kindZh}`.toLowerCase().includes(normalizedFilter)
    ));
  }, [filter]);
  const planets = useMemo(() => bodies.filter((body) => body.type === 'planet'), []);
  const switchViewMode = (mode) => {
    setCameraPose(null);
    setViewMode(mode);
    if (mode === 'orbit') setOrbitScope(DEFAULT_ORBIT_SCOPE);
    setAutoFollow(true);
    setCameraRevision((value) => value + 1);
    setMobileMenuOpen(false);
  };
  const shareState = {
    viewMode,
    orbitScope,
    helicalView,
    selectedId,
    selectedGalaxyFeature,
    scaleMode,
    speedIndex,
    playing,
    autoFollow,
  };
  const copyShareLink = async (includeCurrentView) => {
    const hash = includeCurrentView ? createCurrentViewHash(shareState, sceneRef.current?.getCameraPose()) : '';
    const url = new URL(`${window.location.pathname}${hash}`, window.location.origin).href;
    setShareMenuOpen(false);
    try {
      await copyToClipboard(url);
      setShareNotice(copy.copied);
    } catch {
      setShareNotice(copy.copyFailed);
    }
    window.setTimeout(() => setShareNotice(''), 1800);
  };
  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem('solar-rush-language', nextLanguage);
  };
  const timeline = useMemo(() => {
    const year = telemetry.date.getUTCFullYear();
    const yearStart = Date.UTC(year, 0, 1);
    const nextYearStart = Date.UTC(year + 1, 0, 1);
    const progress = ((telemetry.date.getTime() - yearStart) / (nextYearStart - yearStart)) * 100;
    const monthFormatter = new Intl.DateTimeFormat(locale, {
      month: language === 'zh' ? 'numeric' : 'short',
      timeZone: 'UTC',
    });
    const marks = Array.from({ length: 12 }, (_, index) => {
      const monthStart = Date.UTC(year, index, 1);
      return {
        label: language === 'zh'
          ? `${index + 1}月`
          : monthFormatter.format(new Date(monthStart)),
        left: `${((monthStart - yearStart) / (nextYearStart - yearStart)) * 100}%`,
        active: index === telemetry.date.getUTCMonth(),
      };
    });
    marks.push({
      label: language === 'zh' ? `${year + 1}年` : `${year + 1}`,
      left: '100%',
      active: false,
      yearEnd: true,
    });
    return {
      year,
      yearLabel: language === 'zh' ? `${year}年` : `${year}`,
      progress: Math.min(100, Math.max(0, progress)),
      marks,
    };
  }, [language, locale, telemetry.date]);

  stateRef.current = {
    selectedId,
    secondsPerSecond,
    playing,
    autoFollow,
    viewMode,
    orbitScope,
    helicalView,
    scaleMode,
    language,
    selectedGalaxyFeature,
    cameraRevision,
    cameraPose,
  };

  useEffect(() => {
    if (!shareMenuOpen) return undefined;
    const closeShareMenu = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown'
        && (shareMenuRef.current?.contains(event.target) || shareMenuPanelRef.current?.contains(event.target))) return;
      setShareMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeShareMenu);
    document.addEventListener('keydown', closeShareMenu);
    return () => {
      document.removeEventListener('pointerdown', closeShareMenu);
      document.removeEventListener('keydown', closeShareMenu);
    };
  }, [shareMenuOpen]);

  useEffect(() => {
    let lastAppliedHash = null;
    const applyLocationRoute = () => {
      if (lastAppliedHash === window.location.hash) return;
      lastAppliedHash = window.location.hash;
      const route = readShareRoute();
      setViewMode(route.viewMode);
      setOrbitScope(route.orbitScope);
      setHelicalView(route.helicalView);
      setSelectedId(route.selectedId);
      setSelectedGalaxyFeature(route.selectedGalaxyFeature);
      setScaleMode(route.scaleMode);
      setSpeedIndex(route.speedIndex);
      setPlaying(route.playing);
      setAutoFollow(route.autoFollow);
      setCameraPose(route.cameraPose);
      setCameraRevision((value) => value + 1);
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', applyLocationRoute);
    window.addEventListener('hashchange', applyLocationRoute);
    return () => {
      window.removeEventListener('popstate', applyLocationRoute);
      window.removeEventListener('hashchange', applyLocationRoute);
    };
  }, []);

  useEffect(() => {
    const nextHash = createShareHash({
      viewMode,
      orbitScope,
      helicalView,
      selectedId,
      selectedGalaxyFeature,
      scaleMode,
    });
    if (window.location.hash.split('?')[0] === nextHash) return;
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }, [viewMode, orbitScope, helicalView, selectedId, selectedGalaxyFeature, scaleMode]);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    let lastUiUpdate = -Infinity;
    let lastPlaying = stateRef.current.playing;
    const scene = buildSolarScene(mountRef.current, {
      getState: () => stateRef.current,
      onSelectBody: (id) => {
        setCameraPose(null);
        setSelectedId(id);
        setAutoFollow(true);
        setCameraRevision((value) => value + 1);
      },
      onSelectGalaxyFeature: (id) => {
        setSelectedGalaxyFeature(id);
      },
      onTick: (nextTelemetry) => {
        const now = performance.now();
        const playingChanged = stateRef.current.playing !== lastPlaying;
        const oneSimulationDayInterval = (DAY_MS / stateRef.current.secondsPerSecond);
        const updateInterval = Math.min(
          MAX_UI_TIME_UPDATE_INTERVAL_MS,
          Math.max(MIN_UI_TIME_UPDATE_INTERVAL_MS, oneSimulationDayInterval),
        );
        if (!playingChanged && now - lastUiUpdate < updateInterval) return;
        lastUiUpdate = now;
        lastPlaying = stateRef.current.playing;
        setTelemetry(nextTelemetry);
      },
    });
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  const showTimeOfDay = secondsPerSecond < 86_400;
  const beijingFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(showTimeOfDay && {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    hour12: false,
  });
  const utcFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(showTimeOfDay && {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    hour12: false,
  });

  return (
    <main className={`app-shell ${mobileMenuOpen ? 'mobile-menu-open' : ''} ${viewMode === 'orbit' && orbitScope === 'galaxy' ? 'galaxy-view' : ''}`}>
      <section ref={mountRef} className="space-stage" aria-label={language === 'zh' ? '3D 太阳系模拟器' : '3D Solar System Simulator'} />

      <header className={`top-bar ${shareMenuOpen ? 'share-menu-open' : ''}`}>
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
            <button type="button" aria-label={copy.reset} onClick={() => {
              setCameraPose(null);
              setAutoFollow(true);
              setCameraRevision((value) => value + 1);
            }}>↺</button>
            <button type="button" aria-label={playing ? copy.pause : copy.play} className={playing ? 'active' : ''} onClick={() => setPlaying((value) => !value)}>
              {playing ? 'Ⅱ' : '▶'}
            </button>
          </div>
          <label className="speed-control">
            <span>{copy.simSpeed}</span>
            <select value={speedIndex} onChange={(event) => setSpeedIndex(Number(event.target.value))}>
              {simulationSpeeds.map((item, index) => (
                <option value={index} key={item.label}>
                  {item.adaptiveOrbit
                    ? adaptiveSpeedLabel
                    : `${item.label} · ${item.multiplier}`}
                </option>
              ))}
            </select>
          </label>
          <div className="share-controls" ref={shareMenuRef}>
            <button
              type="button"
              className={shareMenuOpen ? 'active' : ''}
              aria-haspopup="menu"
              aria-expanded={shareMenuOpen}
              onClick={() => setShareMenuOpen((value) => !value)}
            >
              <ShareIcon />{copy.share}
            </button>
            {shareMenuOpen && createPortal(
              <>
                <div className="share-backdrop" aria-hidden="true" onClick={() => setShareMenuOpen(false)} />
                <div className="share-menu" ref={shareMenuPanelRef} role="menu" aria-label={copy.share}>
                  <button type="button" role="menuitem" onClick={() => copyShareLink(false)}>
                    <span className="share-option-icon"><CopyIcon /></span>
                    <span><strong>{copy.copySite}</strong><small>{copy.copySiteHint}</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => copyShareLink(true)}>
                    <span className="share-option-icon"><ShareIcon /></span>
                    <span><strong>{copy.copyView}</strong><small>{copy.copyViewHint}</small></span>
                  </button>
                </div>
              </>,
              document.body,
            )}
            {shareNotice && <span className="share-notice" role="status">{shareNotice}</span>}
          </div>
          <div className="language-switcher" aria-label="Language">
            <button type="button" className={language === 'zh' ? 'active' : ''} onClick={() => changeLanguage('zh')}>中</button>
            <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => changeLanguage('en')}>EN</button>
          </div>
        </div>
      </header>

      <aside className="left-panel glass-panel">
        {viewMode === 'orbit' && orbitScope === 'galaxy' ? (
          <>
            <div className="panel-title">
              <span>{language === 'zh' ? '银河系结构' : 'Galactic Structures'}</span>
              <strong>{galaxyFeatures.length}</strong>
            </div>
            <label className="search-box">
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={language === 'zh' ? '搜索旋臂或结构' : 'Search arms or structures'}
              />
            </label>
            {['core', 'arms', 'locations'].map((group) => {
              const features = visibleGalaxyFeatures.filter((feature) => feature.group === group);
              if (features.length === 0) return null;
              return (
                <div className="body-group" key={group}>
                  <h2>{group === 'locations'
                    ? (language === 'zh' ? '太阳邻域系统' : 'Solar Neighborhood Systems')
                    : group === 'core'
                      ? (language === 'zh' ? '银心结构' : 'Galactic Core')
                      : (language === 'zh' ? '旋臂与支臂' : 'Arms & Spurs')}</h2>
                  {features.map((feature) => (
                    <GalaxyFeatureButton
                      key={feature.id}
                      feature={feature}
                      selectedId={selectedGalaxyFeature}
                      language={language}
                      onSelect={(id) => {
                        setSelectedGalaxyFeature(id);
                      }}
                    />
                  ))}
                </div>
              );
            })}
            {visibleGalaxyFeatures.length === 0 && <p className="empty-state">{copy.noMatches}</p>}
            <p className="galaxy-list-note">
              {language === 'zh'
                ? '邻域系统为代表性样本，并非完整目录；在银河全景尺度共用太阳邻域定位点。星座是从地球观察定义的天区，并非银河系内的实体区域。'
                : 'Neighborhood systems are representative, not a complete catalog; they share one locator at Galaxy scale. Constellations are Earth-sky regions, not physical Galactic structures.'}
            </p>
          </>
        ) : (
          <>
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
              setCameraPose(null);
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
                  <BodyButton body={planet} selectedId={selectedId} language={language} locale={locale} onSelect={(id) => {
                    setCameraPose(null);
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
                        setCameraPose(null);
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
          </>
        )}
      </aside>

      <aside className="right-panel glass-panel">
        {viewMode === 'orbit' && orbitScope === 'galaxy' ? (
          <div className="galaxy-detail-panel">
            <div className="body-hero galaxy-hero">
              <span
                className={`galaxy-detail-symbol feature-${selectedGalacticStructure.group}`}
                style={{ backgroundImage: `url(${assetUrl(`/textures/galaxy/features/${galaxyFeatureImages[selectedGalacticStructure.id].file}`)})` }}
                aria-hidden="true"
              />
              <div>
                <strong>{language === 'zh' ? selectedGalacticStructure.zh : selectedGalacticStructure.name}</strong>
                <small>{language === 'zh' ? selectedGalacticStructure.name : selectedGalacticStructure.zh}</small>
              </div>
            </div>
            <div className="selected-heading">
              <span>{language === 'zh' ? selectedGalacticStructure.kindZh : selectedGalacticStructure.kind}</span>
              <h2>{language === 'zh' ? selectedGalacticStructure.zh : selectedGalacticStructure.name}</h2>
              <p>{selectedGalacticDetails.summary[language === 'zh' ? 1 : 0]}</p>
              <div className="science-status">
                <span>{selectedGalacticStructure.group === 'locations'
                  ? (language === 'zh' ? '银河尺度定位' : 'GALAXY-SCALE LOCATOR')
                  : (language === 'zh' ? '银河系结构模型' : 'GALACTIC STRUCTURE MODEL')}</span>
                <small>{selectedGalacticStructure.group === 'locations'
                  ? (language === 'zh'
                    ? '邻近恒星系统在银河全景比例下不可分辨，共用太阳邻域锚点；距离数据见各自资料来源。'
                    : 'Nearby stellar systems are unresolved at Galaxy scale and share the Solar Neighborhood anchor; distances follow the cited sources.')
                  : (language === 'zh'
                    ? '标签锚点参考 ESA/Gaia 艺术重建图；旋臂边界与分类仍依赖模型。'
                    : 'Label anchors reference the ESA/Gaia artist impression; arm boundaries and classifications remain model-dependent.')}</small>
              </div>
            </div>
            <div className="stat-list galaxy-stat-list">
              {(selectedGalacticDetails.facts
                ? (language === 'zh' ? selectedGalacticDetails.facts : selectedGalacticDetails.factsEn)
                : [
                  [language === 'zh' ? '结构分类' : 'Classification', language === 'zh' ? selectedGalacticStructure.kindZh : selectedGalacticStructure.kind],
                  [language === 'zh' ? '空间关系' : 'Spatial relation', selectedGalacticDetails.relation[language === 'zh' ? 1 : 0]],
                  [language === 'zh' ? '定位依据' : 'Position basis', language === 'zh' ? 'ESA/Gaia 标注模型图中的近似锚点' : 'Approximate anchor from ESA/Gaia annotated model view'],
                ]).map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="detail-copy galaxy-source-note">
              <p>{language === 'zh'
                ? (selectedGalacticStructure.group === 'locations'
                  ? '这是银河全景中的定位表达，不是邻近恒星系统之间的比例位置图。'
                  : '这里显示的是银河尺度结构，不代表旋臂具有清晰硬边界，也不等同于完整三维恒星分布。')
                : (selectedGalacticStructure.group === 'locations'
                  ? 'This is a locator on a Galaxy-wide map, not a to-scale chart of separations between nearby stellar systems.'
                  : 'These are Galaxy-scale structures; spiral arms have no sharp physical edges and this is not a complete 3D stellar map.')}</p>
              <a
                href={selectedGalacticDetails.source ?? 'https://www.esa.int/ESA_Multimedia/Images/2023/12/Top-down_view_of_the_Milky_Way_annotated'}
                target="_blank"
                rel="noreferrer"
              >
                {language === 'zh' ? '科学资料来源' : 'Scientific source'} ↗
              </a>
            </div>
          </div>
        ) : (
          <>
        <div className="body-hero">
          <span className={`body-preview body-texture body-${selectedBody.id}`} style={{ backgroundImage: `url(${textureForBody(selectedBody.id)})` }} />
          <div>
            <strong>{language === 'zh' ? selectedBody.zh : selectedBody.name}</strong>
            <small>{language === 'zh' ? selectedBody.name : selectedBody.zh}</small>
          </div>
        </div>
        <div className="selected-heading">
          <span>{selectedBody.type.toUpperCase()}</span>
          <h2>{language === 'zh' ? selectedBody.zh : selectedBody.name}</h2>
          <p>
            {viewMode === 'orbit' && orbitScope === 'galaxy'
              ? copy.galaxyDescription
              : copy[`${viewMode}Description`]}
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
            <strong>{viewMode === 'orbit' && orbitScope === 'galaxy'
              ? copy.galaxyView
              : copy[viewMode === 'orbit' ? 'orbitView' : viewMode === 'helical' ? 'spiralView' : 'followView']}</strong>
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
            {selectedOrbitOrientation && (
              <>
                <div>
                  <span>{copy.orbitInclination}</span>
                  <strong>{formatFixed(THREE.MathUtils.radToDeg(selectedOrbitOrientation.inclination), 4)}°</strong>
                </div>
                <div>
                  <span>{copy.ascendingNode}</span>
                  <strong>{formatFixed(THREE.MathUtils.radToDeg(selectedOrbitOrientation.ascendingNode), 4)}°</strong>
                </div>
              </>
            )}
            <div><span>{copy.scaleModel}</span><strong>{scaleMode === 'physical' ? 'Unified physical ratio' : 'Compressed visual scale'}</strong></div>
            <div><span>{copy.catalogue}</span><strong>Procedural Milky Way + Hipparcos bright subset / J2000</strong></div>
            <div><span>{copy.lighting}</span><strong>Geometric eclipse + ring shadows</strong></div>
          </div>
        )}

        <div className="follow-control">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={scaleMode === 'physical'}
              onChange={(event) => {
                setCameraPose(null);
                setScaleMode(event.target.checked ? 'physical' : 'visual');
                setViewMode('orbit');
                setOrbitScope('solar');
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
          </>
        )}
      </aside>

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
        {viewMode === 'orbit' && (
          <div className="view-subviews" aria-label={copy.orbitView}>
            <button
              type="button"
              className={orbitScope === 'solar' ? 'active' : ''}
              onClick={() => {
                setCameraPose(null);
                setOrbitScope('solar');
                setCameraRevision((value) => value + 1);
              }}
            >
              {copy.solarSystemView}
            </button>
            <button
              type="button"
              className={orbitScope === 'galaxy' ? 'active' : ''}
              onClick={() => {
                setCameraPose(null);
                setOrbitScope('galaxy');
                setScaleMode('visual');
                setAutoFollow(true);
                setCameraRevision((value) => value + 1);
              }}
            >
              {copy.galaxyView}
            </button>
          </div>
        )}
        {viewMode === 'helical' && (
          <div className="view-subviews" aria-label={copy.spiralView}>
            <button
              type="button"
              className={helicalView === 'front' ? 'active' : ''}
              onClick={() => {
                setCameraPose(null);
                setHelicalView('front');
                setAutoFollow(true);
                setCameraRevision((value) => value + 1);
              }}
            >
              {copy.spiralFrontView}
            </button>
            <button
              type="button"
              className={helicalView === 'rear' ? 'active' : ''}
              onClick={() => {
                setCameraPose(null);
                setHelicalView('rear');
                setAutoFollow(true);
                setCameraRevision((value) => value + 1);
              }}
            >
              {copy.spiralRearView}
            </button>
          </div>
        )}
      </div>

      {viewMode === 'orbit' && orbitScope === 'galaxy' && (
        <section className="galaxy-science-panel" aria-label={copy.galaxyView}>
          <span>{copy.reconstruction}</span>
          <strong>{copy.sunGalacticRadius}: 8.2 kpc · 26,600 ly</strong>
          <small>{copy.mapBoundary}</small>
        </section>
      )}

      <footer className="bottom-bar">
        <div className="timeline">
          <span className="timeline-summary">
            <strong>{timeline.yearLabel}</strong>
            <small>{copy.elapsed} {formatElapsed(telemetry.elapsedSeconds)}</small>
          </span>
          <div className="track" key={timeline.year}>
            <div className="tick-rail">
              {timeline.marks.map((mark, index) => (
                <span
                  key={mark.label}
                  className={index % 3 === 0 || mark.yearEnd ? 'major' : ''}
                  style={{ left: mark.left }}
                />
              ))}
            </div>
            <i style={{ width: `${timeline.progress}%` }} />
            <b style={{ left: `${timeline.progress}%` }} />
            <div className="timeline-labels">
              {timeline.marks.map((mark) => (
                <span
                  key={mark.label}
                  className={`${mark.active ? 'active' : ''} ${mark.yearEnd ? 'year-end' : ''}`}
                  style={{ left: mark.left }}
                >
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
