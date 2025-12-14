# Episodes Panel Developer Guide

## Overview
This guide helps developers understand, maintain, and extend the Episodes panel reinforcement learning features.

**File Location:** `/workspaces/agentdb-site/public/agentdb/examples/browser/management-ide/index.html`

---

## Architecture

### Component Hierarchy
```
Episodes Panel
├── Analytics Dashboard
│   ├── Quick Stats Cards (4)
│   ├── Reward Histogram
│   └── Reward Trend Chart
├── Advanced Filters
│   ├── Reward Range
│   ├── Task Type
│   ├── Time Period
│   └── Outcome
├── View Mode Selector
│   ├── Cards View
│   ├── Table View
│   ├── Timeline View
│   └── Trajectories View
└── Episode Operations
    ├── View/Replay/Clone
    ├── Trajectory Analysis
    ├── Annotations
    ├── Templates
    └── Comparison/Insights
```

---

## State Management

### Global State Variables

```javascript
// Episode view mode state
let episodeViewMode = 'cards'; // Current active view mode

// Episode filters configuration
let episodeFilters = {
  rewardMin: -1,      // Minimum reward threshold
  rewardMax: 1,       // Maximum reward threshold
  taskType: '',       // Task category filter
  timePeriod: 'all',  // Time range filter
  outcome: 'all'      // Success/failure/neutral filter
};
```

### State Flow

```
User Action → Update State → Refresh Episodes
                    ↓
            Update Analytics
                    ↓
            Filter Episodes
                    ↓
            Render View
```

---

## Core Functions

### 1. refreshEpisodes()
**Purpose:** Main orchestrator function

**Flow:**
```javascript
refreshEpisodes()
  ↓
  Fetch all episodes from database
  ↓
  updateEpisodeAnalytics(episodes)
  ↓
  filterEpisodesData(episodes)
  ↓
  renderEpisodesView(filteredEpisodes)
```

**Usage:**
```javascript
// Call after any data change
await refreshEpisodes();
```

---

### 2. updateEpisodeAnalytics(episodes)
**Purpose:** Calculate and display statistics

**Calculations:**
- Total episode count
- Success rate (reward > 0.5)
- Average reward
- Top strategy (most common task type)
- Trend analysis (recent vs previous)

**Updates:**
- Quick stats cards
- Reward histogram
- Reward trend chart

**Example Extension:**
```javascript
// Add new metric
function updateEpisodeAnalytics(episodes) {
  // ... existing code ...

  // Calculate new metric
  const completionRate = calculateCompletionRate(episodes);
  document.getElementById('completion-rate').textContent = completionRate;
}
```

---

### 3. filterEpisodesData(episodes)
**Purpose:** Apply multi-dimensional filters

**Filter Logic:**
```javascript
// Reward range check
if (episode.reward < min || episode.reward > max) return false;

// Task type check
if (taskType && extractTaskType(episode.task) !== taskType) return false;

// Time period check
if (timePeriod !== 'all' && !withinTimePeriod(episode)) return false;

// Outcome check
if (outcome === 'success' && episode.reward <= 0.5) return false;
```

**Adding New Filter:**
```javascript
// 1. Add to episodeFilters state
episodeFilters.priority = 'all';

// 2. Add UI control in HTML
<select id="priority-filter">
  <option value="all">All Priorities</option>
  <option value="high">High</option>
  <option value="low">Low</option>
</select>

// 3. Add filter logic
if (episodeFilters.priority !== 'all') {
  if (episode.metadata.priority !== episodeFilters.priority) {
    return false;
  }
}

// 4. Update applyEpisodeFilters()
episodeFilters.priority = document.getElementById('priority-filter').value;
```

---

### 4. renderEpisodesView(episodes)
**Purpose:** Dispatch to appropriate view renderer

**Dispatcher Pattern:**
```javascript
switch (episodeViewMode) {
  case 'cards':
    renderCardsView(episodes, container);
    break;
  case 'table':
    renderTableView(episodes, container);
    break;
  case 'timeline':
    renderTimelineView(episodes, container);
    break;
  case 'trajectories':
    renderTrajectoriesView(episodes, container);
    break;
}
```

