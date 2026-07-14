const DAY_MS = 86_400_000;
const MAX_UI_TIME_UPDATE_INTERVAL_MS = 1_000;
const MIN_UI_TIME_UPDATE_INTERVAL_MS = 16;
const START_DATE = new Date();
const assetUrl = path => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const simulationSpeeds = [{
  label: 'Adaptive orbit',
  adaptiveOrbit: true
}, {
  label: '1s/s',
  multiplier: '1×',
  secondsPerSecond: 1
}, {
  label: '1m/s',
  multiplier: '60×',
  secondsPerSecond: 60
}, {
  label: '1h/s',
  multiplier: '3,600×',
  secondsPerSecond: 3600
}, {
  label: '1d/s',
  multiplier: '86,400×',
  secondsPerSecond: 86400
}, {
  label: '7d/s',
  multiplier: '604,800×',
  secondsPerSecond: 604_800
}, {
  label: '30d/s',
  multiplier: '2,592,000×',
  secondsPerSecond: 2_592_000
}, {
  label: '1y/s',
  multiplier: '31,557,600×',
  secondsPerSecond: 31_557_600
}, {
  label: '10y/s',
  multiplier: '315,576,000×',
  secondsPerSecond: 315_576_000
}];
const DEFAULT_SPEED_INDEX = simulationSpeeds.findIndex(({
  adaptiveOrbit
}) => adaptiveOrbit);
const DEFAULT_VIEW_MODE = 'helical';
const DEFAULT_ORBIT_SCOPE = 'solar';
const DEFAULT_HELICAL_VIEW = 'front';
const viewModeLabels = {
  orbit: 'Orbit',
  helical: 'Artistic Spiral',
  follow: 'Follow'
};
const viewModeDescriptions = {
  orbit: '俯视完整轨道结构，适合比较行星位置与系统尺度。',
  helical: '统一 J2000 黄道坐标；银道面—黄道面夹角 60.19°，各行星光迹遵循其瞬时 VSOP 轨道面。',
  follow: '跟随选中天体，仅突出它的主轨迹与局部系统。'
};
const ui = {
  en: {
    celestialBodies: 'Celestial Bodies',
    search: 'Search bodies',
    star: 'Star',
    planets: 'Planets',
    comets: 'Comets',
    noMatches: 'No matching celestial bodies.',
    beijingTime: 'Beijing Time',
    lunar: 'Chinese Lunar',
    simSpeed: 'Sim Speed',
    reset: 'Reset view',
    pause: 'Pause',
    play: 'Play',
    overview: 'Overview',
    physical: 'Physical',
    composition: 'Composition',
    atmosphere: 'Atmosphere',
    radius: 'Radius',
    distance: 'Distance to Parent',
    semiMajorAxis: 'Orbital Semi-major Axis',
    orbitPeriod: 'Orbit Period',
    rotationPeriod: 'Rotation Period',
    velocity: 'Orbital Velocity',
    perihelionVelocity: 'Perihelion Velocity',
    axialTilt: 'Axial Tilt',
    observation: 'Observation Mode',
    orbitInclination: 'Orbital Inclination',
    ascendingNode: 'Ascending Node',
    center: 'System barycenter',
    days: 'days',
    hours: 'hours',
    additional: 'Additional Data',
    gravity: 'Surface Gravity',
    escape: 'Escape Velocity',
    mass: 'Mass',
    moons: 'Moons',
    magnitude: 'Visual Magnitude',
    reference: 'Reference Frame',
    positionModel: 'Position Model',
    scaleModel: 'Scale Model',
    catalogue: 'Star Catalogue',
    lighting: 'Lighting',
    source: 'NASA source',
    trueScale: 'True physical scale (1 unit = 50M km)',
    keepCentered: 'Keep selected body centered',
    orbitView: 'Orbit View',
    spiralView: 'Artistic Spiral',
    followView: 'Follow View',
    elapsed: 'Elapsed',
    solarSystemView: 'Solar System',
    galaxyView: 'Milky Way',
    spiralFrontView: 'Front View',
    spiralRearView: 'Rear View',
    reconstruction: 'ESA/Gaia data-informed model view',
    sunGalacticRadius: 'Sun–center distance',
    mapBoundary: 'Data-informed artist impression, not an external photograph or direct density map',
    drift: 'Forward drift',
    wheel: 'Wheel',
    zoom: 'Zoom',
    leftClick: 'Left drag',
    rotate: 'Rotate',
    rightClick: 'Right drag',
    pan: 'Pan',
    select: 'Select',
    focusBody: 'Focus body',
    share: 'Share',
    copySite: 'Site link',
    copyView: 'Current view',
    copySiteHint: 'Open Solar Rush from its default view',
    copyViewHint: 'Keep this body, speed and camera angle',
    copied: 'Link copied',
    copyFailed: 'Copy failed',
    inRange: 'EPHEMERIS IN RANGE',
    outRange: 'EPHEMERIS OUT OF RANGE',
    physicalScale: 'Unified scale: 1 scene unit = 50 million km.',
    visualScale: 'Visual scale: sizes and distances are compressed separately.',
    orbitDescription: 'Top-down system view with the main asteroid belt, Kuiper Belt, and the smooth JPL#75 osculating ellipse of 1P/Halley.',
    galaxyDescription: 'ESA/Gaia data-informed artist impression. The Solar System lies in the Orion Spur, about 26,600 light-years from the Galactic center.',
    helicalDescription: 'Unified J2000 ecliptic frame: Galactic plane–ecliptic 60.19°; Sgr A* λ 266.8517°, β −5.6077°; present Galactocentric velocity λ 342.2°, β 61.0°. 1P/Halley follows the smooth JPL#75 osculating ellipse; trail scale is compressed.',
    followDescription: 'Follow the selected body and emphasize its local system and trajectory.'
  },
  zh: {
    celestialBodies: '天体列表',
    search: '搜索天体',
    star: '恒星',
    planets: '行星',
    comets: '彗星',
    noMatches: '没有匹配的天体。',
    beijingTime: '北京时间',
    lunar: '中国农历',
    simSpeed: '模拟速度',
    reset: '重置视角',
    pause: '暂停',
    play: '播放',
    overview: '概览',
    physical: '物理参数',
    composition: '组成',
    atmosphere: '大气',
    radius: '半径',
    distance: '距母天体',
    semiMajorAxis: '轨道半长轴',
    orbitPeriod: '公转周期',
    rotationPeriod: '自转周期',
    velocity: '轨道速度',
    perihelionVelocity: '近日点速度',
    axialTilt: '轴倾角',
    observation: '观察模式',
    center: '系统质心',
    days: '天',
    hours: '小时',
    orbitInclination: '轨道倾角',
    ascendingNode: '升交点经度',
    additional: '更多数据',
    gravity: '表面重力',
    escape: '逃逸速度',
    mass: '质量',
    moons: '卫星数',
    magnitude: '视星等',
    reference: '参考系',
    positionModel: '位置模型',
    scaleModel: '比例模型',
    catalogue: '恒星目录',
    lighting: '光照模型',
    source: 'NASA 资料来源',
    trueScale: '真实物理比例（1 单位 = 5000 万 km）',
    keepCentered: '保持选中天体居中',
    orbitView: '轨道视图',
    spiralView: '艺术螺旋',
    followView: '跟随视图',
    elapsed: '已运行',
    solarSystemView: '太阳系',
    galaxyView: '银河系',
    spiralFrontView: '前方回望',
    spiralRearView: '后方前望',
    reconstruction: 'ESA/Gaia 数据辅助模型图',
    sunGalacticRadius: '太阳—银心距离',
    mapBoundary: '基于数据的艺术重建图，并非系外实拍或直接恒星密度图',
    drift: '前进距离',
    wheel: '滚轮',
    zoom: '缩放',
    leftClick: '左键拖动',
    rotate: '旋转',
    rightClick: '右键拖动',
    pan: '平移',
    select: '选择',
    focusBody: '聚焦天体',
    share: '分享',
    copySite: '站点链接',
    copyView: '当前视角',
    copySiteHint: '从默认视角打开 Solar Rush',
    copyViewHint: '保留当前天体、速度与相机角度',
    copied: '链接已复制',
    copyFailed: '复制失败',
    inRange: '星历有效范围内',
    outRange: '超出星历有效范围',
    physicalScale: '统一比例：1 场景单位 = 5000 万 km。',
    visualScale: '视觉比例：尺寸与距离分别压缩。',
    orbitDescription: '俯视完整轨道结构，包含主小行星带、柯伊伯带与哈雷彗星平滑的 JPL#75 瞬时椭圆轨道。',
    galaxyDescription: '基于 ESA/Gaia 数据制作的艺术重建俯视图：太阳系位于猎户支臂，距银心约 2.66 万光年。',
    helicalDescription: '统一 J2000 黄道坐标：银道面—黄道面 60.19°；Sgr A* 黄经 266.8517°、黄纬 −5.6077°；当前银心速度方向为黄经 342.2°、黄纬 61.0°。哈雷彗星沿平滑的 JPL#75 瞬时逆行椭圆运动，光迹尺度经过压缩。',
    followDescription: '跟随选中天体，仅突出它的主轨迹与局部系统。'
  }
};

export { DAY_MS, MAX_UI_TIME_UPDATE_INTERVAL_MS, MIN_UI_TIME_UPDATE_INTERVAL_MS, START_DATE, assetUrl, simulationSpeeds, DEFAULT_SPEED_INDEX, DEFAULT_VIEW_MODE, DEFAULT_ORBIT_SCOPE, DEFAULT_HELICAL_VIEW, viewModeLabels, viewModeDescriptions, ui };
