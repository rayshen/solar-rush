// `map` values are approximate scene anchors transcribed from ESA/Gaia's
// annotated artist impression. Only the Solar System radius is numerically
// calibrated (8.2 kpc); arm anchors do not represent measured boundaries.
const galaxyFeatures = [{
  id: 'galactic-center',
  group: 'core',
  name: 'Galactic Center',
  zh: '银河系中心',
  kind: 'Galactic location',
  kindZh: '银河系中心位置',
  map: [0, 0]
}, {
  id: 'sgr-a',
  group: 'core',
  name: 'Sagittarius A*',
  zh: '人马座 A*',
  kind: 'Supermassive black hole',
  kindZh: '超大质量黑洞',
  map: [0, 0],
  nested: true
}, {
  id: 'nuclear-cluster',
  group: 'core',
  name: 'Nuclear Star Cluster',
  zh: '核星团',
  kind: 'Dense central star cluster',
  kindZh: '致密中央星团',
  map: [0, 0],
  nested: true
}, {
  id: 'bulge',
  group: 'core',
  name: 'Galactic Bulge',
  zh: '银河核球',
  kind: 'Dense stellar structure',
  kindZh: '致密恒星结构',
  map: [0, 0],
  nested: true
}, {
  id: 'bar',
  group: 'core',
  name: 'Central Bar',
  zh: '中央棒',
  kind: 'Barred structure',
  kindZh: '棒状结构',
  map: [3, -20]
}, {
  id: 'perseus',
  group: 'arms',
  name: 'Perseus Arm',
  zh: '英仙臂',
  kind: 'Major spiral arm',
  kindZh: '主要旋臂',
  map: [-44, 37]
}, {
  id: 'outer',
  group: 'arms',
  name: 'Outer Arm',
  zh: '外臂',
  kind: 'Outer spiral arm',
  kindZh: '外侧旋臂',
  map: [-62, 45]
}, {
  id: 'orion',
  group: 'arms',
  name: 'Orion Spur',
  zh: '猎户支臂',
  kind: 'Local spur · Sun',
  kindZh: '本地支臂 · 太阳',
  map: [-6, 54]
}, {
  id: 'sagittarius-carina',
  group: 'arms',
  name: 'Sagittarius–Carina Arm',
  zh: '人马—船底臂',
  kind: 'Spiral arm',
  kindZh: '旋臂',
  map: [50, 47]
}, {
  id: 'scutum-centaurus',
  group: 'arms',
  name: 'Scutum–Centaurus Arm',
  zh: '盾牌—半人马臂',
  kind: 'Major spiral arm',
  kindZh: '主要旋臂',
  map: [44, 31]
}, {
  id: 'norma',
  group: 'arms',
  name: 'Norma Arm',
  zh: '矩尺臂',
  kind: 'Inner spiral arm',
  kindZh: '内侧旋臂',
  map: [31, 19]
}, {
  id: 'near-3kpc',
  group: 'arms',
  name: 'Near 3 kpc Arm',
  zh: '近 3 kpc 臂',
  kind: 'Inner gas arm',
  kindZh: '内侧气体臂',
  map: [16, 14]
}, {
  id: 'far-3kpc',
  group: 'arms',
  name: 'Far 3 kpc Arm',
  zh: '远 3 kpc 臂',
  kind: 'Inner gas arm',
  kindZh: '内侧气体臂',
  map: [-15, -9]
}, {
  id: 'solar-neighborhood',
  group: 'locations',
  name: 'Solar Neighborhood',
  zh: '太阳邻域',
  kind: 'Local stellar neighborhood',
  kindZh: '本地恒星邻域',
  map: [4.7, 53.1],
  suppressMapLabel: true
}, {
  id: 'proxima-centauri',
  group: 'locations',
  name: 'Proxima Centauri System',
  zh: '比邻星系统',
  kind: 'Nearest known exoplanet system',
  kindZh: '最近的已知系外行星系统',
  map: [4.7, 53.1],
  nested: true
}, {
  id: 'trappist-1',
  group: 'locations',
  name: 'TRAPPIST-1 System',
  zh: 'TRAPPIST-1 系统',
  kind: 'Seven-planet system',
  kindZh: '七行星系统',
  map: [4.7, 53.1],
  nested: true
}, {
  id: '55-cancri',
  group: 'locations',
  name: '55 Cancri System',
  zh: '巨蟹座 55 系统',
  kind: 'Five-planet system',
  kindZh: '五行星系统',
  map: [4.7, 53.1],
  nested: true
}, {
  id: 'toi-700',
  group: 'locations',
  name: 'TOI-700 System',
  zh: 'TOI-700 系统',
  kind: 'Nearby M-dwarf system',
  kindZh: '邻近 M 型矮星系统',
  map: [4.7, 53.1],
  nested: true
}, {
  id: 'hr-8799',
  group: 'locations',
  name: 'HR 8799 System',
  zh: 'HR 8799 系统',
  kind: 'Directly imaged system',
  kindZh: '直接成像行星系统',
  map: [4.7, 53.1],
  nested: true
}, {
  id: 'solar-system',
  group: 'locations',
  name: 'Solar System',
  zh: '太阳系',
  kind: 'Our planetary system',
  kindZh: '我们的行星系统',
  map: [4.7, 53.1],
  nested: true
}];
const galaxyFeatureImages = {
  'galactic-center': {
    file: 'bulge-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  'sgr-a': {
    file: 'sagittarius-a-eht.jpg',
    type: ['Observation · EHT', '观测图 · EHT']
  },
  'nuclear-cluster': {
    file: 'nuclear-star-cluster-hubble.jpg',
    type: ['Infrared observation · Hubble', '红外观测 · Hubble']
  },
  bulge: {
    file: 'bulge-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  bar: {
    file: 'bar-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  perseus: {
    file: 'perseus-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  outer: {
    file: 'outer-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  orion: {
    file: 'orion-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  'sagittarius-carina': {
    file: 'sagittarius-carina-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  'scutum-centaurus': {
    file: 'scutum-centaurus-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  norma: {
    file: 'norma-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  'near-3kpc': {
    file: 'near-3kpc-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  'far-3kpc': {
    file: 'far-3kpc-model.jpg',
    type: ['Model view · ESA/Gaia', '模型图 · ESA/Gaia']
  },
  'solar-neighborhood': {
    file: 'orion-model.jpg',
    type: ['Galaxy-scale locator', '银河尺度定位图']
  },
  'proxima-centauri': {
    file: 'orion-model.jpg',
    type: ['Unresolved at this scale', '当前尺度不可分辨']
  },
  'trappist-1': {
    file: 'orion-model.jpg',
    type: ['Unresolved at this scale', '当前尺度不可分辨']
  },
  '55-cancri': {
    file: 'orion-model.jpg',
    type: ['Unresolved at this scale', '当前尺度不可分辨']
  },
  'toi-700': {
    file: 'orion-model.jpg',
    type: ['Unresolved at this scale', '当前尺度不可分辨']
  },
  'hr-8799': {
    file: 'orion-model.jpg',
    type: ['Unresolved at this scale', '当前尺度不可分辨']
  },
  'solar-system': {
    file: 'orion-model.jpg',
    type: ['Calibrated model position · ESA/Gaia', '校准模型位置 · ESA/Gaia']
  }
};
const galaxyFeatureDetails = {
  'galactic-center': {
    summary: ['The central region of the Milky Way, whose dynamical center is associated with Sagittarius A* and which contains nested structures at radically different scales.', '银河系中央区域；其动力学中心与人马座 A* 对应，并包含尺度差异巨大的嵌套结构。'],
    facts: [['动力学中心', '由 Sgr A* 观测位置锚定'], ['坐标约定', '银河坐标原点 l=0°、b=0°，与 Sgr A* 相差约 0.07°'], ['内部结构', 'Sgr A*、核星团、核球'], ['地图尺度', '在全银河视图中无法按比例分辨']],
    factsEn: [['Dynamical center', 'Anchored to the observed Sgr A* position'], ['Coordinate convention', 'Galactic origin l=0°, b=0° differs from Sgr A* by ~0.07°'], ['Nested structures', 'Sgr A*, nuclear cluster, bulge'], ['Map scale', 'Not resolvable to scale in a Galaxy-wide view']],
    source: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/'
  },
  'sgr-a': {
    summary: ['The compact radio source associated with the Milky Way’s central supermassive black hole.', '银河系中心超大质量黑洞对应的致密射电源。'],
    facts: [['估算质量', '约 400 万个太阳质量'], ['物理角色', '银河系动力学中心'], ['ICRS J2000', '赤经 266.4168° · 赤纬 −29.0078°'], ['J2000 黄道坐标', '黄经 266.8517° · 黄纬 −5.6077°'], ['地图表达', '定位符号，非比例实体']],
    factsEn: [['Estimated mass', '~4 million solar masses'], ['Physical role', 'Galactic dynamical center'], ['ICRS J2000', 'RA 266.4168° · Dec −29.0078°'], ['J2000 ecliptic', 'λ 266.8517° · β −5.6077°'], ['Map representation', 'Locator symbol; not to scale']],
    source: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/'
  },
  'nuclear-cluster': {
    summary: ['The Milky Way’s densest star cluster, surrounding Sagittarius A* and containing millions of stars.', '银河系最致密的星团，环绕人马座 A*，包含数百万颗恒星。'],
    facts: [['观测范围', 'Hubble 红外拼接图约 50 光年'], ['已分辨恒星', '超过 50 万颗'], ['估计总量', '约 1000 万颗更暗恒星']],
    factsEn: [['Observed field', 'Hubble infrared mosaic: ~50 ly'], ['Resolved stars', 'More than 500,000'], ['Estimated population', '~10 million fainter stars']],
    source: 'https://science.nasa.gov/asset/hubble/milky-way-nuclear-star-cluster/'
  },
  bulge: {
    summary: ['The vertically thick, box/peanut-shaped central stellar component associated with the Milky Way’s bar.', '与银河系中央棒相关、在侧视方向呈盒状/花生状的厚恒星结构。'],
    facts: [['恒星数量', '约 100 亿颗，以老年红色恒星为主'], ['形态', '盒状/花生状，并含 X 形子结构'], ['尺度', '半长约 1 万光年；边界渐变']],
    factsEn: [['Population', '~10 billion, mainly older red stars'], ['Morphology', 'Box/peanut-shaped with an X-shaped substructure'], ['Scale', 'Half-length ~10,000 ly; gradual boundary']],
    source: 'https://sci.esa.int/web/gaia/-/58206-anatomy-of-the-milky-way'
  },
  bar: {
    summary: ['The elongated stellar structure crossing the central bulge; its length and orientation remain model-dependent.', '穿过核球的拉长恒星结构；长度和方向仍依赖具体模型。'],
    facts: [['结构类型', '棒旋星系中央恒星棒'], ['Gaia 结果', '方向比早期模型更倾斜'], ['不确定性', '长度与端点并非精确边界']],
    factsEn: [['Structure', 'Central stellar bar'], ['Gaia result', 'More inclined than earlier models'], ['Uncertainty', 'Length and endpoints are model-dependent']],
    source: 'https://www.esa.int/ESA_Multimedia/Images/2023/12/Top-down_view_of_the_Milky_Way_annotated'
  },
  perseus: {
    summary: ['A prominent outer stellar arm and one of the Milky Way’s major arms in the two-major-arm interpretation.', '显著的外侧恒星臂；在“两条主要恒星臂”模型中属于主臂。'],
    relation: ['Outside the Orion Spur', '猎户支臂外侧']
  },
  outer: {
    summary: ['A distant outer spiral feature whose far-side geometry remains comparatively uncertain.', '遥远的外侧旋臂结构，其银河背面几何形态仍有较大不确定性。'],
    relation: ['Outer Galactic disk', '银河盘外侧']
  },
  orion: {
    summary: ['The local spur containing the Sun, between the Sagittarius–Carina and Perseus arms.', '包含太阳的本地支臂，位于人马—船底臂与英仙臂之间。'],
    relation: ['Sun at 8.2 kpc from center', '太阳距银心 8.2 kpc']
  },
  'sagittarius-carina': {
    summary: ['A gas-rich spiral feature with active star-forming regions, also named Carina–Sagittarius when followed in the opposite direction.', '富含气体和恒星形成区的旋臂；按相反方向命名时也称“船底—人马臂”。'],
    relation: ['Inside the Orion Spur', '猎户支臂内侧']
  },
  'scutum-centaurus': {
    summary: ['A prominent stellar arm commonly called Scutum–Centaurus; the ESA model labels its mapped continuation as the Centaurus Arm.', '通常称为盾牌—半人马臂的显著恒星臂；ESA 模型将图中延伸段标为“半人马臂”。'],
    relation: ['Prominent stellar arm', '显著恒星臂']
  },
  norma: {
    summary: ['An inner spiral feature traced mainly by gas and young star-forming regions.', '主要由气体和年轻恒星形成区追踪的内侧旋臂结构。'],
    relation: ['Inner Galactic disk', '银河盘内侧']
  },
  'near-3kpc': {
    summary: ['A rapidly expanding inner gas feature near the central bar, not a conventional outer stellar arm.', '中央棒附近快速膨胀的内侧气体结构，并非常规外侧恒星臂。'],
    relation: ['Inner gas structure', '内侧气体结构']
  },
  'far-3kpc': {
    summary: ['The far-side counterpart to the Near 3 kpc Arm, identified through radio observations of Galactic gas.', '近 3 kpc 臂在银心远侧的对应结构，由银河气体射电观测识别。'],
    relation: ['Far-side inner gas structure', '远侧内层气体结构']
  },
  'solar-neighborhood': {
    summary: ['The local region around the Sun. The representative planetary systems below are grouped at one locator because their separations cannot be resolved on a Galaxy-wide map.', '太阳周围的本地空间区域。下列代表性行星系统在银河全景尺度无法分开，因此共用一个定位点。'],
    facts: [['地图定位', '猎户支臂内，距银心约 8.2 kpc'], ['当前图比例', '约 1 场景单位 = 500 光年'], ['表达限制', '邻近系统不按像素级间距分散绘制']],
    factsEn: [['Map location', 'Orion Spur, ~8.2 kpc from center'], ['Current map scale', '~1 scene unit = 500 ly'], ['Representation', 'Nearby systems are not spread using false pixel-scale offsets']],
    source: 'https://science.nasa.gov/exoplanets/big-questions/'
  },
  'proxima-centauri': {
    summary: ['The nearest known exoplanet system, around Proxima Centauri, the closest star to the Sun and a member of the Alpha Centauri triple system.', '距离太阳最近的已知系外行星系统；其宿主比邻星是离太阳最近的恒星，也是南门二三星系统成员。'],
    facts: [['距太阳', '约 4.24 光年'], ['宿主恒星', '红矮星 · 南门二三星系统成员'], ['代表行星', '比邻星 b']],
    factsEn: [['Distance from Sun', '~4.24 ly'], ['Host star', 'Red dwarf · Alpha Centauri triple member'], ['Representative planet', 'Proxima b']],
    source: 'https://science.nasa.gov/universe/exoplanets/eso-discovers-earth-size-planet-in-habitable-zone-of-nearest-star/'
  },
  'trappist-1': {
    summary: ['An ultracool red-dwarf system with seven known Earth-sized rocky planets.', '一颗超冷红矮星及其七颗已知地球大小岩质行星组成的系统。'],
    facts: [['距太阳', '约 40 光年'], ['已知行星', '7 颗'], ['行星类型', '均为地球大小的岩质行星']],
    factsEn: [['Distance from Sun', '~40 ly'], ['Known planets', '7'], ['Planet type', 'All Earth-sized rocky worlds']],
    source: 'https://science.nasa.gov/exoplanets/trappist1/'
  },
  '55-cancri': {
    summary: ['A nearby binary-star system with at least five known planets orbiting the primary star, 55 Cancri A.', '邻近双星系统；至少五颗已知行星围绕主星巨蟹座 55 A 运行。'],
    facts: [['距太阳', '约 41 光年'], ['恒星结构', '双星系统'], ['已知行星', '至少 5 颗']],
    factsEn: [['Distance from Sun', '~41 ly'], ['Stellar structure', 'Binary system'], ['Known planets', 'At least 5']],
    source: 'https://science.nasa.gov/solar-system/skywatching/night-sky-network/dim-delights-in-cancer/'
  },
  'toi-700': {
    summary: ['A nearby M-dwarf planetary system containing the roughly Earth-sized planets TOI-700 d and e in the star’s habitable zone.', '邻近 M 型矮星行星系统，包含位于宜居带内、大小接近地球的 TOI-700 d 和 e。'],
    facts: [['距太阳', '约 100 光年'], ['宿主恒星', 'M 型矮星'], ['代表行星', '宜居带内的 TOI-700 d、e']],
    factsEn: [['Distance from Sun', '~100 ly'], ['Host star', 'M dwarf'], ['Representative planets', 'Habitable-zone TOI-700 d and e']],
    source: 'https://science.nasa.gov/exoplanet-catalog/toi-700-e/'
  },
  'hr-8799': {
    summary: ['A young nearby system famous for four giant exoplanets that have been directly imaged.', '一个年轻的邻近系统，以四颗已被直接成像的巨型系外行星闻名。'],
    facts: [['距太阳', '约 130 光年'], ['已成像行星', '4 颗巨型行星'], ['科学意义', '多行星直接成像基准系统']],
    factsEn: [['Distance from Sun', '~130 ly'], ['Imaged planets', '4 giant planets'], ['Scientific role', 'Benchmark directly imaged multiplanet system']],
    source: 'https://science.nasa.gov/missions/webb/nasas-webb-images-young-giant-exoplanets-detects-carbon-dioxide/'
  },
  'solar-system': {
    summary: ['Our planetary system’s location in the Orion Spur, calibrated to the ESA/Gaia map at a Galactocentric radius of about 8.2 kpc.', '太阳系位于猎户支臂；在 ESA/Gaia 地图中按约 8.2 kpc 的银心距离校准。'],
    facts: [['距银心距离', '约 8.2 kpc · 26,600 光年'], ['所在结构', '猎户支臂'], ['绕银心周期', '约 2.3 亿年']],
    factsEn: [['Galactocentric radius', '~8.2 kpc · 26,600 ly'], ['Local structure', 'Orion Spur'], ['Galactic orbital period', '~230 million years']],
    source: 'https://science.nasa.gov/solar-system/solar-system-facts/'
  }
};
export { galaxyFeatures, galaxyFeatureImages, galaxyFeatureDetails };
