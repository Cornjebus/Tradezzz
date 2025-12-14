// ============================================================================
// CAUSAL PATH ANALYSIS
// ============================================================================

function analyzeCausalPaths() {
  document.getElementById('causalAnalysisModal').classList.add('active');
  logToConsole('info', 'Opening causal path analysis...');
}

function closeCausalAnalysis() {
  document.getElementById('causalAnalysisModal').classList.remove('active');
}

/**
 * Build adjacency graph from causal edges
 * @returns {Object} Graph structure with nodes and weighted edges
 */
function buildCausalGraph() {
  try {
    const edges = sqlAll('SELECT * FROM causal_edges');
    const graph = {};
    const nodes = new Set();

    edges.forEach(edge => {
      const metadata = JSON.parse(edge.metadata || '{}');
      const weight = parseFloat(metadata.weight || 0.5);
      const confidence = parseFloat(metadata.confidence || 0.5);

      // Add nodes
      nodes.add(edge.cause);
      nodes.add(edge.effect);

      // Build adjacency list
      if (!graph[edge.cause]) {
        graph[edge.cause] = [];
      }
      graph[edge.cause].push({
        target: edge.effect,
        weight: weight,
        confidence: confidence,
        id: edge.id
      });
    });

    return { graph, nodes: Array.from(nodes), edges };
  } catch (error) {
    logToConsole('error', `Failed to build causal graph: ${error.message}`);
    return { graph: {}, nodes: [], edges: [] };
  }
}

/**
 * Find all paths between start and end nodes using DFS
 * @param {string} startNode - Starting node (optional)
 * @param {string} endNode - Ending node (optional)
 * @param {number} maxDepth - Maximum path length
 * @returns {Array} Array of paths with their strengths
 */
function findCausalPaths(startNode, endNode, maxDepth = 3) {
  const { graph, nodes } = buildCausalGraph();
  const allPaths = [];

  // Determine which nodes to start from
  const startNodes = startNode ? [startNode] : nodes;
  const checkEnd = endNode ? true : false;

  // DFS to find all paths
  function dfs(current, target, visited, path, strength) {
    // Add current node to path
    const newPath = [...path, current];
    const newVisited = new Set(visited);
    newVisited.add(current);

    // Check if we've reached the target (if specified)
    if (checkEnd && current === target && newPath.length > 1) {
      allPaths.push({
        path: newPath,
        strength: strength,
        length: newPath.length - 1
      });
      return;
    }

    // If no specific target, record all paths of length > 1
    if (!checkEnd && newPath.length > 1 && newPath.length <= maxDepth + 1) {
      allPaths.push({
        path: newPath,
        strength: strength,
        length: newPath.length - 1
      });
    }

    // Stop if max depth reached
    if (newPath.length > maxDepth + 1) {
      return;
    }

    // Explore neighbors
    const neighbors = graph[current] || [];
    for (const neighbor of neighbors) {
      if (!newVisited.has(neighbor.target)) {
        const newStrength = strength * neighbor.weight;
        dfs(neighbor.target, target, newVisited, newPath, newStrength);
      }
    }
  }

  // Run DFS from each starting node
  startNodes.forEach(start => {
    if (graph[start]) {
      dfs(start, endNode, new Set(), [], 1.0);
    }
  });

  // Sort by strength (descending)
  return allPaths.sort((a, b) => b.strength - a.strength);
}

/**
 * Detect cycles in the causal graph
 * @returns {Array} Array of cycles found
 */
function detectCausalCycles() {
  const { graph, nodes } = buildCausalGraph();
  const cycles = [];

  function findCyclesFromNode(start) {
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];

    function dfs(node) {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.target)) {
          dfs(neighbor.target);
        } else if (recursionStack.has(neighbor.target)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor.target);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycle.push(neighbor.target); // Complete the cycle

            // Calculate cycle strength
            let strength = 1.0;
            for (let i = 0; i < cycle.length - 1; i++) {
              const edges = graph[cycle[i]] || [];
              const edge = edges.find(e => e.target === cycle[i + 1]);
              if (edge) strength *= edge.weight;
            }

            cycles.push({ path: cycle, strength });
          }
        }
      }

      path.pop();
      recursionStack.delete(node);
    }

    if (!visited.has(start)) {
      dfs(start);
    }
  }

  nodes.forEach(node => findCyclesFromNode(node));

  // Remove duplicate cycles
  const uniqueCycles = [];
  const seen = new Set();
  cycles.forEach(cycle => {
    const normalized = cycle.path.slice(0, -1).sort().join('→');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueCycles.push(cycle);
    }
  });

  return uniqueCycles.sort((a, b) => b.strength - a.strength);
}

