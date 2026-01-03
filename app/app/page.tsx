import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Moon, TrendingUp, Bot, Shield, Zap, BarChart3, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

// TradeZZZ Logo Component
function TradeZZZLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { icon: "h-6 w-6", text: "text-lg" },
    md: { icon: "h-8 w-8", text: "text-2xl" },
    lg: { icon: "h-12 w-12", text: "text-4xl" },
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

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card/80 border border-border rounded-xl p-6 hover:border-indigo-500/50 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
      <div className="text-indigo-400 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
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
      <p className="text-muted-foreground">{description}</p>
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
        ? "bg-indigo-500/20 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20"
        : "bg-card/80 border border-border"
    }`}>
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="text-xl font-semibold mb-2">{tier}</h3>
      <p className="text-3xl font-bold mb-4">
        {price}<span className="text-sm text-muted-foreground">/mo</span>
      </p>
      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="text-muted-foreground text-sm flex items-center gap-2">
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

export default async function Home() {
  // Check if user is signed in - redirect to dashboard if so
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  // Show landing page for non-authenticated users
  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <TradeZZZLogo />
          <div className="flex items-center gap-3">
            <Link href="/explore">
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" />
                Explore Prices
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          {/* Floating ZZZ animation */}
          <div className="flex justify-center mb-6">
            <div className="relative animate-float">
              <Moon className="h-20 w-20 text-indigo-400" />
              <span className="absolute -top-2 -right-4 text-2xl animate-bounce">💤</span>
              <span className="absolute top-0 -right-8 text-xl animate-bounce [animation-delay:100ms]">💤</span>
              <span className="absolute top-2 -right-12 text-lg animate-bounce [animation-delay:200ms]">💤</span>
            </div>
          </div>

          <h1 className="text-6xl font-bold mb-4">
            Trade<span className="text-indigo-400">ZZZ</span>
          </h1>
          <p className="text-2xl text-indigo-300 mb-6 font-medium">
            Make Money In Your Sleep 💰😴
          </p>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            AI-powered crypto trading that works 24/7. Connect your exchanges,
            set your strategy, and let the bots handle the rest while you dream.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/explore">
              <Button size="lg" className="text-lg gap-2">
                <Eye className="h-5 w-5" />
                Explore Live Prices
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="outline" size="lg" className="text-lg">
                Start Trading Free →
              </Button>
            </Link>
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
        <p className="text-muted-foreground text-center mb-12">Three steps to passive income</p>

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
        <p className="text-muted-foreground text-center mb-12">Start free, upgrade when you&apos;re ready</p>

        <div className="grid md:grid-cols-4 gap-6">
          <PricingCard
            tier="Dreamer"
            price="$0"
            features={["1 Strategy", "2 AI Models", "Paper Trading Only", "5 Backtests/Day"]}
            emoji="😴"
          />
          <PricingCard
            tier="Sleeper"
            price="$29"
            features={["5 Strategies", "All AI Models", "Live Trading", "50 Backtests/Day"]}
            highlighted
            emoji="💤"
          />
          <PricingCard
            tier="Deep Sleep"
            price="$99"
            features={["20 Strategies", "Priority Support", "Advanced Analytics", "Unlimited Backtests"]}
            emoji="🌙"
          />
          <PricingCard
            tier="Comatose"
            price="$299"
            features={["Unlimited Everything", "API Access", "White-Label Option", "Dedicated Support"]}
            emoji="⭐"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center mb-6">
            <TradeZZZLogo />
          </div>
          <p className="text-center text-indigo-300 mb-4 font-medium">
            Your Exchange • Your AI • Your Strategy • Your Dreams 💤
          </p>
          <p className="text-center text-muted-foreground text-sm max-w-2xl mx-auto">
            TradeZZZ is a research & execution tool. We never hold your funds or custody your assets.
            Trading cryptocurrency involves substantial risk of loss. Past performance is not indicative of future results.
            Please trade responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
}
