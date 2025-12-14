# AgentDB Browser Examples - Self-Learning Architectures

> **Complete guide to building self-learning client-side AI systems with AgentDB WASM**

This collection demonstrates **5 different self-learning architectures** that run entirely in the browser using AgentDB's WebAssembly backend. Each example showcases a unique approach to client-side machine learning, persistent memory, and adaptive behavior.

## 🎯 Overview

All examples feature:
- ✅ **100% Client-Side** - No backend server required
- ✅ **WASM-Powered** - AgentDB vector database running in browser
- ✅ **LocalStorage Persistence** - Data survives page refreshes
- ✅ **Real-Time Learning** - Immediate adaptation to user behavior
- ✅ **Visual Feedback** - See the learning process in action
- ✅ **Export/Import** - Portable data for backup and sharing

## 📚 Example Architectures

### 1. RAG Self-Learning (`rag/index.html`)

**Retrieval-Augmented Generation with Continuous Learning**

Build a knowledge base that learns from user queries and feedback to improve responses over time.

#### Key Features
- Dynamic knowledge base that grows with user contributions
- Vector-based semantic search for document retrieval
- Query pattern recognition and optimization
- Feedback loop for continuous improvement
- Context-aware response generation

#### Learning Mechanism
1. User submits query → System searches knowledge base
2. Retrieves top-K relevant documents using cosine similarity
3. Generates response from retrieved context
4. User provides feedback (helpful/not helpful)
5. System stores query patterns and adjusts retrieval weights
6. Future similar queries benefit from learned patterns

#### Use Cases
- Personal knowledge management systems
- FAQ chatbots that improve over time
- Document search with learning capabilities
- Context-aware help systems

---

### 2. Pattern-Based Learning (`pattern-learning/index.html`)

**Learn from User Interaction Patterns and Predict Next Actions**

Discover behavioral patterns in user interactions and provide predictive assistance.

#### Key Features
- Automatic pattern detection in task sequences
- Confidence scoring for pattern reliability
- Next-action prediction with explanations
- Temporal pattern analysis (time-aware)
- Visual timeline of user activity

#### Learning Mechanism
1. Track user actions (clicks, navigation, tasks)
2. Store action sequences as vector embeddings
3. Detect frequent patterns using sliding window analysis
4. Calculate pattern confidence based on frequency
5. Predict next action by matching current sequence
6. Adapt UI/UX based on discovered patterns

#### Use Cases
- Workflow optimization tools
- Predictive UI/UX systems
- Task automation assistants
- Smart productivity applications

---

### 3. Experience Replay (`experience-replay/index.html`)

**Q-Learning with Experience Buffer (Reinforcement Learning)**

Classic RL approach with experience replay for learning optimal strategies in grid-world environment.

#### Key Features
- Q-Learning algorithm implementation
- Experience replay buffer management
- Epsilon-greedy exploration strategy
- Real-time Q-value visualization
- Auto-play mode for rapid learning

#### Learning Mechanism
1. Agent takes action in environment (grid navigation)
2. Receives reward signal (goal: +10, obstacle: -5, step: -0.1)
3. Stores experience tuple (state, action, reward, next_state)
4. Samples random batch from replay buffer
5. Updates Q-values using Bellman equation
6. Policy improves through repeated training
7. Success rate increases over episodes

#### Use Cases
- Game AI that learns optimal strategies
- Resource allocation optimization
- Path planning and navigation
- Decision-making under uncertainty

---

### 4. Collaborative Filtering (`collaborative-filtering/index.html`)

**Recommendation System Based on Similar User Preferences**

Build recommendations by finding users with similar tastes and suggesting items they liked.

#### Key Features
- User similarity calculation (cosine similarity)
- Item-based and user-based filtering
- Cold-start problem handling
- Multi-category preference learning
- Cross-user pattern transfer

#### Learning Mechanism
1. User rates items (movies, music, food, games)
2. System calculates similarity with other users
3. Finds top-K most similar users
4. Aggregates their preferences (weighted by similarity)
5. Recommends unrated items with highest predicted scores
6. Updates similarity as more ratings are provided

