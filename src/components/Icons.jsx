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

export { AtmosphereIcon, CopyIcon, ShareIcon };
