/**
 * Provider Test Panel - Interactive testing for AI providers
 *
 * Allows users to:
 * - Test connection with real API call
 * - Chat with the AI
 * - Analyze sentiment
 * - Generate trading signals
 */

import { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  TrendingUp,
  Activity,
  Trash2,
  Clock,
  Zap,
} from 'lucide-react';
import {
  useAIChat,
  useAIAnalysis,
  ChatMessage,
  SentimentResult,
  SignalResult,
} from '../../hooks/useApi';

interface ProviderTestPanelProps {
  providerId: string;
  providerName: string;
  providerType: string;
  onClose: () => void;
}

type TabType = 'chat' | 'sentiment' | 'signal';

export function ProviderTestPanel({
  providerId,
  providerName,
  providerType,
  onClose,
}: ProviderTestPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    lastResponse,
    loading: chatLoading,
    sendMessage,
    clearHistory,
  } = useAIChat(providerId);

  const {
    loading: analysisLoading,
    analyzeSentiment,
    generateSignal,
  } = useAIAnalysis(providerId);

  const [sentimentResult, setSentimentResult] = useState<SentimentResult | null>(null);
  const [signalResult, setSignalResult] = useState<SignalResult | null>(null);
  const [sentimentText, setSentimentText] = useState('');
  const [signalSymbol, setSignalSymbol] = useState('BTC/USDT');
  const [signalPrice, setSignalPrice] = useState('45000');

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAnalyzeSentiment = async () => {
    if (!sentimentText.trim() || analysisLoading) return;
    const result = await analyzeSentiment(sentimentText, 'BTC');
    if (result.success && result.data) {
      setSentimentResult(result.data);
    }
  };

  const handleGenerateSignal = async () => {
    if (analysisLoading) return;
    const result = await generateSignal({
      symbol: signalSymbol,
      price: parseFloat(signalPrice),
      indicators: { rsi: 45, macd: 120, volume: 1000000 },
    });
    if (result.success && result.data) {
      setSignalResult(result.data);
    }
  };

  const loading = chatLoading || analysisLoading;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#12121a] border border-indigo-900/30 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-indigo-900/30">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="font-semibold">{providerName}</h2>
              <p className="text-xs text-gray-500">{providerType} Provider Test</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-indigo-900/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-indigo-900/30">
          <TabButton
            active={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            icon={<MessageSquare className="h-4 w-4" />}
            label="Chat"
          />
          <TabButton
            active={activeTab === 'sentiment'}
            onClick={() => setActiveTab('sentiment')}
            icon={<Activity className="h-4 w-4" />}
            label="Sentiment"
          />
          <TabButton
            active={activeTab === 'signal'}
            onClick={() => setActiveTab('signal')}
            icon={<TrendingUp className="h-4 w-4" />}
            label="Signal"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <ChatTab
              messages={messages}
              lastResponse={lastResponse}
              loading={chatLoading}
              input={input}
              setInput={setInput}
              onSend={handleSendMessage}
              onKeyDown={handleKeyDown}
              onClear={clearHistory}
              messagesEndRef={messagesEndRef}
            />
          )}
          {activeTab === 'sentiment' && (
            <SentimentTab
              text={sentimentText}
              setText={setSentimentText}
              result={sentimentResult}
              loading={analysisLoading}
              onAnalyze={handleAnalyzeSentiment}
            />
          )}
          {activeTab === 'signal' && (
            <SignalTab
              symbol={signalSymbol}
              setSymbol={setSignalSymbol}
              price={signalPrice}
              setPrice={setSignalPrice}
              result={signalResult}
              loading={analysisLoading}
              onGenerate={handleGenerateSignal}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-indigo-500 text-indigo-400'
          : 'border-transparent text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ChatTab({
  messages,
  lastResponse,
  loading,
  input,
  setInput,
  onSend,
  onKeyDown,
  onClear,
  messagesEndRef,
}: {
  messages: ChatMessage[];
  lastResponse: any;
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClear: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Start a conversation to test the AI provider</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-indigo-500/20 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Stats */}
      {lastResponse && (
        <div className="px-4 py-2 border-t border-indigo-900/30 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {lastResponse.latencyMs}ms
          </span>
          <span>Model: {lastResponse.model}</span>
          <span>{lastResponse.usage?.totalTokens || 0} tokens</span>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-indigo-900/30">
        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={messages.length === 0}
            className="p-2 border border-indigo-500/30 rounded-lg text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SentimentTab({
  text,
  setText,
  result,
  loading,
  onAnalyze,
}: {
  text: string;
  setText: (v: string) => void;
  result: SentimentResult | null;
  loading: boolean;
  onAnalyze: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Enter text to analyze sentiment
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., Bitcoin is showing strong momentum, breaking through key resistance levels..."
          rows={4}
          className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none resize-none"
        />
      </div>
      <button
        onClick={onAnalyze}
        disabled={!text.trim() || loading}
        className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Activity className="h-4 w-4" />
            Analyze Sentiment
          </>
        )}
      </button>

      {result && (
        <div className="bg-[#1a1a2e] border border-indigo-900/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Sentiment</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                result.sentiment === 'bullish'
                  ? 'bg-green-500/20 text-green-400'
                  : result.sentiment === 'bearish'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {result.sentiment.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Score</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    result.score > 0 ? 'bg-green-500' : result.score < 0 ? 'bg-red-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.abs(result.score) * 50 + 50}%`, marginLeft: result.score < 0 ? '0' : '50%' }}
                />
              </div>
              <span className="text-sm font-mono">{result.score.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Confidence</span>
            <span className="text-sm">{(result.confidence * 100).toFixed(0)}%</span>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Reasoning</span>
            <p className="text-sm mt-1">{result.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalTab({
  symbol,
  setSymbol,
  price,
  setPrice,
  result,
  loading,
  onGenerate,
}: {
  symbol: string;
  setSymbol: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  result: SignalResult | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Current Price</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <TrendingUp className="h-4 w-4" />
            Generate Signal
          </>
        )}
      </button>

      {result && (
        <div className="bg-[#1a1a2e] border border-indigo-900/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Signal</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                result.action === 'buy'
                  ? 'bg-green-500/20 text-green-400'
                  : result.action === 'sell'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {result.action.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Confidence</span>
            <span className="text-sm">{(result.confidence * 100).toFixed(0)}%</span>
          </div>
          {result.stopLoss && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Stop Loss</span>
              <span className="text-red-400">${result.stopLoss.toLocaleString()}</span>
            </div>
          )}
          {result.takeProfit && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Take Profit</span>
              <span className="text-green-400">${result.takeProfit.toLocaleString()}</span>
            </div>
          )}
          <div>
            <span className="text-gray-400 text-sm">Reasoning</span>
            <p className="text-sm mt-1">{result.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProviderTestPanel;
