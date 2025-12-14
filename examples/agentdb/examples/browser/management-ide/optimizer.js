// ============================================================================
// ADVANCED QUERY OPTIMIZER FOR AGENTDB
// ============================================================================

// Global state for optimizer
const optimizerState = {
  currentQuery: '',
  originalQuery: '',
  optimizedQuery: '',
  analysisHistory: [],
  performanceData: {},
  wizardStep: 0
};

// Query library templates
const queryLibrary = [
  {
    name: 'Efficient Vector Search',
    category: 'vectors',
    description: 'Optimized vector similarity search with indexed embeddings',
    query: `SELECT v.id, v.metadata, v.created_at
FROM vectors v
WHERE v.embedding IS NOT NULL
ORDER BY LENGTH(v.embedding) ASC
LIMIT 10;`,
    tips: ['Use indexed embedding columns', 'Always add LIMIT clause', 'Pre-filter with WHERE if possible']
  },
  {
    name: 'Pattern Matching with Index',
    category: 'patterns',
    description: 'Fast pattern search using indexed pattern_type',
    query: `SELECT p.id, p.pattern_type, p.metadata
FROM patterns p
WHERE p.pattern_type = 'causal'
  AND json_extract(p.metadata, '$.confidence') >= 0.8
ORDER BY p.created_at DESC
LIMIT 20;`,
    tips: ['Index pattern_type column', 'Filter by confidence early', 'Use covering indexes']
  },
  {
    name: 'Causal Path Analysis',
    category: 'causal',
    description: 'Recursive causal edge traversal with weight filtering',
    query: `SELECT ce.id, ce.cause, ce.effect, ce.metadata
FROM causal_edges ce
WHERE json_extract(ce.metadata, '$.weight') >= 0.5
ORDER BY json_extract(ce.metadata, '$.weight') DESC
LIMIT 50;`,
    tips: ['Limit recursion depth', 'Filter by weight threshold', 'Index cause and effect columns']
  },
  {
    name: 'Optimized JOIN Query',
    category: 'joins',
    description: 'Multi-table join with proper indexing and filtering',
    query: `SELECT
  e.id as episode_id,
  e.task,
  p.pattern_type
FROM episodes e
INNER JOIN patterns p ON e.id = json_extract(p.metadata, '$.episode_id')
WHERE e.created_at >= 1000000
ORDER BY e.created_at DESC
LIMIT 100;`,
    tips: ['Join on indexed columns', 'Filter before joining', 'Use INNER JOIN when possible']
  },
  {
    name: 'Aggregate with Grouping',
    category: 'aggregates',
    description: 'Efficient aggregation with indexed GROUP BY',
    query: `SELECT
  pattern_type,
  COUNT(*) as count,
  AVG(CAST(json_extract(metadata, '$.confidence') AS REAL)) as avg_confidence
FROM patterns
WHERE created_at >= 1000000
GROUP BY pattern_type
HAVING count >= 5
ORDER BY count DESC;`,
    tips: ['Index GROUP BY columns', 'Filter before aggregating', 'Use HAVING for aggregate filters']
  },
  {
    name: 'JSON Metadata Search',
    category: 'vectors',
    description: 'Query JSON metadata efficiently',
    query: `SELECT
  id,
  json_extract(metadata, '$.type') as type,
  json_extract(metadata, '$.description') as description
FROM vectors
WHERE json_extract(metadata, '$.type') = 'semantic'
LIMIT 50;`,
    tips: ['Create indexes on JSON fields if possible', 'Extract once, use multiple times', 'Consider materializing columns']
  }
];

// Switch optimizer tabs
function switchOptimizerTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.optimizer-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update tab content
  document.querySelectorAll('.optimizer-tab-content').forEach(content => {
    content.style.display = 'none';
  });
  document.getElementById(`optimizer-tab-${tab}`).style.display = 'block';

  // Load library templates if switching to library tab
  if (tab === 'library') {
    loadQueryLibrary();
  }
}

