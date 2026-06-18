"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Phone, MapPin } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { useToast } from "@/components/toast";
import { contactSchema, type ContactValues } from "@/lib/schemas";

export function Contact() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (values: ContactValues) => {
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      toast("Message sent", "Thanks — we'll get back to you within the hour.");
      reset();
    } catch {
      toast("Something went wrong", "Please try again in a moment.");
    }
  };

  return (
    <section className="section why" id="contact">
      <div className="wrap">
        <Reveal className="shead" >
          <span className="eyebrow">Get in touch</span>
          <h2 className="h2">
            Talk to a real <span className="grad-text">dispatcher</span>
          </h2>
          <p className="lead" style={{ marginTop: 16 }}>
            Have a load to move or a question about partnering? Reach out — we
            answer around the clock.
          </p>
        </Reveal>
        <div className="contact-grid">
          <form className="form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="fgrid">
              <div className={`field${errors.name ? " err" : ""}`}>
                <label>Name</label>
                <input placeholder="Your name" {...register("name")} />
                <span className="msg">{errors.name?.message}</span>
              </div>
              <div className="field">
                <label>Company</label>
                <input placeholder="Company" {...register("company")} />
              </div>
              <div className={`field${errors.email ? " err" : ""}`}>
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  {...register("email")}
                />
                <span className="msg">{errors.email?.message}</span>
              </div>
              <div className="field">
                <label>Phone</label>
                <input type="tel" placeholder="(555) 000-0000" {...register("phone")} />
              </div>
              <div className="field">
                <label>Freight type</label>
                <select defaultValue="" {...register("freightType")}>
                  <option value="">Select…</option>
                  <option>FTL</option>
                  <option>LTL</option>
                  <option>Expedited</option>
                  <option>Dry Van</option>
                  <option>Reefer</option>
                  <option>Flatbed</option>
                </select>
              </div>
              <div className="field">
                <label>Origin</label>
                <input placeholder="City, State" {...register("origin")} />
              </div>
              <div className="field full">
                <label>Destination</label>
                <input placeholder="City, State" {...register("destination")} />
              </div>
              <div className={`field full${errors.message ? " err" : ""}`}>
                <label>Message</label>
                <textarea
                  placeholder="Tell us about your shipment…"
                  {...register("message")}
                />
                <span className="msg">{errors.message?.message}</span>
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: 18 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
          </form>

          <div>
            <div className="ci-list">
              <div className="ci">
                <div className="cii">
                  <Mail strokeWidth={1.9} />
                </div>
                <div>
                  <div className="k">Email</div>
                  <div className="v">dispatch@loadsprint.com</div>
                </div>
              </div>
              <div className="ci">
                <div className="cii">
                  <Phone strokeWidth={1.9} />
                </div>
                <div>
                  <div className="k">Phone</div>
                  <div className="v">+1 (888) 555-0142</div>
                </div>
              </div>
              <div className="ci">
                <div className="cii">
                  <MapPin strokeWidth={1.9} />
                </div>
                <div>
                  <div className="k">Office</div>
                  <div className="v">Atlanta, GA · United States</div>
                </div>
              </div>
            </div>
            <div className="map">
              <iframe
                title="LoadSprint office location"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps?q=Atlanta,+GA&output=embed"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
