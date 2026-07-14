import { textureForBody } from '../bodyDetails.js';
import { assetUrl } from '../config/appConfig.js';
import { galaxyFeatureImages } from '../data/galaxyData.js';
import { bodyMap } from '../solarData.js';
import { formatDistance } from '../utils/formatters.js';

function BodyButton({ body, selectedId, onSelect, language, nested = false }) {
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
        {body.type === 'moon'
          ? (language === 'zh' ? parent?.zh : parent?.name)
          : body.type === 'star'
            ? (language === 'zh' ? '中心' : 'center')
            : body.type === 'comet'
              ? (language === 'zh' ? '76.1 年' : '76.1 yr')
            : formatDistance(body.distanceKm)}
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

export { BodyButton, GalaxyFeatureButton };
