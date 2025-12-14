# Data Feeds Integration - Phase 4

## 🎯 Overview

This plan covers integration of multiple data sources including stock market data, social sentiment, prediction markets, and AI analysis using Midstreamer for real-time streaming.

**Timeline**: Week 4
**Dependencies**: Phase 3 (Agents) must be completed
**Deliverables**: Multi-source data pipeline with real-time streaming

## 📋 Implementation Checklist

- [ ] Stock market data integration (Alpaca, Polygon)
- [ ] Social sentiment feeds (Twitter, Reddit)
- [ ] Polymarket prediction market integration
- [ ] Gemini AI analyzer integration
- [ ] Midstreamer real-time streaming
- [ ] Data normalization layer
- [ ] Caching and buffering
- [ ] WebSocket streaming

## 🏗️ Core Components

### 1. Data Feed Manager

**File**: `src/data/DataFeedManager.ts`

```typescript
import { EventEmitter } from 'events';
import { AgentDB } from 'agentdb';

export interface DataFeed {
  name: string;
  type: 'market' | 'sentiment' | 'prediction' | 'ai';
  initialize(): Promise<void>;
  subscribe(symbols: string[], callback: DataCallback): void;
  unsubscribe(symbols: string[]): void;
  close(): Promise<void>;
}

export type DataCallback = (data: MarketData | SentimentData) => void;

export class DataFeedManager extends EventEmitter {
  private feeds: Map<string, DataFeed> = new Map();
  private db: AgentDB;
  private buffer: Map<string, any[]> = new Map();
  private bufferSize: number = 1000;

  constructor(db: AgentDB) {
    super();
    this.db = db;
  }

  async registerFeed(feed: DataFeed): Promise<void> {
    console.log(`📡 Registering data feed: ${feed.name}`);
    await feed.initialize();
    this.feeds.set(feed.name, feed);
  }

  async subscribeTo(
    feedName: string,
    symbols: string[],
    callback: DataCallback
  ): Promise<void> {
    const feed = this.feeds.get(feedName);
    if (!feed) {
      throw new Error(`Feed not found: ${feedName}`);
    }

    // Wrap callback to add buffering and persistence
    const wrappedCallback = async (data: any) => {
      // Buffer data
      this.addToBuffer(feedName, data);

      // Persist to AgentDB
      await this.persistData(feedName, data);

      // Call original callback
      callback(data);

      // Emit event
      this.emit('data', { feed: feedName, data });
    };

    feed.subscribe(symbols, wrappedCallback);
    console.log(`✅ Subscribed to ${feedName} for symbols: ${symbols.join(', ')}`);
  }

  private addToBuffer(feedName: string, data: any): void {
    if (!this.buffer.has(feedName)) {
      this.buffer.set(feedName, []);
    }

    const buffer = this.buffer.get(feedName)!;
    buffer.push(data);

    // Limit buffer size
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }
  }

  private async persistData(feedName: string, data: any): Promise<void> {
    await this.db.insert({
      collection: `feed_${feedName}`,
      data: {
        ...data,
        timestamp: Date.now()
      }
    });
  }

  getBuffer(feedName: string): any[] {
    return this.buffer.get(feedName) || [];
  }

  async close(): Promise<void> {
    for (const feed of this.feeds.values()) {
      await feed.close();
    }
  }
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface SentimentData {
  symbol: string;
  sentiment: number; // -1 to 1
  volume: number;
  source: string;
  timestamp: number;
}
```

### 2. Stock Market Data Feed (Alpaca)

**File**: `src/data/feeds/AlpacaFeed.ts`

```typescript
import Alpaca from '@alpacahq/alpaca-trade-api';
import { DataFeed, DataCallback, MarketData } from '../DataFeedManager';

export class AlpacaFeed implements DataFeed {
  name = 'alpaca';
  type = 'market' as const;

  private client: Alpaca;
  private dataStream: any;
  private subscriptions: Map<string, DataCallback[]> = new Map();

  constructor(config: AlpacaConfig) {
    this.client = new Alpaca({
      keyId: config.apiKey,
      secretKey: config.apiSecret,
      paper: config.paper || true
    });
  }

  async initialize(): Promise<void> {
    console.log('🔌 Connecting to Alpaca data feed...');

    this.dataStream = this.client.data_stream_v2;

    this.dataStream.onConnect(() => {
      console.log('✅ Connected to Alpaca');
    });

    this.dataStream.onDisconnect(() => {
      console.warn('⚠️ Disconnected from Alpaca');
    });

    this.dataStream.onError((error: any) => {
      console.error('❌ Alpaca error:', error);
    });

    await this.dataStream.connect();
  }

  subscribe(symbols: string[], callback: DataCallback): void {
    for (const symbol of symbols) {
      if (!this.subscriptions.has(symbol)) {
        this.subscriptions.set(symbol, []);

        // Subscribe to trades
        this.dataStream.subscribeForTrades([symbol]);

        // Subscribe to quotes
        this.dataStream.subscribeForQuotes([symbol]);
      }

      this.subscriptions.get(symbol)!.push(callback);
    }

    // Handle trade updates
    this.dataStream.onStockTrade((trade: any) => {
      const data: MarketData = {
        symbol: trade.Symbol,
        price: trade.Price,
        volume: trade.Size,
        bid: 0,
        ask: 0,
        timestamp: new Date(trade.Timestamp).getTime()
      };

      this.notifySubscribers(trade.Symbol, data);
    });

    // Handle quote updates
    this.dataStream.onStockQuote((quote: any) => {
      const data: MarketData = {
        symbol: quote.Symbol,
        price: (quote.BidPrice + quote.AskPrice) / 2,
        volume: 0,
        bid: quote.BidPrice,
        ask: quote.AskPrice,
        timestamp: new Date(quote.Timestamp).getTime()
      };

      this.notifySubscribers(quote.Symbol, data);
    });
  }

  unsubscribe(symbols: string[]): void {
    this.dataStream.unsubscribeFromTrades(symbols);
    this.dataStream.unsubscribeFromQuotes(symbols);

    for (const symbol of symbols) {
      this.subscriptions.delete(symbol);
    }
  }

  async close(): Promise<void> {
    await this.dataStream.disconnect();
  }

  private notifySubscribers(symbol: string, data: MarketData): void {
    const callbacks = this.subscriptions.get(symbol);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paper?: boolean;
}
```

