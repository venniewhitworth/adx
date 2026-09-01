"use client";

import { useCallback, useState } from "react";
import ConsultModal from "@/components/ConsultModal";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PainPointsSection from "@/components/sections/PainPointsSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import HighlightsSection from "@/components/sections/HighlightsSection";
import ValuesSection from "@/components/sections/ValuesSection";
import CasesSection from "@/components/sections/CasesSection";
import PricingSection from "@/components/sections/PricingSection";
import CtaSection from "@/components/sections/CtaSection";
import Footer from "@/components/sections/Footer";

export default function HomePage() {
  const [consultOpen, setConsultOpen] = useState(false);

  const handleBuyClick = useCallback(() => {
    const target = document.getElementById("pricing");
    target?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleConsultClick = useCallback(() => {
    setConsultOpen(true);
  }, []);

  return (
    <main className="min-h-screen bg-[#F7F8FF] text-foreground">
      <Header onBuyClick={handleBuyClick} onConsultClick={handleConsultClick} />
      <Hero onBuyClick={handleBuyClick} onConsultClick={handleConsultClick} />
      <PainPointsSection />
      <FeaturesSection />
      <HighlightsSection />
      <ValuesSection />
      <CasesSection />
      <PricingSection onConsultClick={handleConsultClick} />
      <CtaSection onConsultClick={handleConsultClick} />
      <Footer />
      <ConsultModal open={consultOpen} onClose={() => setConsultOpen(false)} />
    </main>
  );
}
