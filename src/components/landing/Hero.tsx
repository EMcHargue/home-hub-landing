import heroImg from "@/assets/hero-home.jpg";
import { Button } from "@/components/ui/button";
import { ArrowRight, Home } from "lucide-react";

const Hero = () => (
  <section className="relative min-h-[90vh] flex items-center overflow-hidden">
    <div className="absolute inset-0">
      <img src={heroImg} alt="Modern home interior" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent" />
    </div>
    <div className="container relative z-10 py-24">
      <div className="max-w-2xl space-y-6 animate-fade-up">
        <div className="flex items-center gap-2 text-primary-foreground/80">
          <Home className="h-5 w-5" />
          <span className="text-sm font-medium tracking-widest uppercase">House Manager</span>
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-primary-foreground leading-[1.1]">
          Your home,<br />beautifully managed.
        </h1>
        <p className="text-lg text-primary-foreground/75 max-w-lg">
          Track maintenance, manage expenses, and keep every detail of your property organized — all in one elegant platform.
        </p>
        <div className="flex gap-4 pt-4">
          <Button size="lg" className="gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            Learn More
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default Hero;
