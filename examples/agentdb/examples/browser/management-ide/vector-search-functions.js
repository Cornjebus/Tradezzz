// ============================================================================
// ENHANCED VECTOR SEARCH - JAVASCRIPT IMPLEMENTATION
// Insert this before the closing </script> tag in index.html
// ============================================================================

// Safe logging function - uses global logToConsole if available, otherwise console.log
if (typeof logToConsole === 'undefined') {
  window.logToConsole = function(level, ...args) {
    const prefix = `[Vector Search ${level.toUpperCase()}]`;
    console[level] ? console[level](prefix, ...args) : console.log(prefix, ...args);
  };
}

// Global state for vector search
const vectorSearchState = {
  currentTab: 'basic',
  searchHistory: [],
  savedSearches: [],
  analytics: {
    totalSearches: 0,
    totalResults: 0,
    totalClicks: 0,
    searchTimes: [],
    popularQueries: {}
  },
  currentResults: [],
  currentPage: 1,
  resultsPerPage: 10,
  resultView: 'grid',
  filters: {
    type: [],
    dateFrom: null,
    dateTo: null,
    metadata: {},
    source: null
  }
};

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function switchVectorTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.vector-tab-content').forEach(tab => {
    tab.style.display = 'none';
  });

  // Remove active class from all buttons
  document.querySelectorAll('.tabs .tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  const selectedTab = document.getElementById(`vector-tab-${tabName}`);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }

  // Add active class to clicked button
  event.target.classList.add('active');
  vectorSearchState.currentTab = tabName;

  // Load tab-specific data
  if (tabName === 'analytics') {
    refreshAnalytics();
  } else if (tabName === 'visualization') {
    updateVisualization();
  }

  logToConsole('info', `Switched to ${tabName} tab`);
}

// ============================================================================
// BASIC SEARCH WITH FILTERS
// ============================================================================

async function performVectorSearch() {
  const query = document.getElementById('vector-query').value.trim();
  const limit = parseInt(document.getElementById('vector-limit').value);
  const threshold = parseFloat(document.getElementById('similarity-threshold').value);
  const searchMode = document.getElementById('search-mode').value;

  if (!query) {
    alert('Please enter a search query');
    return;
  }

  const startTime = performance.now();
  logToConsole('info', `Performing ${searchMode} vector search: "${query}"`);

  try {
    // Generate embedding for query
    const embedding = generateMockEmbedding(query);

    // Perform search
    let results = state.db.searchSimilar(embedding, limit * 2); // Get more for filtering

    // Apply filters
    results = applySearchFilters(results);

    // Apply threshold
    results = results.filter(r => (1 - r.distance) >= threshold);

    // Limit results
    results = results.slice(0, limit);

    // Apply search mode
    if (searchMode === 'hybrid') {
      results = applyHybridSearch(results, query);
    }

    const searchTime = performance.now() - startTime;

    // Update analytics
    updateSearchAnalytics(query, results.length, searchTime);

    // Save to history
    addToSearchHistory(query, results.length, searchTime);

    // Display results
    displaySearchResults(results, query);

    logToConsole('success', `Found ${results.length} results in ${searchTime.toFixed(2)}ms`);

  } catch (error) {
    logToConsole('error', `Vector search failed: ${error.message}`);
    console.error(error);
  }
}

function applySearchFilters(results) {
  let filtered = [...results];

  // Type filter
  if (vectorSearchState.filters.type.length > 0) {
    filtered = filtered.filter(r => {
      const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      return vectorSearchState.filters.type.includes(metadata.type);
    });
  }

  // Date filter
  if (vectorSearchState.filters.dateFrom || vectorSearchState.filters.dateTo) {
    filtered = filtered.filter(r => {
      const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      const date = new Date(metadata.timestamp || metadata.created_at || Date.now());

      if (vectorSearchState.filters.dateFrom && date < new Date(vectorSearchState.filters.dateFrom)) {
        return false;
      }
      if (vectorSearchState.filters.dateTo && date > new Date(vectorSearchState.filters.dateTo)) {
        return false;
      }
      return true;
    });
  }

  // Source filter
  if (vectorSearchState.filters.source) {
    filtered = filtered.filter(r => {
      const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      return metadata.source?.includes(vectorSearchState.filters.source);
    });
  }

  return filtered;
}

function applyHybridSearch(results, query) {
  const queryTokens = query.toLowerCase().split(/\s+/);

  return results.map(result => {
    const metadata = typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata;
    const text = (metadata.description || JSON.stringify(metadata)).toLowerCase();

    // Calculate keyword match score
    const keywordScore = queryTokens.reduce((score, token) => {
      return score + (text.includes(token) ? 1 : 0);
    }, 0) / queryTokens.length;

    // Combine vector similarity and keyword score
    const vectorScore = 1 - result.distance;
    const hybridScore = (vectorScore * 0.7) + (keywordScore * 0.3);

    return {
      ...result,
      hybridScore,
      keywordScore
    };
  }).sort((a, b) => b.hybridScore - a.hybridScore);
}

// ============================================================================
// ADVANCED SEARCH
// ============================================================================

