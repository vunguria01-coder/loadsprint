import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import {
  MapPin,
  FileText,
  Share2,
  TrendingUp,
  Receipt,
  Truck,
  BellRing,
  Smartphone,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Create account — LoadSprint",
  description: "Register as a dispatcher on LoadSprint.",
};

const features = [
  {
    Icon: MapPin,
    title: "Live GPS tracking",
    desc: "Real trailer position on the map with the true road route, miles and hours left to delivery.",
  },
  {
    Icon: FileText,
    title: "AI rate-con import",
    desc: "Drop the broker's rate confirmation — AI reads every stop, the rate and the broker contact.",
  },
  {
    Icon: Share2,
    title: "Broker portal",
    desc: "Share a private link — live location, status, documents and the rate con you choose.",
  },
  {
    Icon: TrendingUp,
    title: "Profit & P&L",
    desc: "Revenue minus driver pay and truck cost — net profit and margin on every single load.",
  },
  {
    Icon: Receipt,
    title: "Receivables (A/R)",
    desc: "See which brokers have paid, with aging buckets and one-tap “mark paid”.",
  },
  {
    Icon: Truck,
    title: "My Trucks",
    desc: "Purchase, repairs, fuel cards and maintenance — with monthly and yearly reports.",
  },
  {
    Icon: BellRing,
    title: "Reminders",
    desc: "Document expiry and mileage-based maintenance, flagged before anything runs out.",
  },
  {
    Icon: Smartphone,
    title: "Driver app",
    desc: "Drivers get their loads, share GPS and upload PODs straight from their phone.",
  },
];

export default function RegisterPage() {
  return (
    <AuthShell>
      <div className="reg-split">
        <aside className="reg-features">
          <span className="rf-eyebrow">Everything a dispatch needs</span>
          <h2 className="rf-title">Dispatch, track and get paid — without the spreadsheet.</h2>
          <p className="rf-lead">
            One workspace for your loads, drivers and money. Set up in a minute — free to start.
          </p>
          <ul className="rf-list">
            {features.map((f) => (
              <li key={f.title}>
                <span className="rf-ic">
                  <f.Icon size={18} />
                </span>
                <div>
                  <b>{f.title}</b>
                  <span>{f.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <div className="reg-formcol">
          <RegisterForm />
        </div>
      </div>
    </AuthShell>
  );
}