// Comprehensive query analysis
async function analyzeQuery() {
  const query = document.getElementById('optimizer-query').value.trim();

  if (!query) {
    alert('Please enter a query to analyze');
    return;
  }

  logToConsole('info', 'Running comprehensive query analysis...');
  optimizerState.currentQuery = query;

  try {
    const startTime = performance.now();

    // Get execution plan
    const plan = sqlAll(`EXPLAIN QUERY PLAN ${query}`);

    // Benchmark query
    const benchmarkResults = await benchmarkQueryInternal(query);

    const analysisTime = performance.now() - startTime;

    // Generate comprehensive analysis
    const analysis = {
      plan: plan,
      suggestions: generateAdvancedSuggestions(query, plan),
      optimizedQuery: generateOptimizedQuery(query),
      metrics: {
        executionTime: benchmarkResults.avgTime,
        planningTime: analysisTime,
        scanType: detectScanType(plan),
        complexity: calculateQueryComplexity(query)
      },
      agentDBSpecific: analyzeAgentDBFeatures(query),
      antiPatterns: detectAntiPatterns(query)
    };

    // Store in history
    optimizerState.analysisHistory.push({
      query: query,
      timestamp: new Date(),
      analysis: analysis
    });

    // Display results
    displayAnalysisResults(analysis);

    // Auto-optimize if enabled
    const autoOptimize = document.getElementById('auto-optimize');
    if (autoOptimize && autoOptimize.checked) {
      applyOptimization(analysis.optimizedQuery);
    }

    logToConsole('success', 'Analysis complete');

  } catch (error) {
    logToConsole('error', `Analysis failed: ${error.message}`);
    displayError('optimizer-results', error.message);
  }
}

// Quick analysis (lightweight check)
async function quickAnalysis() {
  const query = document.getElementById('optimizer-query').value.trim();

  if (!query) {
    alert('Please enter a query to analyze');
    return;
  }

  const suggestions = generateAdvancedSuggestions(query, []);
  const antiPatterns = detectAntiPatterns(query);

  let html = '<div class="card"><div class="card-title">Quick Analysis</div>';

  if (antiPatterns.length > 0) {
    html += '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.875rem; color: #f97316;">⚠️ Anti-Patterns Detected</h4>';
    html += '<ul style="margin-left: 1.5rem; color: var(--text-secondary);">';
    antiPatterns.forEach(pattern => {
      html += `<li style="margin-bottom: 0.5rem; color: #f97316;">${pattern}</li>`;
    });
    html += '</ul>';
  }

  html += '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.875rem;">💡 Quick Suggestions</h4>';
  html += '<ul style="margin-left: 1.5rem; color: var(--text-secondary);">';
  suggestions.forEach(suggestion => {
    html += `<li style="margin-bottom: 0.5rem;">${suggestion.text}</li>`;
  });
  html += '</ul></div>';

  document.getElementById('optimizer-results').innerHTML = html;
  logToConsole('info', 'Quick analysis complete');
}

// Benchmark query performance
async function benchmarkQuery() {
  const query = document.getElementById('optimizer-query').value.trim();

  if (!query) {
    alert('Please enter a query to benchmark');
    return;
  }

  logToConsole('info', 'Benchmarking query performance...');

  try {
    const results = await benchmarkQueryInternal(query, 10);

    let html = '<div class="card"><div class="card-title">Benchmark Results</div>';
    html += `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
        <div class="stat-card">
          <div class="stat-label">Average Time</div>
          <div class="stat-value">${results.avgTime.toFixed(2)}ms</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Min Time</div>
          <div class="stat-value">${results.minTime.toFixed(2)}ms</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Max Time</div>
          <div class="stat-value">${results.maxTime.toFixed(2)}ms</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Std Dev</div>
          <div class="stat-value">${results.stdDev.toFixed(2)}ms</div>
        </div>
      </div>
    `;

    // Performance chart
    html += '<h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 0.875rem;">Execution Times</h4>';
    html += '<div style="display: flex; align-items: flex-end; gap: 0.25rem; height: 100px; margin-top: 0.5rem;">';
    results.times.forEach((time, i) => {
      const height = (time / results.maxTime) * 100;
      html += `<div style="flex: 1; background: var(--primary-color); height: ${height}%; opacity: 0.7; border-radius: 2px;" title="Run ${i+1}: ${time.toFixed(2)}ms"></div>`;
    });
    html += '</div>';

    html += '</div>';

    document.getElementById('optimizer-results').innerHTML = html;
    logToConsole('success', `Benchmark complete (${results.times.length} runs)`);

  } catch (error) {
    logToConsole('error', `Benchmark failed: ${error.message}`);
  }
}