async function performAdvancedSearch() {
  const multiQuery = document.getElementById('multi-query').value.trim();
  const weightsStr = document.getElementById('query-weights').value.trim();
  const negativeQuery = document.getElementById('negative-query').value.trim();
  const diversityFactor = parseFloat(document.getElementById('diversity-factor').value);
  const rerankStrategy = document.getElementById('rerank-strategy').value;
  const clusterResults = document.getElementById('cluster-results').checked;
  const explainRelevance = document.getElementById('explain-relevance').checked;

  if (!multiQuery) {
    alert('Please enter at least one query');
    return;
  }

  logToConsole('info', 'Performing advanced multi-query search...');

  try {
    const queries = multiQuery.split('\n').filter(q => q.trim());
    const weights = weightsStr ? weightsStr.split(',').map(w => parseFloat(w.trim())) : queries.map(() => 1.0);

    // Normalize weights
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / weightSum);

    // Generate embeddings for all queries
    const queryEmbeddings = queries.map(q => ({
      query: q,
      embedding: generateMockEmbedding(q)
    }));

    // Perform searches
    let allResults = [];
    queryEmbeddings.forEach((qe, index) => {
      const results = state.db.searchSimilar(qe.embedding, 50);
      results.forEach(r => {
        r.queryIndex = index;
        r.weight = normalizedWeights[index];
        r.weightedScore = (1 - r.distance) * normalizedWeights[index];
      });
      allResults.push(...results);
    });

    // Apply negative search
    if (negativeQuery) {
      const negEmbedding = generateMockEmbedding(negativeQuery);
      allResults = allResults.filter(r => {
        const negDistance = cosineSimilarity(r.embedding, negEmbedding);
        return negDistance < 0.7; // Exclude if too similar to negative query
      });
    }

    // Merge and deduplicate results
    const mergedResults = mergeSearchResults(allResults);

    // Apply re-ranking
    let finalResults = rerankResults(mergedResults, rerankStrategy, diversityFactor);

    // Apply clustering if requested
    if (clusterResults) {
      finalResults = clusterSearchResults(finalResults);
    }

    // Add relevance explanations if requested
    if (explainRelevance) {
      finalResults.forEach(r => {
        r.explanation = generateRelevanceExplanation(r, queries);
      });
    }

    // Display results
    displaySearchResults(finalResults.slice(0, 20), queries.join(' + '));

    logToConsole('success', `Advanced search completed: ${finalResults.length} results`);

  } catch (error) {
    logToConsole('error', `Advanced search failed: ${error.message}`);
    console.error(error);
  }
}

function mergeSearchResults(results) {
  const merged = new Map();

  results.forEach(r => {
    const key = JSON.stringify(r.embedding.slice(0, 10)); // Use first 10 dims as key

    if (!merged.has(key)) {
      merged.set(key, { ...r, sources: [r.queryIndex] });
    } else {
      const existing = merged.get(key);
      existing.weightedScore += r.weightedScore;
      existing.sources.push(r.queryIndex);
    }
  });

  return Array.from(merged.values()).sort((a, b) => b.weightedScore - a.weightedScore);
}

function rerankResults(results, strategy, diversityFactor) {
  switch (strategy) {
    case 'mmr':
      return rerankMMR(results, diversityFactor);
    case 'reciprocal':
      return rerankReciprocalRank(results);
    case 'semantic':
      return rerankSemanticCoherence(results);
    default:
      return results;
  }
}

function rerankMMR(results, lambda) {
  // Maximal Marginal Relevance
  const selected = [];
  const remaining = [...results];

  while (remaining.length > 0 && selected.length < 20) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    remaining.forEach((candidate, idx) => {
      const relevance = candidate.weightedScore;

      // Calculate max similarity to already selected
      let maxSim = 0;
      selected.forEach(sel => {
        const sim = cosineSimilarity(candidate.embedding, sel.embedding);
        maxSim = Math.max(maxSim, sim);
      });

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = idx;
      }
    });

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

function rerankReciprocalRank(results) {
  // Reciprocal Rank Fusion
  const scores = new Map();
  const k = 60;

  results.forEach((r, idx) => {
    const key = JSON.stringify(r.embedding.slice(0, 10));
    const score = 1 / (k + idx);
    scores.set(key, (scores.get(key) || 0) + score);
  });

  return results.map(r => ({
    ...r,
    rrfScore: scores.get(JSON.stringify(r.embedding.slice(0, 10)))
  })).sort((a, b) => b.rrfScore - a.rrfScore);
}

function rerankSemanticCoherence(results) {
  // Re-rank based on semantic coherence with top results
  if (results.length === 0) return results;

  const topK = 5;
  const topResults = results.slice(0, topK);

  return results.map(r => {
    const coherence = topResults.reduce((sum, top) => {
      return sum + cosineSimilarity(r.embedding, top.embedding);
    }, 0) / topK;

    return {
      ...r,
      coherenceScore: (r.weightedScore * 0.6) + (coherence * 0.4)
    };
  }).sort((a, b) => b.coherenceScore - a.coherenceScore);
}

function clusterSearchResults(results) {
  // Simple k-means clustering
  const k = Math.min(5, Math.ceil(results.length / 5));

  // Initialize centroids randomly
  const centroids = results.slice(0, k).map(r => r.embedding);

  // Assign to clusters
  results.forEach(r => {
    let minDist = Infinity;
    let clusterIdx = 0;

    centroids.forEach((centroid, idx) => {
      const dist = 1 - cosineSimilarity(r.embedding, centroid);
      if (dist < minDist) {
        minDist = dist;
        clusterIdx = idx;
      }
    });

    r.cluster = clusterIdx;
  });

  // Sort by cluster and score
  return results.sort((a, b) => {
    if (a.cluster !== b.cluster) return a.cluster - b.cluster;
    return (b.weightedScore || b.hybridScore || (1 - b.distance)) -
           (a.weightedScore || a.hybridScore || (1 - a.distance));
  });
}

function generateRelevanceExplanation(result, queries) {
  const metadata = typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata;
  const score = (result.weightedScore || result.hybridScore || (1 - result.distance)) * 100;

  let explanation = `${score.toFixed(1)}% match`;

  if (result.sources && result.sources.length > 1) {
    explanation += ` (matched ${result.sources.length} queries)`;
  }

  if (result.cluster !== undefined) {
    explanation += ` • Cluster ${result.cluster + 1}`;
  }

  return explanation;
}

// ============================================================================
// VECTOR OPERATIONS
// ============================================================================

