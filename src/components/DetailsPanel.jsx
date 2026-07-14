import * as THREE from 'three';
import { assetUrl, ui } from '../config/appConfig.js';
import { galaxyFeatureDetails, galaxyFeatureImages, galaxyFeatures } from '../data/galaxyData.js';
import { getBodyDetails, textureForBody } from '../bodyDetails.js';
import { getPlanetOrbitOrientation } from '../scene/astronomy.js';
import { bodyMap } from '../solarData.js';
import {
  estimateEscapeVelocity,
  formatDistance,
  formatFixed,
  formatNumber,
} from '../utils/formatters.js';
import { AtmosphereIcon } from './Icons.jsx';

function GalaxyDetails({ language, selectedFeatureId }) {
  const feature = galaxyFeatures.find(({ id }) => id === selectedFeatureId) ?? galaxyFeatures[0];
  const details = galaxyFeatureDetails[feature.id];
  const facts = details.facts
    ? (language === 'zh' ? details.facts : details.factsEn)
    : [
      [language === 'zh' ? '结构分类' : 'Classification', language === 'zh' ? feature.kindZh : feature.kind],
      [language === 'zh' ? '空间关系' : 'Spatial relation', details.relation[language === 'zh' ? 1 : 0]],
      [language === 'zh' ? '定位依据' : 'Position basis', language === 'zh' ? 'ESA/Gaia 标注模型图中的近似锚点' : 'Approximate anchor from ESA/Gaia annotated model view'],
    ];

  return (
    <div className="galaxy-detail-panel">
      <div className="body-hero galaxy-hero">
        <span
          className={`galaxy-detail-symbol feature-${feature.group}`}
          style={{ backgroundImage: `url(${assetUrl(`/textures/galaxy/features/${galaxyFeatureImages[feature.id].file}`)})` }}
          aria-hidden="true"
        />
        <div>
          <strong>{language === 'zh' ? feature.zh : feature.name}</strong>
          <small>{language === 'zh' ? feature.name : feature.zh}</small>
        </div>
      </div>
      <div className="selected-heading">
        <span>{language === 'zh' ? feature.kindZh : feature.kind}</span>
        <h2>{language === 'zh' ? feature.zh : feature.name}</h2>
        <p>{details.summary[language === 'zh' ? 1 : 0]}</p>
        <div className="science-status">
          <span>{feature.group === 'locations'
            ? (language === 'zh' ? '银河尺度定位' : 'GALAXY-SCALE LOCATOR')
            : (language === 'zh' ? '银河系结构模型' : 'GALACTIC STRUCTURE MODEL')}</span>
          <small>{feature.group === 'locations'
            ? (language === 'zh'
              ? '邻近恒星系统在银河全景比例下不可分辨，共用太阳邻域锚点；距离数据见各自资料来源。'
              : 'Nearby stellar systems are unresolved at Galaxy scale and share the Solar Neighborhood anchor; distances follow the cited sources.')
            : (language === 'zh'
              ? '标签锚点参考 ESA/Gaia 艺术重建图；旋臂边界与分类仍依赖模型。'
              : 'Label anchors reference the ESA/Gaia artist impression; arm boundaries and classifications remain model-dependent.')}</small>
        </div>
      </div>
      <div className="stat-list galaxy-stat-list">
        {facts.map(([label, value]) => (
          <div key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      <div className="detail-copy galaxy-source-note">
        <p>{language === 'zh'
          ? (feature.group === 'locations'
            ? '这是银河全景中的定位表达，不是邻近恒星系统之间的比例位置图。'
            : '这里显示的是银河尺度结构，不代表旋臂具有清晰硬边界，也不等同于完整三维恒星分布。')
          : (feature.group === 'locations'
            ? 'This is a locator on a Galaxy-wide map, not a to-scale chart of separations between nearby stellar systems.'
            : 'These are Galaxy-scale structures; spiral arms have no sharp physical edges and this is not a complete 3D stellar map.')}</p>
        <a href={details.source ?? 'https://www.esa.int/ESA_Multimedia/Images/2023/12/Top-down_view_of_the_Milky_Way_annotated'} target="_blank" rel="noreferrer">
          {language === 'zh' ? '科学资料来源' : 'Scientific source'} ↗
        </a>
      </div>
    </div>
  );
}

function BodyDetails({
  additionalDataOpen,
  autoFollow,
  detailTab,
  language,
  onAutoFollowChange,
  onDetailTabChange,
  onPhysicalScaleChange,
  onToggleAdditionalData,
  scaleMode,
  selectedId,
  telemetryDate,
  viewMode,
}) {
  const copy = ui[language];
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  const body = bodyMap[selectedId] ?? bodyMap.sun;
  const details = getBodyDetails(body);
  const ephemerisYear = telemetryDate.getUTCFullYear();
  const ephemerisInRange = body.type === 'comet'
    ? ephemerisYear >= 1800 && ephemerisYear <= 2200
    : ephemerisYear >= 1800 && ephemerisYear <= 2050;
  const referenceFrame = body.type === 'comet'
    ? 'J2000 heliocentric ecliptic'
    : body.type === 'planet'
    ? 'J2000 mean ecliptic'
    : body.type === 'moon'
      ? 'JPL local Laplace/equatorial plane'
      : 'Heliocentric origin';
  const ephemerisModel = body.type === 'comet'
    ? (scaleMode === 'physical' ? 'JPL Horizons solution 75' : 'JPL#75 osculating elements')
    : body.type === 'planet'
    ? 'Astronomy Engine VSOP87 / J2000'
    : body.type === 'moon'
      ? 'JPL J2000 mean elements'
      : 'Scene origin';
  const orbitOrientation = ['planet', 'comet'].includes(body.type) ? getPlanetOrbitOrientation(body.id, telemetryDate) : null;

  return (
    <>
      <div className="body-hero">
        <span className={`body-preview body-texture body-${body.id}`} style={{ backgroundImage: `url(${textureForBody(body.id)})` }} />
        <div><strong>{language === 'zh' ? body.zh : body.name}</strong><small>{language === 'zh' ? body.name : body.zh}</small></div>
      </div>
      <div className="selected-heading">
        <span>{body.type.toUpperCase()}</span>
        <h2>{language === 'zh' ? body.zh : body.name}</h2>
        <p>{copy[`${viewMode}Description`]}</p>
        <div className={`science-status ${ephemerisInRange ? '' : 'warning'}`}>
          <span>{ephemerisInRange ? copy.inRange : copy.outRange}</span>
          <small>{scaleMode === 'physical' ? copy.physicalScale : copy.visualScale}</small>
        </div>
      </div>
      <div className="detail-tabs">
        {['overview', 'physical', 'composition', 'atmosphere'].map((tab) => (
          <button key={tab} type="button" className={detailTab === tab ? 'active' : ''} aria-pressed={detailTab === tab} onClick={() => onDetailTabChange(tab)}>
            {tab === 'atmosphere' && <AtmosphereIcon className="tab-atmosphere-icon" />}
            {copy[tab]}
          </button>
        ))}
      </div>
      {detailTab === 'overview' && <div className="detail-copy"><p>{details.overview[language === 'zh' ? 1 : 0]}</p><a href={details.source} target="_blank" rel="noreferrer">{copy.source} ↗</a></div>}
      {detailTab === 'composition' && <div className="detail-copy"><p>{details.composition[language === 'zh' ? 1 : 0]}</p><a href={details.source} target="_blank" rel="noreferrer">{copy.source} ↗</a></div>}
      {detailTab === 'atmosphere' && (
        <div className="detail-copy atmosphere-detail">
          <span className="detail-icon atmosphere-icon" aria-hidden="true"><AtmosphereIcon /></span>
          <p>{details.atmosphere[language === 'zh' ? 1 : 0]}</p>
          <a href={details.source} target="_blank" rel="noreferrer">{copy.source} ↗</a>
        </div>
      )}
      {(detailTab === 'overview' || detailTab === 'physical') && (
        <div className="stat-list">
          <div><span>{copy.radius}</span><strong>{body.type === 'comet' ? `${formatFixed(body.radiusKm, 1)} km` : formatNumber(body.radiusKm, ' km', locale)}</strong></div>
          <div><span>{body.type === 'comet' ? copy.semiMajorAxis : copy.distance}</span><strong>{body.parent ? formatDistance(body.distanceKm) : copy.center}</strong></div>
          <div><span>{copy.orbitPeriod}</span><strong>{body.orbitDays ? `${formatFixed(Math.abs(body.orbitDays), 3)} ${copy.days}` : 'N/A'}</strong></div>
          <div><span>{copy.rotationPeriod}</span><strong>{formatFixed(Math.abs(body.rotationHours), 2)} {copy.hours}</strong></div>
          <div><span>{body.type === 'comet' ? copy.perihelionVelocity : copy.velocity}</span><strong>{formatFixed(body.speedKmS, 2)} km/s</strong></div>
          <div><span>{copy.axialTilt}</span><strong>{body.type === 'comet' ? '—' : `${formatFixed(body.axialTilt, 2)}°`}</strong></div>
          <div><span>{copy.observation}</span><strong>{copy[viewMode === 'orbit' ? 'orbitView' : viewMode === 'helical' ? 'spiralView' : 'followView']}</strong></div>
        </div>
      )}
      <button type="button" className="additional-data" aria-expanded={additionalDataOpen} onClick={onToggleAdditionalData}>
        <span>{copy.additional}</span><strong>{additionalDataOpen ? '⌃' : '⌄'}</strong>
      </button>
      {additionalDataOpen && (
        <div className="stat-list additional-stat-list">
          <div><span>{copy.gravity}</span><strong>{body.gravity}</strong></div>
          <div><span>{copy.escape}</span><strong>{estimateEscapeVelocity(body)}</strong></div>
          <div><span>{copy.mass}</span><strong>{body.mass}</strong></div>
          <div><span>{copy.moons}</span><strong>{body.moons.length}</strong></div>
          <div><span>{copy.magnitude}</span><strong>{body.type === 'star' ? '-26.74' : '—'}</strong></div>
          <div><span>{copy.reference}</span><strong>{referenceFrame}</strong></div>
          <div><span>{copy.positionModel}</span><strong>{ephemerisModel}</strong></div>
          {orbitOrientation && (
            <>
              <div><span>{copy.orbitInclination}</span><strong>{formatFixed(THREE.MathUtils.radToDeg(orbitOrientation.inclination), 4)}°</strong></div>
              <div><span>{copy.ascendingNode}</span><strong>{formatFixed(THREE.MathUtils.radToDeg(orbitOrientation.ascendingNode), 4)}°</strong></div>
            </>
          )}
          <div><span>{copy.scaleModel}</span><strong>{scaleMode === 'physical' ? 'Unified physical ratio' : 'Compressed visual scale'}</strong></div>
          <div><span>{copy.catalogue}</span><strong>NASA SVS Milky Way + Hipparcos bright subset / J2000</strong></div>
          <div><span>{copy.lighting}</span><strong>Geometric eclipse + ring shadows</strong></div>
        </div>
      )}
      <div className="follow-control">
        <label className="toggle-row">
          <input type="checkbox" checked={scaleMode === 'physical'} onChange={(event) => onPhysicalScaleChange(event.target.checked)} />
          <span>{copy.trueScale}</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={autoFollow} onChange={(event) => onAutoFollowChange(event.target.checked)} />
          <span>{copy.keepCentered}</span>
        </label>
      </div>
    </>
  );
}

function DetailsPanel(props) {
  const galaxyMode = props.viewMode === 'orbit' && props.orbitScope === 'galaxy';
  return (
    <aside className="right-panel glass-panel">
      {galaxyMode
        ? <GalaxyDetails language={props.language} selectedFeatureId={props.selectedGalaxyFeature} />
        : <BodyDetails {...props} />}
    </aside>
  );
}

export { DetailsPanel };
