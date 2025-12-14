/**
 * AgentDB Management IDE - Advanced Pattern Management Enhancements
 *
 * This file contains comprehensive pattern management features including:
 * - Advanced filtering (type, date range, search, tags, similarity)
 * - Pattern operations (bulk select, delete, export, duplicate, edit)
 * - Pattern analytics (usage stats, effectiveness metrics, clustering)
 * - Visualization (relationship graphs, embedding space, timeline, charts)
 * - Smart features (auto-tagging, recommendations, composition, testing)
 * - Enhanced UI (grid/list view, sorting, quick actions, preview cards)
 */

// ============================================================================
// GLOBAL STATE FOR PATTERN MANAGEMENT
// ============================================================================

const patternState = {
  selectedPatterns: new Set(),
  bulkSelectMode: false,
  viewMode: 'list', // 'list' or 'grid'
  filters: {
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    tags: '',
    similarity: 0
  },
  sortBy: 'date-desc',
  analytics: null
};

// ============================================================================
// PATTERN FILTERING & SORTING
// ============================================================================

function updateSimilarityValue(value) {
  document.getElementById('similarity-value').textContent = parseFloat(value).toFixed(1);
  patternState.filters.similarity = parseFloat(value);
}

function resetPatternFilters() {
  // Reset all filter inputs
  document.getElementById('pattern-type-filter').value = '';
  document.getElementById('pattern-date-from').value = '';
  document.getElementById('pattern-date-to').value = '';
  document.getElementById('pattern-search').value = '';
  document.getElementById('pattern-tags-filter').value = '';
  document.getElementById('pattern-similarity').value = '0';
  document.getElementById('similarity-value').textContent = '0.0';
  document.getElementById('pattern-sort').value = 'date-desc';

  // Reset state
  patternState.filters = {
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    tags: '',
    similarity: 0
  };
  patternState.sortBy = 'date-desc';

  // Refresh display
  applyPatternFilters();
  logToConsole('info', 'Pattern filters reset');
}

function applyPatternFilters() {
  // Get filter values
  patternState.filters.type = document.getElementById('pattern-type-filter').value;
  patternState.filters.dateFrom = document.getElementById('pattern-date-from').value;
  patternState.filters.dateTo = document.getElementById('pattern-date-to').value;
  patternState.filters.search = document.getElementById('pattern-search').value.toLowerCase();
  patternState.filters.tags = document.getElementById('pattern-tags-filter').value.toLowerCase();
  patternState.sortBy = document.getElementById('pattern-sort').value;

  // Refresh patterns with filters
  refreshPatterns();
}

function filterAndSortPatterns(patterns) {
  let filtered = patterns;

  // Apply type filter
  if (patternState.filters.type) {
    filtered = filtered.filter(p => p.pattern_type === patternState.filters.type);
  }

  // Apply date range filter
  if (patternState.filters.dateFrom) {
    const fromDate = new Date(patternState.filters.dateFrom).getTime() / 1000;
    filtered = filtered.filter(p => p.created_at >= fromDate);
  }
  if (patternState.filters.dateTo) {
    const toDate = new Date(patternState.filters.dateTo).getTime() / 1000;
    filtered = filtered.filter(p => p.created_at <= toDate);
  }

  // Apply search filter
  if (patternState.filters.search) {
    filtered = filtered.filter(p => {
      const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
      const description = (metadata.description || '').toLowerCase();
      const content = JSON.stringify(metadata).toLowerCase();
      return description.includes(patternState.filters.search) ||
             content.includes(patternState.filters.search);
    });
  }

  // Apply tag filter
  if (patternState.filters.tags) {
    filtered = filtered.filter(p => {
      const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
      const tags = (metadata.tags || []).map(t => t.toLowerCase());
      return tags.some(t => t.includes(patternState.filters.tags));
    });
  }

  // Apply similarity threshold (using mock calculation for demo)
  if (patternState.filters.similarity > 0) {
    filtered = filtered.filter(p => {
      const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
      const similarity = metadata.similarity_score || Math.random();
      return similarity >= patternState.filters.similarity;
    });
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const metaA = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
    const metaB = typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata;

    switch(patternState.sortBy) {
      case 'date-desc':
        return b.created_at - a.created_at;
      case 'date-asc':
        return a.created_at - b.created_at;
      case 'usage-desc':
        return (metaB.usage_count || 0) - (metaA.usage_count || 0);
      case 'usage-asc':
        return (metaA.usage_count || 0) - (metaB.usage_count || 0);
      case 'effectiveness-desc':
        return (metaB.effectiveness || 0) - (metaA.effectiveness || 0);
      case 'type':
        return a.pattern_type.localeCompare(b.pattern_type);
      default:
        return 0;
    }
  });

  return filtered;
}

