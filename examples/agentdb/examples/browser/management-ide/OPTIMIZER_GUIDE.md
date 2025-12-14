# Query Optimizer - User Guide

## Quick Start

The Query Optimizer is a comprehensive SQL optimization workbench designed specifically for AgentDB. Access it from the left navigation panel under "⚡ Optimizer".

## Features Overview

### 1. Analyze Tab (Default)
**Deep query analysis with comprehensive metrics**

#### How to Use:
1. Paste your SQL query in the text area
2. Click "⚡ Deep Analysis" for full analysis
3. Click "🔍 Quick Check" for fast anti-pattern detection
4. Click "⏱️ Benchmark" to measure actual performance

#### What You Get:
- **Performance Metrics**: Execution time, scan type, complexity score
- **Execution Plan**: Step-by-step query execution visualization
- **Anti-Patterns**: Common mistakes detected (N+1 queries, missing indexes, etc.)
- **Optimization Suggestions**: Prioritized recommendations (High/Medium/Low)
- **AgentDB-Specific Tips**: Vector, pattern, and causal query optimizations
- **Optimized Query**: Auto-generated improved version

#### Example Workflow:
```sql
-- Original Query
SELECT * FROM vectors WHERE embedding IS NOT NULL

-- Click "Deep Analysis"
-- Results:
-- ⚡ Full table scan detected
-- 📊 Replace SELECT * with specific columns
-- 🎯 Add LIMIT clause
-- ✨ Optimized Query provided with one-click apply
```

### 2. Compare Tab
**Side-by-side performance comparison**

#### How to Use:
1. Enter original query in left panel
2. Enter optimized query in right panel
3. Click "⚖️ Run Comparison"
4. Review performance improvement percentage

#### What You Get:
- Average execution time for both queries
- Performance improvement percentage
- Detailed metrics (min, max, std deviation)
- Visual comparison indicators
- 10-run benchmark for accuracy

#### Example:
```
Original: 125.5ms
Optimized: 45.2ms
Improvement: 64% faster! 🎉
```

### 3. Library Tab
**Pre-optimized query templates**

#### Available Templates:
1. **Efficient Vector Search** - Optimized vector similarity queries
2. **Pattern Matching with Index** - Fast pattern type filtering
3. **Causal Path Analysis** - Recursive edge traversal
4. **Optimized JOIN Query** - Multi-table joins with filtering
5. **Aggregate with Grouping** - Efficient aggregations
6. **JSON Metadata Search** - Optimized JSON field extraction

#### How to Use:
1. Browse templates or use search
2. Filter by category (Vectors, Patterns, Causal, Joins, Aggregates)
3. Click "📋 Use Template" to load into Analyze tab
4. Click "💡 Tips" to see optimization advice

#### Template Structure:
- **Query**: Ready-to-use optimized SQL
- **Description**: What the query does
- **Tips**: 3-4 specific optimization recommendations
- **Category**: Type of query (for filtering)

### 4. Wizard Tab
**Interactive step-by-step optimization**

#### 3-Step Process:
1. **Select Query Type**:
   - 🔢 Vector Search
   - 🧩 Pattern Match
   - 🔗 Causal Query
   - 🔀 Complex Join
   - 📊 Aggregation
   - 📝 Other

2. **Choose Performance Goal**:
   - ⚡ Reduce execution time
   - 💾 Reduce memory usage
   - 🎯 Improve result accuracy
   - 📈 Improve scalability

3. **Apply Optimizations**:
   - Checklist of specific recommendations
   - Select which to apply
   - One-click implementation

## Key Features Explained