**Adding New View:**
```javascript
// 1. Add button to HTML
<button class="view-mode-btn" data-mode="heatmap"
        onclick="setEpisodeViewMode('heatmap')">
  🔥 Heatmap
</button>

// 2. Create render function
function renderHeatmapView(episodes, container) {
  // Implementation
  let html = '<div class="heatmap-container">';
  // ... generate heatmap ...
  html += '</div>';
  container.innerHTML = html;
}

// 3. Add to dispatcher
case 'heatmap':
  renderHeatmapView(episodes, container);
  break;
```

---

## View Renderers

### renderCardsView(episodes, container)

**HTML Structure:**
```html
<div class="episode-card reward-{class}">
  <div class="episode-header">
    <div class="episode-title">Task</div>
    <div class="episode-badges">
      <span class="episode-badge {type}">Badge</span>
    </div>
  </div>
  <div>Critique preview</div>
  <div class="episode-actions">
    <button class="episode-action-btn">Action</button>
  </div>
</div>
```

**Customization:**
```javascript
// Add new badge
const customBadge = calculateCustomMetric(episode);
html += `<span class="episode-badge">${customBadge}</span>`;

// Add new action button
html += `<button class="episode-action-btn"
         onclick="customAction(${episode.id})">
  🎯 Custom
</button>`;
```

---

### renderTableView(episodes, container)

**Adding Column:**
```javascript
// 1. Add header
<th style="padding: 0.75rem; text-align: left;">
  New Column
</th>

// 2. Add data cell in loop
<td style="padding: 0.75rem;">
  ${episode.newProperty}
</td>
```

---

### renderTimelineView(episodes, container)

**Customizing Timeline:**
```javascript
// Change dot color based on custom logic
const dotColor = episode.metadata.urgent ? 'var(--danger)' : 'var(--accent)';

html += `
<div class="timeline-item" style="--dot-color: ${dotColor}">
  ...
</div>
`;
```

---

### renderTrajectoriesView(episodes, container)

**SVG Path Generation:**
```javascript
function renderTrajectoryPath(episodes) {
  // Calculate scaling
  const xScale = (width - padding * 2) / (episodes.length - 1);
  const yScale = (height - padding * 2) / 2; // Range: -1 to 1

  // Generate path
  let path = 'M';
  episodes.forEach((episode, i) => {
    const x = padding + i * xScale;
    const y = height / 2 - episode.reward * yScale;
    path += i === 0 ? `${x},${y}` : ` L${x},${y}`;
  });

  return `<path class="trajectory-path" d="${path}" />`;
}
```

**Customizing Trajectory:**
```javascript
// Add custom data points
const customPoints = episodes.map((e, i) => ({
  x: padding + i * xScale,
  y: height / 2 - e.customMetric * yScale,
  label: e.customLabel
}));

// Add to SVG
customPoints.forEach(p => {
  points += `<circle cx="${p.x}" cy="${p.y}" r="4">
              <title>${p.label}</title>
            </circle>`;
});
```

---

## Analytics Components

### renderRewardHistogram(episodes)

**Bin Configuration:**
```javascript
const bins = 10; // Number of histogram bars
const buckets = new Array(bins).fill(0);

// Distribute episodes into bins
episodes.forEach(e => {
  const binIndex = Math.min(
    Math.floor((e.reward + 1) / 2 * bins),
    bins - 1
  );
  buckets[binIndex]++;
});
```

**Customizing Bins:**
```javascript
// Custom bin ranges
const customBins = [
  { min: -1.0, max: -0.5, label: 'Very Poor' },
  { min: -0.5, max: 0.0, label: 'Poor' },
  { min: 0.0, max: 0.5, label: 'Fair' },
  { min: 0.5, max: 1.0, label: 'Excellent' }
];

customBins.forEach(bin => {
  const count = episodes.filter(e =>
    e.reward >= bin.min && e.reward < bin.max
  ).length;

  html += `<div class="histogram-bar"
           style="height: ${count / maxCount * 100}%"
           title="${bin.label}: ${count}">
          </div>`;
});
```

---

### renderRewardTrendChart(episodes)

