# Causal Path Analysis Feature

## Quick Start

1. Open the AgentDB Management IDE (`index.html`)
2. Navigate to the "Causal Graph" tab
3. Click the "🔬 Analyze Paths" button
4. Configure your analysis parameters
5. Click one of the analysis buttons

## Features

### 1. Find Paths 🔍
Discover direct and indirect causal relationships between nodes.

**Options:**
- **Start Node**: Filter paths beginning at a specific cause
- **End Node**: Filter paths ending at a specific effect
- **Max Depth**: Control how many hops to traverse (1-5)

**Example:**
```
Input: Start="exercise", End="health_score", Depth=3
Output:
  Path 1: exercise → (0.9) calories_burned → (0.8) health_score [72%]
  Path 2: exercise → (0.7) stress_level → (0.6) health_score [42%]
```

### 2. Detect Cycles 🔄
Find feedback loops and circular dependencies in your causal model.

**Why it matters:**
- Validates causal model integrity
- Identifies reinforcing/dampening loops
- Warns about potential infinite recursion

**Example:**
```
Cycle detected: A → B → C → A
Strength: 36% (weak feedback loop)
```

### 3. Strongest Chains 💪
Rank all causal paths by their cumulative strength.

**Use cases:**
- Prioritize interventions
- Focus on high-confidence relationships
- Identify most impactful causal chains

**Example:**
```
Top 3 Strongest Chains:
1. training → skill_level → performance [81%]
2. sleep → energy → productivity [76%]
3. diet → health → longevity [68%]
```

### 4. Analyze All 🌐
Comprehensive analysis with statistics dashboard.

**Includes:**
- Total nodes and edges count
- All discovered paths
- Cycle detection warnings
- Average path strength
- Top 10 strongest paths

## File Structure

```
management-ide/
├── index.html              # Main IDE (includes modal)
├── causal-analysis.js      # Path analysis algorithms
├── test-causal-analysis.html  # Test suite
└── README-causal-analysis.md  # This file
```

## API Reference

### Core Functions

#### `buildCausalGraph()`
Reads causal edges from database and constructs adjacency list.
```javascript
Returns: {
  graph: Object,   // Adjacency list representation
  nodes: Array,    // All unique nodes
  edges: Array     // Original edge data
}
```

#### `findCausalPaths(startNode, endNode, maxDepth)`
Discovers all paths using depth-first search.
```javascript
Parameters:
  startNode: string | null  // Starting node (null = all nodes)
  endNode: string | null    // Target node (null = all nodes)
  maxDepth: number          // Maximum path length (1-5)

Returns: Array<{
  path: string[],      // Ordered list of nodes
  strength: number,    // Cumulative weight (0-1)
  length: number       // Number of edges
}>
```

#### `detectCausalCycles()`
Finds all feedback loops in the graph.
```javascript
Returns: Array<{
  path: string[],      // Cycle path (first = last)
  strength: number     // Cumulative loop strength
}>
```

#### `rankCausalChains(topN)`
Returns strongest causal paths.
```javascript
Parameters:
  topN: number  // Number of top chains to return

Returns: Array<Path>  // Sorted by strength (descending)
```

### UI Functions

#### `analyzeCausalPaths()`
Opens the analysis modal.

#### `closeCausalAnalysis()`
Closes the analysis modal.

#### `runPathAnalysis()`
Executes path finding based on modal inputs.

#### `detectCycles()`
Runs cycle detection and displays results.

#### `findStrongestChains()`
Finds and displays top 20 strongest paths.

#### `analyzeAllPaths()`
Performs comprehensive analysis with statistics.

## Algorithm Details

### Path Strength Calculation
Cumulative strength uses **multiplicative** approach:
```
Path: A → (0.9) B → (0.8) C
Strength: 0.9 × 0.8 = 0.72 (72%)
```

This is conservative - strength decreases with path length, reflecting growing uncertainty in indirect relationships.

### Cycle Detection Algorithm
Uses DFS with recursion stack:
1. Traverse graph maintaining recursion stack
2. If we encounter a node in recursion stack → cycle detected
3. Extract cycle path from recursion stack
4. Calculate cycle strength (product of edge weights)
5. Remove duplicate cycles (normalize and dedupe)

### Complexity
- **Path Finding**: O(N × M^D)
  - N = number of nodes
  - M = average edges per node
  - D = max depth
- **Cycle Detection**: O(N + E)
  - E = total edges

## Testing

Run the test suite by opening `test-causal-analysis.html` in a browser.

**Tests include:**
1. Graph building from edge data
2. Path finding (A → C with multiple routes)
3. Cycle detection (A → B → C → A)
4. Path formatting and display

## Color Coding

Results use color-coded strength indicators:

| Strength | Color | Meaning |
|----------|-------|---------|
| >70% | 🟢 Green | Strong causal relationship |
| 40-70% | 🟡 Orange | Moderate relationship |
| <40% | ⚪ Gray | Weak relationship |

## Examples

### Example 1: Health Analysis
```
Causal edges:
- exercise → calories_burned (0.9)
- calories_burned → weight_loss (0.8)
- weight_loss → health_score (0.7)

Analysis:
Direct path: exercise → calories_burned [90%]
Indirect path: exercise → calories_burned → weight_loss [72%]
Full chain: exercise → ... → health_score [50%]
```

### Example 2: Learning System
```
Causal edges:
- study → knowledge (0.8)
- knowledge → test_score (0.9)
- test_score → confidence (0.7)
- confidence → study (0.6)  # Feedback loop!

Analysis:
Strongest chain: study → knowledge → test_score [72%]
Cycle detected: study → knowledge → test_score → confidence → study [30%]
Warning: Positive feedback loop (self-reinforcing)
```

## Tips

1. **Start with small max depth** (2-3) for faster results
2. **Use specific start/end nodes** to focus analysis
3. **Check for cycles** before making causal inferences
4. **Examine strongest chains** to prioritize interventions
5. **Run comprehensive analysis** for complete overview

## Limitations

1. **Performance**: Large graphs (>100 nodes) may be slow at depth 5
2. **Path explosion**: Densely connected graphs generate many paths
3. **No temporal ordering**: Assumes static causal structure
4. **Weight interpretation**: Assumes multiplicative relationship

## Future Enhancements

- [ ] Export results to CSV/JSON
- [ ] Graph visualization (D3.js integration)
- [ ] Path comparison tool
- [ ] Temporal analysis support
- [ ] Confidence intervals
- [ ] Interactive path selection
- [ ] Batch analysis
- [ ] Custom strength calculation methods

## Support

For issues or questions:
1. Check test suite (`test-causal-analysis.html`)
2. Review implementation docs (`/docs/causal-analysis-implementation.md`)
3. Open browser console for detailed logs
4. Verify database has `causal_edges` table

## License

Part of AgentDB Management IDE
MIT License