### 3. Social Sentiment Feed

**File**: `src/data/feeds/SentimentFeed.ts`

```typescript
import { TwitterApi } from 'twitter-api-v2';
import { DataFeed, DataCallback, SentimentData } from '../DataFeedManager';
import { GeminiAnalyzer } from './GeminiAnalyzer';

export class SentimentFeed implements DataFeed {
  name = 'sentiment';
  type = 'sentiment' as const;

  private twitter: TwitterApi;
  private gemini: GeminiAnalyzer;
  private streams: Map<string, any> = new Map();
  private subscriptions: Map<string, DataCallback[]> = new Map();

  constructor(config: SentimentConfig) {
    this.twitter = new TwitterApi(config.twitterBearerToken);
    this.gemini = new GeminiAnalyzer(config.geminiApiKey);
  }

  async initialize(): Promise<void> {
    console.log('🔌 Initializing sentiment feed...');
    await this.gemini.initialize();
    console.log('✅ Sentiment feed ready');
  }

  subscribe(symbols: string[], callback: DataCallback): void {
    for (const symbol of symbols) {
      if (!this.subscriptions.has(symbol)) {
        this.subscriptions.set(symbol, []);
        this.startStream(symbol);
      }

      this.subscriptions.get(symbol)!.push(callback);
    }
  }

  private async startStream(symbol: string): Promise<void> {
    const searchTerms = this.getSearchTerms(symbol);

    const stream = await this.twitter.v2.searchStream({
      'tweet.fields': ['created_at', 'public_metrics'],
      expansions: ['author_id']
    });

    stream.on('data', async (tweet: any) => {
      // Analyze sentiment with Gemini
      const sentiment = await this.gemini.analyzeSentiment(tweet.data.text);

      const data: SentimentData = {
        symbol,
        sentiment: sentiment.score,
        volume: tweet.data.public_metrics.like_count,
        source: 'twitter',
        timestamp: new Date(tweet.data.created_at).getTime()
      };

      this.notifySubscribers(symbol, data);
    });

    this.streams.set(symbol, stream);
  }

  unsubscribe(symbols: string[]): void {
    for (const symbol of symbols) {
      const stream = this.streams.get(symbol);
      if (stream) {
        stream.close();
        this.streams.delete(symbol);
      }
      this.subscriptions.delete(symbol);
    }
  }

  async close(): Promise<void> {
    for (const stream of this.streams.values()) {
      stream.close();
    }
  }

  private getSearchTerms(symbol: string): string[] {
    // Map symbols to search terms
    const termMap: Record<string, string[]> = {
      'AAPL': ['$AAPL', 'Apple', 'iPhone'],
      'TSLA': ['$TSLA', 'Tesla', 'Elon Musk'],
      // Add more mappings
    };

    return termMap[symbol] || [`$${symbol}`];
  }

  private notifySubscribers(symbol: string, data: SentimentData): void {
    const callbacks = this.subscriptions.get(symbol);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

interface SentimentConfig {
  twitterBearerToken: string;
  geminiApiKey: string;
}
```

### 4. Gemini AI Analyzer

**File**: `src/data/feeds/GeminiAnalyzer.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async initialize(): Promise<void> {
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    console.log('✅ Gemini AI initialized');
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    const prompt = `Analyze the sentiment of this financial text and return ONLY a JSON object with "score" (-1 to 1) and "reasoning":\n\n${text}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();

      // Parse JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback to simple parsing
      return {
        score: this.extractScore(analysisText),
        reasoning: analysisText
      };
    } catch (error) {
      console.error('Gemini analysis failed:', error);
      return { score: 0, reasoning: 'Analysis failed' };
    }
  }

  async analyzeMarketConditions(data: any): Promise<string> {
    const prompt = `Analyze these market conditions and provide trading insights:\n${JSON.stringify(data, null, 2)}`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  private extractScore(text: string): number {
    // Simple score extraction from text
    if (text.toLowerCase().includes('bullish') || text.toLowerCase().includes('positive')) {
      return 0.7;
    }
    if (text.toLowerCase().includes('bearish') || text.toLowerCase().includes('negative')) {
      return -0.7;
    }
    return 0;
  }
}