// Internal benchmark function
async function benchmarkQueryInternal(query, runs = 5) {
  const times = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    try {
      sqlAll(query);
    } catch (e) {
      // Query might fail, but we still measure planning time
    }
    times.push(performance.now() - start);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return { times, avgTime, minTime, maxTime, stdDev };
}

// Generate advanced optimization suggestions
function generateAdvancedSuggestions(query, plan) {
  const suggestions = [];
  const queryLower = query.toLowerCase();

  // Index recommendations
  const tables = extractTables(query);
  const whereColumns = extractWhereColumns(query);

  if (whereColumns.length > 0) {
    whereColumns.forEach(col => {
      suggestions.push({
        type: 'index',
        priority: 'high',
        text: `🔍 Create index on '${col}' column for faster filtering`,
        sql: `CREATE INDEX IF NOT EXISTS idx_${col.replace(/\./g, '_')} ON ${tables[0]}(${col.split('.').pop()});`
      });
    });
  }

  // Scan type optimization
  if (plan.some(step => step.detail && step.detail.includes('SCAN TABLE'))) {
    suggestions.push({
      type: 'performance',
      priority: 'high',
      text: '⚡ Full table scan detected - add indexes on filter columns'
    });
  }

  // SELECT * optimization
  if (queryLower.includes('select *')) {
    suggestions.push({
      type: 'performance',
      priority: 'medium',
      text: '📊 Replace SELECT * with specific columns for better performance'
    });
  }

  // LIMIT clause
  if (!queryLower.includes('limit') && queryLower.includes('select')) {
    suggestions.push({
      type: 'performance',
      priority: 'medium',
      text: '🎯 Add LIMIT clause to prevent excessive data retrieval'
    });
  }

  // JOIN optimization
  if (queryLower.includes('join')) {
    suggestions.push({
      type: 'performance',
      priority: 'high',
      text: '🔗 Ensure JOIN columns are indexed and filtered before joining'
    });

    // Check for JOIN order
    if (tables.length > 2) {
      suggestions.push({
        type: 'optimization',
        priority: 'medium',
        text: '🔀 Optimize JOIN order - put smallest result set first'
      });
    }
  }

  // Subquery optimization
  const subqueryCount = (query.match(/select/gi) || []).length - 1;
  if (subqueryCount > 0) {
    suggestions.push({
      type: 'refactoring',
      priority: 'medium',
      text: '🔄 Consider replacing subqueries with JOINs or CTEs for better performance'
    });
  }

  // DISTINCT optimization
  if (queryLower.includes('distinct')) {
    suggestions.push({
      type: 'performance',
      priority: 'low',
      text: '✨ DISTINCT can be expensive - ensure it\'s necessary or use GROUP BY'
    });
  }

  // ORDER BY optimization
  if (queryLower.includes('order by')) {
    const orderColumns = extractOrderByColumns(query);
    suggestions.push({
      type: 'index',
      priority: 'medium',
      text: `📈 Create composite index for ORDER BY columns: ${orderColumns.join(', ')}`
    });
  }

  // UNION vs UNION ALL
  if (queryLower.includes('union ') && !queryLower.includes('union all')) {
    suggestions.push({
      type: 'performance',
      priority: 'low',
      text: '🔗 Use UNION ALL instead of UNION if duplicates are acceptable'
    });
  }

  return suggestions;
}

// Analyze AgentDB-specific features
function analyzeAgentDBFeatures(query) {
  const features = [];
  const queryLower = query.toLowerCase();

  if (queryLower.includes('vectors') || queryLower.includes('embedding')) {
    features.push({
      type: 'vector',
      recommendation: 'Use vector operations efficiently and always filter with LIMIT',
      example: 'SELECT * FROM vectors WHERE embedding IS NOT NULL LIMIT 10'
    });
  }

  if (queryLower.includes('patterns')) {
    features.push({
      type: 'pattern',
      recommendation: 'Index pattern_type column for fast filtering',
      example: 'CREATE INDEX idx_pattern_type ON patterns(pattern_type)'
    });
  }

  if (queryLower.includes('causal_edges')) {
    features.push({
      type: 'causal',
      recommendation: 'Filter by weight/confidence to reduce result set',
      example: 'WHERE json_extract(metadata, \'$.weight\') >= 0.5'
    });
  }

  if (queryLower.includes('json_extract')) {
    features.push({
      type: 'json',
      recommendation: 'Extract JSON fields efficiently and consider caching results',
      example: 'Store frequently accessed JSON fields as virtual columns if possible'
    });
  }

  return features;
}