**Canvas Configuration:**
```javascript
const canvas = document.getElementById('reward-trend-chart');
const ctx = canvas.getContext('2d');

// Responsive sizing
canvas.width = canvas.offsetWidth;
canvas.height = 60;

// Scaling calculations
const xScale = width / (episodes.length - 1);
const yMin = -1, yMax = 1;
const yScale = height / (yMax - yMin);
```

**Adding Features:**
```javascript
// Add moving average line
const movingAvg = calculateMovingAverage(episodes, 5);

ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
ctx.lineWidth = 1;
ctx.beginPath();

movingAvg.forEach((avg, i) => {
  const x = i * xScale;
  const y = height - (avg - yMin) * yScale;

  if (i === 0) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
});

ctx.stroke();

// Add confidence bands
const stdDev = calculateStdDev(episodes);
ctx.fillStyle = 'rgba(142, 76, 50, 0.1)';
// ... draw confidence bands
```

---

## Utility Functions

### extractTaskType(task)

**Pattern Matching:**
```javascript
const lower = task.toLowerCase();
if (lower.includes('code') || lower.includes('implement')) return 'coding';
if (lower.includes('analyz') || lower.includes('review')) return 'analysis';
// ... more patterns
```

**Adding New Type:**
```javascript
// 1. Add pattern
if (lower.includes('design') || lower.includes('architect')) {
  return 'architecture';
}

// 2. Add to UI filter
<option value="architecture">Architecture</option>

// 3. Update color scheme
.episode-badge.architecture {
  background: var(--info);
}
```

---

### analyzeSentiment(text)

**Current Logic:**
```javascript
if (text.includes('excellent') || text.includes('great')) return '😊 Positive';
if (text.includes('poor') || text.includes('failed')) return '😞 Negative';
if (text.includes('good') || text.includes('okay')) return '😐 Neutral';
```

**Enhanced Sentiment:**
```javascript
function analyzeSentiment(text) {
  if (!text) return '';

  const lower = text.toLowerCase();

  // Calculate sentiment score
  const positiveWords = ['excellent', 'great', 'perfect', 'outstanding'];
  const negativeWords = ['poor', 'failed', 'bad', 'terrible'];

  let score = 0;
  positiveWords.forEach(word => {
    score += (lower.match(new RegExp(word, 'g')) || []).length;
  });
  negativeWords.forEach(word => {
    score -= (lower.match(new RegExp(word, 'g')) || []).length;
  });

  // Return sentiment with confidence
  if (score > 2) return '😊 Very Positive';
  if (score > 0) return '🙂 Positive';
  if (score === 0) return '😐 Neutral';
  if (score > -2) return '😕 Negative';
  return '😞 Very Negative';
}
```

---

## Episode Actions

### Adding New Action

**1. Create Handler Function:**
```javascript
function exportEpisodeToJSON(id) {
  const episode = sqlGet(`SELECT * FROM episodes WHERE id = ?`, [id]);

  const json = JSON.stringify(episode, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `episode-${id}.json`;
  a.click();

  logToConsole('success', `Exported episode ${id} to JSON`);
}
```

**2. Add to Card Actions:**
```javascript
<button class="episode-action-btn"
        onclick="exportEpisodeToJSON(${episode.id})">
  💾 Export JSON
</button>
```

**3. Add to Context Menu (optional):**
```javascript
<div class="episode-context-menu" id="episode-${episode.id}-menu">
  <div class="menu-item" onclick="exportEpisodeToJSON(${episode.id})">
    Export to JSON
  </div>
</div>
```

---

## CSS Customization

### Theme Variables

**Current Colors:**
```css
:root {
  --bg-primary: hsl(0 0% 10%);
  --bg-secondary: hsl(0 0% 15%);
  --bg-tertiary: hsl(0 0% 20%);
  --accent: hsl(142 76% 50%);
  --success: hsl(142 76% 50%);
  --warning: hsl(45 76% 50%);
  --danger: hsl(0 76% 50%);
}
```

**Adding Custom Theme:**
```css
/* Light theme override */
[data-theme="light"] {
  --bg-primary: hsl(0 0% 98%);
  --bg-secondary: hsl(0 0% 95%);
  --bg-tertiary: hsl(0 0% 90%);
  --text-primary: hsl(0 0% 10%);
}
```

