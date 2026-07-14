import { createPortal } from 'react-dom';
import { simulationSpeeds } from '../config/appConfig.js';
import { formatElapsed, formatFixed, formatLunarDate } from '../utils/formatters.js';
import { CopyIcon, ShareIcon } from './Icons.jsx';

function TopBar({
  adaptiveSpeedLabel,
  beijingFormatter,
  copy,
  language,
  mobileMenuOpen,
  onChangeLanguage,
  onCopyShareLink,
  onResetCamera,
  onSetSpeedIndex,
  onToggleMobileMenu,
  onTogglePlaying,
  onToggleShareMenu,
  playing,
  shareMenuOpen,
  shareMenuPanelRef,
  shareMenuRef,
  shareNotice,
  speedIndex,
  telemetryDate,
  utcFormatter,
}) {
  return (
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
        onClick={onToggleMobileMenu}
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
        <div><span>UTC</span><strong>{utcFormatter.format(telemetryDate)}</strong></div>
        <div><span>{copy.beijingTime}</span><strong>{beijingFormatter.format(telemetryDate)}</strong></div>
        <div>
          <span>{copy.lunar}</span>
          <strong>{language === 'zh'
            ? formatLunarDate(telemetryDate)
            : new Intl.DateTimeFormat('en-US-u-ca-chinese', { month: 'long', day: 'numeric' }).format(telemetryDate)}</strong>
        </div>
      </div>
      <div className="controls">
        <div className="transport-controls" aria-label="time controls">
          <button type="button" aria-label={copy.reset} onClick={onResetCamera}>↺</button>
          <button type="button" aria-label={playing ? copy.pause : copy.play} className={playing ? 'active' : ''} onClick={onTogglePlaying}>
            {playing ? 'Ⅱ' : '▶'}
          </button>
        </div>
        <label className="speed-control">
          <span>{copy.simSpeed}</span>
          <select value={speedIndex} onChange={(event) => onSetSpeedIndex(Number(event.target.value))}>
            {simulationSpeeds.map((item, index) => (
              <option value={index} key={item.label}>
                {item.adaptiveOrbit ? adaptiveSpeedLabel : `${item.label} · ${item.multiplier}`}
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
            onClick={onToggleShareMenu}
          >
            <ShareIcon />{copy.share}
          </button>
          {shareMenuOpen && createPortal(
            <>
              <div className="share-backdrop" aria-hidden="true" onClick={onToggleShareMenu} />
              <div className="share-menu" ref={shareMenuPanelRef} role="menu" aria-label={copy.share}>
                <button type="button" role="menuitem" onClick={() => onCopyShareLink(false)}>
                  <span className="share-option-icon"><CopyIcon /></span>
                  <span><strong>{copy.copySite}</strong><small>{copy.copySiteHint}</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => onCopyShareLink(true)}>
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
          <button type="button" className={language === 'zh' ? 'active' : ''} onClick={() => onChangeLanguage('zh')}>中</button>
          <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => onChangeLanguage('en')}>EN</button>
        </div>
      </div>
    </header>
  );
}

function ViewControls({
  copy,
  helicalView,
  onSelectHelicalView,
  onSelectOrbitScope,
  onSwitchViewMode,
  orbitScope,
  viewMode,
}) {
  return (
    <>
      <div className="view-switcher">
        <button type="button" className={viewMode === 'orbit' ? 'active' : ''} onClick={() => onSwitchViewMode('orbit')}>◎ {copy.orbitView}</button>
        <button type="button" className={viewMode === 'helical' ? 'active' : ''} onClick={() => onSwitchViewMode('helical')}>◈ {copy.spiralView}</button>
        <button type="button" className={viewMode === 'follow' ? 'active' : ''} onClick={() => onSwitchViewMode('follow')}>△ {copy.followView}</button>
        {viewMode === 'orbit' && (
          <div className="view-subviews" aria-label={copy.orbitView}>
            <button type="button" className={orbitScope === 'solar' ? 'active' : ''} onClick={() => onSelectOrbitScope('solar')}>{copy.solarSystemView}</button>
            <button type="button" className={orbitScope === 'galaxy' ? 'active' : ''} onClick={() => onSelectOrbitScope('galaxy')}>{copy.galaxyView}</button>
          </div>
        )}
        {viewMode === 'helical' && (
          <div className="view-subviews" aria-label={copy.spiralView}>
            <button type="button" className={helicalView === 'front' ? 'active' : ''} onClick={() => onSelectHelicalView('front')}>{copy.spiralFrontView}</button>
            <button type="button" className={helicalView === 'rear' ? 'active' : ''} onClick={() => onSelectHelicalView('rear')}>{copy.spiralRearView}</button>
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
    </>
  );
}

function TimelineFooter({ copy, telemetry, timeline }) {
  return (
    <footer className="bottom-bar">
      <div className="timeline">
        <span className="timeline-summary">
          <strong>{timeline.yearLabel}</strong>
          <small>{copy.elapsed} {formatElapsed(telemetry.elapsedSeconds)}</small>
        </span>
        <div className="track" key={timeline.year}>
          <div className="tick-rail">
            {timeline.marks.map((mark, index) => (
              <span key={mark.label} className={index % 3 === 0 || mark.yearEnd ? 'major' : ''} style={{ left: mark.left }} />
            ))}
          </div>
          <i style={{ width: `${timeline.progress}%` }} />
          <b style={{ left: `${timeline.progress}%` }} />
          <div className="timeline-labels">
            {timeline.marks.map((mark) => (
              <span key={mark.label} className={`${mark.active ? 'active' : ''} ${mark.yearEnd ? 'year-end' : ''}`} style={{ left: mark.left }}>
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
  );
}

export { TimelineFooter, TopBar, ViewControls };