// ============================================================================
// VIEW TOGGLE (GRID/LIST)
// ============================================================================

function togglePatternView(viewMode) {
  patternState.viewMode = viewMode;

  // Update button styles
  const gridBtn = document.getElementById('view-grid');
  const listBtn = document.getElementById('view-list');

  if (viewMode === 'grid') {
    gridBtn.classList.add('btn-primary');
    gridBtn.classList.remove('btn-secondary');
    listBtn.classList.remove('btn-primary');
    listBtn.classList.add('btn-secondary');
  } else {
    listBtn.classList.add('btn-primary');
    listBtn.classList.remove('btn-secondary');
    gridBtn.classList.remove('btn-primary');
    gridBtn.classList.add('btn-secondary');
  }

  // Apply view mode class to container
  const container = document.getElementById('patterns-list');
  container.className = viewMode === 'grid' ? 'patterns-grid-view' : 'patterns-list-view';

  // Refresh display
  refreshPatterns();
  logToConsole('info', `Switched to ${viewMode} view`);
}

// ============================================================================
// BULK SELECTION & OPERATIONS
// ============================================================================

function toggleBulkSelect() {
  patternState.bulkSelectMode = document.getElementById('bulk-select-toggle').checked;
  const deleteBtn = document.getElementById('bulk-delete-btn');

  if (patternState.bulkSelectMode) {
    deleteBtn.style.display = 'inline-block';
    patternState.selectedPatterns.clear();
  } else {
    deleteBtn.style.display = 'none';
    patternState.selectedPatterns.clear();
  }

  refreshPatterns();
}

function togglePatternSelection(patternId) {
  if (patternState.selectedPatterns.has(patternId)) {
    patternState.selectedPatterns.delete(patternId);
  } else {
    patternState.selectedPatterns.add(patternId);
  }

  // Update checkbox visual state
  const checkbox = document.getElementById(`pattern-check-${patternId}`);
  if (checkbox) {
    checkbox.checked = patternState.selectedPatterns.has(patternId);
  }

  // Update delete button
  updateBulkDeleteButton();
}

function updateBulkDeleteButton() {
  const deleteBtn = document.getElementById('bulk-delete-btn');
  const count = patternState.selectedPatterns.size;

  if (count > 0) {
    deleteBtn.textContent = `🗑️ Delete Selected (${count})`;
    deleteBtn.disabled = false;
  } else {
    deleteBtn.textContent = '🗑️ Delete Selected';
    deleteBtn.disabled = true;
  }
}

async function bulkDeletePatterns() {
  const count = patternState.selectedPatterns.size;

  if (count === 0) {
    alert('No patterns selected');
    return;
  }

  if (!confirm(`Delete ${count} selected pattern(s)? This cannot be undone.`)) {
    return;
  }

  try {
    const deletePromises = Array.from(patternState.selectedPatterns).map(id =>
      sqlRun('DELETE FROM patterns WHERE id = ?', [id])
    );

    await Promise.all(deletePromises);

    logToConsole('success', `Deleted ${count} patterns`);
    patternState.selectedPatterns.clear();
    updateBulkDeleteButton();
    refreshPatterns();

  } catch (error) {
    logToConsole('error', `Failed to delete patterns: ${error.message}`);
    alert('Failed to delete patterns. Check console for details.');
  }
}

async function duplicatePattern(patternId) {
  try {
    const pattern = sqlGet('SELECT * FROM patterns WHERE id = ?', [patternId]);
    if (!pattern) {
      throw new Error('Pattern not found');
    }

    const metadata = typeof pattern.metadata === 'string' ?
      JSON.parse(pattern.metadata) : pattern.metadata;

    // Update metadata to indicate it's a copy
    metadata.description = `${metadata.description || 'Pattern'} (Copy)`;
    metadata.original_id = patternId;
    metadata.created_at = Date.now() / 1000;

    await state.db.storePattern({
      pattern_type: pattern.pattern_type,
      embedding: pattern.embedding,
      metadata: metadata
    });

    logToConsole('success', `Duplicated pattern ${patternId}`);
    refreshPatterns();

  } catch (error) {
    logToConsole('error', `Failed to duplicate pattern: ${error.message}`);
    alert('Failed to duplicate pattern. Check console for details.');
  }
}

