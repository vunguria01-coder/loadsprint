"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const steps = [
  { title: "Request a Quote", desc: "Tell us your lane, freight type, and date — get pricing fast." },
  { title: "We Find the Carrier", desc: "LoadSprint matches your load to the best vetted carrier." },
  { title: "Shipment Pickup", desc: "Your freight is collected on schedule, hassle-free." },
  { title: "Real-Time Tracking", desc: "Follow every mile with live updates from the road." },
  { title: "Successful Delivery", desc: "On-time, in full — with proof of delivery confirmed." },
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
          <span className="eyebrow">The process</span>
          <h2 className="h2">
            From quote to delivery in{" "}
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
