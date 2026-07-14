import { bodyMap } from '../solarData.js';
import {
  DEFAULT_HELICAL_VIEW,
  DEFAULT_ORBIT_SCOPE,
  DEFAULT_SPEED_INDEX,
  DEFAULT_VIEW_MODE,
  simulationSpeeds,
} from '../config/appConfig.js';
import { galaxyFeatures } from '../data/galaxyData.js';

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
      ...fallback,
      ...sharedState,
      viewMode: 'orbit',
      selectedId,
      scaleMode: segments[3] === 'physical' ? 'physical' : 'visual',
    };
  }

  if (segments[0] === SHARE_ROUTE_PREFIXES.helical) {
    return {
      ...fallback,
      ...sharedState,
      viewMode: 'helical',
      helicalView: segments[1] === 'rear' ? 'rear' : 'front',
      selectedId: bodyMap[segments[2]] ? segments[2] : fallback.selectedId,
    };
  }

  if (segments[0] === SHARE_ROUTE_PREFIXES.follow) {
    return {
      ...fallback,
      ...sharedState,
      viewMode: 'follow',
      selectedId: bodyMap[segments[1]] ? segments[1] : fallback.selectedId,
    };
  }

  return fallback;
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

export { copyToClipboard, createCurrentViewHash, createShareHash, readShareRoute };
