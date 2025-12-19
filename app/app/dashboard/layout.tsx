"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  Moon,
  LayoutDashboard,
  Link2,
  Bot,
  LineChart,
  History,
  Settings,
  Sparkles,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// TradeZZZ Logo Component
function TradeZZZLogo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <div className="relative">
        <Moon className="h-8 w-8 text-indigo-400" />
        <Sparkles className="h-3 w-3 text-yellow-400 absolute -top-1 -right-1" />
      </div>
      <span className="text-xl font-bold">
        Trade<span className="text-indigo-400">ZZZ</span>
      </span>
    </Link>
  );
}

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/exchanges", label: "Exchanges", icon: Link2 },
  { href: "/dashboard/ai-providers", label: "AI Providers", icon: Bot },
  { href: "/dashboard/strategies", label: "Strategies", icon: LineChart },
  { href: "/dashboard/orders", label: "Orders", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen text-white flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <TradeZZZLogo />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "text-muted-foreground hover:text-white hover:bg-muted"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <UserButton afterSignOutUrl="/" />
            <div className="flex-1">
              <p className="text-sm font-medium">{user?.firstName || "Sleeper"}</p>
              <Badge variant="secondary" className="text-xs">
                😴 Dreamer
              </Badge>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <TradeZZZLogo />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-16">
          <nav className="p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "text-muted-foreground hover:text-white hover:bg-muted"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <UserButton afterSignOutUrl="/" />
              <div className="flex-1">
                <p className="text-sm font-medium">{user?.firstName || "Sleeper"}</p>
                <Badge variant="secondary" className="text-xs">
                  😴 Dreamer
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-16">
        {/* Header with Trading Mode Indicator */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-8 py-4 flex items-center justify-between">
          <div />
          <TradingModeIndicator />
        </div>

        {children}
      </main>
    </div>
  );
}

// Trading Mode Indicator Component
function TradingModeIndicator() {
  const [mode, setMode] = useState<"paper" | "live">("paper");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {mode === "paper" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              Paper Trading
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live Trading
            </>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode("paper")}>
          <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
          Paper Trading
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("live")}>
          <span className="h-2 w-2 rounded-full bg-green-500 mr-2" />
          Live Trading
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
