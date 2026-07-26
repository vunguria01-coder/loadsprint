const items = [
  "AI rate-con import",
  "Multi-stop routing",
  "Live GPS tracking",
  "Driver mobile app",
  "Cargo photos",
  "AI invoices",
  "Broker packets",
  "Settlements",
  "Team roles & 2FA",
];

/**
 * A quiet capability ticker between the stats band and the feature grid —
 * keeps the eye moving without adding another block of copy.
 */
export function Ticker() {
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">
        {[0, 1].map((pass) => (
          <div className="ticker-row" key={pass}>
            {items.map((t) => (
              <span className="ticker-item" key={`${pass}-${t}`}>
                {t}
                <i className="ticker-dot" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