### Auto-Optimize Checkbox
**Location**: Analyze tab, top right
**Function**: Automatically applies safe optimizations after analysis
**Safe Optimizations**:
- Adding LIMIT clauses
- Replacing IN (SELECT with EXISTS
- Basic query formatting

### Format SQL Button
**Location**: Analyze tab, query input
**Function**: Auto-formats SQL with proper indentation
**Formatting**:
- Separates SELECT, FROM, WHERE, JOIN on new lines
- Preserves query logic
- Improves readability

### Load from Editor
**Location**: Analyze tab, actions row
**Function**: Copies query from main SQL Editor
**Use Case**: Optimize queries you're working on in the editor

## Optimization Recommendations Guide

### High Priority (🔴)
**Critical issues that significantly impact performance**
- Full table scans without indexes
- Missing indexes on filter columns
- Unindexed JOIN columns
- Subqueries that should be JOINs

**Action**: Address these first for maximum performance gain

### Medium Priority (🟡)
**Optimization opportunities**
- SELECT * instead of specific columns
- Missing LIMIT clauses
- Suboptimal JOIN order
- Inefficient ORDER BY

**Action**: Apply when optimizing for production

### Low Priority (🔵)
**Best practice improvements**
- UNION instead of UNION ALL
- Unnecessary DISTINCT
- Minor query structure improvements

**Action**: Apply for code quality and maintainability

## AgentDB-Specific Optimizations

### Vector Queries
**Common Issues**:
- Not filtering with LIMIT
- Selecting all columns instead of needed ones
- Missing NULL checks on embeddings

**Best Practices**:
```sql
-- Good
SELECT id, metadata, created_at
FROM vectors
WHERE embedding IS NOT NULL
ORDER BY LENGTH(embedding) ASC
LIMIT 10;

-- Avoid
SELECT * FROM vectors;
```

### Pattern Queries
**Common Issues**:
- Not indexing pattern_type
- Not filtering by confidence
- Selecting unnecessary data

**Best Practices**:
```sql
-- Good
SELECT id, pattern_type, metadata
FROM patterns
WHERE pattern_type = 'causal'
  AND json_extract(metadata, '$.confidence') >= 0.8
ORDER BY created_at DESC
LIMIT 20;

-- Avoid
SELECT * FROM patterns;
```

### Causal Queries
**Common Issues**:
- Unlimited recursion depth
- Not filtering by weight
- Missing index on cause/effect columns

**Best Practices**:
```sql
-- Good
SELECT ce.id, ce.cause, ce.effect, ce.metadata
FROM causal_edges ce
WHERE json_extract(ce.metadata, '$.weight') >= 0.5
ORDER BY json_extract(ce.metadata, '$.weight') DESC
LIMIT 50;

-- Avoid
SELECT * FROM causal_edges;
```

### JSON Metadata
**Common Issues**:
- Multiple json_extract on same field
- Not using indexes
- Inefficient filtering

**Best Practices**:
```sql
-- Good
SELECT
  id,
  json_extract(metadata, '$.type') as type,
  json_extract(metadata, '$.description') as description
FROM vectors
WHERE json_extract(metadata, '$.type') = 'semantic'
LIMIT 50;

-- Consider creating virtual columns for frequently accessed fields
```

## Performance Benchmarking

### Benchmark Metrics Explained:
- **Average Time**: Mean execution time over 10 runs
- **Min Time**: Fastest execution (best case)
- **Max Time**: Slowest execution (worst case)
- **Std Dev**: Consistency indicator (lower = more consistent)

### When to Benchmark:
- Before and after optimizations
- When comparing query alternatives
- Testing index effectiveness
- Production query validation

### Interpreting Results:
- **< 10ms**: Excellent performance
- **10-50ms**: Good performance
- **50-100ms**: Acceptable, consider optimization
- **> 100ms**: Needs optimization

## Common Anti-Patterns

### 1. N+1 Query Pattern
**Problem**: Using IN (SELECT...) creates multiple queries
**Solution**: Use JOIN instead
```sql
-- Bad
SELECT * FROM episodes WHERE id IN (SELECT episode_id FROM patterns);

-- Good
SELECT e.* FROM episodes e
INNER JOIN patterns p ON e.id = p.episode_id;
```

### 2. NOT IN with NULLs
**Problem**: NOT IN behaves unexpectedly with NULL values
**Solution**: Use NOT EXISTS or LEFT JOIN
```sql
-- Bad
SELECT * FROM episodes WHERE id NOT IN (SELECT episode_id FROM patterns);

-- Good
SELECT e.* FROM episodes e
LEFT JOIN patterns p ON e.id = p.episode_id
WHERE p.id IS NULL;
```

### 3. LIKE with Leading Wildcard
**Problem**: Prevents index usage
**Solution**: Avoid leading wildcards or use full-text search
```sql
-- Bad
SELECT * FROM vectors WHERE metadata LIKE '%search%';

-- Better
SELECT * FROM vectors WHERE metadata LIKE 'search%';
```

### 4. Functions on Indexed Columns
**Problem**: Prevents index usage
**Solution**: Use indexed columns directly
```sql
-- Bad
SELECT * FROM episodes WHERE UPPER(task) = 'IMPORTANT';

-- Good
SELECT * FROM episodes WHERE task = 'important';
```

### 5. Multiple ORs in WHERE
**Problem**: Can prevent index usage
**Solution**: Use UNION or separate queries
```sql
-- Bad
SELECT * FROM patterns WHERE type = 'A' OR type = 'B' OR type = 'C';

-- Good
SELECT * FROM patterns WHERE type IN ('A', 'B', 'C');
```

## Tips for Best Performance

### 1. Always Use LIMIT
- Prevents loading excessive data
- Especially important for large tables
- Use pagination for large result sets

### 2. Index Wisely
- Index columns used in WHERE clauses
- Index JOIN columns
- Index ORDER BY columns
- Don't over-index (slows writes)

### 3. Select Specific Columns
- Avoid SELECT *
- Only select what you need
- Reduces data transfer
- Improves cache efficiency

### 4. Filter Early
- Apply WHERE clauses before JOIN
- Use subqueries to pre-filter
- Reduce data processed in later stages

### 5. Use Appropriate JOIN Types
- INNER JOIN when possible (fastest)
- LEFT JOIN only when needed
- Avoid FULL OUTER JOIN
- Put smallest table first

## Keyboard Shortcuts

- **Ctrl/Cmd + Enter**: Run analysis (when focused on query input)
- **Ctrl/Cmd + K**: Format SQL
- **Escape**: Close modals/overlays

## Troubleshooting

### Analysis Fails
**Causes**:
- Invalid SQL syntax
- Table doesn't exist
- Missing permissions

**Solution**: Check query syntax and table names

### Slow Benchmark
**Causes**:
- Large result set
- Complex query
- No indexes

**Solution**: Add LIMIT clause, create indexes

### No Suggestions
**Causes**:
- Query already optimized
- Simple query with no issues

**Solution**: Query is likely fine!

## Best Practices Summary

1. ✅ Always add LIMIT clauses
2. ✅ Index filter and JOIN columns
3. ✅ Select specific columns, not *
4. ✅ Use appropriate JOIN types
5. ✅ Filter before joining
6. ✅ Avoid leading wildcards in LIKE
7. ✅ Don't use functions on indexed columns
8. ✅ Test with benchmarks
9. ✅ Monitor query complexity
10. ✅ Use templates as starting points

## Getting Help

### Built-in Help
- Click "❓ Help" button in any panel
- Hover over buttons for tooltips
- Check template tips for guidance

### Common Questions
**Q: Why isn't my query optimizing?**
A: Some queries are already optimal. Check the complexity score and suggestions.

**Q: Should I apply all suggestions?**
A: Start with high-priority suggestions. Test each change with benchmarks.

**Q: How do I know if optimization worked?**
A: Use the Compare tab to measure before/after performance.

**Q: Can I save my optimized queries?**
A: Use the main editor's "Save Query" feature after applying optimizations.

## Advanced Usage

### Combining Features
1. Start with Wizard for guidance
2. Use Library templates as base
3. Analyze in Analyze tab
4. Compare original vs optimized
5. Apply and test in main editor

### Custom Templates
- Modify library templates for your needs
- Save frequently used patterns
- Build your own optimization library

### Performance Monitoring
- Regularly benchmark production queries
- Track performance over time
- Identify degradation early

---

**Remember**: The best optimization is the one that solves your specific performance problem. Use this tool to understand, test, and validate your optimizations!
