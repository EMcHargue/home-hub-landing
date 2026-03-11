import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => (
  <div className="min-h-screen bg-background font-sans">
    <Hero />
    <Features />
    <CTA />
    <Footer />
  </div>
);

export default Index;