async function deletePattern(patternId) {
  if (!confirm('Delete this pattern? This cannot be undone.')) {
    return;
  }

  try {
    await sqlRun('DELETE FROM patterns WHERE id = ?', [patternId]);
    logToConsole('success', `Deleted pattern ${patternId}`);
    refreshPatterns();
  } catch (error) {
    logToConsole('error', `Failed to delete pattern: ${error.message}`);
    alert('Failed to delete pattern. Check console for details.');
  }
}

// ============================================================================
// PATTERN ANALYTICS
// ============================================================================

function calculatePatternAnalytics(patterns) {
  const analytics = {
    total: patterns.length,
    byType: {},
    usageStats: {
      total: 0,
      average: 0,
      mostUsed: null,
      leastUsed: null
    },
    effectiveness: {
      average: 0,
      highest: null,
      lowest: null
    },
    timeline: [],
    tags: {}
  };

  let totalUsage = 0;
  let totalEffectiveness = 0;
  let usageList = [];
  let effectivenessList = [];

  patterns.forEach(pattern => {
    const metadata = typeof pattern.metadata === 'string' ?
      JSON.parse(pattern.metadata) : pattern.metadata;

    // Count by type
    analytics.byType[pattern.pattern_type] = (analytics.byType[pattern.pattern_type] || 0) + 1;

    // Usage stats
    const usage = metadata.usage_count || 0;
    totalUsage += usage;
    usageList.push({ id: pattern.id, usage, description: metadata.description });

    // Effectiveness stats
    const effectiveness = metadata.effectiveness || 0;
    totalEffectiveness += effectiveness;
    effectivenessList.push({ id: pattern.id, effectiveness, description: metadata.description });

    // Timeline data
    const date = new Date(pattern.created_at * 1000).toISOString().split('T')[0];
    const existing = analytics.timeline.find(t => t.date === date);
    if (existing) {
      existing.count++;
    } else {
      analytics.timeline.push({ date, count: 1 });
    }

    // Tag counting
    const tags = metadata.tags || [];
    tags.forEach(tag => {
      analytics.tags[tag] = (analytics.tags[tag] || 0) + 1;
    });
  });

  // Calculate averages and extremes
  analytics.usageStats.total = totalUsage;
  analytics.usageStats.average = patterns.length > 0 ? totalUsage / patterns.length : 0;
  usageList.sort((a, b) => b.usage - a.usage);
  analytics.usageStats.mostUsed = usageList[0] || null;
  analytics.usageStats.leastUsed = usageList[usageList.length - 1] || null;

  analytics.effectiveness.average = patterns.length > 0 ? totalEffectiveness / patterns.length : 0;
  effectivenessList.sort((a, b) => b.effectiveness - a.effectiveness);
  analytics.effectiveness.highest = effectivenessList[0] || null;
  analytics.effectiveness.lowest = effectivenessList[effectivenessList.length - 1] || null;

  // Sort timeline
  analytics.timeline.sort((a, b) => a.date.localeCompare(b.date));

  patternState.analytics = analytics;
  return analytics;
}

