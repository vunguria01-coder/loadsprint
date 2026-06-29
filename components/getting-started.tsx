// Friendly first-run guidance shown to a dispatcher who has no loads yet, so a
// brand-new user immediately knows the three steps to get going.
export function GettingStarted() {
  return (
    <div className="start-card">
      <div className="start-head">
        <span className="start-badge">Start here</span>
        <h3>Welcome to LoadSprint</h3>
        <p>Three quick steps to get going:</p>
      </div>
      <ol className="start-steps">
        <li>
          <span className="start-num">1</span>
          <div>
            <b>Add your first driver</b>
            <p>
              Use the <b>Add driver</b> button above — enter their email and send
              them the join code.
            </p>
          </div>
        </li>
        <li>
          <span className="start-num">2</span>
          <div>
            <b>Create a load</b>
            <p>
              Tap a driver, then <b>New load</b>. Upload the broker&apos;s rate
              confirmation and the AI fills in the stops, rate and bill-to for you.
            </p>
          </div>
        </li>
        <li>
          <span className="start-num">3</span>
          <div>
            <b>Track, message &amp; invoice</b>
            <p>
              Follow the truck on the map, chat with the driver, then generate the
              invoice and share a tracking link with the broker.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
