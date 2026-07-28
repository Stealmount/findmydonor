import React from "react";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { BloodGroupMarquee } from "./BloodGroupMarquee";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { Showcase } from "./Showcase";
import { Benefits } from "./Benefits";
import { Impact } from "./Impact";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { User as DonorUser, Requester } from "../../types";
import { LiveFeed } from "./LiveFeed";
import { Leaderboard } from "./Leaderboard";
import { DirectoriesHubSection } from "./DirectoriesHubSection";

interface RaktdaanHomeProps {
  onNavigate: (view: any) => void;
  loggedInUser?: DonorUser | null;
  loggedInRequester?: Requester | null;
}

export function RaktdaanHome({
  onNavigate,
  loggedInUser,
  loggedInRequester,
}: RaktdaanHomeProps) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar
        onNavigate={onNavigate}
        loggedInUser={loggedInUser}
        loggedInRequester={loggedInRequester}
      />
      <main>
        <Hero onNavigate={onNavigate} />
        <LiveFeed />
        <BloodGroupMarquee />
        <Leaderboard />
        <div className="section-fade-top">
          <HowItWorks />
        </div>
        <Features />
        <Showcase />
        <DirectoriesHubSection onNavigate={onNavigate} />
        <Benefits />
        <Impact />
        <FAQ />
        <CTA onNavigate={onNavigate} />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
