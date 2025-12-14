/**
 * DisclaimerAcceptance - Legal disclaimer acceptance component
 *
 * Users must accept this before they can trade.
 * Includes all required checkboxes and audit trail.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, FileText, Shield } from 'lucide-react';

interface CheckboxDescriptions {
  understandRisks: string;
  notFinancialAdvice: string;
  ownDecisions: string;
  canAffordLoss: string;
}

interface DisclaimerData {
  content: string;
  version: string;
  checkboxes: CheckboxDescriptions;
}

interface DisclaimerAcceptanceProps {
  onAccepted?: () => void;
  onSkip?: () => void;
}

export const DisclaimerAcceptance: React.FC<DisclaimerAcceptanceProps> = ({
  onAccepted,
  onSkip
}) => {
  const [disclaimerData, setDisclaimerData] = useState<DisclaimerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRead, setHasRead] = useState(false);

  const [checkboxes, setCheckboxes] = useState({
    understandRisks: false,
    notFinancialAdvice: false,
    ownDecisions: false,
    canAffordLoss: false
  });

  // Fetch disclaimer content
  useEffect(() => {
    fetchDisclaimer();
  }, []);

  const fetchDisclaimer = async () => {
    try {
      const response = await fetch('/api/onboarding/disclaimer');
      const data = await response.json();

      if (data.success) {
        setDisclaimerData(data.data);
      } else {
        setError('Failed to load disclaimer');
      }
    } catch (err) {
      setError('Failed to load disclaimer');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (key: keyof typeof checkboxes) => {
    setCheckboxes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(checkboxes).every(v => v);

  const handleAccept = async () => {
    if (!allChecked || !hasRead) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/disclaimer/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ checkboxes })
      });

      const data = await response.json();

      if (data.success) {
        onAccepted?.();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to accept disclaimer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">Loading disclaimer...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500/20 rounded-full mb-4">
            <Shield className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Risk Disclaimer</h1>
          <p className="text-gray-400">
            Please read and accept the following terms before trading
          </p>
          {disclaimerData && (
            <p className="text-sm text-gray-500 mt-2">
              Version {disclaimerData.version}
            </p>
          )}
        </div>

        {/* Disclaimer Content */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
          <div className="p-4 border-b border-gray-700 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-white">Terms of Use & Risk Warning</span>
          </div>
          <div
            className="p-6 max-h-96 overflow-y-auto prose prose-invert prose-sm"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
                setHasRead(true);
              }
            }}
          >
            {disclaimerData && (
              <div className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">
                {disclaimerData.content}
              </div>
            )}
          </div>
          {!hasRead && (
            <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/30 text-center">
              <p className="text-yellow-400 text-sm">
                ↓ Scroll to read the entire disclaimer
              </p>
            </div>
          )}
        </div>

        {/* Warning Box */}
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400 mb-1">Important Warning</h3>
              <p className="text-red-300 text-sm">
                Cryptocurrency trading involves substantial risk of loss. You should only
                trade with money you can afford to lose. Past performance does not
                guarantee future results.
              </p>
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          <h3 className="font-semibold text-white mb-4">I acknowledge and agree:</h3>
          <div className="space-y-4">
            {disclaimerData && Object.entries(disclaimerData.checkboxes).map(([key, description]) => (
              <label
                key={key}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    checkboxes[key as keyof typeof checkboxes]
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-600 group-hover:border-gray-500'
                  }`}
                  onClick={() => handleCheckboxChange(key as keyof typeof checkboxes)}
                >
                  {checkboxes[key as keyof typeof checkboxes] && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-gray-300 text-sm">{description}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {onSkip && (
            <button
              onClick={onSkip}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
            >
              Skip for Now
            </button>
          )}
          <button
            onClick={handleAccept}
            disabled={!allChecked || !hasRead || submitting}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              allChecked && hasRead && !submitting
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Accepting...' : 'I Accept & Agree'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          By clicking "I Accept & Agree", you acknowledge that you have read, understood,
          and agree to be bound by these terms.
        </p>
      </div>
    </div>
  );
};

export default DisclaimerAcceptance;