#### Use Cases
- Content recommendation engines
- E-commerce product suggestions
- Social platform friend recommendations
- Playlist and media suggestions

---

### 5. Adaptive Recommendations (`adaptive-recommendations/index.html`)

**Multi-Armed Bandit with Thompson Sampling**

Real-time adaptive recommendation system that balances exploration and exploitation.

#### Key Features
- Thompson Sampling for optimal exploration
- Beta distribution for each content category
- Real-time adaptation to user feedback
- Exploration vs exploitation balance
- Category preference tracking

#### Learning Mechanism
1. Maintain Beta distribution (α, β) for each category
2. Sample from each distribution to select category
3. Show content from selected category
4. User provides feedback (like/dislike)
5. Update distribution: α += 1 (like) or β += 1 (dislike)
6. Future samples favor categories with positive feedback
7. System automatically balances trying new categories

#### Use Cases
- Personalized content feeds
- A/B testing optimization
- Dynamic pricing systems
- Adaptive marketing campaigns

---

## ⚡ Advanced & Exotic Architectures

### 6. Swarm Intelligence (`swarm-intelligence/index.html`)

**Emergent Collective Behavior with Particle Swarm Optimization**

Watch autonomous agents exhibit emergent intelligence through local interactions, pheromone trails, and swarm coordination.

#### Key Features
- Multi-agent particle swarm optimization
- Stigmergy-based communication (pheromone trails)
- Three behavior modes: foraging, flocking, exploration
- Real-time emergent pathfinding
- Obstacle avoidance and target discovery

#### Learning Mechanism
1. Agents move through environment with local perception
2. Leave pheromone trails based on success/exploration
3. Other agents detect and follow strong pheromone gradients
4. Collective intelligence emerges from individual simple rules
5. Optimal paths discovered without central coordination
6. Pheromones decay over time, allowing adaptation

#### Use Cases
- Distributed optimization problems
- Route planning and logistics
- Autonomous swarm robotics
- Network optimization
- Resource allocation in distributed systems

---

### 7. Meta-Learning (MAML) (`meta-learning/index.html`)

**Learning to Learn: Few-Shot Task Adaptation**

Model-Agnostic Meta-Learning enables rapid adaptation to new tasks with just 3-5 examples by learning universal meta-parameters.

#### Key Features
- Model-Agnostic Meta-Learning (MAML) algorithm
- Inner loop: task-specific rapid adaptation
- Outer loop: meta-parameter optimization
- Few-shot learning across task distributions
- Meta-training across multiple task families

#### Learning Mechanism
1. Meta-train across diverse tasks to learn good initialization
2. Inner loop: Clone meta-parameters for new task
3. Adapt cloned parameters with few examples (3-5 shots)
4. Outer loop: Update meta-parameters using task gradients
5. Learned meta-parameters enable rapid specialization
6. New tasks learned in milliseconds instead of hours

#### Use Cases
- Personalization with limited user data
- Quick adaptation to new domains
- Transfer learning across problem types
- AI assistants that learn user preferences rapidly
- Dynamic task switching in multi-task systems

---

### 8. Neuro-Symbolic Reasoning (`neuro-symbolic/index.html`)

**Hybrid AI: Neural Perception + Symbolic Logic**

Combines neural networks' pattern recognition with symbolic systems' logical reasoning for interpretable, verifiable AI.

#### Key Features
- Dual-system architecture (neural + symbolic)
- Logical rule knowledge base
- Forward chaining inference engine
- Hybrid confidence scoring
- Explainable reasoning chains

#### Learning Mechanism
1. Neural component: Pattern matching with learned embeddings
2. Symbolic component: Rule-based logical inference
3. Query triggers both neural and symbolic paths
4. Neural provides soft confidence via learned patterns
5. Symbolic provides hard logic via rule chaining
6. Hybrid decision combines both (weighted fusion)
7. Full reasoning chain logged for explainability

#### Use Cases
- Explainable AI systems
- Medical diagnosis with interpretability
- Legal reasoning and compliance checking
- Scientific hypothesis generation
- Safety-critical systems requiring verification