function updateOperationUI() {
  const operationType = document.getElementById('operation-type').value;

  // Hide all operation panels
  document.querySelectorAll('.operation-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  // Show selected panel
  const panel = document.getElementById(`op-${operationType}`);
  if (panel) {
    panel.style.display = 'block';
  }
}

async function performVectorOperation() {
  const operationType = document.getElementById('operation-type').value;

  logToConsole('info', `Performing vector operation: ${operationType}`);

  try {
    let results;

    switch (operationType) {
      case 'arithmetic':
        results = await performVectorArithmetic();
        break;
      case 'analogy':
        results = await performAnalogy();
        break;
      case 'interpolation':
        results = await performInterpolation();
        break;
      case 'neighbors':
        results = await performNeighborsGraph();
        break;
      case 'drift':
        results = await performDriftDetection();
        break;
    }

    displayOperationResults(results, operationType);

  } catch (error) {
    logToConsole('error', `Operation failed: ${error.message}`);
    console.error(error);
  }
}

async function performVectorArithmetic() {
  const positive = document.getElementById('positive-concepts').value.split(',').map(s => s.trim()).filter(s => s);
  const negative = document.getElementById('negative-concepts').value.split(',').map(s => s.trim()).filter(s => s);

  if (positive.length === 0) {
    throw new Error('Enter at least one positive concept');
  }

  // Generate embeddings
  const positiveEmbeddings = positive.map(c => generateMockEmbedding(c));
  const negativeEmbeddings = negative.map(c => generateMockEmbedding(c));

  // Perform vector arithmetic: avg(positive) - avg(negative)
  const dims = positiveEmbeddings[0].length;
  const resultVector = new Array(dims).fill(0);

  positiveEmbeddings.forEach(emb => {
    emb.forEach((val, idx) => resultVector[idx] += val);
  });

  negativeEmbeddings.forEach(emb => {
    emb.forEach((val, idx) => resultVector[idx] -= val);
  });

  // Normalize
  const norm = Math.sqrt(resultVector.reduce((sum, val) => sum + val * val, 0));
  const normalizedVector = resultVector.map(val => val / norm);

  // Find similar vectors
  const results = state.db.searchSimilar(normalizedVector, 10);

  return {
    operation: `${positive.join(' + ')} - ${negative.join(' - ')}`,
    results: results
  };
}

async function performAnalogy() {
  const a = document.getElementById('analogy-a').value.trim();
  const b = document.getElementById('analogy-b').value.trim();
  const c = document.getElementById('analogy-c').value.trim();

  if (!a || !b || !c) {
    throw new Error('Enter all three concepts for analogy');
  }

  // A:B::C:? => B - A + C
  const embA = generateMockEmbedding(a);
  const embB = generateMockEmbedding(b);
  const embC = generateMockEmbedding(c);

  const resultVector = embB.map((val, idx) => val - embA[idx] + embC[idx]);

  // Normalize
  const norm = Math.sqrt(resultVector.reduce((sum, val) => sum + val * val, 0));
  const normalizedVector = resultVector.map(val => val / norm);

  const results = state.db.searchSimilar(normalizedVector, 10);

  return {
    operation: `${a}:${b}::${c}:?`,
    results: results,
    explanation: `If ${a} is to ${b}, then ${c} is to...`
  };
}

async function performInterpolation() {
  const a = document.getElementById('interp-a').value.trim();
  const b = document.getElementById('interp-b').value.trim();
  const steps = parseInt(document.getElementById('interp-steps').value);

  if (!a || !b) {
    throw new Error('Enter both concepts for interpolation');
  }

  const embA = generateMockEmbedding(a);
  const embB = generateMockEmbedding(b);

  const interpolations = [];

  for (let i = 0; i <= steps; i++) {
    const alpha = i / steps;
    const interpolated = embA.map((val, idx) => val * (1 - alpha) + embB[idx] * alpha);

    // Normalize
    const norm = Math.sqrt(interpolated.reduce((sum, val) => sum + val * val, 0));
    const normalized = interpolated.map(val => val / norm);

    const results = state.db.searchSimilar(normalized, 3);

    interpolations.push({
      step: i,
      alpha: alpha.toFixed(2),
      label: `${(alpha * 100).toFixed(0)}% → ${b}`,
      results: results
    });
  }

  return {
    operation: `Interpolating from ${a} to ${b}`,
    interpolations: interpolations
  };
}

async function performNeighborsGraph() {
  const concept = document.getElementById('neighbors-concept').value.trim();
  const count = parseInt(document.getElementById('neighbors-count').value);
  const depth = parseInt(document.getElementById('graph-depth').value);

  if (!concept) {
    throw new Error('Enter a center concept');
  }

  const embedding = generateMockEmbedding(concept);
  const graph = { nodes: [], edges: [] };

  // Build graph
  const visited = new Set();
  const queue = [{ concept, embedding, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current.concept) || current.depth >= depth) continue;

    visited.add(current.concept);
    graph.nodes.push({ id: current.concept, depth: current.depth });

    const neighbors = state.db.searchSimilar(current.embedding, count);

    neighbors.forEach(neighbor => {
      const metadata = typeof neighbor.metadata === 'string' ? JSON.parse(neighbor.metadata) : neighbor.metadata;
      const neighborConcept = metadata.description || `Vector ${neighbor.id}`;

      graph.edges.push({
        source: current.concept,
        target: neighborConcept,
        weight: 1 - neighbor.distance
      });

      if (current.depth + 1 < depth) {
        queue.push({
          concept: neighborConcept,
          embedding: neighbor.embedding,
          depth: current.depth + 1
        });
      }
    });
  }

  return {
    operation: `Nearest neighbors graph for "${concept}"`,
    graph: graph
  };
}

async function performDriftDetection() {
  const concept = document.getElementById('drift-concept').value.trim();
  const window = parseInt(document.getElementById('drift-window').value);

  if (!concept) {
    throw new Error('Enter a reference concept');
  }

  const refEmbedding = generateMockEmbedding(concept);

  // Simulate drift detection by checking vectors over time
  const driftData = [];
  const now = Date.now();

  for (let i = 0; i < window; i += Math.floor(window / 10)) {
    const timestamp = now - (window - i) * 24 * 60 * 60 * 1000;

    // Simulate getting vectors from that time period
    const results = state.db.searchSimilar(refEmbedding, 100);

    const avgSimilarity = results.reduce((sum, r) => sum + (1 - r.distance), 0) / results.length;

    driftData.push({
      day: i,
      date: new Date(timestamp).toLocaleDateString(),
      avgSimilarity: avgSimilarity,
      drift: Math.abs(avgSimilarity - 0.8) // Assume 0.8 is baseline
    });
  }

  return {
    operation: `Vector drift analysis for "${concept}"`,
    window: `${window} days`,
    driftData: driftData,
    maxDrift: Math.max(...driftData.map(d => d.drift))
  };
}

