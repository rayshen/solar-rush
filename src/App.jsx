import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  DAY_MS,
  DEFAULT_ORBIT_SCOPE,
  MAX_UI_TIME_UPDATE_INTERVAL_MS,
  MIN_UI_TIME_UPDATE_INTERVAL_MS,
  START_DATE,
  simulationSpeeds,
  ui,
  viewModeDescriptions,
  viewModeLabels,
} from './config/appConfig.js';
import { buildSolarScene } from './scene/solarScene.js';
import { bodyMap } from './solarData.js';
import { TimelineFooter, TopBar, ViewControls } from './components/AppChrome.jsx';
import { DetailsPanel } from './components/DetailsPanel.jsx';
import { NavigationPanel } from './components/NavigationPanel.jsx';
import {
  copyToClipboard,
  createCurrentViewHash,
  createShareHash,
  readShareRoute,
} from './utils/shareRoute.js';

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
  const copy = ui[language];
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
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

      <TopBar
        adaptiveSpeedLabel={adaptiveSpeedLabel}
        beijingFormatter={beijingFormatter}
        copy={copy}
        language={language}
        mobileMenuOpen={mobileMenuOpen}
        onChangeLanguage={changeLanguage}
        onCopyShareLink={copyShareLink}
        onResetCamera={() => {
          setCameraPose(null);
          setAutoFollow(true);
          setCameraRevision((value) => value + 1);
        }}
        onSetSpeedIndex={setSpeedIndex}
        onToggleMobileMenu={() => setMobileMenuOpen((value) => !value)}
        onTogglePlaying={() => setPlaying((value) => !value)}
        onToggleShareMenu={() => setShareMenuOpen((value) => !value)}
        playing={playing}
        shareMenuOpen={shareMenuOpen}
        shareMenuPanelRef={shareMenuPanelRef}
        shareMenuRef={shareMenuRef}
        shareNotice={shareNotice}
        speedIndex={speedIndex}
        telemetryDate={telemetry.date}
        utcFormatter={utcFormatter}
      />

      <NavigationPanel
        filter={filter}
        language={language}
        onFilterChange={setFilter}
        onSelectBody={(id) => {
          setCameraPose(null);
          setSelectedId(id);
          setAutoFollow(true);
          setCameraRevision((value) => value + 1);
          setMobileMenuOpen(false);
        }}
        onSelectGalaxyFeature={setSelectedGalaxyFeature}
        orbitScope={orbitScope}
        selectedGalaxyFeature={selectedGalaxyFeature}
        selectedId={selectedId}
        viewMode={viewMode}
      />

      <DetailsPanel
        additionalDataOpen={additionalDataOpen}
        autoFollow={autoFollow}
        detailTab={detailTab}
        language={language}
        onAutoFollowChange={setAutoFollow}
        onDetailTabChange={setDetailTab}
        onPhysicalScaleChange={(physical) => {
          setCameraPose(null);
          setScaleMode(physical ? 'physical' : 'visual');
          setViewMode('orbit');
          setOrbitScope('solar');
          setCameraRevision((value) => value + 1);
        }}
        onToggleAdditionalData={() => setAdditionalDataOpen((value) => !value)}
        orbitScope={orbitScope}
        scaleMode={scaleMode}
        selectedGalaxyFeature={selectedGalaxyFeature}
        selectedId={selectedId}
        telemetryDate={telemetry.date}
        viewMode={viewMode}
      />

      <ViewControls
        copy={copy}
        helicalView={helicalView}
        onSelectHelicalView={(nextView) => {
          setCameraPose(null);
          setHelicalView(nextView);
          setAutoFollow(true);
          setCameraRevision((value) => value + 1);
        }}
        onSelectOrbitScope={(nextScope) => {
          setCameraPose(null);
          setOrbitScope(nextScope);
          if (nextScope === 'galaxy') {
            setScaleMode('visual');
            setAutoFollow(true);
          }
          setCameraRevision((value) => value + 1);
        }}
        onSwitchViewMode={switchViewMode}
        orbitScope={orbitScope}
        viewMode={viewMode}
      />

      <TimelineFooter copy={copy} telemetry={telemetry} timeline={timeline} />
    </main>
  );
}

export default App;
