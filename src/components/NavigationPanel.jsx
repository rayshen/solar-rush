import { ui } from '../config/appConfig.js';
import { galaxyFeatures } from '../data/galaxyData.js';
import { bodies, bodyMap } from '../solarData.js';
import { BodyButton, GalaxyFeatureButton } from './CelestialButtons.jsx';

const planets = bodies.filter((body) => body.type === 'planet');
const comets = bodies.filter((body) => body.type === 'comet');

function NavigationPanel({
  filter,
  language,
  onFilterChange,
  onSelectBody,
  onSelectGalaxyFeature,
  orbitScope,
  selectedGalaxyFeature,
  selectedId,
  viewMode,
}) {
  const copy = ui[language];
  const normalizedFilter = filter.trim().toLowerCase();
  const visibleBodies = bodies.filter((body) => (
    !normalizedFilter || `${body.name} ${body.zh} ${body.type}`.toLowerCase().includes(normalizedFilter)
  ));
  const visibleIds = new Set(visibleBodies.map((body) => body.id));
  const visibleGalaxyFeatures = galaxyFeatures.filter((feature) => (
    !normalizedFilter
    || `${feature.name} ${feature.zh} ${feature.kind} ${feature.kindZh}`.toLowerCase().includes(normalizedFilter)
  ));
  const galaxyMode = viewMode === 'orbit' && orbitScope === 'galaxy';

  return (
    <aside className="left-panel glass-panel">
      {galaxyMode ? (
        <>
          <div className="panel-title">
            <span>{language === 'zh' ? '银河系结构' : 'Galactic Structures'}</span>
            <strong>{galaxyFeatures.length}</strong>
          </div>
          <label className="search-box">
            <input
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
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
                    onSelect={onSelectGalaxyFeature}
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
            <input value={filter} onChange={(event) => onFilterChange(event.target.value)} placeholder={copy.search} />
          </label>
          {visibleIds.has('sun') && (
            <div className="body-group">
              <h2>{copy.star}</h2>
              <BodyButton body={bodyMap.sun} selectedId={selectedId} language={language} onSelect={onSelectBody} />
            </div>
          )}
          <div className="body-group">
            <h2>{copy.planets}</h2>
            {planets.map((planet) => {
              const planetVisible = visibleIds.has(planet.id);
              const visibleMoons = planet.moons
                .map((moonId) => bodyMap[moonId])
                .filter((moon) => moon && visibleIds.has(moon.id));
              if (!planetVisible && visibleMoons.length === 0) return null;
              return (
                <div className="tree-node" key={planet.id}>
                  {planetVisible && (
                    <BodyButton body={planet} selectedId={selectedId} language={language} onSelect={onSelectBody} />
                  )}
                  {visibleMoons.length > 0 && (
                    <div className="moon-branch">
                      {visibleMoons.map((moon) => (
                        <BodyButton key={moon.id} body={moon} selectedId={selectedId} language={language} nested onSelect={onSelectBody} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {comets.some((comet) => visibleIds.has(comet.id)) && (
            <div className="body-group">
              <h2>{copy.comets}</h2>
              {comets
                .filter((comet) => visibleIds.has(comet.id))
                .map((comet) => (
                  <BodyButton key={comet.id} body={comet} selectedId={selectedId} language={language} onSelect={onSelectBody} />
                ))}
            </div>
          )}
          {visibleBodies.length === 0 && <p className="empty-state">{copy.noMatches}</p>}
        </>
      )}
    </aside>
  );
}

export { NavigationPanel };
