# Pattern Enhancements - Quick Reference Card

## 🚀 Quick Start (30 seconds)

```bash
# 1. Include files in HTML
<link rel="stylesheet" href="pattern-enhancements.css">
<script src="pattern-enhancements.js"></script>
<script src="pattern-sample-data.js"></script>

# 2. Generate sample data (in browser console)
addSamplePatternsToIDE()

# 3. Start using!
```

## 🎯 Common Tasks

### Filter Patterns
```javascript
// By type
document.getElementById('pattern-type-filter').value = 'causal';
applyPatternFilters();

// By date
document.getElementById('pattern-date-from').value = '2024-01-01';
applyPatternFilters();

// By search
document.getElementById('pattern-search').value = 'optimization';
applyPatternFilters();

// Clear all filters
resetPatternFilters();
```

### Switch Views
```javascript
togglePatternView('grid');  // Grid view
togglePatternView('list');  // List view
```

### Bulk Operations
```javascript
// Enable bulk select
document.getElementById('bulk-select-toggle').checked = true;
toggleBulkSelect();

// Select patterns
togglePatternSelection(1);
togglePatternSelection(2);

// Delete selected
bulkDeletePatterns();
```

### Analytics
```javascript
// Show dashboard
showPatternAnalytics();

// Export report
exportAnalytics();

// Show graph
showPatternGraph();
```

### Pattern Operations
```javascript
// Duplicate
duplicatePattern(patternId);

// Delete
deletePattern(patternId);

// View details
viewPattern(patternId);
```

## 📊 Key Functions

| Function | Purpose |
|----------|---------|
| `applyPatternFilters()` | Apply current filters |
| `resetPatternFilters()` | Clear all filters |
| `togglePatternView(mode)` | Switch view mode |
| `refreshPatterns()` | Reload patterns |
| `showPatternAnalytics()` | Show analytics |
| `bulkDeletePatterns()` | Delete selected |
| `duplicatePattern(id)` | Duplicate pattern |

## 🎨 CSS Classes

| Class | Purpose |
|-------|---------|
| `.patterns-list-view` | List view container |
| `.patterns-grid-view` | Grid view container |
| `.pattern-card-grid` | Grid view card |
| `.tag` | Tag badge |
| `.btn-icon` | Icon button |

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Navigate elements |
| `Enter` | Activate button |
| `Space` | Toggle checkbox |
| `Esc` | Close modal |

## 🔧 Customization

### Add Pattern Type
```html
<option value="your-type">Your Type</option>
```

### Custom Styling
```css
:root {
  --pattern-card-bg: #ffffff;
  --pattern-primary-color: #4A90E2;
}
```

### Custom Analytics
```javascript
function calculatePatternAnalytics(patterns) {
  return {
    ...standardMetrics,
    customMetric: yourCalculation(patterns)
  };
}
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Filters not working | Check console, call `applyPatternFilters()` |
| Analytics empty | Ensure patterns have metadata |
| View not switching | Clear cache, check CSS loaded |

## 📱 Mobile Support

- Touch-friendly controls
- Responsive layouts
- Simplified filters
- Quick actions always visible

## ♿ Accessibility

- Keyboard navigation: ✅
- Screen readers: ✅
- High contrast: ✅
- Reduced motion: ✅

## 📞 Quick Help

- Docs: `/PATTERN_ENHANCEMENTS_README.md`
- Integration: `/PATTERN_ENHANCEMENTS_INTEGRATION.md`
- Sample Data: `addSamplePatternsToIDE()`
- Console Help: `window.patternEnhancements`

## 🎯 Pro Tips

1. Use **grid view** for visual scanning
2. Enable **bulk select** for mass operations
3. Check **analytics** regularly for insights
4. Use **tags** to organize patterns
5. **Export** data for backup

---

**Keep this card handy for quick reference!**
