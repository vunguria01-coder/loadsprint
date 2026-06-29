"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";

type Help = { title: string; intro: string; points: string[] };

const GENERAL: Help = {
  title: "LoadSprint help",
  intro: "Here's what each part of the app does. Open any screen and this panel explains it.",
  points: [
    "Home — your daily overview: active loads, drivers, completed loads and earnings.",
    "Drivers — invite drivers and open a driver to create loads and see live GPS.",
    "Completed — finished loads, with document packages to download.",
    "Calendar — schedule pickups and deliveries and see them by day.",
    "Insights — revenue and performance charts.",
    "Settlements — set driver pay and download pay statements.",
    "Team — invite extra dispatchers and set their commission.",
    "Plans & billing — choose a plan; Invoice details (in your account menu) sets your invoice header.",
  ],
};

function helpFor(path: string): Help {
  if (path.startsWith("/dashboard"))
    return {
      title: "Home",
      intro: "Your daily overview — everything that needs attention in one place.",
      points: [
        "The cards show your active loads, drivers, completed loads, and your earnings (if a commission % is set).",
        "Active loads are listed below — click any one to open it.",
        "Use \"Manage drivers\" to add a driver or open a driver's loads.",
        "New here? The \"Start here\" steps walk you through your first load.",
      ],
    };
  if (path === "/drivers")
    return {
      title: "Drivers",
      intro: "Your driver roster. Open a driver to see their loads, GPS, and create a new load.",
      points: [
        "\"Add driver\" invites a driver by email — they get a join code for the mobile app.",
        "The counter shows how many drivers your plan allows.",
        "Search by driver name, email, load number or broker.",
        "Each card shows the driver's status (Active or Pending) and load counts.",
        "Click a driver to open their loads and create a new load.",
      ],
    };
  if (path.startsWith("/drivers/"))
    return {
      title: "Driver",
      intro: "Everything for one driver — their loads and live location.",
      points: [
        "Create a new load here. You can upload a rate confirmation PDF and AI fills in the details automatically.",
        "See this driver's loads and open any one for full control.",
        "Track the driver's live location when they're sharing it.",
      ],
    };
  if (path.startsWith("/loads/"))
    return {
      title: "Load",
      intro: "Full control of a single load.",
      points: [
        "Map — track the truck and see distance and ETA to delivery.",
        "Documents & photos — upload, view, and download the load's paperwork.",
        "Status — move the load along: Assigned → In transit → Delivered → Closed.",
        "Invoice — generate an invoice with AI and send final documents to the broker.",
        "Chat — send messages about this load.",
      ],
    };
  if (path.startsWith("/review"))
    return {
      title: "Completed",
      intro: "Delivered and closed loads, grouped by driver.",
      points: [
        "Open a load (tap the card) to check its photos, documents and invoice.",
        "\"Review & send\" shows what's inside the broker package — confirmation, photos and invoice — so you can check and fix it, then download the ZIP for your broker.",
      ],
    };
  if (path.startsWith("/calendar"))
    return {
      title: "Calendar",
      intro: "Pickups and deliveries across all your loads, by day.",
      points: [
        "Blue marks a pickup, green marks a delivery.",
        "Use the ‹ › arrows to change month, or \"Today\" to jump back.",
        "In \"Schedule loads\" below, set each load's pickup and delivery dates and press Save — they appear on the calendar.",
        "Click any load shown on a day to open it.",
      ],
    };
  if (path.startsWith("/insights"))
    return {
      title: "Insights",
      intro: "Revenue and performance from your delivered loads.",
      points: [
        "Top cards: total revenue, this month, completed loads, and average per load.",
        "The chart shows revenue over the last 8 weeks.",
        "\"By driver\" shows each driver's delivered revenue and how many loads they ran.",
      ],
    };
  if (path.startsWith("/settlements"))
    return {
      title: "Settlements",
      intro: "Work out and document what each driver is paid.",
      points: [
        "Set a driver's pay — a percentage of each load, or a flat amount per delivered load — then press Save.",
        "Their pay is calculated automatically from their delivered loads.",
        "\"Download statement\" creates a PDF you can send to the driver.",
      ],
    };
  if (path.startsWith("/team"))
    return {
      title: "Team",
      intro: "Invite extra dispatchers who share your plan.",
      points: [
        "\"Add dispatcher\" invites a teammate who can manage loads and drivers.",
        "Set each dispatcher's commission % — their share of delivered loads.",
        "Only you (the owner) can see these percentages.",
      ],
    };
  if (path.startsWith("/invoice-settings"))
    return {
      title: "Invoice details",
      intro: "Your company details for invoices — entered once and remembered.",
      points: [
        "Fill in your company, contact and payment terms.",
        "The live preview on the right shows how your invoice header will look.",
        "Press \"Save details\" — these appear at the top of every invoice you create.",
      ],
    };
  if (path.startsWith("/billing"))
    return {
      title: "Plans & billing",
      intro: "Choose a plan to unlock features and add drivers.",
      points: [
        "Switch between \"Monthly\" and \"One month\" at the top.",
        "Each plan shows how many drivers it includes — Gold is the most popular.",
        "Checkout is secure through Stripe (Apple Pay, Google Pay and cards).",
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
                <div className="help-eyebrow">Help</div>
                <div className="help-title">{h.title}</div>
              </div>
              <button className="help-x" onClick={() => setOpen(false)} aria-label="Close help">
                <X size={18} />
              </button>
            </div>
            <p className="help-intro">{h.intro}</p>
            <ul className="help-points">
              {h.points.map((p, i) => (
                <li key={i}>
                  <span className="hp-n">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
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