function displayOperationResults(data, operationType) {
  const container = document.getElementById('vector-results');

  let html = '<div class="card" style="background: var(--bg-secondary);">';
  html += `<div class="card-title">🧮 ${data.operation}</div>`;

  if (operationType === 'interpolation') {
    html += '<div style="display: grid; gap: 1rem;">';
    data.interpolations.forEach(interp => {
      html += `
        <div class="card">
          <div style="font-weight: 600; margin-bottom: 0.5rem;">Step ${interp.step}: ${interp.label}</div>
          <div style="display: grid; gap: 0.5rem;">
      `;

      interp.results.slice(0, 3).forEach((r, idx) => {
        const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
        const similarity = ((1 - r.distance) * 100).toFixed(1);
        html += `
          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px;">
            <span>${metadata.description || `Vector ${r.id}`}</span>
            <span class="status-badge success">${similarity}%</span>
          </div>
        `;
      });

      html += '</div></div>';
    });
    html += '</div>';

  } else if (operationType === 'neighbors') {
    html += `<div style="margin-bottom: 1rem; color: var(--text-secondary);">`;
    html += `Graph with ${data.graph.nodes.length} nodes and ${data.graph.edges.length} edges`;
    html += `</div>`;

    // Display as adjacency list
    html += '<div style="max-height: 400px; overflow-y: auto;">';
    const nodeMap = new Map();

    data.graph.edges.forEach(edge => {
      if (!nodeMap.has(edge.source)) {
        nodeMap.set(edge.source, []);
      }
      nodeMap.get(edge.source).push({
        target: edge.target,
        weight: edge.weight
      });
    });

    nodeMap.forEach((neighbors, node) => {
      html += `<div style="margin-bottom: 1rem;">`;
      html += `<div style="font-weight: 600; margin-bottom: 0.5rem;">📍 ${node}</div>`;
      html += '<div style="display: grid; gap: 0.25rem; margin-left: 1rem;">';

      neighbors.slice(0, 5).forEach(n => {
        html += `
          <div style="font-size: 0.875rem; color: var(--text-secondary);">
            → ${n.target} <span class="status-badge">${(n.weight * 100).toFixed(1)}%</span>
          </div>
        `;
      });

      html += '</div></div>';
    });
    html += '</div>';

  } else if (operationType === 'drift') {
    html += `<div style="margin-bottom: 1rem; color: var(--text-secondary);">`;
    html += `Analysis window: ${data.window} • Max drift: ${(data.maxDrift * 100).toFixed(2)}%`;
    html += `</div>`;

    html += '<div class="card" style="background: var(--bg-tertiary);">';
    data.driftData.forEach(d => {
      const driftPercent = (d.drift * 100).toFixed(2);
      const color = d.drift > 0.2 ? 'error' : d.drift > 0.1 ? 'warning' : 'success';

      html += `
        <div class="stat-bar">
          <div class="stat-label">${d.date}</div>
          <div class="stat-value">
            <div class="stat-fill ${color}" style="width: ${Math.min(100, driftPercent * 10)}%;">
              <span class="stat-text">${driftPercent}%</span>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';

  } else {
    // Standard results display
    html += '<div style="display: grid; gap: 0.75rem; margin-top: 1rem;">';
    data.results.forEach((result, index) => {
      const similarity = ((1 - result.distance) * 100).toFixed(1);
      const metadata = typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata;

      html += `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <div style="font-weight: 600;">Result ${index + 1}</div>
            <span class="status-badge success">${similarity}% match</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.875rem;">
            ${metadata.description || JSON.stringify(metadata).substring(0, 100)}
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;

  // Show results controls
  document.getElementById('results-controls').style.display = 'block';
}

// ============================================================================
// SEARCH ANALYTICS
// ============================================================================

function updateSearchAnalytics(query, resultCount, searchTime) {
  vectorSearchState.analytics.totalSearches++;
  vectorSearchState.analytics.totalResults += resultCount;
  vectorSearchState.analytics.searchTimes.push(searchTime);

  // Track popular queries
  if (!vectorSearchState.analytics.popularQueries[query]) {
    vectorSearchState.analytics.popularQueries[query] = 0;
  }
  vectorSearchState.analytics.popularQueries[query]++;
}

function addToSearchHistory(query, resultCount, searchTime) {
  vectorSearchState.searchHistory.unshift({
    query: query,
    resultCount: resultCount,
    searchTime: searchTime,
    timestamp: new Date().toISOString()
  });

  // Keep only last 50
  if (vectorSearchState.searchHistory.length > 50) {
    vectorSearchState.searchHistory = vectorSearchState.searchHistory.slice(0, 50);
  }
}

function refreshAnalytics() {
  const analytics = vectorSearchState.analytics;

  // Update metrics
  document.getElementById('total-searches').textContent = analytics.totalSearches;

  const avgResults = analytics.totalSearches > 0
    ? (analytics.totalResults / analytics.totalSearches).toFixed(1)
    : 0;
  document.getElementById('avg-results').textContent = avgResults;

  // Calculate average similarity (mock)
  document.getElementById('avg-similarity').textContent = '78%';

  // Calculate click-through rate (mock)
  const ctr = analytics.totalSearches > 0
    ? ((analytics.totalClicks / analytics.totalSearches) * 100).toFixed(1)
    : 0;
  document.getElementById('click-through-rate').textContent = `${ctr}%`;

  // Popular searches
  const popularContainer = document.getElementById('popular-searches');
  const popular = Object.entries(analytics.popularQueries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (popular.length > 0) {
    popularContainer.innerHTML = popular.map(([query, count]) =>
      `<span class="tag" onclick="loadSearchFromHistory('${query}')" style="cursor: pointer;">
        ${query} (${count})
      </span>`
    ).join('');
  } else {
    popularContainer.innerHTML = '<span class="tag">No searches yet</span>';
  }

  // Search history
  const historyContainer = document.getElementById('search-history-list');
  if (vectorSearchState.searchHistory.length > 0) {
    historyContainer.innerHTML = vectorSearchState.searchHistory.slice(0, 10).map(h => {
      const date = new Date(h.timestamp);
      return `
        <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: 4px; cursor: pointer;"
             onclick="loadSearchFromHistory('${h.query}')">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.875rem; font-weight: 500;">${h.query}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
              ${h.resultCount} results • ${h.searchTime.toFixed(0)}ms
            </div>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
            ${date.toLocaleString()}
          </div>
        </div>
      `;
    }).join('');
  }

  // Update embedding stats
  const totalVectors = state.db?.vectors?.length || 0;
  document.getElementById('total-vectors').textContent = totalVectors;

  if (totalVectors > 0) {
    const vectors = state.db.vectors;
    const avgNorm = vectors.reduce((sum, v) => {
      const norm = Math.sqrt(v.embedding.reduce((s, val) => s + val * val, 0));
      return sum + norm;
    }, 0) / vectors.length;

    document.getElementById('avg-norm').textContent = avgNorm.toFixed(3);
  }
}

function loadSearchFromHistory(query) {
  document.getElementById('vector-query').value = query;

  // Switch to basic tab
  const basicTab = document.querySelector('.tabs .tab-button:first-child');
  if (basicTab) {
    basicTab.click();
  }

  logToConsole('info', `Loaded query from history: "${query}"`);
}

function exportAnalytics() {
  const data = {
    analytics: vectorSearchState.analytics,
    history: vectorSearchState.searchHistory,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vector-search-analytics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  logToConsole('success', 'Analytics exported successfully');
}

function clearAnalytics() {
  if (confirm('Clear all search analytics and history?')) {
    vectorSearchState.analytics = {
      totalSearches: 0,
      totalResults: 0,
      totalClicks: 0,
      searchTimes: [],
      popularQueries: {}
    };
    vectorSearchState.searchHistory = [];

    refreshAnalytics();
    logToConsole('info', 'Analytics cleared');
  }
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function updateVisualization() {
  // Placeholder - would implement actual visualization
  logToConsole('info', 'Visualization updated');
}

function generateVisualization() {
  const vizType = document.getElementById('viz-type').value;
  const sampleSize = parseInt(document.getElementById('viz-sample-size').value);
  const colorScheme = document.getElementById('viz-color-scheme').value;

  logToConsole('info', `Generating ${vizType} visualization...`);

  const container = document.getElementById('vector-visualization');
  const canvas = document.getElementById('viz-canvas');
  const emptyState = document.getElementById('viz-empty-state');

  try {
    // Get sample vectors
    const vectors = state.db?.vectors?.slice(0, sampleSize) || [];

    if (vectors.length === 0) {
      throw new Error('No vectors available for visualization');
    }

    // Hide empty state, show canvas
    emptyState.style.display = 'none';
    canvas.style.display = 'block';

    // Generate visualization based on type
    const ctx = canvas.getContext('2d');
    canvas.width = container.clientWidth - 32;
    canvas.height = 400;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch (vizType) {
      case 'scatter':
        drawScatterPlot(ctx, vectors, canvas.width, canvas.height, colorScheme);
        break;
      case 'heatmap':
        drawHeatmap(ctx, vectors, canvas.width, canvas.height, colorScheme);
        break;
      case 'network':
        drawNetwork(ctx, vectors, canvas.width, canvas.height, colorScheme);
        break;
      case 'cloud':
        drawConceptCloud(ctx, vectors, canvas.width, canvas.height);
        break;
      case 'distribution':
        drawDistribution(ctx, vectors, canvas.width, canvas.height);
        break;
    }

    logToConsole('success', `Visualization generated: ${vectors.length} vectors`);

  } catch (error) {
    logToConsole('error', `Visualization failed: ${error.message}`);
    emptyState.style.display = 'block';
    canvas.style.display = 'none';
  }
}

function drawScatterPlot(ctx, vectors, width, height, colorScheme) {
  // Simple 2D projection using first 2 dimensions (mock t-SNE)
  const padding = 40;
  const plotWidth = width - 2 * padding;
  const plotHeight = height - 2 * padding;

  // Find min/max for scaling
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  vectors.forEach(v => {
    minX = Math.min(minX, v.embedding[0]);
    maxX = Math.max(maxX, v.embedding[0]);
    minY = Math.min(minY, v.embedding[1]);
    maxY = Math.max(maxY, v.embedding[1]);
  });

  // Draw axes
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Draw points
  vectors.forEach((v, idx) => {
    const x = padding + ((v.embedding[0] - minX) / (maxX - minX)) * plotWidth;
    const y = height - padding - ((v.embedding[1] - minY) / (maxY - minY)) * plotHeight;

    // Color based on scheme
    const hue = colorScheme === 'viridis' ? (idx / vectors.length) * 280
              : colorScheme === 'plasma' ? (idx / vectors.length) * 300
              : (idx / vectors.length) * 360;

    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Labels
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('Dimension 1', width / 2 - 40, height - 10);
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Dimension 2', 0, 0);
  ctx.restore();
}

function drawHeatmap(ctx, vectors, width, height, colorScheme) {
  const size = Math.min(20, vectors.length);
  const cellSize = Math.min(width, height) / size;

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const similarity = cosineSimilarity(
        vectors[i].embedding,
        vectors[j].embedding
      );

      const intensity = Math.floor(similarity * 255);
      ctx.fillStyle = `rgb(${intensity}, ${intensity / 2}, ${255 - intensity})`;
      ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
    }
  }

  // Grid lines
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= size; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, size * cellSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(size * cellSize, i * cellSize);
    ctx.stroke();
  }
}

function drawNetwork(ctx, vectors, width, height, colorScheme) {
  const numNodes = Math.min(30, vectors.length);
  const nodes = [];

  // Position nodes in a circle
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 3;

  for (let i = 0; i < numNodes; i++) {
    const angle = (i / numNodes) * Math.PI * 2;
    nodes.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vector: vectors[i]
    });
  }

  // Draw edges for high similarity
  ctx.strokeStyle = 'rgba(100, 150, 255, 0.2)';
  ctx.lineWidth = 1;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const sim = cosineSimilarity(nodes[i].vector.embedding, nodes[j].vector.embedding);
      if (sim > 0.8) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw nodes
  nodes.forEach((node, idx) => {
    const hue = (idx / nodes.length) * 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.beginPath();
    ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawConceptCloud(ctx, vectors, width, height) {
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  vectors.slice(0, 30).forEach((v, idx) => {
    const metadata = typeof v.metadata === 'string' ? JSON.parse(v.metadata) : v.metadata;
    const text = metadata.description?.split(' ').slice(0, 2).join(' ') || `V${v.id}`;

    const x = (Math.random() * 0.8 + 0.1) * width;
    const y = (Math.random() * 0.8 + 0.1) * height;
    const size = 12 + Math.random() * 12;

    ctx.font = `bold ${size}px sans-serif`;
    const hue = (idx / vectors.length) * 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.fillText(text, x, y);
  });
}

function drawDistribution(ctx, vectors, width, height) {
  // Calculate similarity distribution
  const bins = 20;
  const histogram = new Array(bins).fill(0);

  // Compare all pairs
  for (let i = 0; i < Math.min(50, vectors.length); i++) {
    for (let j = i + 1; j < Math.min(50, vectors.length); j++) {
      const sim = cosineSimilarity(vectors[i].embedding, vectors[j].embedding);
      const bin = Math.min(bins - 1, Math.floor(sim * bins));
      histogram[bin]++;
    }
  }

  const maxCount = Math.max(...histogram);
  const barWidth = width / bins;
  const padding = 40;
  const plotHeight = height - 2 * padding;

  // Draw bars
  histogram.forEach((count, idx) => {
    const barHeight = (count / maxCount) * plotHeight;
    const x = idx * barWidth;
    const y = height - padding - barHeight;

    ctx.fillStyle = `hsl(${(idx / bins) * 240}, 70%, 60%)`;
    ctx.fillRect(x, y, barWidth - 2, barHeight);
  });

  // Axes
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - padding);
  ctx.lineTo(width, height - padding);
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('Similarity Distribution', width / 2 - 60, 20);
  ctx.fillText('0.0', 0, height - padding + 20);
  ctx.fillText('1.0', width - 20, height - padding + 20);
}

function exportVisualization() {
  const canvas = document.getElementById('viz-canvas');
  if (canvas.style.display === 'none') {
    alert('Generate a visualization first');
    return;
  }

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vector-visualization-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });

  logToConsole('success', 'Visualization exported');
}

function toggleVizOptions() {
  alert('Visualization options:\n\n' +
        '• Adjust sample size for performance\n' +
        '• Choose color scheme for clarity\n' +
        '• Export as PNG image\n' +
        '• Interactive features coming soon');
}

// ============================================================================
// RESULTS DISPLAY & MANAGEMENT
// ============================================================================

function displaySearchResults(results, query) {
  vectorSearchState.currentResults = results;
  vectorSearchState.currentPage = 1;

  if (results.length === 0) {
    document.getElementById('vector-results').innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">🔍</div>' +
      '<div class="empty-state-title">No similar vectors found</div></div>';
    document.getElementById('results-controls').style.display = 'none';
    return;
  }

  document.getElementById('results-controls').style.display = 'block';
  updateResultsDisplay();
}

function updateResultsDisplay() {
  const results = vectorSearchState.currentResults;
  const page = vectorSearchState.currentPage;
  const perPage = vectorSearchState.resultsPerPage;
  const view = vectorSearchState.resultView;

  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, results.length);
  const pageResults = results.slice(start, end);

  const container = document.getElementById('vector-results');

  let html = view === 'grid'
    ? '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0.75rem;">'
    : '<div style="display: grid; gap: 0.75rem;">';

  pageResults.forEach((result, index) => {
    const globalIndex = start + index;
    const similarity = ((result.weightedScore || result.hybridScore || (1 - result.distance)) * 100).toFixed(1);
    const metadata = typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata;

    html += `
      <div class="card" onclick="handleResultClick(${globalIndex})" style="cursor: pointer;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
          <div style="font-weight: 600;">Result ${globalIndex + 1}</div>
          <span class="status-badge success">${similarity}% match</span>
        </div>
    `;

    if (result.explanation) {
      html += `
        <div style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; margin-bottom: 0.75rem; font-size: 0.75rem;">
          💡 ${result.explanation}
        </div>
      `;
    }

    if (result.cluster !== undefined) {
      html += `<div style="margin-bottom: 0.5rem;"><span class="tag">Cluster ${result.cluster + 1}</span></div>`;
    }

    html += `
        <div style="color: var(--text-secondary); font-size: 0.875rem;">
          ${metadata.description || JSON.stringify(metadata).substring(0, 150)}
        </div>

        <div class="stat-bar" style="margin-top: 0.75rem; margin-bottom: 0;">
          <div class="stat-label" style="min-width: 80px;">Similarity</div>
          <div class="stat-value">
            <div class="stat-fill" style="width: ${similarity}%;">
              <span class="stat-text">${similarity}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Update pagination
  updatePaginationControls();
}

function updatePaginationControls() {
  const total = vectorSearchState.currentResults.length;
  const page = vectorSearchState.currentPage;
  const perPage = vectorSearchState.resultsPerPage;

  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  document.getElementById('pagination-info').textContent =
    `Showing ${start}-${end} of ${total} results`;

  if (totalPages > 1) {
    document.getElementById('pagination-controls').style.display = 'block';
    document.getElementById('page-numbers').textContent = `Page ${page} of ${totalPages}`;

    document.getElementById('prev-page-btn').disabled = page === 1;
    document.getElementById('next-page-btn').disabled = page === totalPages;
  } else {
    document.getElementById('pagination-controls').style.display = 'none';
  }
}

function toggleResultView(view) {
  vectorSearchState.resultView = view;

  // Update button states
  document.getElementById('view-grid-btn').classList.toggle('active', view === 'grid');
  document.getElementById('view-list-btn').classList.toggle('active', view === 'list');

  updateResultsDisplay();
}

function sortResults() {
  const sortBy = document.getElementById('sort-by').value;
  const results = vectorSearchState.currentResults;

  results.sort((a, b) => {
    switch (sortBy) {
      case 'relevance':
        const scoreA = a.weightedScore || a.hybridScore || (1 - a.distance);
        const scoreB = b.weightedScore || b.hybridScore || (1 - b.distance);
        return scoreB - scoreA;

      case 'date':
        const metaA = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
        const metaB = typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata;
        return new Date(metaB.timestamp || 0) - new Date(metaA.timestamp || 0);

      case 'type':
        const typeA = (typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata).type || '';
        const typeB = (typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata).type || '';
        return typeA.localeCompare(typeB);

      case 'similarity':
        return (1 - a.distance) - (1 - b.distance);

      default:
        return 0;
    }
  });

  vectorSearchState.currentPage = 1;
  updateResultsDisplay();
}

function updatePagination() {
  vectorSearchState.resultsPerPage = parseInt(document.getElementById('results-per-page').value);
  vectorSearchState.currentPage = 1;
  updateResultsDisplay();
}

function previousPage() {
  if (vectorSearchState.currentPage > 1) {
    vectorSearchState.currentPage--;
    updateResultsDisplay();
  }
}

function nextPage() {
  const totalPages = Math.ceil(vectorSearchState.currentResults.length / vectorSearchState.resultsPerPage);
  if (vectorSearchState.currentPage < totalPages) {
    vectorSearchState.currentPage++;
    updateResultsDisplay();
  }
}

function handleResultClick(index) {
  vectorSearchState.analytics.totalClicks++;

  const result = vectorSearchState.currentResults[index];
  const metadata = typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata;

  logToConsole('info', `Result clicked: ${metadata.description || 'Vector ' + result.id}`);

  // Could implement detail view here
  alert('Result Details:\n\n' + JSON.stringify(metadata, null, 2));
}

function exportSearchResults() {
  if (vectorSearchState.currentResults.length === 0) {
    alert('No results to export');
    return;
  }

  const format = prompt('Export format (json/csv):', 'json');

  if (format === 'json') {
    const data = {
      results: vectorSearchState.currentResults.map(r => ({
        similarity: (1 - r.distance) * 100,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
      })),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

  } else if (format === 'csv') {
    let csv = 'Rank,Similarity,Description,Type\n';

    vectorSearchState.currentResults.forEach((r, idx) => {
      const sim = ((1 - r.distance) * 100).toFixed(2);
      const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      const desc = (metadata.description || '').replace(/"/g, '""');
      const type = metadata.type || 'unknown';

      csv += `${idx + 1},${sim},"${desc}",${type}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  logToConsole('success', `Results exported as ${format}`);
}

// ============================================================================
// FILTER MANAGEMENT
// ============================================================================

function toggleFilter(filterType) {
  const filterOptions = document.getElementById('filter-options');
  const filterSection = document.getElementById(`filter-${filterType}`);

  // Toggle visibility
  if (filterSection.style.display === 'none') {
    filterSection.style.display = 'block';
    filterOptions.style.display = 'block';
  } else {
    filterSection.style.display = 'none';

    // Hide parent if no filters visible
    const anyVisible = Array.from(document.querySelectorAll('.filter-section'))
      .some(s => s.style.display !== 'none');

    if (!anyVisible) {
      filterOptions.style.display = 'none';
    }
  }

  // Update filter state when checkboxes change
  if (filterType === 'type') {
    const checkboxes = filterSection.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        vectorSearchState.filters.type = Array.from(checkboxes)
          .filter(c => c.checked)
          .map(c => c.value);
      });
    });
  }

  // Update date filters
  if (filterType === 'date') {
    document.getElementById('date-from')?.addEventListener('change', (e) => {
      vectorSearchState.filters.dateFrom = e.target.value;
    });
    document.getElementById('date-to')?.addEventListener('change', (e) => {
      vectorSearchState.filters.dateTo = e.target.value;
    });
  }

  // Update source filter
  if (filterType === 'source') {
    document.getElementById('source-filter')?.addEventListener('input', (e) => {
      vectorSearchState.filters.source = e.target.value.trim();
    });
  }
}

