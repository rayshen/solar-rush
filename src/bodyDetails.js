const nasaBase = 'https://science.nasa.gov';

export const textureForBody = (id) => id === 'earth'
  ? `${import.meta.env.BASE_URL}textures/earth/day.jpg`
  : `${import.meta.env.BASE_URL}textures/bodies/${id}.jpg`;

const planetSources = Object.fromEntries(
  ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
    .map((id) => [id, `${nasaBase}/${id}/facts/`]),
);

const moonSourcePaths = {
  moon: 'moon/facts',
  phobos: 'mars/moons/phobos/facts', deimos: 'mars/moons/deimos/facts',
  io: 'jupiter/jupiter-moons/io/facts', europa: 'jupiter/jupiter-moons/europa/facts',
  ganymede: 'jupiter/jupiter-moons/ganymede/facts', callisto: 'jupiter/jupiter-moons/callisto/facts',
  titan: 'saturn/moons/titan/facts', rhea: 'saturn/moons/rhea/facts',
  iapetus: 'saturn/moons/iapetus/facts', dione: 'saturn/moons/dione/facts',
  titania: 'uranus/moons/titania/facts', oberon: 'uranus/moons/oberon/facts',
  triton: 'neptune/moons/triton/facts',
};

const facts = {
  sun: ['The star that contains about 99.8% of the solar system’s mass.', '包含太阳系约 99.8% 质量的恒星。'],
  mercury: ['The smallest planet and the closest planet to the Sun.', '太阳系最小、距离太阳最近的行星。'],
  venus: ['A rocky world with a dense carbon-dioxide atmosphere and the hottest planetary surface.', '拥有浓厚二氧化碳大气，表面温度为八大行星之最。'],
  earth: ['The only world currently known to support life and stable surface oceans.', '目前唯一确认存在生命和稳定地表海洋的天体。'],
  moon: ['Earth’s only natural satellite; its rotation is synchronized with its orbit.', '地球唯一的天然卫星，自转与公转同步。'],
  mars: ['A cold desert world with the largest volcano in the solar system, Olympus Mons.', '寒冷的沙漠世界，拥有太阳系最大火山奥林匹斯山。'],
  phobos: ['The larger, inner Martian moon, slowly spiraling toward Mars.', '火星较大且靠内的卫星，正缓慢向火星靠近。'],
  deimos: ['The smaller and outermost of Mars’s two irregular moons.', '火星两颗不规则卫星中更小、轨道更外侧的一颗。'],
  jupiter: ['The largest planet, a hydrogen-helium gas giant with powerful storms.', '太阳系最大行星，以氢和氦为主并拥有强烈风暴。'],
  io: ['The most volcanically active world known in the solar system.', '太阳系已知火山活动最剧烈的天体。'],
  europa: ['An ice-covered ocean world and a major target in the search for habitable environments.', '冰层覆盖的海洋世界，是寻找宜居环境的重要目标。'],
  ganymede: ['The solar system’s largest moon and the only moon known to have its own magnetic field.', '太阳系最大卫星，也是唯一已知拥有自身磁场的卫星。'],
  callisto: ['A heavily cratered moon that may hide a salty ocean beneath its surface.', '布满撞击坑，表面下可能存在咸水海洋。'],
  saturn: ['A hydrogen-helium gas giant surrounded by the solar system’s most extensive ring system.', '氢氦气态巨行星，拥有太阳系最壮观的环系。'],
  titan: ['A large moon with a dense nitrogen atmosphere and methane-ethane lakes.', '拥有浓厚氮气大气及甲烷、乙烷湖泊的大型卫星。'],
  rhea: ['An icy, heavily cratered moon with a very tenuous oxygen-carbon dioxide exosphere.', '富冰且遍布撞击坑，拥有极稀薄的氧和二氧化碳外逸层。'],
  iapetus: ['An icy moon famous for its dramatic two-tone surface and equatorial ridge.', '以强烈明暗双色表面和赤道山脊著称的冰卫星。'],
  dione: ['An icy moon with bright tectonic fractures and evidence for a subsurface ocean.', '拥有明亮构造裂缝，并有地下海洋证据的冰卫星。'],
  uranus: ['An ice giant rotating on its side, with an axial tilt near 98 degrees.', '几乎侧躺自转、轴倾角接近 98° 的冰巨星。'],
  titania: ['Uranus’s largest moon, an ice-rock world cut by faults and canyons.', '天王星最大卫星，由冰岩构成并遍布断层与峡谷。'],
  oberon: ['The outermost major Uranian moon, with an old and heavily cratered surface.', '天王星主要卫星中轨道最外侧的一颗，表面古老且撞击坑密布。'],
  neptune: ['The most distant planet, an ice giant with the fastest planetary winds observed.', '距离太阳最远的行星，拥有已观测到的最快行星风。'],
  triton: ['Neptune’s largest moon; it follows a retrograde orbit and has active nitrogen geysers.', '海王星最大卫星，沿逆行轨道运行并存在活跃氮喷泉。'],
};