/**
 * Rank causal chains by total strength
 * @param {number} topN - Number of top chains to return
 * @returns {Array} Top N strongest chains
 */
function rankCausalChains(topN = 10) {
  const maxDepth = parseInt(document.getElementById('analysis-max-depth').value);
  const paths = findCausalPaths(null, null, maxDepth);
  return paths.slice(0, topN);
}

/**
 * Format path for display
 * @param {Array} path - Array of nodes in path
 * @param {number} strength - Total path strength
 * @returns {string} Formatted path string
 */
function formatPath(path, strength) {
  const { graph } = buildCausalGraph();
  const parts = [];

  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];
    const neighbors = graph[current] || [];
    const edge = neighbors.find(e => e.target === next);
    const weight = edge ? edge.weight.toFixed(2) : '?';

    parts.push(`<span style="color: var(--primary-color); font-weight: 500;">${current}</span>`);
    parts.push(`<span style="opacity: 0.7; margin: 0 0.5rem;">→ (${weight})</span>`);
  }
  parts.push(`<span style="color: var(--primary-color); font-weight: 500;">${path[path.length - 1]}</span>`);

  return parts.join('');
}

/**
 * Display analysis results
 * @param {string} title - Result section title
 * @param {Array} results - Array of results to display
 * @param {string} type - Type of analysis (paths, cycles, chains)
 */
