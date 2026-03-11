import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CTA = () => (
  <section className="py-24">
    <div className="container">
      <div className="rounded-2xl bg-primary px-8 py-16 md:px-16 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
          Ready to simplify homeownership?
        </h2>
        <p className="text-primary-foreground/75 max-w-md mx-auto mb-8">
          Join thousands of homeowners who manage their property with confidence.
        </p>
        <Button size="lg" variant="secondary" className="gap-2">
          Start Free Trial <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </section>
);

export default CTA;
