# ⚡ AgentDB Management IDE v2.0

A comprehensive, full-featured browser-based IDE for managing SQL databases with advanced AI-powered features including vector embeddings, pattern management, episode tracking, and causal graph analysis.

Built on **AgentDB v1.3.9** - The intelligent database with built-in learning capabilities.

---

## 🎯 Overview

The AgentDB Management IDE is a zero-installation, browser-based integrated development environment that provides a complete suite of tools for working with AgentDB's advanced features. From SQL editing to vector similarity search, pattern management to reinforcement learning episode tracking, the IDE offers an intuitive visual interface for all AgentDB capabilities.

**Key Highlights:**
- 🚀 Zero installation - runs entirely in browser
- 📱 Fully responsive mobile design
- 🧠 AI-powered query diagnostics
- 📊 Real-time data visualization
- 💾 Export/import capabilities
- 🔍 Advanced filtering and search
- ❓ Context-sensitive help system

---

## ✨ New in v2.0

### 🎨 Tab-Based Interface
- **Editor/Results/Diagnostics Tabs** - Organized workspace with quick switching
- **Tab Memory** - Preserves content across navigation
- **Context-Aware Views** - Show relevant tabs based on operations

### 📱 Mobile-First Responsive Design
- **Hamburger Menu** (☰) - Touch-optimized navigation
- **Responsive Layout** - Adapts to all screen sizes
- **Mobile Overlay** - Smooth sidebar interactions
- **Touch Gestures** - Swipe and tap support
- **Optimized Controls** - Large touch targets for mobile

### 🔍 Query Diagnostics System
- **Performance Metrics** - Execution time, row counts, query complexity
- **Optimization Tips** - AI-powered suggestions for query improvement
- **Index Recommendations** - Smart suggestions for database optimization
- **Best Practices** - Real-time query quality assessment
- **Cost Analysis** - Identify expensive operations

### ❓ Enhanced Context-Sensitive Help
- **Feature-Specific Help** - Dedicated help for each panel
- **Interactive Examples** - Working code samples
- **Quick Reference** - Schema and API documentation
- **Inline Tooltips** - Guidance throughout the interface

### 💾 Advanced Export Functions
- **Export Patterns** - JSON export with metadata
- **Export Episodes** - Complete learning trajectories
- **Export Causal Graphs** - Relationship mappings
- **Export Query Results** - CSV and JSON formats
- **Batch Operations** - Export multiple datasets

### 🎛️ Interactive Filtering System
- **Pattern Type Filter** - Filter by causal, temporal, reasoning, optimization
- **Episode Reward Filter** - Slider-based threshold filtering
- **Causal Weight Filter** - Minimum edge weight filtering
- **Real-Time Updates** - Instant filter application
- **Visual Feedback** - Display current filter values

### 🤖 Sample Data Generation
- **AI-Powered Generation** - Intelligent test data creation
- **Template-Based** - Pre-built patterns and episodes
- **Batch Import** - Import multiple items at once
- **Realistic Data** - Context-aware sample generation

### 📈 Trajectory Visualization
- **Learning Progress Tracking** - Visualize episode sequences
- **Performance Trends** - Track reward evolution
- **Action Analysis** - Understand decision patterns
- **Historical Insights** - Compare trajectories over time

### 🔬 Causal Path Analysis
- **Indirect Relationships** - Discover multi-hop connections
- **Path Discovery** - Find all paths between nodes
- **Weight Propagation** - Calculate cumulative effects
- **Network Analysis** - Identify critical nodes

---

## 🚀 Getting Started

### Quick Start