interface SentimentAnalysis {
  score: number;
  reasoning: string;
}
```

### 5. Midstreamer Integration

**File**: `src/data/MidstreamerIntegration.ts`

```typescript
import { Midstreamer } from 'midstreamer';
import { DataFeedManager } from './DataFeedManager';

export class MidstreamerIntegration {
  private streamer: Midstreamer;
  private feedManager: DataFeedManager;

  constructor(feedManager: DataFeedManager) {
    this.feedManager = feedManager;
    this.streamer = new Midstreamer({
      bufferSize: 1000,
      flushInterval: 100, // ms
      enableCompression: true
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Midstreamer...');

    // Create data streams for each feed type
    this.streamer.createStream('market-data', {
      transform: (data: any) => this.normalizeMarketData(data)
    });

    this.streamer.createStream('sentiment-data', {
      transform: (data: any) => this.normalizeSentimentData(data)
    });

    // Pipe data from feeds to streams
    this.feedManager.on('data', ({ feed, data }) => {
      if (feed.includes('market')) {
        this.streamer.push('market-data', data);
      } else if (feed.includes('sentiment')) {
        this.streamer.push('sentiment-data', data);
      }
    });

    console.log('✅ Midstreamer initialized');
  }

  subscribeToStream(streamName: string, callback: (data: any) => void): void {
    this.streamer.subscribe(streamName, callback);
  }

  private normalizeMarketData(data: any): any {
    return {
      symbol: data.symbol,
      price: parseFloat(data.price),
      volume: parseInt(data.volume),
      timestamp: data.timestamp
    };
  }

  private normalizeSentimentData(data: any): any {
    return {
      symbol: data.symbol,
      sentiment: parseFloat(data.sentiment),
      source: data.source,
      timestamp: data.timestamp
    };
  }
}
```

## 🧪 Testing

```typescript
// tests/data/DataFeedManager.test.ts
import { DataFeedManager } from '../../src/data/DataFeedManager';
import { AgentDB } from 'agentdb';

describe('DataFeedManager', () => {
  let manager: DataFeedManager;
  let db: AgentDB;

  beforeEach(async () => {
    db = new AgentDB({ path: ':memory:' });
    await db.connect();
    manager = new DataFeedManager(db);
  });

  it('should register and subscribe to feeds', async () => {
    const mockFeed = {
      name: 'test-feed',
      type: 'market' as const,
      initialize: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    };

    await manager.registerFeed(mockFeed);
    await manager.subscribeTo('test-feed', ['AAPL'], (data) => {
      expect(data).toBeDefined();
    });

    expect(mockFeed.subscribe).toHaveBeenCalled();
  });
});
```

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────────┐
│         External Data Sources            │
│  Alpaca │ Polygon │ Twitter │ Gemini    │
└───────────┬─────────────────────────────┘
            │
┌───────────▼─────────────────────────────┐
│         Data Feed Manager                │
│  • Registration  • Buffering            │
│  • Normalization • Persistence          │
└───────────┬─────────────────────────────┘
            │
┌───────────▼─────────────────────────────┐
│         Midstreamer                      │
│  • Stream multiplexing                  │
│  • Real-time distribution               │
│  • Compression & optimization           │
└───────────┬─────────────────────────────┘
            │
┌───────────▼─────────────────────────────┐
│         Trading Agents                   │
│  Process real-time market data          │
└─────────────────────────────────────────┘
```

## 🚀 Usage Example

```typescript
// Initialize data pipeline
const db = new AgentDB({ path: './data.db' });
await db.connect();

const feedManager = new DataFeedManager(db);

// Register feeds
await feedManager.registerFeed(new AlpacaFeed({
  apiKey: process.env.ALPACA_KEY,
  apiSecret: process.env.ALPACA_SECRET,
  paper: true
}));

await feedManager.registerFeed(new SentimentFeed({
  twitterBearerToken: process.env.TWITTER_TOKEN,
  geminiApiKey: process.env.GEMINI_KEY
}));

// Subscribe to data
await feedManager.subscribeTo('alpaca', ['AAPL', 'TSLA'], (data) => {
  console.log('Market data:', data);
});

await feedManager.subscribeTo('sentiment', ['AAPL', 'TSLA'], (data) => {
  console.log('Sentiment:', data);
});

// Initialize Midstreamer for real-time distribution
const midstreamer = new MidstreamerIntegration(feedManager);
await midstreamer.initialize();
```

## 📊 Success Metrics

- [ ] Real-time data latency < 100ms
- [ ] Support 100+ symbols simultaneously
- [ ] 99.9% uptime for data streams
- [ ] Buffer overflow rate < 0.1%
- [ ] Sentiment analysis accuracy > 75%

---

**Version**: 1.0.0
**Last Updated**: 2025-10-28