// Detect anti-patterns
function detectAntiPatterns(query) {
  const antiPatterns = [];
  const queryLower = query.toLowerCase();

  // N+1 query pattern
  if (queryLower.includes('in (select')) {
    antiPatterns.push('❌ Possible N+1 query - use JOIN instead of IN (SELECT ...)');
  }

  // NOT IN with NULL handling
  if (queryLower.includes('not in')) {
    antiPatterns.push('⚠️ NOT IN can have unexpected results with NULLs - use NOT EXISTS or LEFT JOIN');
  }

  // OR in WHERE clause
  if ((query.match(/\sOR\s/gi) || []).length > 2) {
    antiPatterns.push('⚠️ Multiple ORs can prevent index usage - consider UNION or separate queries');
  }

  // Functions on indexed columns
  if (/WHERE\s+\w+\([^)]*\w+\)/i.test(query)) {
    antiPatterns.push('⚠️ Functions on columns prevent index usage - use indexed columns directly');
  }

  // LIKE with leading wildcard
  if (queryLower.includes("like '%")) {
    antiPatterns.push('⚠️ LIKE with leading wildcard prevents index usage - use full-text search instead');
  }

  return antiPatterns;
}

// Generate optimized version of query
function generateOptimizedQuery(query) {
  let optimized = query;
  const queryLower = query.toLowerCase();

  // Add LIMIT if missing
  if (!queryLower.includes('limit') && queryLower.includes('select')) {
    optimized += optimized.trim().endsWith(';') ? '\nLIMIT 100;' : '\nLIMIT 100';
  }

  // Replace IN (SELECT with EXISTS
  optimized = optimized.replace(/IN\s*\(\s*SELECT/gi, 'EXISTS (SELECT 1 FROM');

  // Store for comparison
  optimizerState.optimizedQuery = optimized;

  return optimized;
}

// Calculate query complexity score
function calculateQueryComplexity(query) {
  let score = 0;
  const queryLower = query.toLowerCase();

  score += (query.match(/join/gi) || []).length * 2;
  score += (query.match(/select/gi) || []).length - 1; // Subqueries
  score += (query.match(/where/gi) || []).length;
  score += (query.match(/group by/gi) || []).length * 2;
  score += (query.match(/order by/gi) || []).length;
  score += queryLower.includes('distinct') ? 1 : 0;
  score += queryLower.includes('union') ? 2 : 0;
  score += (query.match(/recursive/gi) || []).length * 3;

  return Math.min(score, 10); // Cap at 10
}

// Detect scan type from plan
function detectScanType(plan) {
  if (!plan || plan.length === 0) return 'unknown';

  const planText = plan.map(p => p.detail).join(' ');

  if (planText.includes('SEARCH') && planText.includes('INDEX')) {
    return 'index-search';
  } else if (planText.includes('SCAN') && planText.includes('INDEX')) {
    return 'index-scan';
  } else if (planText.includes('SCAN TABLE')) {
    return 'table-scan';
  }

  return 'unknown';
}

// Helper functions for query parsing
function extractTables(query) {
  const regex = /FROM\s+(\w+)|JOIN\s+(\w+)/gi;
  const tables = new Set();
  let match;

  while ((match = regex.exec(query)) !== null) {
    tables.add(match[1] || match[2]);
  }

  return Array.from(tables);
}

function extractWhereColumns(query) {
  const whereMatch = query.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|;|$)/is);
  if (!whereMatch) return [];

  const whereClause = whereMatch[1];
  const columns = [];
  const columnRegex = /(\w+\.\w+|\w+)\s*[=<>]/g;
  let match;

  while ((match = columnRegex.exec(whereClause)) !== null) {
    columns.push(match[1]);
  }

  return [...new Set(columns)];
}

function extractOrderByColumns(query) {
  const orderMatch = query.match(/ORDER BY\s+(.+?)(?:LIMIT|;|$)/is);
  if (!orderMatch) return [];

  return orderMatch[1].split(',').map(col => col.trim().split(/\s+/)[0]);
}