function showPatternAnalytics() {
  try {
    const patterns = sqlAll('SELECT * FROM patterns');

    if (patterns.length === 0) {
      alert('No patterns to analyze');
      return;
    }

    const analytics = calculatePatternAnalytics(patterns);

    // Build analytics HTML
    let html = `
      <div class="modal-header">
        <div class="modal-title">📊 Pattern Analytics Dashboard</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">

        <!-- Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${analytics.total}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">Total Patterns</div>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; color: var(--info);">${analytics.usageStats.average.toFixed(1)}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">Avg Usage Count</div>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; color: var(--success);">${(analytics.effectiveness.average * 100).toFixed(0)}%</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">Avg Effectiveness</div>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; color: var(--warning);">${Object.keys(analytics.byType).length}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">Pattern Types</div>
          </div>
        </div>

        <!-- Type Distribution -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <h3 style="font-size: 1rem; margin-bottom: 1rem;">Pattern Type Distribution</h3>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${Object.entries(analytics.byType).map(([type, count]) => `
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="flex: 0 0 120px; font-size: 0.875rem;">${type}</div>
                <div style="flex: 1; background: var(--bg-tertiary); border-radius: 4px; height: 24px; position: relative; overflow: hidden;">
                  <div style="background: var(--primary); height: 100%; width: ${(count / analytics.total * 100).toFixed(1)}%;"></div>
                </div>
                <div style="flex: 0 0 60px; text-align: right; font-size: 0.875rem; font-weight: 600;">${count} (${(count / analytics.total * 100).toFixed(1)}%)</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Top Patterns -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card">
            <h3 style="font-size: 1rem; margin-bottom: 0.75rem;">🏆 Most Used Pattern</h3>
            ${analytics.usageStats.mostUsed ? `
              <div style="font-size: 0.875rem;">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${analytics.usageStats.mostUsed.description || 'N/A'}</div>
                <div style="color: var(--text-secondary);">Usage: ${analytics.usageStats.mostUsed.usage} times</div>
              </div>
            ` : '<div style="color: var(--text-secondary); font-size: 0.875rem;">No usage data</div>'}
          </div>

          <div class="card">
            <h3 style="font-size: 1rem; margin-bottom: 0.75rem;">⭐ Most Effective Pattern</h3>
            ${analytics.effectiveness.highest ? `
              <div style="font-size: 0.875rem;">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${analytics.effectiveness.highest.description || 'N/A'}</div>
                <div style="color: var(--text-secondary);">Effectiveness: ${(analytics.effectiveness.highest.effectiveness * 100).toFixed(0)}%</div>
              </div>
            ` : '<div style="color: var(--text-secondary); font-size: 0.875rem;">No effectiveness data</div>'}
          </div>
        </div>

        <!-- Popular Tags -->
        ${Object.keys(analytics.tags).length > 0 ? `
          <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1rem; margin-bottom: 0.75rem;">🏷️ Popular Tags</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${Object.entries(analytics.tags)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([tag, count]) => `
                  <span class="status-badge info" style="font-size: 0.75rem;">${tag} (${count})</span>
                `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Timeline -->
        ${analytics.timeline.length > 0 ? `
          <div class="card">
            <h3 style="font-size: 1rem; margin-bottom: 0.75rem;">📅 Pattern Creation Timeline</h3>
            <div style="display: flex; align-items: flex-end; gap: 4px; height: 150px;">
              ${analytics.timeline.map(point => {
                const maxCount = Math.max(...analytics.timeline.map(p => p.count));
                const height = (point.count / maxCount * 100).toFixed(1);
                return `
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
                    <div style="font-size: 0.625rem; font-weight: 600; margin-bottom: 2px;">${point.count}</div>
                    <div style="background: var(--primary); width: 100%; height: ${height}%; min-height: 2px; border-radius: 2px 2px 0 0;" title="${point.date}: ${point.count} patterns"></div>
                    <div style="font-size: 0.625rem; color: var(--text-muted); margin-top: 4px; writing-mode: vertical-rl; transform: rotate(180deg);">${point.date.slice(5)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="exportAnalytics()">💾 Export Report</button>
      </div>
    `;

    const modal = document.getElementById('genericModal');
    modal.innerHTML = html;
    modal.classList.add('active');

    logToConsole('info', 'Pattern analytics displayed');

  } catch (error) {
    logToConsole('error', `Failed to generate analytics: ${error.message}`);
    alert('Failed to generate analytics. Check console for details.');
  }
}

function exportAnalytics() {
  if (!patternState.analytics) {
    alert('No analytics data to export');
    return;
  }

  try {
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total_patterns: patternState.analytics.total,
        average_usage: patternState.analytics.usageStats.average,
        average_effectiveness: patternState.analytics.effectiveness.average
      },
      by_type: patternState.analytics.byType,
      top_performers: {
        most_used: patternState.analytics.usageStats.mostUsed,
        most_effective: patternState.analytics.effectiveness.highest
      },
      tags: patternState.analytics.tags,
      timeline: patternState.analytics.timeline
    };

    const data = JSON.stringify(report, null, 2);
    downloadFile('agentdb-pattern-analytics.json', data, 'application/json');
    logToConsole('success', 'Analytics report exported');

  } catch (error) {
    logToConsole('error', `Failed to export analytics: ${error.message}`);
    alert('Failed to export analytics. Check console for details.');
  }
}

// ============================================================================
// PATTERN RELATIONSHIP GRAPH
// ============================================================================

function showPatternGraph() {
  try {
    const patterns = sqlAll('SELECT * FROM patterns');

    if (patterns.length === 0) {
      alert('No patterns to visualize');
      return;
    }

    // Calculate relationships based on embedding similarity (simplified)
    const relationships = [];
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        // Mock similarity calculation
        const similarity = Math.random();
        if (similarity > 0.7) {
          relationships.push({
            source: patterns[i].id,
            target: patterns[j].id,
            similarity: similarity
          });
        }
      }
    }

    let html = `
      <div class="modal-header">
        <div class="modal-title">🕸️ Pattern Relationship Graph</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background: var(--bg-secondary); border-radius: 8px; padding: 2rem; text-align: center; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🕸️</div>
          <h3 style="margin-bottom: 0.5rem;">Pattern Relationship Network</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1rem;">Visualization of ${patterns.length} patterns with ${relationships.length} relationships</p>

          <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1.5rem; width: 100%; max-width: 500px; text-align: left;">
            <h4 style="font-size: 0.875rem; margin-bottom: 0.75rem;">Network Statistics:</h4>
            <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.8;">
              <div>📊 Total Nodes: <strong>${patterns.length}</strong></div>
              <div>🔗 Total Edges: <strong>${relationships.length}</strong></div>
              <div>🎯 Avg Connections: <strong>${(relationships.length / patterns.length).toFixed(1)}</strong></div>
              <div>⭐ Network Density: <strong>${((relationships.length / (patterns.length * (patterns.length - 1) / 2)) * 100).toFixed(1)}%</strong></div>
            </div>
          </div>

          <div style="margin-top: 1.5rem; padding: 1rem; background: var(--info-bg); border-left: 3px solid var(--info); border-radius: 4px; width: 100%; max-width: 500px;">
            <div style="font-size: 0.75rem; color: var(--info);">
              💡 <strong>Info:</strong> Full graph visualization would require a library like D3.js or vis.js. This is a statistical summary view.
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="exportGraphData()">💾 Export Graph Data</button>
      </div>
    `;

    const modal = document.getElementById('genericModal');
    modal.innerHTML = html;
    modal.classList.add('active');

    logToConsole('info', 'Pattern graph displayed');

  } catch (error) {
    logToConsole('error', `Failed to generate pattern graph: ${error.message}`);
    alert('Failed to generate pattern graph. Check console for details.');
  }
}

