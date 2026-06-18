"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Clock } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { useToast } from "@/components/toast";
import { quoteSchema, type QuoteValues } from "@/lib/schemas";

export function QuoteForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuoteValues>({ resolver: zodResolver(quoteSchema) });

  const onSubmit = async (values: QuoteValues) => {
    try {
      await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      toast("Quote requested", "Our dispatch team will email your rate shortly.");
      reset();
    } catch {
      toast("Something went wrong", "Please try again in a moment.");
    }
  };

  return (
    <section className="section" id="quote">
      <div className="wrap quote-wrap">
        <Reveal>
          <span className="eyebrow">Freight quote</span>
          <h2 className="h2">
            Get a rate in <span className="grad-text">minutes</span>, not days
          </h2>
          <p className="lead" style={{ marginTop: 18 }}>
            Share a few details about your shipment and our dispatch team will
            come back with competitive, all-in pricing — no obligation, no spam.
          </p>
          <div className="hero-trust" style={{ marginTop: 30 }}>
            <span className="i">
              <Clock size={16} /> Average quote returned in under 30 min
            </span>
          </div>
        </Reveal>

        <form
          className="form-card"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <h3>Request a freight quote</h3>
          <p className="sub">
            Fields marked are required. We&apos;ll only use this to price your
            load.
          </p>
          <div className="fgrid">
            <div className={`field full${errors.pickup ? " err" : ""}`}>
              <label>Pickup location</label>
              <input placeholder="City, State or ZIP" {...register("pickup")} />
              <span className="msg">{errors.pickup?.message}</span>
            </div>
            <div className={`field full${errors.delivery ? " err" : ""}`}>
              <label>Delivery location</label>
              <input placeholder="City, State or ZIP" {...register("delivery")} />
              <span className="msg">{errors.delivery?.message}</span>
            </div>
            <div className={`field${errors.freight ? " err" : ""}`}>
              <label>Freight type</label>
              <select defaultValue="" {...register("freight")}>
                <option value="">Select…</option>
                <option>FTL</option>
                <option>LTL</option>
                <option>Expedited</option>
                <option>Dry Van</option>
                <option>Reefer</option>
                <option>Flatbed</option>
              </select>
              <span className="msg">{errors.freight?.message}</span>
            </div>
            <div className={`field${errors.trailer ? " err" : ""}`}>
              <label>Trailer type</label>
              <select defaultValue="" {...register("trailer")}>
                <option value="">Select…</option>
                <option>Dry Van (53′)</option>
                <option>Reefer</option>
                <option>Flatbed</option>
                <option>Step Deck</option>
                <option>Box Truck</option>
              </select>
              <span className="msg">{errors.trailer?.message}</span>
            </div>
            <div className={`field${errors.weight ? " err" : ""}`}>
              <label>Weight (lbs)</label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 24000"
                {...register("weight")}
              />
              <span className="msg">{errors.weight?.message}</span>
            </div>
            <div className={`field${errors.date ? " err" : ""}`}>
              <label>Shipment date</label>
              <input type="date" {...register("date")} />
              <span className="msg">{errors.date?.message}</span>
            </div>
            <div className={`field full${errors.email ? " err" : ""}`}>
              <label>Work email</label>
              <input
                type="email"
                placeholder="you@company.com"
                {...register("email")}
              />
              <span className="msg">{errors.email?.message}</span>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending…" : "Get my quote"} <ArrowRight size={17} />
          </button>
          <p className="form-note">
            By submitting you agree to be contacted about your shipment.
          </p>
        </form>
      </div>
    </section>
  );
}
