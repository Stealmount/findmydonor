import React from "react";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { FAQ } from "./FAQ";
import { Footer } from "./Footer";
import { DirectoriesHubSection } from "./DirectoriesHubSection";
import { LiveDonorAvailability } from "./LiveDonorAvailability";

interface RaktdaanHomeProps {
  onNavigate: (view: any) => void;
}

export function RaktdaanHome({ onNavigate }: RaktdaanHomeProps) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar onNavigate={onNavigate} />
      <main>
        <Hero onNavigate={onNavigate} />
        <LiveDonorAvailability />
        <DirectoriesHubSection onNavigate={onNavigate} />
        <Features />
        <FAQ />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