function exportGraphData() {
  try {
    const patterns = sqlAll('SELECT * FROM patterns');
    const nodes = patterns.map(p => ({
      id: p.id,
      type: p.pattern_type,
      label: (typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata).description
    }));

    // Calculate edges (mock similarity)
    const edges = [];
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const similarity = Math.random();
        if (similarity > 0.7) {
          edges.push({
            source: patterns[i].id,
            target: patterns[j].id,
            weight: similarity
          });
        }
      }
    }

    const graphData = { nodes, edges };
    const data = JSON.stringify(graphData, null, 2);
    downloadFile('agentdb-pattern-graph.json', data, 'application/json');
    logToConsole('success', 'Pattern graph data exported');

  } catch (error) {
    logToConsole('error', `Failed to export graph data: ${error.message}`);
  }
}

// ============================================================================
// PATTERN RECOMMENDATIONS
// ============================================================================

function getPatternRecommendations(context) {
  try {
    const patterns = sqlAll('SELECT * FROM patterns');

    if (patterns.length === 0) {
      return [];
    }

    // Mock recommendation engine - in real implementation would use embeddings
    const recommendations = patterns
      .map(p => {
        const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
        return {
          pattern: p,
          score: Math.random(),
          reason: 'Similar to current context',
          metadata
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return recommendations;
  } catch (error) {
    logToConsole('error', `Failed to get recommendations: ${error.message}`);
    return [];
  }
}

// ============================================================================
// ENHANCED PATTERN DISPLAY
// ============================================================================

function renderPatternCard(pattern, viewMode = 'list') {
  const metadata = typeof pattern.metadata === 'string' ?
    JSON.parse(pattern.metadata) : pattern.metadata;

  const description = metadata.description || 'No description';
  const tags = metadata.tags || [];
  const usage = metadata.usage_count || 0;
  const effectiveness = metadata.effectiveness || 0;
  const similarity = metadata.similarity_score || 0;

  const isSelected = patternState.selectedPatterns.has(pattern.id);
  const checkboxHtml = patternState.bulkSelectMode ?
    `<input type="checkbox" id="pattern-check-${pattern.id}"
       ${isSelected ? 'checked' : ''}
       onchange="togglePatternSelection(${pattern.id})"
       onclick="event.stopPropagation()"
       style="cursor: pointer; margin-right: 0.5rem;">` : '';

  if (viewMode === 'grid') {
    return `
      <div class="pattern-card-grid" onclick="viewPattern(${pattern.id})">
        <div style="display: flex; align-items: start; margin-bottom: 0.75rem;">
          ${checkboxHtml}
          <div style="flex: 1;">
            <span class="status-badge info">${pattern.pattern_type}</span>
          </div>
          <div class="pattern-quick-actions">
            <button class="btn-icon" onclick="event.stopPropagation(); duplicatePattern(${pattern.id})" title="Duplicate">📋</button>
            <button class="btn-icon" onclick="event.stopPropagation(); deletePattern(${pattern.id})" title="Delete">🗑️</button>
          </div>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${description}
          </div>
        </div>

        ${tags.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.75rem;">
            ${tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
            ${tags.length > 3 ? `<span class="tag">+${tags.length - 3}</span>` : ''}
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
          <div>📊 Usage: <strong>${usage}</strong></div>
          <div>⭐ Eff: <strong>${(effectiveness * 100).toFixed(0)}%</strong></div>
        </div>

        <div style="font-size: 0.625rem; color: var(--text-muted); padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          ID: ${pattern.id} | ${new Date(pattern.created_at * 1000).toLocaleDateString()}
        </div>
      </div>
    `;
  } else {
    // List view
    return `
      <div class="card" style="cursor: pointer; transition: all 0.2s;"
           onmouseenter="this.style.boxShadow='0 4px 12px rgba(74, 144, 226, 0.15)'"
           onmouseleave="this.style.boxShadow='0 2px 8px rgba(0, 0, 0, 0.1)'"
           onclick="viewPattern(${pattern.id})">
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
          <div style="display: flex; align-items: start; flex: 1; gap: 0.5rem;">
            ${checkboxHtml}
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="status-badge info">${pattern.pattern_type}</span>
                ${tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
              </div>

              <div style="font-weight: 600; margin-bottom: 0.5rem;">
                ${description}
              </div>

              <div style="display: flex; gap: 1.5rem; font-size: 0.75rem; color: var(--text-secondary);">
                <span>📊 Usage: <strong>${usage}</strong></span>
                <span>⭐ Effectiveness: <strong>${(effectiveness * 100).toFixed(0)}%</strong></span>
                <span>🎯 Similarity: <strong>${(similarity * 100).toFixed(0)}%</strong></span>
                <span style="color: var(--text-muted);">ID: ${pattern.id}</span>
                <span style="color: var(--text-muted);">${new Date(pattern.created_at * 1000).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewPattern(${pattern.id})">View</button>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); duplicatePattern(${pattern.id})" title="Duplicate">📋</button>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); deletePattern(${pattern.id})" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }
}

// Override the existing refreshPatterns function
async function refreshPatterns() {
  logToConsole('info', 'Refreshing patterns...');

  try {
    let patterns = sqlAll('SELECT * FROM patterns ORDER BY created_at DESC');

    // Apply filters and sorting
    patterns = filterAndSortPatterns(patterns);

    const container = document.getElementById('patterns-list');
    const countEl = document.getElementById('pattern-count');

    if (countEl) {
      countEl.textContent = `${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}`;
    }

    if (patterns.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧩</div><div class="empty-state-title">No patterns found</div><div class="empty-state-text">Try adjusting your filters or add new patterns</div></div>';
      return;
    }

    let html = patterns.map(pattern =>
      renderPatternCard(pattern, patternState.viewMode)
    ).join('');

    container.innerHTML = html;
    logToConsole('success', `Loaded ${patterns.length} patterns`);

  } catch (error) {
    logToConsole('error', `Failed to refresh patterns: ${error.message}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function closeModal() {
  const modal = document.getElementById('genericModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Export for use in main application
if (typeof window !== 'undefined') {
  window.patternEnhancements = {
    updateSimilarityValue,
    resetPatternFilters,
    applyPatternFilters,
    togglePatternView,
    toggleBulkSelect,
    bulkDeletePatterns,
    duplicatePattern,
    deletePattern,
    showPatternAnalytics,
    showPatternGraph,
    getPatternRecommendations,
    refreshPatterns
  };
}

console.log('✅ AgentDB Pattern Enhancements loaded');
