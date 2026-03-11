import { CalendarCheck, DollarSign, Wrench, Shield } from "lucide-react";

const features = [
  { icon: Wrench, title: "Maintenance Tracking", desc: "Schedule and log repairs, inspections, and upkeep so nothing falls through the cracks." },
  { icon: DollarSign, title: "Expense Management", desc: "Monitor spending across utilities, repairs, and improvements with clear breakdowns." },
  { icon: CalendarCheck, title: "Smart Reminders", desc: "Never miss a filter change, lease renewal, or seasonal task with automated alerts." },
  { icon: Shield, title: "Document Vault", desc: "Store warranties, contracts, and insurance documents securely in one place." },
];

const Features = () => (
  <section className="py-24 bg-background">
    <div className="container">
      <div className="text-center max-w-xl mx-auto mb-16 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <p className="text-sm font-semibold tracking-widest uppercase text-accent mb-3">Features</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
          Everything your home needs
        </h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="group rounded-xl border border-border bg-card p-8 transition-shadow hover:shadow-[var(--card-hover-shadow)] animate-fade-up"
            style={{ animationDelay: `${0.15 + i * 0.1}s` }}
          >
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-semibold text-card-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