---

### 9. Quantum-Inspired Optimization (`quantum-inspired/index.html`)

**Global Optimization via Quantum Computing Principles**

Uses quantum mechanics concepts (superposition, entanglement, tunneling) to escape local optima and find global solutions.

#### Key Features
- Quantum Particle Swarm Optimization (QPSO)
- Superposition of multiple states
- Quantum entanglement between particles
- Tunneling through energy barriers
- Multi-modal landscape visualization

#### Learning Mechanism
1. Initialize particles in quantum superposition
2. Each particle exists in multiple states simultaneously
3. Measure (collapse) superposition based on fitness
4. Quantum potential well guides particle movement
5. Tunneling allows escape from local minima
6. Entangled particles share phase information
7. Converge to global optimum faster than classical PSO

#### Use Cases
- Complex optimization landscapes
- Neural architecture search
- Hyperparameter tuning
- Portfolio optimization
- Protein folding simulation

---

### 10. Continual Learning (`continual-learning/index.html`)

**Lifelong Learning Without Catastrophic Forgetting**

Learn new tasks sequentially while preserving knowledge from previous tasks using Elastic Weight Consolidation (EWC) and memory replay.

#### Key Features
- Elastic Weight Consolidation (EWC) regularization
- Experience replay buffer with importance sampling
- Synaptic consolidation for critical weights
- Progressive task learning timeline
- Forgetting curve monitoring

#### Learning Mechanism
1. Learn first task normally, compute Fisher Information
2. Fisher identifies which weights are critical for task
3. When learning new task, penalize changes to critical weights
4. Store important examples in replay buffer
5. Periodically replay old examples during new learning
6. Consolidate memories based on activation patterns
7. Sequential tasks learned without forgetting previous ones

#### Use Cases
- Personal AI assistants that grow with user
- Autonomous systems in changing environments
- Educational platforms adapting to curriculum
- Robotics with expanding skill sets
- Long-running production ML systems

---

## 🚀 Quick Start

### Running the Examples

1. **Open any example directly in your browser:**
   ```bash
   # Navigate to the examples directory
   cd examples/browser

   # Open the main index
   open index.html

   # Or open a specific example
   open rag/index.html
   ```

2. **Use a local web server (recommended for WASM):**
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve

   # Then visit: http://localhost:8000
   ```

3. **Interact with the examples:**
   - Each example has interactive UI elements
   - Follow on-screen instructions
   - Observe learning progress in real-time
   - Check statistics panels for metrics

### Integration with AgentDB

To use these patterns with real AgentDB WASM backend:

```javascript
// Import AgentDB (in your actual application)
import { createVectorDB } from 'agentdb';

// Initialize with WASM backend (auto-detected in browser)
const db = await createVectorDB({
    memoryMode: true  // In-memory for browser, or use export/import
});

// Insert vectors
const id = db.insert({
    embedding: yourEmbeddingArray,  // From OpenAI, Cohere, or local model
    metadata: { type: 'pattern', data: {...} }
});

// Search for similar vectors
const results = db.search(
    queryEmbedding,
    5,           // top 5 results
    'cosine',    // similarity metric
    0.7          // minimum threshold
);

// Export for persistence
const data = db.export();
localStorage.setItem('agentdb', JSON.stringify(Array.from(data)));