// Display comprehensive analysis results
function displayAnalysisResults(analysis) {
  const container = document.getElementById('optimizer-results');

  let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';

  // Metrics overview
  html += '<div class="card"><div class="card-title">📊 Performance Metrics</div>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">';
  html += `
    <div class="stat-card">
      <div class="stat-label">Execution Time</div>
      <div class="stat-value">${analysis.metrics.executionTime.toFixed(2)}ms</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Scan Type</div>
      <div class="stat-value" style="font-size: 0.875rem;">${analysis.metrics.scanType}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Complexity</div>
      <div class="stat-value">${analysis.metrics.complexity}/10</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Planning Time</div>
      <div class="stat-value">${analysis.metrics.planningTime.toFixed(2)}ms</div>
    </div>
  `;
  html += '</div></div>';

  // Execution plan
  html += '<div class="card"><div class="card-title">🗺️ Execution Plan</div>';
  html += '<div class="help-example"><pre style="font-size: 0.8rem;">';
  analysis.plan.forEach((step, i) => {
    html += `${i + 1}. ${step.detail}\n`;
  });
  html += '</pre></div></div>';

  // Anti-patterns
  if (analysis.antiPatterns.length > 0) {
    html += '<div class="card"><div class="card-title" style="color: #f97316;">⚠️ Anti-Patterns Detected</div>';
    html += '<ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text-secondary);">';
    analysis.antiPatterns.forEach(pattern => {
      html += `<li style="margin-bottom: 0.5rem; color: #f97316;">${pattern}</li>`;
    });
    html += '</ul></div>';
  }

  // Optimization suggestions
  html += '<div class="card"><div class="card-title">💡 Optimization Suggestions</div>';

  const highPriority = analysis.suggestions.filter(s => s.priority === 'high');
  const mediumPriority = analysis.suggestions.filter(s => s.priority === 'medium');
  const lowPriority = analysis.suggestions.filter(s => s.priority === 'low');

  if (highPriority.length > 0) {
    html += '<h4 style="margin-top: 0.5rem; margin-bottom: 0.5rem; font-size: 0.875rem; color: #ef4444;">High Priority</h4>';
    html += '<ul style="margin-left: 1.5rem; color: var(--text-secondary);">';
    highPriority.forEach(s => {
      html += `<li style="margin-bottom: 0.5rem;">${s.text}`;
      if (s.sql) {
        html += `<br><code style="font-size: 0.75rem; background: var(--bg-secondary); padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block; margin-top: 0.25rem;">${s.sql}</code>`;
      }
      html += '</li>';
    });
    html += '</ul>';
  }

  if (mediumPriority.length > 0) {
    html += '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.875rem; color: #f97316;">Medium Priority</h4>';
    html += '<ul style="margin-left: 1.5rem; color: var(--text-secondary);">';
    mediumPriority.forEach(s => {
      html += `<li style="margin-bottom: 0.5rem;">${s.text}</li>`;
    });
    html += '</ul>';
  }

  if (lowPriority.length > 0) {
    html += '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.875rem; color: #3b82f6;">Low Priority</h4>';
    html += '<ul style="margin-left: 1.5rem; color: var(--text-secondary);">';
    lowPriority.forEach(s => {
      html += `<li style="margin-bottom: 0.5rem;">${s.text}</li>`;
    });
    html += '</ul>';
  }

  html += '</div>';

  // AgentDB-specific recommendations
  if (analysis.agentDBSpecific.length > 0) {
    html += '<div class="card"><div class="card-title">🤖 AgentDB-Specific Optimizations</div>';
    analysis.agentDBSpecific.forEach(feature => {
      html += `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
          <div style="font-weight: 500; margin-bottom: 0.25rem;">📌 ${feature.type.toUpperCase()}</div>
          <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">${feature.recommendation}</div>
          <code style="font-size: 0.75rem; background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; display: block;">${feature.example}</code>
        </div>
      `;
    });
    html += '</div>';
  }

  // Optimized query
  if (analysis.optimizedQuery !== optimizerState.currentQuery) {
    html += '<div class="card"><div class="card-title">✨ Optimized Query</div>';
    html += `<div class="help-example"><pre style="font-size: 0.875rem;">${escapeHtml(analysis.optimizedQuery)}</pre></div>`;
    html += `<button class="btn btn-primary btn-sm" onclick="applyOptimization(\`${escapeHtml(analysis.optimizedQuery)}\`)">✅ Apply Optimization</button> `;
    html += `<button class="btn btn-secondary btn-sm" onclick="loadToComparison(\`${escapeHtml(optimizerState.currentQuery)}\`, \`${escapeHtml(analysis.optimizedQuery)}\`)">⚖️ Compare Performance</button>`;
    html += '</div>';
  }

  html += '</div>';

  container.innerHTML = html;
}