// ============================================================================
// SEARCH SUGGESTIONS
// ============================================================================

function showSearchSuggestions(value) {
  const container = document.getElementById('search-suggestions');

  if (!value || value.length < 2) {
    container.style.display = 'none';
    return;
  }

  // Get suggestions from history and popular searches
  const suggestions = new Set();

  vectorSearchState.searchHistory.forEach(h => {
    if (h.query.toLowerCase().includes(value.toLowerCase())) {
      suggestions.add(h.query);
    }
  });

  Object.keys(vectorSearchState.analytics.popularQueries).forEach(q => {
    if (q.toLowerCase().includes(value.toLowerCase())) {
      suggestions.add(q);
    }
  });

  if (suggestions.size > 0) {
    container.innerHTML = Array.from(suggestions).slice(0, 5).map(s =>
      `<div class="suggestion-item" onclick="selectSuggestion('${s}')">${s}</div>`
    ).join('');
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

function selectSuggestion(suggestion) {
  document.getElementById('vector-query').value = suggestion;
  document.getElementById('search-suggestions').style.display = 'none';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function saveSearch() {
  const query = document.getElementById('vector-query').value.trim();
  if (!query) {
    alert('Enter a query to save');
    return;
  }

  const name = prompt('Name for this search:', query);
  if (!name) return;

  vectorSearchState.savedSearches.push({
    name: name,
    query: query,
    filters: { ...vectorSearchState.filters },
    savedAt: new Date().toISOString()
  });

  logToConsole('success', `Search saved: ${name}`);
}

function showSearchHistory() {
  // Switch to analytics tab
  const analyticsTab = document.querySelectorAll('.tabs .tab-button')[3];
  if (analyticsTab) {
    analyticsTab.click();
  }
}

function clearVectorSearch() {
  document.getElementById('vector-query').value = '';
  document.getElementById('vector-limit').value = '10';
  document.getElementById('similarity-threshold').value = '0.5';
  document.getElementById('search-mode').value = 'semantic';

  // Clear filters
  vectorSearchState.filters = {
    type: [],
    dateFrom: null,
    dateTo: null,
    metadata: {},
    source: null
  };

  document.getElementById('filter-options').style.display = 'none';
  document.querySelectorAll('.filter-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);

  // Clear results
  document.getElementById('vector-results').innerHTML =
    '<div class="empty-state"><div class="empty-state-icon">🔍</div>' +
    '<div class="empty-state-title">Enter a query to search</div>' +
    '<div class="empty-state-text">Advanced semantic search with vector embeddings</div></div>';

  document.getElementById('results-controls').style.display = 'none';

  logToConsole('info', 'Search cleared');
}

function clearAdvancedSearch() {
  document.getElementById('multi-query').value = '';
  document.getElementById('query-weights').value = '';
  document.getElementById('negative-query').value = '';
  document.getElementById('diversity-factor').value = '0.5';
  document.getElementById('rerank-strategy').value = 'none';
  document.getElementById('cluster-results').checked = false;
  document.getElementById('explain-relevance').checked = false;

  logToConsole('info', 'Advanced search cleared');
}

function clearOperations() {
  document.getElementById('positive-concepts').value = '';
  document.getElementById('negative-concepts').value = '';
  document.getElementById('analogy-a').value = '';
  document.getElementById('analogy-b').value = '';
  document.getElementById('analogy-c').value = '';
  document.getElementById('interp-a').value = '';
  document.getElementById('interp-b').value = '';
  document.getElementById('neighbors-concept').value = '';
  document.getElementById('drift-concept').value = '';

  logToConsole('info', 'Operations cleared');
}

function loadSearchTemplate() {
  const templates = [
    { name: 'Multi-topic Research', queries: 'machine learning\nartificial intelligence\nneural networks', weights: '1.0, 0.8, 0.8' },
    { name: 'Filtered Search', queries: 'technology trends', negative: 'cryptocurrency' },
    { name: 'Diverse Results', queries: 'innovation', diversity: '0.8', rerank: 'mmr' }
  ];

  const choice = prompt('Templates:\n' + templates.map((t, i) => `${i + 1}. ${t.name}`).join('\n') + '\n\nSelect (1-3):');

  const idx = parseInt(choice) - 1;
  if (idx >= 0 && idx < templates.length) {
    const template = templates[idx];

    if (template.queries) document.getElementById('multi-query').value = template.queries;
    if (template.weights) document.getElementById('query-weights').value = template.weights;
    if (template.negative) document.getElementById('negative-query').value = template.negative;
    if (template.diversity) document.getElementById('diversity-factor').value = template.diversity;
    if (template.rerank) document.getElementById('rerank-strategy').value = template.rerank;

    logToConsole('info', `Loaded template: ${template.name}`);
  }
}

function showOperationExamples() {
  const operationType = document.getElementById('operation-type').value;

  const examples = {
    arithmetic: 'Example: king + woman - man = queen\nPositive: king, woman\nNegative: man',
    analogy: 'Example: Paris is to France as Tokyo is to Japan\nA: Paris, B: France, C: Tokyo → ?',
    interpolation: 'Example: Find concepts between "science" and "art"\nShows gradual semantic transitions',
    neighbors: 'Example: Explore concepts related to "technology"\nBuilds a knowledge graph of related terms',
    drift: 'Example: Track how "AI" meaning changed over time\nDetects semantic shifts in concept usage'
  };

  alert(examples[operationType] || 'Select an operation type');
}

// Helper: cosine similarity
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// INITIALIZE
// ============================================================================

// Initialize analytics on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Set up event listeners for filters
    const filterCheckboxes = document.querySelectorAll('.filter-checkbox');
    filterCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const section = cb.closest('.filter-section');
        if (section && section.id === 'filter-type') {
          vectorSearchState.filters.type = Array.from(section.querySelectorAll('input:checked'))
            .map(c => c.value);
        }
      });
    });

    // Add CSS for suggestions
    const style = document.createElement('style');
    style.textContent = `
      .search-suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        margin-top: 0.25rem;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .suggestion-item {
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        transition: background 0.2s;
      }

      .suggestion-item:hover {
        background: var(--bg-tertiary);
      }

      .metric-card {
        text-align: center;
        padding: 1rem;
        background: var(--bg-secondary);
        border-radius: 6px;
      }

      .metric-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: 0.25rem;
      }

      .metric-label {
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
      }

      .checkbox-label {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-right: 1rem;
        cursor: pointer;
        font-size: 0.875rem;
      }

      .checkbox-label input[type="checkbox"] {
        cursor: pointer;
      }

      .tag {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        background: var(--bg-tertiary);
        border-radius: 4px;
        font-size: 0.75rem;
        color: var(--text-secondary);
      }

      .operation-panel {
        margin-top: 1rem;
      }

      .btn.active {
        background: var(--primary);
        color: white;
      }
    `;
    document.head.appendChild(style);

    logToConsole('info', 'Enhanced Vector Search initialized');
  });
}
