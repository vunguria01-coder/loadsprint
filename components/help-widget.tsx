"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";

// Each help entry explains ONE cell/section of a screen: what it is and how to
// use it. The panel content changes automatically with the page you open.
type Item = { name: string; what: string; how: string };
type Help = { title: string; intro: string; items: Item[] };

const GENERAL: Help = {
  title: "LoadSprint — quick guide",
  intro: "Open any screen and this panel explains every part of it — what it is and how to use it.",
  items: [
    { name: "Home", what: "Your daily overview: active loads, drivers, completed loads and earnings.", how: "Open it from the menu; click any active load to jump into it." },
    { name: "Drivers", what: "Your driver roster.", how: "Add a driver by email, then open a driver to create loads and see live GPS." },
    { name: "Completed", what: "Delivered and closed loads with document packages.", how: "Open a load to review photos, docs and the invoice, then download the broker ZIP." },
    { name: "Calendar", what: "Pickups and deliveries shown by day.", how: "Set each load's pickup/delivery dates so they appear on the calendar." },
    { name: "Insights", what: "Revenue and performance charts.", how: "Read totals, the weekly chart, and per-driver revenue." },
    { name: "Settlements", what: "Driver pay and pay statements.", how: "Set each driver's pay, then download a PDF statement." },
    { name: "Team", what: "Extra dispatchers who share your plan.", how: "Invite a teammate and set their commission %." },
    { name: "Plans & billing", what: "Your subscription and driver limits.", how: "Pick a plan; set your invoice header under Invoice details." },
  ],
};

