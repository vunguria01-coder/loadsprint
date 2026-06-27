"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const steps = [
  { title: "Import the rate con", desc: "Upload the rate confirmation — AI reads the stops, addresses, rate and payer automatically." },
  { title: "Assign a driver", desc: "Invite a driver by email and assign the load. They get it instantly in the mobile app." },
  { title: "Track live", desc: "Watch the driver's GPS on the map, with live distance to each pickup and to delivery." },
  { title: "Drivers run the stops", desc: "Drivers copy addresses one-tap, work each pickup and drop, and snap cargo & paperwork photos." },
  { title: "Send the broker packet", desc: "Generate the AI invoice and download one ZIP — confirmation, photos and invoice, ready to send." },
];

function Step({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={`step${inView ? " lit" : ""}`}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
    >
      <div className="num">{index + 1}</div>
      <h4>{title}</h4>
      <p>{desc}</p>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="shead center">
          <span className="eyebrow">The workflow</span>
          <h2 className="h2">
            From rate con to invoice in{" "}
            <span className="grad-text">five steps</span>
          </h2>
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <Step key={s.title} index={i} title={s.title} desc={s.desc} />
          ))}
        </div>
      </div>
    </section>
  );
}