---

### Component Styling

**Stat Card Variants:**
```css
/* Add warning variant */
.stat-card.warning {
  border-left: 4px solid var(--warning);
}

.stat-card.warning .stat-card-value {
  color: var(--warning);
}

/* Add pulse animation */
.stat-card.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
```

**Episode Card Variants:**
```css
/* Add compact variant */
.episode-card.compact {
  padding: 0.5rem;
}

.episode-card.compact .episode-title {
  font-size: 0.875rem;
}

/* Add featured variant */
.episode-card.featured {
  border: 2px solid var(--accent);
  box-shadow: 0 0 20px rgba(142, 76, 50, 0.3);
}
```

---

## Performance Optimization

### Data Caching

```javascript
// Cache episode data
let episodeCache = {
  data: null,
  timestamp: null,
  ttl: 30000 // 30 seconds
};

async function refreshEpisodes() {
  const now = Date.now();

  // Check cache
  if (episodeCache.data &&
      episodeCache.timestamp &&
      now - episodeCache.timestamp < episodeCache.ttl) {

    // Use cached data
    updateEpisodeAnalytics(episodeCache.data);
    const filtered = filterEpisodesData(episodeCache.data);
    renderEpisodesView(filtered);
    return;
  }

  // Fetch fresh data
  const episodes = sqlAll('SELECT * FROM episodes...');

  // Update cache
  episodeCache.data = episodes;
  episodeCache.timestamp = now;

  // Continue normal flow
  updateEpisodeAnalytics(episodes);
  // ...
}
```

---

### Lazy Rendering

```javascript
// Render only visible episodes
let visibleRange = { start: 0, end: 20 };

function renderCardsView(episodes, container) {
  const visible = episodes.slice(
    visibleRange.start,
    visibleRange.end
  );

  let html = '';
  visible.forEach(episode => {
    html += generateEpisodeCard(episode);
  });

  container.innerHTML = html;

  // Add scroll listener for infinite scroll
  container.addEventListener('scroll', handleScroll);
}

function handleScroll(e) {
  const { scrollTop, scrollHeight, clientHeight } = e.target;

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    // Load more
    visibleRange.end += 20;
    refreshEpisodes();
  }
}
```

---

### Debouncing

```javascript
// Debounce filter applications
let filterTimeout = null;

function applyEpisodeFilters() {
  clearTimeout(filterTimeout);

  filterTimeout = setTimeout(() => {
    episodeFilters.rewardMin = parseFloat(
      document.getElementById('reward-min').value
    ) || -1;
    // ... update other filters

    refreshEpisodes();
  }, 300); // Wait 300ms after last change
}
```

---

## Testing

### Unit Test Examples

```javascript
// Test extractTaskType
function testExtractTaskType() {
  console.assert(
    extractTaskType('Implement user auth') === 'coding',
    'Should detect coding tasks'
  );

  console.assert(
    extractTaskType('Analyze performance metrics') === 'analysis',
    'Should detect analysis tasks'
  );
}

// Test filterEpisodesData
function testFilterEpisodesData() {
  const mockEpisodes = [
    { id: 1, reward: 0.8, task: 'Code feature', created_at: new Date() },
    { id: 2, reward: -0.2, task: 'Test code', created_at: new Date() }
  ];

  episodeFilters.outcome = 'success';
  const filtered = filterEpisodesData(mockEpisodes);

  console.assert(
    filtered.length === 1,
    'Should filter success episodes'
  );
}

// Run tests
testExtractTaskType();
testFilterEpisodesData();
```

---

### Integration Testing

```javascript
// Test complete flow
async function testEpisodeFlow() {
  console.log('Testing episode flow...');

  // 1. Add episode
  await saveEpisode();

  // 2. Refresh
  await refreshEpisodes();

  // 3. Apply filters
  applyEpisodeFilters();

  // 4. Change view
  setEpisodeViewMode('table');

  // 5. Verify rendering
  const container = document.getElementById('episodes-list');
  console.assert(
    container.querySelector('table') !== null,
    'Table should be rendered'
  );

  console.log('✓ Episode flow test passed');
}
```