const rocky = new Set(['mercury', 'venus', 'earth', 'moon', 'mars', 'phobos', 'deimos']);
const icy = new Set(['europa', 'ganymede', 'callisto', 'rhea', 'iapetus', 'dione', 'titania', 'oberon', 'triton']);
const gas = new Set(['jupiter', 'saturn']);
const iceGiants = new Set(['uranus', 'neptune']);

export function getBodyDetails(body) {
  const composition = body.id === 'sun'
    ? ['Hydrogen and helium plasma', '氢、氦等离子体']
    : gas.has(body.id)
      ? ['Mostly hydrogen and helium; no solid surface', '主要由氢和氦构成，没有固体表面']
      : iceGiants.has(body.id)
        ? ['Hydrogen-helium envelope over water, ammonia and methane-rich interior', '氢氦包层之下是富含水、氨和甲烷的内部']
        : rocky.has(body.id)
          ? ['Rock and metal; solid surface', '岩石与金属，具有固体表面']
          : icy.has(body.id)
            ? ['Water ice mixed with rocky material', '水冰与岩石物质的混合体']
            : ['Rock, ice and trace volatile compounds', '岩石、冰与少量挥发性物质'];
  const atmospheres = {
    sun: ['Solar atmosphere: photosphere, chromosphere and corona', '太阳大气：光球层、色球层与日冕'],
    mercury: ['Extremely tenuous exosphere; no substantial atmosphere', '仅有极稀薄外逸层，无实质性大气'],
    venus: ['Mostly carbon dioxide, with nitrogen and sulfuric-acid clouds', '以二氧化碳为主，含氮并覆盖硫酸云'],
    earth: ['About 78% nitrogen, 21% oxygen, plus argon and trace gases', '约 78% 氮、21% 氧，另含氩及微量气体'],
    moon: ['Extremely tenuous exosphere', '极稀薄外逸层'],
    mars: ['Thin atmosphere, mostly carbon dioxide', '稀薄大气，以二氧化碳为主'],
    jupiter: ['Mostly hydrogen and helium, with ammonia and water clouds', '以氢、氦为主，含氨云和水云'],
    saturn: ['Mostly hydrogen and helium, with ammonia cloud layers', '以氢、氦为主，含氨云层'],
    titan: ['Dense atmosphere dominated by nitrogen, with methane', '浓厚大气以氮为主，并含甲烷'],
    uranus: ['Hydrogen, helium and methane', '氢、氦与甲烷'],
    neptune: ['Hydrogen, helium and methane', '氢、氦与甲烷'],
    triton: ['Very thin nitrogen atmosphere with trace methane', '极稀薄氮气大气，含微量甲烷'],
  };
  const atmosphere = atmospheres[body.id] ?? (body.type === 'moon'
    ? ['No substantial atmosphere; at most a tenuous exosphere', '无实质性大气，至多存在稀薄外逸层']
    : ['No verified atmosphere data in this compact catalogue', '本精简目录暂无经核实的大气数据']);
  const source = body.id === 'sun'
    ? `${nasaBase}/sun/facts/`
    : planetSources[body.id] ?? `${nasaBase}/${moonSourcePaths[body.id] ?? 'solar-system/moons/facts'}/`;
  return { overview: facts[body.id], composition, atmosphere, source };
}