// Import on next session
const stored = JSON.parse(localStorage.getItem('agentdb'));
await db.importAsync(new Uint8Array(stored));
```

## 🎓 Learning Algorithms Explained

### Vector Embeddings

All examples use vector embeddings to represent data in high-dimensional space:

**Simple Hash-Based Embeddings (Demo)**
- Used in examples for demonstration
- Convert text to numeric vectors
- Enable similarity calculations

**Production Embeddings**
- Use OpenAI (`text-embedding-ada-002`)
- Use Cohere (`embed-english-v3.0`)
- Use open-source models (Sentence Transformers)
- Or fine-tune custom embeddings

### Similarity Metrics

**Cosine Similarity** (Default)
- Measures angle between vectors
- Best for normalized embeddings
- Range: -1 to 1 (1 = identical)

**Euclidean Distance**
- Measures geometric distance
- Good for spatial data
- Smaller = more similar

**Dot Product**
- Measures projection magnitude
- Fast computation
- Not normalized

### Learning Strategies

**Supervised Learning** (RAG, Collaborative Filtering)
- Learn from explicit user feedback
- Labeled data (ratings, likes, feedback)
- Gradual improvement with more labels

**Reinforcement Learning** (Experience Replay)
- Learn from reward signals
- Trial and error exploration
- Optimal policy emerges over time

**Unsupervised Learning** (Pattern Learning)
- Discover structure in data
- No explicit labels needed
- Pattern detection through clustering

**Bandit Algorithms** (Adaptive Recommendations)
- Balance exploration vs exploitation
- Probabilistic decision making
- Regret minimization

## 🔧 Customization Guide

### Modifying Learning Parameters

**RAG System:**
```javascript
const MIN_SIMILARITY = 0.7;  // Lower = more permissive matches
const TOP_K = 3;             // Number of documents to retrieve
```

**Pattern Learning:**
```javascript
const MIN_PATTERN_FREQUENCY = 2;  // How often before it's a pattern
const SEQUENCE_LENGTH = 5;        // Max pattern length
```

**Experience Replay:**
```javascript
const ALPHA = 0.1;      // Learning rate (0-1)
const GAMMA = 0.9;      // Discount factor (0-1)
const EPSILON = 0.1;    // Exploration rate (0-1)
const BUFFER_SIZE = 100; // Experience buffer capacity
```

**Multi-Armed Bandit:**
```javascript
const ALPHA_PRIOR = 1;  // Initial success count (optimistic)
const BETA_PRIOR = 1;   // Initial failure count
```

### Adding New Features

**1. Export/Import Functionality:**
```javascript
function exportData() {
    const data = {
        database: db.export(),
        userHistory: userHistory,
        learnedPatterns: patterns,
        timestamp: Date.now()
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    // Download or save to localStorage
}

function importData(jsonData) {
    const data = JSON.parse(jsonData);
    db.importAsync(new Uint8Array(data.database));
    userHistory = data.userHistory;
    patterns = data.learnedPatterns;
    // Restore UI state
}
```

**2. Cross-Tab Synchronization:**
```javascript
// Use BroadcastChannel API
const channel = new BroadcastChannel('agentdb-sync');

channel.onmessage = (event) => {
    if (event.data.type === 'update') {
        // Sync database state across tabs
        db.importAsync(event.data.dbState);
    }
};

// Broadcast updates
function broadcastUpdate() {
    channel.postMessage({
        type: 'update',
        dbState: db.export()
    });
}
```

**3. Service Worker for Offline:**
```javascript
// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

// In sw.js - cache database exports
self.addEventListener('message', (event) => {
    if (event.data.type === 'cache-db') {
        caches.open('agentdb-v1').then(cache => {
            cache.put('/db-backup', new Response(event.data.dbData));
        });
    }
});
```

## 📊 Performance Considerations

### WASM Backend Performance

**Throughput:**
- 51.7K vectors/sec insert (WASM)
- ~5ms search time @ 100K vectors
- Only 2.2x slower than native

**Memory Usage:**
- ~0.74MB per 1K vectors (384-dim embeddings)
- ~7.4MB per 10K vectors
- ~74MB per 100K vectors

**Optimization Tips:**
1. Use batch inserts for bulk operations
2. Enable HNSW index for large datasets (>1K vectors)
3. Implement pagination for large result sets
4. Debounce frequent searches
5. Use Web Workers for heavy computations

### Browser Compatibility

**Minimum Requirements:**
- Modern browser with WebAssembly support
- Chrome 57+, Firefox 52+, Safari 11+, Edge 16+
- ~100MB free memory for large datasets
- LocalStorage or IndexedDB for persistence

**Feature Detection:**
```javascript
// Check WASM support
const wasmSupported = (() => {
    try {
        if (typeof WebAssembly === 'object'
            && typeof WebAssembly.instantiate === 'function') {
            const module = new WebAssembly.Module(
                Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
            );
            return module instanceof WebAssembly.Module;
        }
    } catch (e) {}
    return false;
})();

if (!wasmSupported) {
    console.error('WebAssembly not supported');
}
```

## 🌟 Advanced Patterns

### Hybrid Architectures

Combine multiple learning approaches:

**RAG + Pattern Learning:**
- Learn query patterns to improve retrieval
- Adjust document ranking based on feedback
- Predict query intent from partial input

**Experience Replay + Collaborative Filtering:**
- Learn from both own experiences and similar users
- Transfer knowledge across user sessions
- Cold-start with replay buffer, warm-up with collaborative data

**Multi-Armed Bandit + Pattern Learning:**
- Use patterns to inform category selection
- Contextual bandits with pattern features
- Adaptive exploration based on detected patterns

### Federated Learning Simulation

```javascript
// Aggregate learnings from multiple users (privacy-preserving)
function aggregateModels(userModels) {
    const aggregated = {};

    // Average model parameters
    Object.keys(userModels[0]).forEach(param => {
        aggregated[param] = userModels
            .map(m => m[param])
            .reduce((a, b) => a + b, 0) / userModels.length;
    });

    return aggregated;
}

// Download global model
function downloadGlobalModel() {
    fetch('/api/global-model')
        .then(r => r.json())
        .then(model => updateLocalModel(model));
}

// Upload local updates (gradients only, not data)
function uploadGradients(gradients) {
    fetch('/api/update', {
        method: 'POST',
        body: JSON.stringify({ gradients })
    });
}
```

## 🐛 Debugging Tips

**Enable Verbose Logging:**
```javascript
const DEBUG = true;

function log(...args) {
    if (DEBUG) {
        console.log('[AgentDB]', ...args);
    }
}

// Log all vector insertions
db.insert = new Proxy(db.insert, {
    apply: (target, thisArg, args) => {
        log('Insert:', args);
        return target.apply(thisArg, args);
    }
});
```

**Visualize Vector Space:**
```javascript
// Use t-SNE or UMAP for 2D projection
function visualizeEmbeddings(embeddings) {
    // Reduce to 2D for plotting
    const tsne = new TSNE({
        dim: 2,
        perplexity: 30
    });

    tsne.init(embeddings);
    tsne.run();

    const projected = tsne.getSolution();
    plotScatter(projected);  // Use Chart.js or D3.js
}
```

**Monitor Learning Progress:**
```javascript
setInterval(() => {
    console.table({
        'Vectors': db.stats().count,
        'Queries': queryHistory.length,
        'Patterns': patterns.length,
        'Success Rate': `${(successRate * 100).toFixed(1)}%`,
        'Memory Usage': `${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`
    });
}, 5000);
```

## 📚 Further Reading

**AgentDB Documentation:**
- [ReasoningBank Guide](../../docs/REASONINGBANK_VALIDATION.md)
- [Performance Benchmarks](../../docs/PERFORMANCE_REPORT.md)
- [WASM Backend Guide](../../docs/WASM_BACKEND.md)

**Learning Algorithms:**
- [Q-Learning Tutorial](https://towardsdatascience.com/q-learning)
- [Thompson Sampling Explained](https://en.wikipedia.org/wiki/Thompson_sampling)
- [Collaborative Filtering Guide](https://developers.google.com/machine-learning/recommendation/collaborative/basics)
- [RAG Systems Overview](https://arxiv.org/abs/2005.11401)

**Browser AI:**
- [TensorFlow.js](https://www.tensorflow.org/js)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [Transformers.js](https://huggingface.co/docs/transformers.js)

## 🤝 Contributing

Have a new self-learning architecture idea? Contributions welcome!

1. Fork the repository
2. Create your example in `examples/browser/your-architecture/`
3. Follow the existing structure (index.html with inline JS)
4. Add to the main `index.html` grid
5. Update this README with your architecture description
6. Submit a pull request

## 📄 License

These examples are part of AgentDB, dual-licensed under MIT OR Apache-2.0.

---

**Built with ❤️ for AI developers**

*Demonstrating the power of client-side self-learning systems*