---

## Debugging

### Console Logging

**Current Logs:**
```javascript
logToConsole('info', 'Refreshing episodes...');
logToConsole('success', `Loaded ${episodes.length} episodes`);
logToConsole('error', `Failed to refresh: ${error.message}`);
```

**Enhanced Logging:**
```javascript
// Add debug mode
let DEBUG_MODE = localStorage.getItem('episodes-debug') === 'true';

function debugLog(category, message, data) {
  if (!DEBUG_MODE) return;

  console.group(`[Episodes] ${category}`);
  console.log(message);
  if (data) console.table(data);
  console.groupEnd();
}

// Usage
debugLog('Analytics', 'Updated stats', {
  total: episodes.length,
  success: successCount,
  avgReward: avgReward
});

// Enable/disable in console
localStorage.setItem('episodes-debug', 'true');
```

---

### Performance Monitoring

```javascript
// Add performance marks
function refreshEpisodes() {
  performance.mark('episodes-refresh-start');

  // ... existing code ...

  performance.mark('episodes-refresh-end');
  performance.measure(
    'episodes-refresh',
    'episodes-refresh-start',
    'episodes-refresh-end'
  );

  const measure = performance.getEntriesByName('episodes-refresh')[0];
  debugLog('Performance', `Refresh took ${measure.duration}ms`);
}
```

---

## Best Practices

### Code Organization
1. Group related functions together
2. Use descriptive function names
3. Add JSDoc comments
4. Keep functions under 50 lines
5. Extract reusable logic

### Error Handling
```javascript
async function safeRefreshEpisodes() {
  try {
    await refreshEpisodes();
  } catch (error) {
    logToConsole('error', `Failed to refresh: ${error.message}`);

    // Show user-friendly message
    const container = document.getElementById('episodes-list');
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Failed to load episodes</div>
        <div class="error-text">${error.message}</div>
        <button onclick="refreshEpisodes()">Retry</button>
      </div>
    `;
  }
}
```

### Accessibility
```javascript
// Add ARIA labels
<button
  class="episode-action-btn"
  onclick="replayEpisode(${episode.id})"
  aria-label="Replay episode ${episode.id}"
  title="Replay episode">
  ▶️ Replay
</button>

// Add keyboard navigation
container.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    viewEpisode(selectedEpisodeId);
  }
});
```

---

## Future Enhancements

### Planned Features
1. Machine learning integration
2. Real-time episode streaming
3. Collaborative annotations
4. Export to external RL frameworks
5. Advanced trajectory analysis
6. Network graph visualizations
7. Automated insights generation
8. Multi-user support

### Extension Points
- Custom view modes
- Plugin system for actions
- Custom analytics widgets
- Theme marketplace
- External data connectors

---

## Troubleshooting

### Common Issues

**Issue: Charts not rendering**
```javascript
// Solution: Check canvas context
const canvas = document.getElementById('reward-trend-chart');
if (!canvas.getContext('2d')) {
  console.error('Canvas 2D context not supported');
}
```

**Issue: Filters not applying**
```javascript
// Solution: Verify filter state
console.log('Current filters:', episodeFilters);

// Reset if needed
resetEpisodeFilters();
```

**Issue: Performance degradation**
```javascript
// Solution: Enable pagination
const EPISODES_PER_PAGE = 20;

function renderCardsView(episodes, container) {
  const page = currentPage || 0;
  const start = page * EPISODES_PER_PAGE;
  const end = start + EPISODES_PER_PAGE;
  const pageEpisodes = episodes.slice(start, end);

  // Render only current page
  // ...
}
```

---

## Support & Resources

### Documentation
- AgentDB API Docs
- SQLite.js Documentation
- Canvas API Reference
- SVG Path Reference

### Community
- GitHub Discussions
- Stack Overflow Tag: `agentdb`
- Discord Server

### Contributing
1. Fork the repository
2. Create feature branch
3. Add tests
4. Submit pull request

---

**Version:** 1.0.0
**Last Updated:** 2025-10-23
**Maintainer:** AgentDB Team