1. **Open the IDE**
   ```
   http://localhost:8081/agentdb/examples/browser/management-ide/
   ```
   Or visit: [agentdb.ruv.io/examples](https://agentdb.ruv.io/examples)

2. **Database Auto-Initialization**
   - Database initializes automatically in memory
   - No configuration required to start

3. **Choose Your First Action**
   - 📝 **SQL Editor** - Run queries with templates
   - 🧩 **Patterns** - Store reasoning patterns
   - 📊 **Data Browser** - Explore existing data
   - 🔍 **Vector Search** - Semantic similarity search

### Mobile Access

1. **Tap the Menu Icon** (☰) - Opens navigation sidebar
2. **Select a Feature** - Touch-optimized panels
3. **Swipe to Dismiss** - Close sidebar with overlay tap
4. **Responsive Tables** - Horizontal scroll on small screens

**Mobile Tips:**
- Use landscape mode for query editing
- Pinch to zoom on data tables
- Long-press for context menus
- All features work on mobile devices

---

## 📚 Core Features

### 📝 AgentDB SQL Editor

**Advanced SQL editing with AgentDB-specific enhancements**

**8 Pre-Built Query Templates:**
1. 🔢 **Query Vectors** - Browse vector embeddings with metadata
2. 🧩 **Query Patterns** - Filter patterns by type with full metadata
3. 📝 **Query Episodes** - Find high-performing learning episodes
4. 🔗 **Query Causal Edges** - Analyze cause-effect relationships
5. 🔍 **Semantic Search** - Similarity-based pattern matching using vectors
6. 📊 **Aggregate Stats** - Cross-table analytics and metrics
7. 🔀 **Advanced Joins** - Complex multi-table queries
8. 🏷️ **JSON Metadata** - Extract and query nested JSON fields

**Editor Features:**
- Syntax-aware formatting
- Auto-completion hints
- Query history tracking
- Save/load favorite queries
- Export results (JSON/CSV)
- Performance timing
- Tab-based workspace

**Usage Example:**
```sql
-- Quick template: Query high-reward episodes
SELECT
  task,
  action,
  reward,
  json_extract(metadata, '$.confidence') as confidence
FROM episodes
WHERE reward > 0.8
ORDER BY reward DESC
LIMIT 10;
```

**New: Query Diagnostics**

After executing a query, switch to the **Diagnostics** tab to view:
- ⏱️ **Execution Time** - Millisecond precision
- 📊 **Rows Returned** - Result set size
- 🎯 **Query Complexity** - Simple, Medium, or Complex
- 💡 **Optimization Tips** - Specific improvement suggestions
- 📈 **Performance Score** - Query efficiency rating

---

### 📊 Data Browser

**Interactive table exploration with filtering and search**

**Features:**
- **Table Selection** - Dropdown menu for all tables
- **Real-Time Search** - Filter records as you type (🔍)
- **Paginated View** - Handle large datasets efficiently
- **Column Inspection** - Click headers for details
- **Export Options** - Download table data
- **Auto-Refresh** - Stay synchronized with changes

**How to Use:**
1. Select table from dropdown
2. Use search box to filter records
3. Click column headers to sort
4. Export data for external analysis

**Mobile Optimization:**
- Horizontal scroll for wide tables
- Sticky headers
- Touch-friendly controls

---

### 🧩 Pattern Management

**Store and manage reasoning patterns with vector embeddings**

**What are Patterns?**

Patterns are reusable reasoning templates that capture problem-solving approaches, strategies, and domain knowledge. Each pattern is automatically embedded as a 384-dimensional vector for semantic similarity search.

**Pattern Types:**
- 🔗 **Causal** - Cause-effect reasoning patterns
- ⏰ **Temporal** - Time-based patterns and sequences
- 🧠 **Reasoning** - Logic and inference patterns
- ⚡ **Optimization** - Performance optimization strategies
- ✨ **Custom** - User-defined pattern types

**New Features in v2.0:**

1. **Type Filter** - Dropdown to filter patterns by type
2. **Export Patterns** (💾) - Download all patterns as JSON
3. **Batch Add** (⚡) - Import multiple patterns at once
4. **Templates** (📚) - Pre-built pattern library
5. **Help Button** (❓) - Context-sensitive guidance

**Adding a Pattern:**

1. Click **➕ Add Pattern**
2. Enter description: "When X happens, consider Y"
3. Select pattern type (causal, temporal, etc.)
4. Add optional JSON metadata:
   ```json
   {
     "domain": "marketing",
     "confidence": 0.85,
     "source": "A/B test results"
   }
   ```
5. Pattern is automatically embedded and stored

**Filtering Patterns:**

Use the **Filter by Type** dropdown to show only:
- All Types
- Causal patterns
- Temporal patterns
- Reasoning patterns
- Optimization patterns
- Custom patterns

**Exporting Patterns:**

Click **💾 Export** to download all patterns with:
- Pattern descriptions
- Types and metadata
- Vector embeddings
- Creation timestamps
- JSON format for easy re-import

---

### 📝 Episode Management

**Track reinforcement learning episodes with complete trajectories**

**What are Episodes?**

Episodes record complete task-action-reward cycles for reinforcement learning. Each episode captures what was tried, what action was taken, the outcome, and a critique for learning.

**Episode Structure:**
```javascript
{
  task: "Optimize conversion rate",
  action: "Redesign landing page with social proof",
  reward: 0.87,  // 0.0 to 1.0 scale
  critique: "Adding testimonials increased conversions by 23%",
  trajectory: "research → design → test → deploy",
  metadata: {
    duration_hours: 48,
    a_b_test_size: 5000,
    confidence: 0.91
  }
}
```

**New Features in v2.0:**

1. **Reward Filter** - Slider to filter by minimum reward threshold
2. **Trajectory View** (📈) - Visualize learning progress over time
3. **Export Episodes** (💾) - Download complete episode history
4. **Examples** (📚) - Pre-built episode templates
5. **Real-Time Filter Value** - Shows current threshold (≥ 0.5)

**Adding an Episode:**

1. Click **➕ Add Episode**
2. Enter task description
3. Describe action taken
4. Set reward (0.0 = failure, 1.0 = perfect)
5. Add critique for learning
6. Optional: Include trajectory and metadata

**Filtering Episodes:**

Use the **Reward Threshold** slider to show only high-performing episodes:
- Drag slider to set minimum reward
- Episodes below threshold are hidden
- Filter value displays in real-time (≥ 0.7)
- Ideal for identifying successful strategies

**Trajectory Visualization:**

Click **📈 Trajectories** to:
- View episode sequences chronologically
- Track performance trends
- Identify learning patterns
- Compare action effectiveness

---

### 🔗 Causal Graph Visualization

**Map and analyze cause-effect relationships**

**What are Causal Graphs?**

Causal graphs represent directed relationships between events, actions, and outcomes. Each edge has a weight indicating relationship strength, enabling causal inference and decision-making.

**Causal Edge Structure:**
```javascript
{
  cause: "increased_marketing_budget",
  effect: "higher_customer_acquisition",
  weight: 0.82,  // 0.0 to 1.0 strength
  metadata: {
    confidence: 0.91,
    sample_size: 10000,
    time_lag_days: 7
  }
}
```

**New Features in v2.0:**

1. **Weight Filter** - Slider to show only strong relationships
2. **Path Analysis** (🔬) - Discover indirect causal paths
3. **Export Graph** (💾) - Download complete causal network
4. **Examples** (📚) - Common causal relationship templates
5. **Visual Feedback** - Real-time weight threshold display

**Adding a Causal Edge:**

1. Click **➕ Add Edge**
2. Define cause event/action
3. Define effect/outcome
4. Set weight (0.0 = weak, 1.0 = strong)
5. Add confidence and context in metadata

**Filtering by Weight:**

Use the **Minimum Edge Weight** slider to:
- Filter out weak relationships
- Focus on strong causal links
- Threshold displayed in real-time (≥ 0.6)
- Identify critical cause-effect pairs

**Causal Path Analysis:**

Click **🔬 Analyze Paths** to:
- Find indirect causal chains (A → B → C)
- Calculate cumulative path weights
- Discover hidden relationships
- Identify intervention points

**Example Use Cases:**
- Marketing: Ad spend → Impressions → Conversions
- Product: Feature → Engagement → Retention
- Operations: Process change → Efficiency → Cost reduction

---

### 🔍 Vector Similarity Search

**Semantic search across all stored vectors**

**How it Works:**

1. Enter natural language query
2. Query is converted to 384-dimensional vector
3. Cosine similarity computed against all stored vectors
4. Results ranked by similarity score
5. Display top matches with metadata

**Search Features:**
- **Configurable Results** - Choose how many matches to return (1-50)
- **Similarity Scores** - See exact match percentages
- **Cross-Collection Search** - Searches patterns, episodes, and vectors
- **Real-Time Results** - Instant search as you type
- **Metadata Display** - View full context of matches

**Usage Example:**

```
Query: "strategies for improving customer retention"

Results:
1. Pattern (95% match): "Implement loyalty program with tiered rewards"
2. Episode (87% match): "Reduced churn by 34% with personalized email"
3. Pattern (82% match): "Focus on high-value customer segments"
```

**Advanced Search:**

Combine vector search with SQL for powerful queries:
```sql
-- Find similar patterns with high confidence
SELECT p.*, v.similarity_score
FROM patterns p
JOIN (
  SELECT entity_id, similarity_score
  FROM vector_search('[1.2, 0.8, ...]', 10)
) v ON p.id = v.entity_id
WHERE json_extract(p.metadata, '$.confidence') > 0.8
ORDER BY v.similarity_score DESC;
```

---

### ⚡ Query Optimizer

**AI-powered SQL query analysis and optimization**

**Diagnostic Features:**

After running a query, the **Diagnostics** tab shows:

1. **Performance Metrics**
   - Execution time in milliseconds
   - Number of rows returned
   - Memory usage estimate

2. **Query Complexity Analysis**
   - Simple: Single table, no joins
   - Medium: Joins or aggregations
   - Complex: Multiple joins, subqueries

3. **Optimization Suggestions**
   - Add indexes on filtered columns
   - Use LIMIT for large result sets
   - Specify columns instead of SELECT *
   - Optimize JOIN order
   - Consider query caching

4. **Best Practices**
   - SQL syntax recommendations
   - Performance tips
   - Security considerations

**Example Diagnostic Output:**

```
✅ Query Performance: GOOD
⏱️  Execution Time: 45ms
📊 Rows Returned: 127
🎯 Complexity: Medium

💡 Optimization Tips:
• Consider adding index on 'reward' column for faster filtering
• Query uses WHERE clause effectively
• Result set is appropriately limited

✨ Best Practices:
• Specific columns selected (good)
• Efficient filtering applied
• No unnecessary joins detected
```

**How to Use:**

1. Write your SQL query
2. Click **▶️ Execute**
3. View results in **Results** tab
4. Switch to **Diagnostics** tab
5. Review performance metrics
6. Implement suggested optimizations
7. Re-run and compare performance

---

### 🏗️ Schema Designer

**Visual table creation and schema management**

**Features:**
- **Visual Column Definition** - Simple textarea format
- **Type Selection** - All SQLite types supported
- **Constraint Management** - PRIMARY KEY, NOT NULL, UNIQUE, etc.
- **SQL Preview** - Review generated SQL before execution
- **Index Design** - Create indexes with visual tools
- **Migration Support** - Track schema changes

**Creating a Table:**

1. Click **🏗️ Schema Designer**
2. Enter table name
3. Define columns (one per line):
   ```
   id INTEGER PRIMARY KEY AUTOINCREMENT
   name TEXT NOT NULL
   email TEXT UNIQUE
   score REAL DEFAULT 0.0
   created_at INTEGER DEFAULT (strftime('%s', 'now'))
   ```
4. Click **👁️ Preview SQL**
5. Review generated CREATE TABLE statement
6. Click **✨ Create Table**

**Supported Column Types:**
- INTEGER, REAL, TEXT, BLOB
- PRIMARY KEY, FOREIGN KEY
- NOT NULL, UNIQUE, DEFAULT
- CHECK constraints
- Auto-increment columns

---

### 💾 Import/Export System

**Complete data portability and backup**

**Export Formats:**

1. **JSON Database Dump**
   - Complete database structure
   - All table data
   - Preserves relationships
   - Easy re-import

2. **SQL Script**
   - CREATE TABLE statements
   - INSERT statements
   - Executable SQL
   - Version control friendly

3. **CSV Data Export**
   - Per-table CSV files
   - Excel-compatible
   - Easy analysis
   - Bulk import support

4. **Standalone HTML**
   - Self-contained IDE copy
   - Embedded data
   - Configuration included
   - Share entire setup

**New Export Functions:**

- **💾 Export Patterns** - All patterns with metadata as JSON
- **💾 Export Episodes** - Complete learning history
- **💾 Export Causal Graph** - Full relationship network
- **💾 Export Query Results** - Current result set

**Import Options:**

- **Batch Import** - Multiple patterns/episodes at once
- **Template Import** - Pre-built examples
- **JSON Import** - Restore from exports
- **SQL Script** - Execute CREATE/INSERT statements

**Backup Strategy:**

1. Regular automatic backups (configurable interval)
2. Manual export before major changes
3. Version-named files with timestamps
4. Keep multiple backup generations

---

### 📟 Diagnostic Console

**Real-time logging and debugging**

**Log Levels:**
- 🔵 **INFO** - General operations and status
- ✅ **SUCCESS** - Successful operations
- ⚠️ **WARNING** - Potential issues, non-critical
- ❌ **ERROR** - Failed operations with details

**Console Features:**
- **Timestamp** - Precise operation timing
- **Color Coding** - Visual severity indicators
- **Export Logs** - Download for analysis
- **Clear History** - Reset console
- **Auto-Scroll** - Follow latest messages
- **Filter by Level** - Show only specific severities

**Example Console Output:**

```
[14:23:45] 🔵 INFO: Database initialized successfully
[14:23:47] ✅ SUCCESS: Executed query in 45ms
[14:23:52] ⚠️ WARNING: Large result set (>1000 rows)
[14:24:10] ❌ ERROR: Failed to parse JSON metadata
```

---

### ⚙️ Advanced Settings

**Customize IDE behavior and performance**

**General Settings:**
- **Database Mode**
  - Memory (volatile, fast)
  - Persistent (IndexedDB, survives refresh)
- **Auto-Save Interval** - 10-300 seconds
- **Auto-Backup** - Automatic periodic exports

**Vector Settings:**
- **Vector Dimensions** - 128-1024 (default: 384)
- **Similarity Threshold** - 0.0-1.0 minimum match
- **Default Search Limit** - 1-100 results

**Performance Settings:**
- **Query Cache Size** - 10-1000 cached queries
- **Enable Query Caching** - Speed up repeated queries
- **Lazy Loading** - Load large datasets on demand

**Advanced Settings:**
- **Debug Level** - Error, Warning, Info, Debug
- **Detailed Logging** - Verbose console output
- **Performance Tracking** - Display timing metrics

---

## 🎨 AgentDB SQL Templates

### Template 1: Query Vectors
```sql
SELECT
  id,
  entity_type,
  entity_id,
  json_extract(metadata, '$.description') as description,
  created_at
FROM vectors
ORDER BY created_at DESC
LIMIT 20;
```
**Use Case:** Browse all vector embeddings with metadata

### Template 2: Query Patterns
```sql
SELECT
  id,
  pattern_type,
  json_extract(metadata, '$.description') as description,
  created_at
FROM patterns
WHERE pattern_type = 'causal'
ORDER BY created_at DESC;
```
**Use Case:** Filter patterns by type with metadata

### Template 3: Query Episodes
```sql
SELECT
  task,
  action,
  reward,
  critique,
  json_extract(metadata, '$.duration') as duration
FROM episodes
WHERE reward > 0.8
ORDER BY reward DESC
LIMIT 10;
```
**Use Case:** Find high-performing learning episodes

### Template 4: Query Causal Edges
```sql
SELECT
  cause,
  effect,
  weight,
  json_extract(metadata, '$.confidence') as confidence
FROM causal_edges
WHERE weight > 0.7
ORDER BY weight DESC;
```
**Use Case:** Analyze strong cause-effect relationships

### Template 5: Semantic Search
```sql
-- Requires embedding vector
SELECT
  p.*,
  v.similarity_score
FROM patterns p
JOIN vector_search_results v ON p.id = v.entity_id
WHERE v.similarity_score > 0.75
ORDER BY v.similarity_score DESC;
```
**Use Case:** Similarity-based pattern matching

### Template 6: Aggregate Statistics
```sql
SELECT
  pattern_type,
  COUNT(*) as pattern_count,
  AVG(json_extract(metadata, '$.confidence')) as avg_confidence
FROM patterns
GROUP BY pattern_type
ORDER BY pattern_count DESC;
```
**Use Case:** Cross-table analytics and metrics

### Template 7: Advanced Joins
```sql
SELECT
  e.task,
  e.reward,
  p.pattern_type,
  ce.weight as causal_strength
FROM episodes e
LEFT JOIN patterns p ON e.task LIKE '%' || json_extract(p.metadata, '$.keyword') || '%'
LEFT JOIN causal_edges ce ON ce.cause LIKE '%' || e.action || '%'
WHERE e.reward > 0.7
ORDER BY e.reward DESC;
```
**Use Case:** Complex multi-table analysis

### Template 8: JSON Metadata
```sql
SELECT
  id,
  json_extract(metadata, '$.domain') as domain,
  json_extract(metadata, '$.confidence') as confidence,
  json_extract(metadata, '$.source') as source
FROM patterns
WHERE json_extract(metadata, '$.confidence') > 0.8
ORDER BY json_extract(metadata, '$.confidence') DESC;
```
**Use Case:** Extract and query nested JSON fields

---

## 💾 Data Management Best Practices

### Export Workflows

**Daily Pattern Export:**
1. Navigate to Patterns panel
2. Click **💾 Export**
3. Save with timestamp: `patterns-2025-10-23.json`
4. Version control or backup

**Episode Archiving:**
1. Filter high-reward episodes (≥ 0.8)
2. Click **💾 Export**
3. Store learning history for analysis
4. Import into analytics tools

**Causal Graph Backup:**
1. Click **💾 Export** in Causal Graph panel
2. Save complete relationship network
3. Document causal discoveries
4. Share with team

### Import Strategies

**Batch Pattern Import:**
1. Prepare JSON file with patterns array
2. Click **⚡ Batch Add** in Patterns
3. Upload or paste JSON
4. Patterns auto-embedded and stored

**Template Library:**
1. Click **📚 Templates** in any panel
2. Browse pre-built examples
3. Select templates to import
4. Customize for your use case

**Sample Data Generation:**
1. Use built-in generator for testing
2. AI-powered realistic data
3. Populate database quickly
4. Experiment with features

---

## 🔧 Advanced Features

### Query Diagnostics Deep Dive

**Performance Metrics Explained:**

- **Execution Time**
  - <50ms: Excellent
  - 50-200ms: Good
  - 200-500ms: Fair
  - >500ms: Needs optimization

- **Query Complexity**
  - Simple: Single table, basic WHERE
  - Medium: Joins, GROUP BY, or ORDER BY
  - Complex: Multiple joins, subqueries, aggregations

**Optimization Strategies:**

1. **Index Creation**
   ```sql
   CREATE INDEX idx_pattern_type ON patterns(pattern_type);
   CREATE INDEX idx_episode_reward ON episodes(reward);
   CREATE INDEX idx_causal_weight ON causal_edges(weight);
   ```

2. **Query Rewriting**
   ```sql
   -- Before: SELECT *
   SELECT * FROM patterns WHERE pattern_type = 'causal';

   -- After: Specific columns
   SELECT id, pattern_type, metadata FROM patterns
   WHERE pattern_type = 'causal';
   ```

3. **Result Limiting**
   ```sql
   -- Always use LIMIT for exploration
   SELECT * FROM episodes ORDER BY reward DESC LIMIT 100;
   ```

### Causal Path Analysis

**Finding Indirect Relationships:**

```sql
-- Find 2-hop causal paths
SELECT
  e1.cause as root_cause,
  e1.effect as intermediate,
  e2.effect as final_effect,
  (e1.weight * e2.weight) as path_strength
FROM causal_edges e1
JOIN causal_edges e2 ON e1.effect = e2.cause
WHERE (e1.weight * e2.weight) > 0.5
ORDER BY path_strength DESC;
```

**Use Cases:**
- Discover hidden causal chains
- Identify indirect impacts
- Find intervention points
- Optimize decision trees

### Trajectory Visualization

**Tracking Learning Progress:**

Episodes can include trajectory sequences:
```json
{
  "task": "Optimize checkout flow",
  "action": "Implement one-click purchase",
  "reward": 0.91,
  "trajectory": "research → prototype → A/B test → deploy → measure",
  "metadata": {
    "steps": 5,
    "duration_days": 14,
    "team_size": 3
  }
}
```

**Analysis Queries:**

```sql
-- Episodes with multi-step trajectories
SELECT
  task,
  reward,
  trajectory,
  length(trajectory) - length(replace(trajectory, '→', '')) + 1 as step_count
FROM episodes
WHERE trajectory IS NOT NULL
ORDER BY reward DESC;
```

---

## 📱 Mobile Support Guide

### Navigation on Mobile

**Hamburger Menu (☰):**
- Tap to open sidebar
- Tap overlay to close
- Swipe gestures supported
- Sticky when scrolling

**Panel Access:**
- All panels mobile-optimized
- Vertical stacking on small screens
- Touch-friendly buttons
- Responsive tables with scroll

### Mobile-Specific Features

**Orientation Support:**
- Portrait: Vertical panel layout
- Landscape: Optimal for SQL editing
- Auto-adjust on rotation

**Touch Gestures:**
- Swipe: Navigate panels
- Long-press: Context menus
- Pinch-zoom: Data tables
- Tap: Select and activate

**Performance:**
- Lazy loading on mobile
- Reduced animations
- Optimized rendering
- Battery-efficient

### Mobile Best Practices

1. **Use landscape** for query editing
2. **Enable auto-save** for reliability
3. **Export frequently** (no persistence guarantee)
4. **Use filters** to reduce data shown
5. **Close sidebar** when viewing results

---

## 🛠️ Development Integration

### Using AgentDB Programmatically

```javascript
// Initialize AgentDB
const db = new AgentDB({
  mode: 'memory',          // or 'persistent'
  vectorDimensions: 384,
  debug: true
});

await db.initializeAsync();

// Store a pattern
await db.storePattern({
  pattern_type: 'optimization',
  embedding: await generateEmbedding("Use caching for frequent queries"),
  metadata: {
    description: "Use caching for frequent queries",
    confidence: 0.89,
    domain: "performance"
  }
});

// Store an episode
await db.storeEpisode({
  task: "Reduce page load time",
  action: "Implement lazy loading for images",
  reward: 0.87,
  critique: "Page load improved by 2.3 seconds",
  trajectory: "analyze → implement → test → deploy",
  metadata: {
    duration_hours: 6,
    baseline_load_time: 4.5,
    optimized_load_time: 2.2
  }
});

// Add causal relationship
await db.addCausalEdge({
  cause: "lazy_loading_images",
  effect: "faster_page_load",
  weight: 0.82,
  metadata: {
    confidence: 0.91,
    sample_size: 10000
  }
});

// Vector similarity search
const queryEmbedding = await generateEmbedding("how to improve performance");
const results = db.searchSimilar(queryEmbedding, 5);

// Execute SQL
const data = db.exec("SELECT * FROM patterns WHERE pattern_type = 'optimization'");
```

### AgentDB Schema Reference

**Core Tables:**

```sql
-- Vectors table (384-dimensional embeddings)
CREATE TABLE vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  embedding BLOB NOT NULL,
  metadata TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Patterns table
CREATE TABLE patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Episodes table
CREATE TABLE episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  action TEXT NOT NULL,
  reward REAL NOT NULL,
  critique TEXT,
  trajectory TEXT,
  metadata TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Causal edges table
CREATE TABLE causal_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cause TEXT NOT NULL,
  effect TEXT NOT NULL,
  weight REAL NOT NULL,
  metadata TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### API Reference

**Full Documentation:** [agentdb.ruv.io/docs](https://agentdb.ruv.io/docs)

**Key Methods:**
- `initializeAsync()` - Initialize database
- `storePattern(pattern)` - Store reasoning pattern
- `storeEpisode(episode)` - Record learning episode
- `addCausalEdge(edge)` - Create causal relationship
- `searchSimilar(embedding, limit)` - Vector similarity search
- `exec(sql)` - Execute SQL query
- `export()` - Export database as JSON

---

## 🐛 Troubleshooting

### Database Issues

**Database Won't Initialize**
- ✅ Check browser console for errors
- ✅ Verify WebAssembly support (required)
- ✅ Clear browser cache and reload
- ✅ Try different database mode (memory vs. persistent)
- ✅ Disable browser extensions that block WASM

**Persistent Mode Not Working**
- ✅ Check IndexedDB support in browser
- ✅ Verify sufficient storage quota
- ✅ Clear IndexedDB data and retry
- ✅ Switch to memory mode temporarily

### Query Problems

**Queries Fail to Execute**
- ✅ Validate SQL syntax (use templates as reference)
- ✅ Check table and column names (case-sensitive)
- ✅ Review error messages in console
- ✅ Use Query Optimizer for analysis
- ✅ Test with simpler query first

**Slow Query Performance**
- ✅ Add indexes on filtered columns
- ✅ Use LIMIT to restrict result size
- ✅ Avoid SELECT * (specify columns)
- ✅ Enable query caching in settings
- ✅ Check Diagnostics tab for tips

### Vector Search Issues

**No Results from Vector Search**
- ✅ Verify vectors exist in database (`SELECT COUNT(*) FROM vectors`)
- ✅ Lower similarity threshold in settings
- ✅ Check vector dimensions match (384)
- ✅ Ensure embeddings are properly stored
- ✅ Try different search query phrasing

**Search Results Seem Irrelevant**
- ✅ Refine search query with specific terms
- ✅ Increase similarity threshold
- ✅ Check pattern/episode metadata
- ✅ Verify embedding quality

### Export/Import Problems

**Export Downloads Empty File**
- ✅ Ensure data exists in database
- ✅ Check browser download permissions
- ✅ Try different export format
- ✅ Review console for errors

**Import Fails**
- ✅ Validate JSON structure
- ✅ Check file encoding (UTF-8)
- ✅ Verify schema matches
- ✅ Import smaller batches

### Mobile Issues

**Sidebar Won't Open**
- ✅ Tap hamburger icon (☰)
- ✅ Check for JavaScript errors
- ✅ Reload page
- ✅ Try different mobile browser

**Performance Lag on Mobile**
- ✅ Enable lazy loading in settings
- ✅ Use filters to reduce data shown
- ✅ Clear browser cache
- ✅ Close other browser tabs
- ✅ Use LIMIT in queries

### General Tips

1. **Check Console** - Most errors show in browser console (F12)
2. **Use Help Buttons** (❓) - Context-sensitive guidance
3. **Start Simple** - Test with templates before custom queries
4. **Export Regularly** - Backup data before experiments
5. **Mobile Performance** - Use landscape mode for best experience

---

## 📊 Use Case Examples

### Marketing Analytics

**Store Campaign Patterns:**
```javascript
await db.storePattern({
  pattern_type: 'optimization',
  metadata: {
    description: "Email subject lines with numbers increase open rates by 20%",
    domain: "marketing",
    confidence: 0.87
  }
});
```

**Track Campaign Episodes:**
```javascript
await db.storeEpisode({
  task: "Increase email open rate",
  action: "Added urgency + number in subject line",
  reward: 0.84,
  critique: "Open rate improved from 18% to 22%",
  metadata: {
    list_size: 50000,
    control_open_rate: 0.18,
    test_open_rate: 0.22
  }
});
```

**Map Causal Relationships:**
```javascript
await db.addCausalEdge({
  cause: "subject_line_personalization",
  effect: "higher_open_rate",
  weight: 0.79,
  metadata: {
    confidence: 0.88,
    sample_size: 100000
  }
});
```

### Product Development

**Feature Impact Analysis:**
```sql
SELECT
  ce.cause as feature,
  ce.effect as metric,
  ce.weight as impact,
  e.reward as performance
FROM causal_edges ce
LEFT JOIN episodes e ON e.action LIKE '%' || ce.cause || '%'
WHERE ce.weight > 0.7
ORDER BY ce.weight DESC;
```

**Learning from Past Decisions:**
```sql
SELECT
  task,
  action,
  reward,
  critique
FROM episodes
WHERE task LIKE '%user retention%'
  AND reward > 0.8
ORDER BY reward DESC;
```

### Operations Optimization

**Process Improvement Patterns:**
```sql
SELECT
  json_extract(metadata, '$.description') as improvement,
  json_extract(metadata, '$.time_saved_hours') as time_saved,
  pattern_type
FROM patterns
WHERE pattern_type = 'optimization'
  AND json_extract(metadata, '$.domain') = 'operations'
ORDER BY json_extract(metadata, '$.time_saved_hours') DESC;
```

---

## 🚀 Performance Tips

### Database Optimization

**Create Strategic Indexes:**
```sql
-- Index frequently filtered columns
CREATE INDEX idx_pattern_type ON patterns(pattern_type);
CREATE INDEX idx_episode_reward ON episodes(reward);
CREATE INDEX idx_causal_weight ON causal_edges(weight);

-- Index JSON fields (SQLite 3.38+)
CREATE INDEX idx_pattern_confidence ON patterns(
  json_extract(metadata, '$.confidence')
);
```

**Query Best Practices:**
1. Always use LIMIT for exploration
2. Specify columns instead of SELECT *
3. Use WHERE before ORDER BY
4. Prefer indexed columns in filters
5. Enable query caching for repeated queries

### UI Performance

**Settings for Better Performance:**
- Enable Query Caching (10-1000 cached queries)
- Enable Lazy Loading for large datasets
- Reduce Auto-Save interval (60+ seconds)
- Use Memory mode for fastest access

**Mobile Optimization:**
- Use filters to reduce displayed data
- Close sidebar when not needed
- Enable lazy loading
- Limit query results (LIMIT 50)

### Browser Compatibility

**Supported Browsers:**
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers with WASM support

**Required Features:**
- WebAssembly (WASM)
- IndexedDB (for persistent mode)
- ES6+ JavaScript
- CSS Grid/Flexbox

---

## 📄 License & Credits

### License

This IDE is part of the **AgentDB project** and follows the same license terms.

**AgentDB v1.3.9** - MIT License

### Credits

**Built with:**
- AgentDB v1.3.9 - SQL-based agentic memory
- SQL.js - SQLite compiled to WebAssembly
- Native JavaScript - Zero framework dependencies
- Modern CSS - Grid, Flexbox, CSS Variables

**Created by:** The Agentic Flow Team

**Special Thanks:**
- SQL.js and WebAssembly community
- SQLite development team
- Open-source contributors

### Links

- 🏠 **Homepage:** [agentdb.ruv.io](https://agentdb.ruv.io)
- 📦 **NPM:** [npmjs.com/package/agentdb](https://www.npmjs.com/package/agentdb)
- 💻 **GitHub:** [github.com/ruvnet/agentic-flow](https://github.com/ruvnet/agentic-flow/tree/main/packages/agentdb)
- 📚 **Documentation:** [agentdb.ruv.io/docs](https://agentdb.ruv.io/docs)
- 🐛 **Issues:** [GitHub Issues](https://github.com/ruvnet/agentic-flow/issues)

---

## 🎓 Learn More

### Tutorials

**Getting Started (5 min):**
1. Open IDE → SQL Editor
2. Click template: "Query Vectors"
3. Execute to see sample data
4. Explore other panels

**Pattern Management (10 min):**
1. Navigate to Patterns panel
2. Click "Templates" for examples
3. Add your first custom pattern
4. Try vector search to find similar

**Episode Tracking (15 min):**
1. Go to Episodes panel
2. Review pre-built examples
3. Record your first episode
4. Use reward filter to analyze

**Advanced Features (30 min):**
1. Master query diagnostics
2. Export and import workflows
3. Causal path analysis
4. Mobile optimization

### Video Guides

Coming soon to [agentdb.ruv.io/tutorials](https://agentdb.ruv.io/tutorials)

### Community

- Join discussions on GitHub
- Share patterns and templates
- Contribute improvements
- Report bugs and suggestions

---

**AgentDB Management IDE v2.0** - Intelligent data management meets AI-powered learning.

Built with ❤️ for developers, data scientists, and AI researchers.

Visit [agentdb.ruv.io](https://agentdb.ruv.io) to explore the future of agentic databases.
