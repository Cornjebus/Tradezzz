/**
 * Register Form Component
 */

import { useState } from 'react';
import { useAuth } from './AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Brain, UserPlus, AlertCircle, Check } from 'lucide-react';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0/mo',
    features: ['2 Strategies', '1 Exchange', 'Paper Trading Only'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49/mo',
    features: ['10 Strategies', '3 Exchanges', 'Live Trading', 'AI Signals'],
    recommended: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '$149/mo',
    features: ['50 Strategies', '10 Exchanges', 'Custom Algorithms', 'Priority Support'],
  },
];

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tier, setTier] = useState('pro');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    const result = await register(email, password, tier);

    if (!result.success) {
      setError(result.error || 'Registration failed');
    }

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-panel border-border">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Brain className="h-12 w-12 text-cyan" />
        </div>
        <CardTitle className="text-2xl">Create Your Account</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Start your AI-powered trading journey
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert className="border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          {/* Tier Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Select Your Plan</label>
            <div className="grid grid-cols-3 gap-3">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id)}
                  className={`relative p-4 rounded-lg border text-left transition-all ${
                    tier === t.id
                      ? 'border-cyan bg-cyan/10'
                      : 'border-border hover:border-cyan/50'
                  }`}
                >
                  {t.recommended && (
                    <Badge className="absolute -top-2 right-2 bg-cyan text-black text-xs">
                      Popular
                    </Badge>
                  )}
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-cyan text-lg font-bold">{t.price}</div>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                    {t.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan/50"
                placeholder="trader@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan/50"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan/50"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-cyan hover:bg-cyan/80 text-black font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              'Creating account...'
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Account
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-cyan hover:underline"
            >
              Sign in
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
