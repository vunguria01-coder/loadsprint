"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { useToast } from "@/components/toast";
import { carrierSchema, type CarrierValues } from "@/lib/schemas";

export function CarrierForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CarrierValues>({ resolver: zodResolver(carrierSchema) });

  const onSubmit = async (values: CarrierValues) => {
    try {
      await fetch("/api/carrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      toast("Application received", "An onboarding specialist will reach out soon.");
      reset();
    } catch {
      toast("Something went wrong", "Please try again in a moment.");
    }
  };

  return (
    <section className="section why" id="carrier-form">
      <div className="wrap quote-wrap">
        <Reveal>
          <span className="eyebrow">Carrier onboarding</span>
          <h2 className="h2">
            Join the <span className="grad-text">LoadSprint</span> carrier
            network
          </h2>
          <p className="lead" style={{ marginTop: 18 }}>
            Run with consistent freight, fast pay, and dispatchers who have your
            back. Tell us about your operation and we&apos;ll get you set up to
            start hauling.
          </p>
          <div className="aud-card" style={{ marginTop: 28, padding: 24 }}>
            <ul style={{ margin: 0 }}>
              <li>
                <Check strokeWidth={2.4} /> Quick-pay available on delivered loads
              </li>
              <li>
                <Check strokeWidth={2.4} /> Onboarding usually completed the same
                day
              </li>
            </ul>
          </div>
        </Reveal>

        <form className="form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <h3>Carrier application</h3>
          <p className="sub">We verify MC/DOT before activating your account.</p>
          <div className="fgrid">
            <div className={`field full${errors.company ? " err" : ""}`}>
              <label>Company name</label>
              <input placeholder="Your carrier company" {...register("company")} />
              <span className="msg">{errors.company?.message}</span>
            </div>
            <div className={`field${errors.mc ? " err" : ""}`}>
              <label>MC number</label>
              <input placeholder="MC-000000" {...register("mc")} />
              <span className="msg">{errors.mc?.message}</span>
            </div>
            <div className={`field${errors.dot ? " err" : ""}`}>
              <label>DOT number</label>
              <input placeholder="0000000" {...register("dot")} />
              <span className="msg">{errors.dot?.message}</span>
            </div>
            <div className={`field${errors.contact ? " err" : ""}`}>
              <label>Contact name</label>
              <input placeholder="Full name" {...register("contact")} />
              <span className="msg">{errors.contact?.message}</span>
            </div>
            <div className={`field${errors.phone ? " err" : ""}`}>
              <label>Phone</label>
              <input type="tel" placeholder="(555) 000-0000" {...register("phone")} />
              <span className="msg">{errors.phone?.message}</span>
            </div>
            <div className={`field full${errors.email ? " err" : ""}`}>
              <label>Email</label>
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
            {isSubmitting ? "Submitting…" : "Join carrier network"}
          </button>
          <p className="form-note">
            An onboarding specialist will reach out to verify your details.
          </p>
        </form>
      </div>
    </section>
  );
}
