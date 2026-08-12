import React from "react";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { BloodGroupMarquee } from "./BloodGroupMarquee";
import { WhatFMDDoes } from "./WhatFMDDoes";
import { Features } from "./Features";
import { Showcase } from "./Showcase";
import { Benefits } from "./Benefits";
import { Impact } from "./Impact";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { LiveFeed } from "./LiveFeed";
import { Leaderboard } from "./Leaderboard";
import { DirectoriesHubSection } from "./DirectoriesHubSection";

// Auth state is read from useAuth() inside Navbar (Task 4.2).
interface RaktdaanHomeProps {
  onNavigate: (view: any) => void;
}

export function RaktdaanHome({ onNavigate }: RaktdaanHomeProps) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar onNavigate={onNavigate} />
      <main>
        <Hero onNavigate={onNavigate} />
        <LiveFeed />
        <BloodGroupMarquee />
        <Leaderboard />
        <DirectoriesHubSection onNavigate={onNavigate} />
        <div className="section-fade-top">
          <WhatFMDDoes />
        </div>
        <CTA onNavigate={onNavigate} />
        <Features />
        <Benefits />
        <FAQ />
        <Impact />
        <Showcase />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
