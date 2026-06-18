"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "How quickly can I receive a quote?",
    a: "Most quotes are returned in under 30 minutes during business hours, and our 24/7 dispatch can price urgent loads any time. Submit the freight quote form and we'll get back to you fast.",
  },
  {
    q: "What freight types do you handle?",
    a: "FTL, LTL, expedited, dry van, reefer (temperature-controlled), and flatbed for oversized or specialized cargo. If you're not sure which fits, our team will recommend the right option.",
  },
  {
    q: "Do you provide tracking?",
    a: "Yes. Every shipment includes real-time tracking with location and status updates from pickup through delivery, shared with everyone who needs visibility.",
  },
  {
    q: "Can carriers apply online?",
    a: "Absolutely. Use the carrier application above with your MC and DOT numbers. Onboarding is usually completed the same day so you can start hauling quickly.",
  },
  {
    q: "What regions do you serve?",
    a: "We provide nationwide coverage across the 48 contiguous United States, with carrier capacity on lanes in every region.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const ansRef = useRef<HTMLDivElement>(null);
  return (
    <div className={`faq${open ? " open" : ""}`}>
      <button aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {q}
        <span className="chev">
          <Plus size={16} strokeWidth={2.4} />
        </span>
      </button>
      <div
        className="ans"
        ref={ansRef}
        style={{ maxHeight: open ? ansRef.current?.scrollHeight ?? 999 : 0 }}
      >
        <p>{a}</p>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="shead center">
          <span className="eyebrow">Questions</span>
          <h2 className="h2">Frequently asked</h2>
        </div>
        <div className="faq-grid">
          {faqs.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