// Apply optimization
function applyOptimization(optimizedQuery) {
  document.getElementById('optimizer-query').value = optimizedQuery;
  logToConsole('success', 'Optimization applied');
}

// Load query library
function loadQueryLibrary() {
  const container = document.getElementById('library-templates');

  let html = '';

  queryLibrary.forEach((template, index) => {
    html += `
      <div class="library-item" data-category="${template.category}" data-name="${template.name.toLowerCase()}" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div>
            <div style="font-weight: 500; margin-bottom: 0.25rem;">${template.name}</div>
            <div style="color: var(--text-secondary); font-size: 0.875rem;">${template.description}</div>
          </div>
          <span class="badge" style="background: var(--primary-color); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${template.category}</span>
        </div>
        <div class="help-example" style="margin: 0.75rem 0;"><pre style="font-size: 0.75rem; max-height: 150px; overflow-y: auto;">${escapeHtml(template.query)}</pre></div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="loadLibraryTemplate(${index})">📋 Use Template</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleLibraryTips(${index})">💡 Tips</button>
        </div>
        <div id="library-tips-${index}" style="display: none; margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px; font-size: 0.875rem;">
          <strong>Optimization Tips:</strong>
          <ul style="margin: 0.25rem 0 0 1.25rem; padding: 0;">
            ${template.tips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">No templates found</div></div>';
}

// Load library template
function loadLibraryTemplate(index) {
  const template = queryLibrary[index];
  document.getElementById('optimizer-query').value = template.query;
  switchOptimizerTab('analyze');
  if (typeof logToConsole === 'function') {
    logToConsole('success', `Loaded template: ${template.name}`);
  }
}

// Toggle library tips
function toggleLibraryTips(index) {
  const tipsEl = document.getElementById(`library-tips-${index}`);
  if (tipsEl) {
    tipsEl.style.display = tipsEl.style.display === 'none' ? 'block' : 'none';
  }
}

// Filter library
function filterLibrary() {
  const searchTerm = document.getElementById('library-search').value.toLowerCase();
  const items = document.querySelectorAll('.library-item');

  items.forEach(item => {
    const name = item.dataset.name;
    item.style.display = name.includes(searchTerm) ? 'block' : 'none';
  });
}

// Filter library by category
function filterLibraryCategory(category) {
  // Update button states
  document.querySelectorAll('.library-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  const items = document.querySelectorAll('.library-item');

  items.forEach(item => {
    if (category === 'all') {
      item.style.display = 'block';
    } else {
      item.style.display = item.dataset.category === category ? 'block' : 'none';
    }
  });
}

// Compare queries
async function compareQueries() {
  const queryA = document.getElementById('compare-query-a').value.trim();
  const queryB = document.getElementById('compare-query-b').value.trim();

  if (!queryA || !queryB) {
    alert('Please enter both queries to compare');
    return;
  }

  if (typeof logToConsole === 'function') {
    logToConsole('info', 'Running performance comparison...');
  }

  try {
    const benchA = await benchmarkQueryInternal(queryA, 10);
    const benchB = await benchmarkQueryInternal(queryB, 10);

    const improvement = ((benchA.avgTime - benchB.avgTime) / benchA.avgTime * 100);

    let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';

    // Comparison summary
    html += '<div class="card"><div class="card-title">⚖️ Performance Comparison</div>';
    html += '<div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center;">';

    // Query A stats
    html += `
      <div>
        <div style="font-weight: 500; margin-bottom: 0.5rem; color: #3b82f6;">Original Query</div>
        <div class="stat-card">
          <div class="stat-label">Avg Time</div>
          <div class="stat-value">${benchA.avgTime.toFixed(2)}ms</div>
        </div>
      </div>
    `;

    // Comparison arrow
    html += `
      <div style="text-align: center; font-size: 2rem;">
        ${improvement > 0 ? '→' : '←'}
      </div>
    `;

    // Query B stats
    html += `
      <div>
        <div style="font-weight: 500; margin-bottom: 0.5rem; color: #10b981;">Optimized Query</div>
        <div class="stat-card">
          <div class="stat-label">Avg Time</div>
          <div class="stat-value">${benchB.avgTime.toFixed(2)}ms</div>
        </div>
      </div>
    `;

    html += '</div>';

    // Improvement indicator
    const improvementColor = improvement > 0 ? '#10b981' : '#ef4444';
    const improvementText = improvement > 0 ? 'faster' : 'slower';
    html += `
      <div style="text-align: center; margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
        <div style="font-size: 1.5rem; font-weight: 600; color: ${improvementColor};">
          ${Math.abs(improvement).toFixed(1)}% ${improvementText}
        </div>
        <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">
          ${improvement > 0 ? '🎉 Performance improved!' : '⚠️ Performance decreased'}
        </div>
      </div>
    `;

    html += '</div>';

    // Detailed metrics
    html += '<div class="card"><div class="card-title">📊 Detailed Metrics</div>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">';

    html += `
      <div>
        <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem;">Original Query</h4>
        <div style="font-size: 0.875rem; color: var(--text-secondary);">
          <div>Min: ${benchA.minTime.toFixed(2)}ms</div>
          <div>Max: ${benchA.maxTime.toFixed(2)}ms</div>
          <div>Std Dev: ${benchA.stdDev.toFixed(2)}ms</div>
        </div>
      </div>
      <div>
        <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem;">Optimized Query</h4>
        <div style="font-size: 0.875rem; color: var(--text-secondary);">
          <div>Min: ${benchB.minTime.toFixed(2)}ms</div>
          <div>Max: ${benchB.maxTime.toFixed(2)}ms</div>
          <div>Std Dev: ${benchB.stdDev.toFixed(2)}ms</div>
        </div>
      </div>
    `;

    html += '</div></div>';

    html += '</div>';

    document.getElementById('comparison-results').innerHTML = html;
    if (typeof logToConsole === 'function') {
      logToConsole('success', 'Comparison complete');
    }

  } catch (error) {
    if (typeof logToConsole === 'function') {
      logToConsole('error', `Comparison failed: ${error.message}`);
    }
    displayError('comparison-results', error.message);
  }
}

// Load comparison from analysis
function loadToComparison(original, optimized) {
  document.getElementById('compare-query-a').value = original;
  document.getElementById('compare-query-b').value = optimized;
  switchOptimizerTab('compare');
}

function loadComparisonFromAnalysis() {
  if (optimizerState.currentQuery && optimizerState.optimizedQuery) {
    loadToComparison(optimizerState.currentQuery, optimizerState.optimizedQuery);
  } else {
    alert('Run an analysis first to generate optimized query');
  }
}

// Clear comparison
function clearComparison() {
  document.getElementById('compare-query-a').value = '';
  document.getElementById('compare-query-b').value = '';
  document.getElementById('comparison-results').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚖️</div><div class="empty-state-title">Enter queries to compare</div><div class="empty-state-text">Side-by-side performance comparison with benchmarks</div></div>';
}

// Optimization wizard
function startWizard() {
  optimizerState.wizardStep = 0;
  showWizardStep(0);
}

function showWizardStep(step) {
  const container = document.getElementById('wizard-content');

  const steps = [
    {
      title: 'Step 1: Query Type',
      content: `
        <p style="margin-bottom: 1rem;">What type of query are you optimizing?</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem;">
          <button class="btn btn-secondary" onclick="wizardSelectType('vector')">🔢 Vector Search</button>
          <button class="btn btn-secondary" onclick="wizardSelectType('pattern')">🧩 Pattern Match</button>
          <button class="btn btn-secondary" onclick="wizardSelectType('causal')">🔗 Causal Query</button>
          <button class="btn btn-secondary" onclick="wizardSelectType('join')">🔀 Complex Join</button>
          <button class="btn btn-secondary" onclick="wizardSelectType('aggregate')">📊 Aggregation</button>
          <button class="btn btn-secondary" onclick="wizardSelectType('other')">📝 Other</button>
        </div>
      `
    },
    {
      title: 'Step 2: Performance Goal',
      content: `
        <p style="margin-bottom: 1rem;">What is your primary optimization goal?</p>
        <div style="display: grid; gap: 0.5rem;">
          <button class="btn btn-secondary" onclick="wizardSelectGoal('speed')" style="justify-content: start;">⚡ Reduce execution time</button>
          <button class="btn btn-secondary" onclick="wizardSelectGoal('memory')" style="justify-content: start;">💾 Reduce memory usage</button>
          <button class="btn btn-secondary" onclick="wizardSelectGoal('accuracy')" style="justify-content: start;">🎯 Improve result accuracy</button>
          <button class="btn btn-secondary" onclick="wizardSelectGoal('scalability')" style="justify-content: start;">📈 Improve scalability</button>
        </div>
      `
    },
    {
      title: 'Step 3: Apply Optimizations',
      content: `<div id="wizard-recommendations"></div>`
    }
  ];

  if (step >= 0 && step < steps.length) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">${steps[step].title}</div>
        ${steps[step].content}
        <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          ${step > 0 ? '<button class="btn btn-secondary btn-sm" onclick="showWizardStep(' + (step - 1) + ')">← Back</button>' : ''}
          <button class="btn btn-secondary btn-sm" onclick="startWizard()">Cancel</button>
        </div>
      </div>
    `;
  }
}

function wizardSelectType(type) {
  optimizerState.wizardType = type;
  showWizardStep(1);
}

function wizardSelectGoal(goal) {
  optimizerState.wizardGoal = goal;
  showWizardStep(2);
  generateWizardRecommendations();
}

function generateWizardRecommendations() {
  const type = optimizerState.wizardType;
  const goal = optimizerState.wizardGoal;

  const recommendations = {
    vector: {
      speed: ['Add index on embedding column', 'Use LIMIT clause', 'Pre-filter with WHERE'],
      memory: ['Use specific columns instead of SELECT *', 'Implement pagination', 'Cache frequent queries']
    },
    pattern: {
      speed: ['Index pattern_type', 'Use covering indexes', 'Filter early in WHERE'],
      memory: ['Limit result set size', 'Use iterators for large results']
    },
    causal: {
      speed: ['Limit recursion depth', 'Index cause and effect columns', 'Filter by weight threshold'],
      scalability: ['Use materialized views', 'Implement caching layer']
    }
  };

  const recs = recommendations[type]?.[goal] || ['Run full analysis for detailed recommendations'];

  let html = '<div style="margin-bottom: 1rem;"><strong>Recommended Optimizations:</strong></div>';
  html += '<ul style="margin-left: 1.5rem; color: var(--text-secondary);">';
  recs.forEach((rec, i) => {
    html += `<li style="margin-bottom: 0.5rem;">
      <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
        <input type="checkbox" id="wizard-rec-${i}">
        <span>${rec}</span>
      </label>
    </li>`;
  });
  html += '</ul>';
  html += '<button class="btn btn-primary" onclick="applyWizardOptimizations()" style="margin-top: 1rem;">✨ Apply Selected</button>';

  document.getElementById('wizard-recommendations').innerHTML = html;
}

function applyWizardOptimizations() {
  if (typeof logToConsole === 'function') {
    logToConsole('success', 'Wizard optimizations applied');
  }
  switchOptimizerTab('analyze');
}

// Format optimizer query
function formatOptimizerQuery() {
  const query = document.getElementById('optimizer-query').value;
  // Simple formatting - in production, use a proper SQL formatter
  const formatted = query
    .replace(/\s+/g, ' ')
    .replace(/SELECT/gi, '\nSELECT')
    .replace(/FROM/gi, '\nFROM')
    .replace(/WHERE/gi, '\nWHERE')
    .replace(/JOIN/gi, '\nJOIN')
    .replace(/ORDER BY/gi, '\nORDER BY')
    .replace(/GROUP BY/gi, '\nGROUP BY')
    .replace(/LIMIT/gi, '\nLIMIT')
    .trim();

  document.getElementById('optimizer-query').value = formatted;
}

// Helper to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display error
function displayError(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="color: #ef4444;">❌</div>
        <div class="empty-state-title">Error</div>
        <div class="empty-state-text">${escapeHtml(message)}</div>
      </div>
    `;
  }
}
