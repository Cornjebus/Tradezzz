/**
 * TradeZZZ - Make Money In Your Sleep
 * AI-Powered Crypto Trading Platform
 */

import { SignedIn, SignedOut, SignIn, useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { Moon, TrendingUp, Bot, Shield, Zap, BarChart3, Sparkles } from 'lucide-react';
import { Dashboard } from './components/Dashboard';

// TradeZZZ Logo Component
function TradeZZZLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 'h-6 w-6', text: 'text-lg', z: 'text-xs' },
    md: { icon: 'h-8 w-8', text: 'text-2xl', z: 'text-sm' },
    lg: { icon: 'h-12 w-12', text: 'text-4xl', z: 'text-lg' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Moon className={`${s.icon} text-indigo-400`} />
        <Sparkles className="h-3 w-3 text-yellow-400 absolute -top-1 -right-1" />
      </div>
      <span className={`${s.text} font-bold`}>
        Trade<span className="text-indigo-400">ZZZ</span>
      </span>
    </div>
  );
}

// Landing page for unauthenticated users
function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  if (showSignIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a12] to-[#12121f] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <TradeZZZLogo size="lg" />
            </div>
            <p className="text-gray-400">Sign in to start making money in your sleep</p>
          </div>
          <SignIn
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-[#12121a] border border-indigo-900/30 shadow-xl shadow-indigo-500/10',
                headerTitle: 'text-white',
                headerSubtitle: 'text-gray-400',
                socialButtonsBlockButton: 'bg-[#1a1a2e] border-indigo-900/30 text-white hover:bg-[#252540] hover:border-indigo-500/50',
                formFieldLabel: 'text-gray-300',
                formFieldInput: 'bg-[#1a1a2e] border-indigo-900/30 text-white focus:border-indigo-500',
                footerActionLink: 'text-indigo-400 hover:text-indigo-300',
                formButtonPrimary: 'bg-indigo-500 hover:bg-indigo-600',
              }
            }}
            forceRedirectUrl="http://localhost:3000"
            signUpForceRedirectUrl="http://localhost:3000"
            fallbackRedirectUrl="http://localhost:3000"
          />
          <button
            onClick={() => setShowSignIn(false)}
            className="mt-4 w-full text-gray-400 hover:text-white text-sm"
          >
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a12] to-[#12121f] text-white">
      {/* Header */}
      <header className="border-b border-indigo-900/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <TradeZZZLogo />
          <button
            onClick={() => setShowSignIn(true)}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-medium transition-colors"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          {/* Floating ZZZ animation */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Moon className="h-20 w-20 text-indigo-400" />
              <span className="absolute -top-2 -right-4 text-2xl animate-bounce">💤</span>
              <span className="absolute top-0 -right-8 text-xl animate-bounce delay-100">💤</span>
              <span className="absolute top-2 -right-12 text-lg animate-bounce delay-200">💤</span>
            </div>
          </div>

          <h1 className="text-6xl font-bold mb-4">
            Trade<span className="text-indigo-400">ZZZ</span>
          </h1>
          <p className="text-2xl text-indigo-300 mb-6 font-medium">
            Make Money In Your Sleep 💰😴
          </p>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            AI-powered crypto trading that works 24/7. Connect your exchanges,
            set your strategy, and let the bots handle the rest while you dream.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setShowSignIn(true)}
              className="px-8 py-4 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-lg font-medium transition-all hover:scale-105"
            >
              Start Trading Free →
            </button>
            <button className="px-8 py-4 border border-indigo-500/50 hover:border-indigo-400 rounded-lg text-lg font-medium transition-colors">
              Watch Demo
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<TrendingUp className="h-8 w-8" />}
            title="Multi-Exchange"
            description="Connect Binance, Coinbase, Kraken, and more. One dashboard for all your accounts."
          />
          <FeatureCard
            icon={<Bot className="h-8 w-8" />}
            title="Your AI, Your Choice"
            description="Bring your own OpenAI, Anthropic, or DeepSeek API. Pay only for what you use."
          />
          <FeatureCard
            icon={<Moon className="h-8 w-8" />}
            title="24/7 Automation"
            description="Set it and forget it. Your strategies execute automatically while you sleep."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="Paper Trading First"
            description="Test strategies risk-free before going live. No real money at stake."
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8" />}
            title="Pattern Learning"
            description="AI learns from every trade, getting smarter over time with RuVector memory."
          />
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8" />}
            title="Real-Time Analytics"
            description="Track P&L, win rates, and AI confidence scores in beautiful dashboards."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-gray-400 text-center mb-12">Three steps to passive income</p>

        <div className="grid md:grid-cols-3 gap-8">
          <StepCard
            number="1"
            title="Connect"
            description="Link your exchange accounts and AI provider. Your keys, your control."
            emoji="🔗"
          />
          <StepCard
            number="2"
            title="Configure"
            description="Set up your trading strategy. Choose risk level, assets, and AI model."
            emoji="⚙️"
          />
          <StepCard
            number="3"
            title="Sleep"
            description="Let TradeZZZ handle the rest. Wake up to potential profits."
            emoji="😴"
          />
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Simple Pricing</h2>
        <p className="text-gray-400 text-center mb-12">Start free, upgrade when you're ready</p>

        <div className="grid md:grid-cols-4 gap-6">
          <PricingCard
            tier="Dreamer"
            price="$0"
            features={['1 Strategy', '2 AI Models', 'Paper Trading Only', '5 Backtests/Day']}
            emoji="😴"
          />
          <PricingCard
            tier="Sleeper"
            price="$29"
            features={['5 Strategies', 'All AI Models', 'Live Trading', '50 Backtests/Day']}
            highlighted
            emoji="💤"
          />
          <PricingCard
            tier="Deep Sleep"
            price="$99"
            features={['20 Strategies', 'Priority Support', 'Advanced Analytics', 'Unlimited Backtests']}
            emoji="🌙"
          />
          <PricingCard
            tier="Comatose"
            price="$299"
            features={['Unlimited Everything', 'API Access', 'White-Label Option', 'Dedicated Support']}
            emoji="⭐"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-indigo-900/30 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center mb-6">
            <TradeZZZLogo />
          </div>
          <p className="text-center text-indigo-300 mb-4 font-medium">
            Your Exchange • Your AI • Your Strategy • Your Dreams 💤
          </p>
          <p className="text-center text-gray-500 text-sm max-w-2xl mx-auto">
            TradeZZZ is a research & execution tool. We never hold your funds or custody your assets.
            Trading cryptocurrency involves substantial risk of loss. Past performance is not indicative of future results.
            Please trade responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6 hover:border-indigo-500/50 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
      <div className="text-indigo-400 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description, emoji }: { number: string; title: string; description: string; emoji: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center mx-auto mb-4 text-2xl">
        {emoji}
      </div>
      <div className="text-indigo-400 text-sm font-medium mb-2">Step {number}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function PricingCard({ tier, price, features, highlighted = false, emoji }: {
  tier: string;
  price: string;
  features: string[];
  highlighted?: boolean;
  emoji: string;
}) {
  return (
    <div className={`rounded-xl p-6 transition-all hover:scale-105 ${
      highlighted
        ? 'bg-indigo-500/20 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20'
        : 'bg-[#12121a]/80 border border-indigo-900/30'
    }`}>
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="text-xl font-semibold mb-2">{tier}</h3>
      <p className="text-3xl font-bold mb-4">
        {price}<span className="text-sm text-gray-400">/mo</span>
      </p>
      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="text-gray-300 text-sm flex items-center gap-2">
            <span className="text-indigo-400">✓</span> {feature}
          </li>
        ))}
      </ul>
      {highlighted && (
        <div className="mt-4 text-center">
          <span className="text-xs bg-indigo-500 px-2 py-1 rounded-full">Most Popular</span>
        </div>
      )}
    </div>
  );
}

// Loading state
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0a12] to-[#12121f]">
      <div className="text-center">
        <div className="relative mb-4">
          <Moon className="h-16 w-16 text-indigo-400 mx-auto animate-pulse" />
          <span className="absolute -top-2 right-1/3 text-xl animate-bounce">💤</span>
        </div>
        <p className="text-gray-400">Loading TradeZZZ...</p>
      </div>
    </div>
  );
}

// Main App component
export function App() {
  // Check if we have Clerk available
  const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // No Clerk = demo mode, show dashboard directly
  if (!hasClerk) {
    return <Dashboard />;
  }

  // With Clerk: use auth flow
  return <AuthenticatedApp />;
}

// Separate component for Clerk-wrapped auth flow
function AuthenticatedApp() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  );
}

export default App;