function displayAnalysisResults(title, results, type = 'paths') {
  const container = document.getElementById('analysis-results');

  if (results.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No ${type} found</div>
        <div class="empty-state-text">Try adjusting your search parameters</div>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom: 1rem;">
      <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">${title}</div>
      <div style="font-size: 0.875rem; opacity: 0.7;">Found ${results.length} result${results.length !== 1 ? 's' : ''}</div>
    </div>
  `;

  results.forEach((result, index) => {
    const strengthPercent = (result.strength * 100).toFixed(1);
    const strengthColor = result.strength > 0.7 ? '#10b981' : result.strength > 0.4 ? '#f59e0b' : '#6b7280';

    html += `
      <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem; border-left: 3px solid ${strengthColor};">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div style="font-size: 0.75rem; color: ${strengthColor}; font-weight: 600;">
            ${type === 'cycles' ? '🔄 CYCLE' : '🔗 PATH'} #${index + 1}
          </div>
          <div style="font-size: 0.875rem; font-weight: 500; color: ${strengthColor};">
            Strength: ${strengthPercent}%
          </div>
        </div>
        <div style="font-size: 0.875rem; line-height: 1.6; word-break: break-word;">
          ${formatPath(result.path, result.strength)}
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.75rem; opacity: 0.7;">
          <span>📏 Length: ${result.length} hop${result.length !== 1 ? 's' : ''}</span>
          <span>🎯 Total Strength: ${result.strength.toFixed(4)}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Run path analysis based on UI inputs
 */
function runPathAnalysis() {
  const startNode = document.getElementById('analysis-start-node').value.trim();
  const endNode = document.getElementById('analysis-end-node').value.trim();
  const maxDepth = parseInt(document.getElementById('analysis-max-depth').value);

  logToConsole('info', `Finding paths: ${startNode || 'any'} → ${endNode || 'any'} (max depth: ${maxDepth})`);

  try {
    const paths = findCausalPaths(
      startNode || null,
      endNode || null,
      maxDepth
    );

    const title = startNode && endNode
      ? `Paths from "${startNode}" to "${endNode}"`
      : startNode
        ? `Paths starting from "${startNode}"`
        : endNode
          ? `Paths ending at "${endNode}"`
          : 'All Causal Paths';

    displayAnalysisResults(title, paths, 'paths');
    logToConsole('success', `Found ${paths.length} causal path${paths.length !== 1 ? 's' : ''}`);
  } catch (error) {
    logToConsole('error', `Path analysis failed: ${error.message}`);
    document.getElementById('analysis-results').innerHTML = `
      <div class="error-state" style="text-align: center; padding: 2rem; color: var(--error-color);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
        <div style="font-weight: 500;">Analysis Failed</div>
        <div style="font-size: 0.875rem; margin-top: 0.5rem;">${error.message}</div>
      </div>
    `;
  }
}

/**
 * Detect and display cycles
 */
function detectCycles() {
  logToConsole('info', 'Detecting feedback loops and cycles...');

  try {
    const cycles = detectCausalCycles();
    displayAnalysisResults('Feedback Loops & Cycles', cycles, 'cycles');

    if (cycles.length > 0) {
      logToConsole('warning', `Found ${cycles.length} cycle${cycles.length !== 1 ? 's' : ''} in causal graph`);
    } else {
      logToConsole('success', 'No cycles detected - graph is acyclic');
    }
  } catch (error) {
    logToConsole('error', `Cycle detection failed: ${error.message}`);
  }
}

/**
 * Find and display strongest causal chains
 */
function findStrongestChains() {
  logToConsole('info', 'Finding strongest causal chains...');

  try {
    const chains = rankCausalChains(20);
    displayAnalysisResults('Top 20 Strongest Causal Chains', chains, 'chains');
    logToConsole('success', `Ranked ${chains.length} causal chain${chains.length !== 1 ? 's' : ''}`);
  } catch (error) {
    logToConsole('error', `Chain ranking failed: ${error.message}`);
  }
}

/**
 * Comprehensive analysis - all features
 */
function analyzeAllPaths() {
  logToConsole('info', 'Running comprehensive causal analysis...');

  try {
    const maxDepth = parseInt(document.getElementById('analysis-max-depth').value);
    const paths = findCausalPaths(null, null, maxDepth);
    const cycles = detectCausalCycles();
    const { graph, nodes } = buildCausalGraph();

    const container = document.getElementById('analysis-results');

    // Calculate statistics
    const totalEdges = Object.values(graph).reduce((sum, edges) => sum + edges.length, 0);
    const avgPathStrength = paths.length > 0
      ? paths.reduce((sum, p) => sum + p.strength, 0) / paths.length
      : 0;

    let html = `
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">📊 Comprehensive Causal Analysis</div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; text-align: center;">
            <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary-color);">${nodes.length}</div>
            <div style="font-size: 0.875rem; opacity: 0.7; margin-top: 0.25rem;">Nodes</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; text-align: center;">
            <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary-color);">${totalEdges}</div>
            <div style="font-size: 0.875rem; opacity: 0.7; margin-top: 0.25rem;">Direct Edges</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; text-align: center;">
            <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary-color);">${paths.length}</div>
            <div style="font-size: 0.875rem; opacity: 0.7; margin-top: 0.25rem;">Total Paths</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; text-align: center;">
            <div style="font-size: 1.75rem; font-weight: 700; color: ${cycles.length > 0 ? '#f59e0b' : '#10b981'};">${cycles.length}</div>
            <div style="font-size: 0.875rem; opacity: 0.7; margin-top: 0.25rem;">Cycles Detected</div>
          </div>
        </div>

        ${cycles.length > 0 ? `
          <div style="background: #fef3c7; color: #92400e; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border-left: 3px solid #f59e0b;">
            <div style="font-weight: 600; margin-bottom: 0.25rem;">⚠️ Feedback Loops Detected</div>
            <div style="font-size: 0.875rem;">
              ${cycles.length} cycle${cycles.length !== 1 ? 's' : ''} found. These represent feedback loops in your causal model.
            </div>
          </div>
        ` : ''}

        <div style="font-size: 0.875rem; opacity: 0.7; margin-bottom: 1rem;">
          📈 Average Path Strength: ${(avgPathStrength * 100).toFixed(1)}%<br>
          📏 Max Depth Analyzed: ${maxDepth} hops
        </div>
      </div>

      <div style="font-weight: 600; margin-bottom: 0.75rem; font-size: 1rem;">🏆 Top 10 Strongest Paths</div>
    `;

    const topPaths = paths.slice(0, 10);
    topPaths.forEach((result, index) => {
      const strengthPercent = (result.strength * 100).toFixed(1);
      const strengthColor = result.strength > 0.7 ? '#10b981' : result.strength > 0.4 ? '#f59e0b' : '#6b7280';

      html += `
        <div style="background: var(--bg-secondary); padding: 0.875rem; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid ${strengthColor};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.375rem;">
            <span style="font-size: 0.75rem; color: ${strengthColor}; font-weight: 600;">#${index + 1}</span>
            <span style="font-size: 0.8125rem; font-weight: 500; color: ${strengthColor};">${strengthPercent}%</span>
          </div>
          <div style="font-size: 0.8125rem; line-height: 1.5; word-break: break-word;">
            ${formatPath(result.path, result.strength)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    logToConsole('success', 'Comprehensive analysis complete');
  } catch (error) {
    logToConsole('error', `Comprehensive analysis failed: ${error.message}`);
  }
}