function helpFor(path: string): Help {
  if (path.startsWith("/dashboard"))
    return {
      title: "Home",
      intro: "Your daily overview — every part explained below.",
      items: [
        { name: "Active loads (card)", what: "How many loads are moving right now (not yet delivered or closed).", how: "The number is a live count; the loads themselves are listed lower on the page." },
        { name: "Drivers (card)", what: "How many drivers you have.", how: "Click \"Manage drivers\" to add a driver or open one." },
        { name: "Completed (card)", what: "How many loads are delivered or closed.", how: "Open the Completed screen to review and send their document packages." },
        { name: "Earnings (card)", what: "Your commission on delivered/closed loads. Shows only when a commission % is set.", how: "Set your commission on the Team screen; see the breakdown in Insights." },
        { name: "Active loads (list)", what: "Every load currently in progress.", how: "Click a load to open its full workspace: map, documents, chat and status." },
        { name: "Start here (steps)", what: "A short walkthrough for your first load.", how: "New here? Follow the steps to add a driver and create your first load." },
      ],
    };
  if (path === "/drivers")
    return {
      title: "Drivers",
      intro: "Your driver roster. Here's what each part does.",
      items: [
        { name: "Add driver", what: "Invites a driver by email; they get a one-time join code for the app or PWA.", how: "Click \"Add driver\", enter the email, and share the code with them." },
        { name: "Seat counter", what: "How many drivers your plan allows versus how many you use.", how: "If you're out of seats, upgrade on the Billing screen." },
        { name: "Search box", what: "Filters the list by driver name, email, load number or broker.", how: "Start typing — the list narrows as you type." },
        { name: "Driver card", what: "One driver, with their status (Active or Pending) and load counts.", how: "Click a card to open that driver's loads and create a new load." },
      ],
    };
  if (path.startsWith("/drivers/"))
    return {
      title: "Driver",
      intro: "Everything for one driver — their loads and live location.",
      items: [
        { name: "Create load", what: "Starts a new load for this driver. You can upload the broker's rate confirmation PDF and AI fills in pickups, drops, rate and bill-to.", how: "Click create, upload the rate con, check the details it found, then confirm." },
        { name: "Loads list", what: "All loads assigned to this driver.", how: "Click any load to open full control (map, docs, chat, status)." },
        { name: "Live location", what: "The driver's real GPS position when they're sharing it.", how: "Watch the map; on a load you can freeze the marker with a privacy hold." },
      ],
    };
  if (path.startsWith("/loads/"))
    return {
      title: "Load",
      intro: "Full control of one load — each section explained.",
      items: [
        { name: "Map & ETA", what: "The truck's live position with remaining truck-legal distance and ETA (via HERE routing).", how: "Watch the marker; use the privacy hold to freeze it at a parked point (e.g. a truck stop)." },
        { name: "Documents", what: "The load's paperwork: Rate Con, BOL, POD, invoices and attachments.", how: "Upload, view or download any file; you can forward a document to the driver in chat." },
        { name: "Cargo photos", what: "Photos grouped by phase — before pickup, in transit, at delivery.", how: "Tick a photo as \"visible to broker\" to include it in the broker's share link." },
        { name: "Status", what: "The load's stage: Assigned → Picked Up → In Transit → At Delivery → Delivered → Closed.", how: "Move it along the steps. Only the assigned driver can mark Delivered, and only with a proof-of-delivery photo." },
        { name: "Invoice (AI)", what: "A carrier invoice built from the load data and saved as a clean PDF.", how: "Tap \"Generate invoice with AI\" — it's saved to the load and included when you send final documents." },
        { name: "Chat", what: "Messages between dispatcher, driver and broker, with files and read receipts.", how: "Type a message or attach a file; everyone on the load sees it." },
        { name: "Broker share", what: "A read-only link plus a one-time code so the broker can watch status, location and chosen documents.", how: "Create the link and send the code. \"Send final documents\" releases the invoice and paperwork to the broker." },
      ],
    };
  if (path.startsWith("/review"))
    return {
      title: "Completed",
      intro: "Delivered and closed loads, ready to send to brokers.",
      items: [
        { name: "Completed loads (by driver)", what: "Your delivered and closed loads, grouped by driver.", how: "Tap a card to open the load and check its photos, documents and invoice." },
        { name: "Review & send", what: "A preview of the broker package — rate confirmation, chosen photos and the invoice.", how: "Check it, fix anything that's off, then download the ZIP to send to your broker." },
      ],
    };
  if (path.startsWith("/calendar"))
    return {
      title: "Calendar",
      intro: "Pickups and deliveries across all your loads, by day.",
      items: [
        { name: "Month grid", what: "Each day's pickups (blue) and deliveries (green).", how: "Use the ‹ › arrows to change month, or \"Today\" to jump back. Click a load on a day to open it." },
        { name: "Schedule loads", what: "Where you set each load's pickup and delivery dates.", how: "Pick the dates for a load and press Save — it then appears on the calendar above." },
      ],
    };
  if (path.startsWith("/insights"))
    return {
      title: "Insights",
      intro: "Revenue and performance from your delivered loads.",
      items: [
        { name: "Top cards", what: "Total revenue, this month, completed loads, and average per load.", how: "Read them at a glance for a quick health check." },
        { name: "Revenue chart", what: "Your revenue over the last 8 weeks.", how: "Scan the bars to see the trend week to week." },
        { name: "By driver", what: "Each driver's delivered revenue and how many loads they ran.", how: "Compare drivers to see who's carrying the most." },
      ],
    };
  if (path.startsWith("/settlements"))
    return {
      title: "Settlements",
      intro: "Work out and document what each driver is paid.",
      items: [
        { name: "Driver pay", what: "The pay rule for a driver — a percentage of each load, or a flat amount per delivered load.", how: "Choose the type, enter the value, and press Save." },
        { name: "Auto totals", what: "Each driver's pay, calculated automatically from their delivered loads.", how: "No input needed — the totals update as loads are delivered." },
        { name: "Download statement", what: "A PDF pay statement for a driver.", how: "Click \"Download statement\" and send the PDF to the driver." },
      ],
    };
  if (path.startsWith("/team"))
    return {
      title: "Team",
      intro: "Invite extra dispatchers who share your plan.",
      items: [
        { name: "Add dispatcher", what: "Invites a teammate who can manage loads and drivers under your subscription.", how: "Click \"Add dispatcher\" and enter their email." },
        { name: "Commission %", what: "Each dispatcher's share of delivered loads. Only you (the owner) can see it.", how: "Set the percentage for each dispatcher and save." },
      ],
    };
  if (path.startsWith("/invoice-settings"))
    return {
      title: "Invoice details",
      intro: "Your company details for invoices — entered once and remembered.",
      items: [
        { name: "Company details", what: "Your company name, contact and payment terms that appear at the top of every invoice.", how: "Fill in the fields; the live preview shows the header. Press \"Save details\"." },
      ],
    };
  if (path.startsWith("/billing"))
    return {
      title: "Plans & billing",
      intro: "Choose a plan to unlock features and add drivers.",
      items: [
        { name: "Monthly / One month", what: "Switches between a recurring monthly subscription and a one-time one-month purchase.", how: "Click the toggle at the top before choosing a plan." },
        { name: "Plan cards", what: "Silver, Gold and Platinum, each showing how many drivers it includes (Gold is most popular).", how: "Pick the plan that fits your driver count." },
        { name: "Checkout", what: "Secure payment through Stripe — Apple Pay, Google Pay and cards.", how: "Complete checkout; the plan and expiry activate as soon as you return." },
      ],
    };
  return GENERAL;
}

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const path = usePathname() || "";
  const h = helpFor(path);

  return (
    <>
      {open && <div className="help-scrim" onClick={() => setOpen(false)} />}
      <div className="help-fab-wrap">
        {open && (
          <div className="help-panel" role="dialog" aria-label="Help">
            <div className="help-head">
              <div>
                <div className="help-eyebrow">Help · what everything does</div>
                <div className="help-title">{h.title}</div>
              </div>
              <button className="help-x" onClick={() => setOpen(false)} aria-label="Close help">
                <X size={18} />
              </button>
            </div>
            <p className="help-intro">{h.intro}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {h.items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: "11px 13px",
                  }}
                >
                  <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                    {it.name}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 5, opacity: 0.92 }}>
                    <span style={{ opacity: 0.55, fontWeight: 700 }}>What it is · </span>
                    {it.what}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.92 }}>
                    <span style={{ opacity: 0.55, fontWeight: 700 }}>How to use · </span>
                    {it.how}
                  </div>
                </div>
              ))}
            </div>
            <div className="help-foot">This guide changes for each screen you open.</div>
          </div>
        )}
        <button
          className={`help-fab${open ? " open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-label="Help"
        >
          {open ? <X size={22} /> : <HelpCircle size={22} />}
          {!open && <span className="help-fab-label">Help</span>}
        </button>
      </div>
    </>
  );
}
