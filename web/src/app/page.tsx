"use client";

import { useAccount } from "wagmi";
import ConnectButton from "@/components/ConnectButton";
import CreateTrip from "@/components/CreateTrip";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav Bar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
            R
          </div>
          <span className="text-lg font-semibold tracking-tight">
            RoadTrip Co-Pilot
          </span>
        </div>
        <ConnectButton />
      </nav>

      {/* Hero / Main Content */}
      {!isConnected ? (
        <HeroSection />
      ) : (
        <DashboardSection />
      )}
    </main>
  );
}

function HeroSection() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      {/* Decorative road lines */}
      <div className="mb-8 relative">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-amber-500 flex items-center justify-center text-4xl shadow-lg shadow-purple-500/20">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-2-2.2-3.3C13 5.6 12 5 11 5H5c-1 0-2 .5-2.8 1.2L0 8" />
            <path d="M5 17H3" />
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
            <path d="M9 17h6" />
          </svg>
        </div>
      </div>

      <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
        Give your car a{" "}
        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-amber-400 text-transparent bg-clip-text">
          wallet
        </span>
      </h1>

      <p className="text-[var(--text-secondary)] text-lg sm:text-xl max-w-lg mb-8 leading-relaxed">
        Voice-first AI agent for group road trips. Pool USDC, let the AI manage spending,
        and hit the road.
      </p>

      <div className="mb-12">
        <ConnectButton />
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
        <FeatureCard
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          }
          title="Voice-First"
          desc="Talk to your co-pilot. It finds stops, checks weather, and manages the budget."
        />
        <FeatureCard
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          }
          title="Shared Treasury"
          desc="Friends pool USDC on-chain. Transparent spending with real-time tracking."
        />
        <FeatureCard
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
          title="AI Agent Spending"
          desc="The agent autonomously pays for gas, food, and lodging within your limits."
        />
      </div>

      {/* Built for badge */}
      <div className="mt-16 mb-8 text-sm text-[var(--text-secondary)]">
        Built for ETHGlobal Cannes 2026
      </div>
    </div>
  );
}

function DashboardSection() {
  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Your Trips</h2>
        <p className="text-[var(--text-secondary)]">
          Create a new trip or join an existing one.
        </p>
      </div>

      <CreateTrip />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="glass-card p-5 text-left hover:border-[var(--accent-blue)]/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
    </div>
  );
}
