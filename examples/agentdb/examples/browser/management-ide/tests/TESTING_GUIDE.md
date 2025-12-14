# AgentDB Management IDE - Testing Guide

**Version:** 1.0
**Last Updated:** 2025-10-23
**Maintained By:** QA Team

---

## Table of Contents

1. [Introduction](#introduction)
2. [Testing Setup](#testing-setup)
3. [Test Execution Procedures](#test-execution-procedures)
4. [Testing Best Practices](#testing-best-practices)
5. [Tools and Resources](#tools-and-resources)
6. [Reporting Issues](#reporting-issues)
7. [Regression Testing](#regression-testing)
8. [Automation Recommendations](#automation-recommendations)

---

## Introduction

This guide provides comprehensive instructions for testing the AgentDB Management IDE. It's designed for:
- QA engineers conducting manual testing
- Developers testing their own changes
- Contributors validating pull requests
- Anyone performing quality assurance

### Testing Philosophy
- **Test-first mindset:** Tests should guide development
- **Comprehensive coverage:** Test happy paths and edge cases
- **User-centric:** Test from user perspective
- **Performance-aware:** Monitor performance during testing
- **Documentation:** Record all findings thoroughly

---

## Testing Setup

### Prerequisites

#### Required Software
- Modern web browser (recommended: Chrome, Firefox, Safari, or Edge)
- Browser DevTools knowledge
- Text editor for documentation
- Screenshot tool

#### Optional Tools
- Browser extensions disabled (for clean testing)
- Network throttling tools (for performance testing)
- Mobile device or emulator (for mobile testing)
- Screen recording software (for bug reproduction)

### Environment Preparation

#### 1. Browser Setup
```bash
# Clear browser cache
# Chrome: Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)
# Select "All time" and clear:
- Browsing history
- Cookies and other site data
- Cached images and files
```

#### 2. Open Application
```bash
# Navigate to:
file:///workspaces/agentdb-site/public/agentdb/examples/browser/management-ide/index.html

# Or use a local server:
cd /workspaces/agentdb-site/public/agentdb/examples/browser/management-ide
python3 -m http.server 8000
# Then open: http://localhost:8000
```

#### 3. Open DevTools
```bash
# Press F12 or:
# Chrome/Edge: Ctrl+Shift+I (Cmd+Option+I on Mac)
# Firefox: Ctrl+Shift+I (Cmd+Option+I on Mac)
# Safari: Cmd+Option+I (enable Developer menu first)
```

#### 4. DevTools Configuration
- **Console Tab:** Monitor logs, errors, warnings
- **Network Tab:** Track requests, responses, performance
- **Application Tab:** Inspect LocalStorage, IndexedDB
- **Performance Tab:** Record performance profiles
- **Device Toolbar:** Test responsive design (Ctrl+Shift+M)

---

## Test Execution Procedures

### Step 1: Pre-Test Verification

Before starting any test suite:

1. **Verify Clean State**
   - Fresh browser session
   - Cache cleared
   - LocalStorage empty (check DevTools > Application > Local Storage)
   - No console errors on load

2. **Initial Load Test**
   - Navigate to application
   - Verify page loads without errors
   - Check console for initialization messages
   - Confirm database initializes successfully

3. **Baseline Screenshot**
   - Capture initial state
   - Document browser version
   - Note operating system
   - Record screen resolution

### Step 2: Systematic Test Execution

#### Functional Testing Workflow

**A. Navigation Tests**
```
1. Click each navigation item in order:
   - SQL Editor
   - Data Browser
   - Patterns
   - Episodes
   - Causal Graph
   - Vector Search
   - Query Optimizer

2. For each view:
   ✓ View displays correctly
   ✓ Active state highlighted
   ✓ Previous view deactivated
   ✓ No console errors
   ✓ Content loads properly

3. Record results in TEST_RESULTS.md
```

**B. Modal Testing Workflow**
```
1. Identify all modal triggers:
   - Settings (⚙️)
   - Help (❓)
   - Import/Export (💾)
   - Sample Data (🎲)
   - Schema Designer (🏗️)
   - Add Pattern (➕)
   - Add Episode (➕)
   - Add Causal Edge (➕)
   - Trajectory View (📈)
   - Causal Analysis (🔬)
   - Batch Import (⚡)

2. For each modal:
   ✓ Click trigger button
   ✓ Modal appears with correct content
   ✓ Backdrop overlay displays
   ✓ Close via X button
   ✓ Close via Cancel button
   ✓ Close via backdrop click
   ✓ Modal properly removed from DOM
   ✓ No memory leaks

3. Test modal z-index stacking
4. Test multiple modal opens (if applicable)
```

**C. Form Testing Workflow**
```
1. Locate all forms:
   - SQL query editor
   - Add pattern form
   - Add episode form
   - Add causal edge form
   - Vector search form
   - Settings form
   - Schema designer form

2. For each form:
   a. Valid Input Test:
      - Fill all required fields with valid data
      - Submit form
      - Verify success message
      - Check database for new record
      - Verify data in relevant view

   b. Invalid Input Test:
      - Leave required fields empty
      - Enter invalid data types
      - Test field validation
      - Verify error messages
      - Ensure form doesn't submit

   c. Edge Case Test:
      - Maximum length inputs
      - Minimum values
      - Special characters
      - Unicode characters
      - SQL/XSS injection attempts
```

**D. CRUD Operations Testing**
```
1. CREATE (Add/Insert):
   - Add pattern via modal
   - Insert data via SQL
   - Generate sample data
   - Verify in database

2. READ (View/Query):
   - View in data browser
   - Query via SQL editor
   - Search via vector search
   - Filter by criteria

3. UPDATE (Edit/Modify):
   - Update via SQL
   - Modify settings
   - Edit configurations

4. DELETE (Remove):
   - Delete via SQL
   - Clear data
   - Reset database
```

### Step 3: Feature-Specific Testing

#### Patterns Management
```
1. Navigate to Patterns view
2. Click "Add Pattern" button
3. Fill form:
   - Pattern Type: [select from dropdown]
   - Name: "Test Pattern"
   - Description: "Test description"
   - Data: Valid JSON/text
4. Submit form
5. Verify pattern appears in list
6. Test filter by pattern type
7. Test export patterns (JSON, CSV)
8. Test batch import
9. Test pattern help modal
10. Test pattern search
```

#### Episodes Management
```
1. Navigate to Episodes view
2. Add new episode
3. Test reward threshold slider
4. Filter episodes by threshold
5. View episode trajectory
6. Verify trajectory chart displays
7. Test episode comparison
8. Export episodes
9. Verify episode statistics
```

#### Causal Graph
```
1. Navigate to Causal Graph view
2. Add causal edges
3. Test weight filter
4. View graph visualization
5. Run path analysis
6. Test cycle detection
7. Export causal graph
8. Verify graph statistics
```

#### Vector Search
```
1. Navigate to Vector Search view
2. Enter search query
3. Adjust similarity threshold
4. Execute search
5. Verify results ranking
6. Check similarity scores
7. Test search history
8. Clear search
```

#### Query Optimizer
```
1. Navigate to Query Optimizer view
2. Enter SQL query or load from editor
3. Click "Analyze Query"
4. Review optimization suggestions
5. Check performance metrics
6. Apply optimizations
7. Compare before/after
8. Test index recommendations
```

### Step 4: Performance Testing

#### Page Load Performance
```
1. Open DevTools > Network tab
2. Enable "Disable cache"
3. Reload page (Ctrl+Shift+R)
4. Measure:
   - DOMContentLoaded time
   - Load time
   - Number of requests
   - Total transfer size
5. Target: Page load <3 seconds
```

#### Query Performance
```
1. Open DevTools > Console
2. Run test queries:

   Simple SELECT:
   console.time('simple');
   SELECT * FROM patterns LIMIT 100;
   console.timeEnd('simple');
   Target: <100ms

   Complex JOIN:
   console.time('complex');
   SELECT * FROM patterns p
   JOIN episodes e ON p.id = e.pattern_id;
   console.timeEnd('complex');
   Target: <500ms

3. Record execution times
```

#### Memory Profiling
```
1. DevTools > Performance > Memory
2. Click "Record"
3. Perform operations:
   - Add 100 patterns
   - Switch views multiple times
   - Open/close modals
   - Execute queries
4. Stop recording
5. Analyze:
   - Heap size growth
   - Memory leaks
   - GC activity
```

#### UI Responsiveness
```
1. DevTools > Performance
2. Record while:
   - Switching tabs
   - Opening modals
   - Scrolling long lists
   - Filtering data
3. Check for:
   - 60fps frame rate
   - No long tasks (>50ms)
   - Smooth animations
```

### Step 5: Mobile/Responsive Testing

#### Responsive Layout Testing
```
1. DevTools > Device Toolbar (Ctrl+Shift+M)
2. Test viewports:
   - Mobile: 375x667 (iPhone SE)
   - Mobile: 390x844 (iPhone 12 Pro)
   - Tablet: 768x1024 (iPad)
   - Tablet: 820x1180 (iPad Air)
   - Desktop: 1920x1080
   - Desktop: 2560x1440

3. For each viewport:
   ✓ Layout adjusts correctly
   ✓ No horizontal scroll
   ✓ Text readable
   ✓ Buttons accessible
   ✓ Navigation functional
```

#### Mobile Navigation Testing
```
1. Switch to mobile viewport (<768px)
2. Verify hamburger menu appears
3. Click hamburger icon
4. Sidebar slides in
5. Click backdrop to close
6. Sidebar slides out
7. Test all navigation items
8. Verify touch interactions
```

#### Touch Interaction Testing
```
On actual mobile device or touch screen:
1. Tap buttons
2. Tap links
3. Touch form inputs
4. Use sliders
5. Scroll lists
6. Open/close modals
7. Verify no accidental triggers
```

### Step 6: Integration Testing

#### Cross-Feature Workflows
```
Workflow 1: Add Pattern → Query → Export
1. Navigate to Patterns
2. Add new pattern
3. Navigate to SQL Editor
4. Query: SELECT * FROM patterns WHERE id = [new_id]
5. Verify data
6. Export results as JSON
7. Verify export file

Workflow 2: Generate Sample Data → Search → Filter
1. Open Sample Data Generator
2. Generate 50 patterns
3. Navigate to Vector Search
4. Search for similar patterns
5. Navigate to Patterns view
6. Filter by pattern type
7. Verify filtering works

Workflow 3: Import → Browse → Export
1. Prepare import file (JSON/SQL)
2. Import data
3. Browse in Data Browser
4. Verify all data imported
5. Export database
6. Compare import/export files
```

### Step 7: Edge Case Testing

#### Empty State Testing
```
1. Fresh database (clear LocalStorage)
2. Navigate to each view:
   - Patterns: Verify "No patterns" message
   - Episodes: Verify "No episodes" message
   - Causal Graph: Verify "No edges" message
3. Test operations on empty database
```

#### Invalid Input Testing
```
SQL Injection Test:
Input: '; DROP TABLE patterns; --
Expected: Query sanitized or error, table still exists

XSS Test:
Input: <script>alert('XSS')</script>
Expected: Input sanitized, no script execution

Special Characters:
Input: Unicode, emoji, special chars
Expected: Properly stored and displayed
```

#### Large Dataset Testing
```
1. Generate 10,000 records
2. Test:
   - View performance
   - Query performance
   - Export performance
   - Filter performance
   - UI responsiveness
3. Verify no crashes
```

### Step 8: Browser Compatibility Testing

#### Multi-Browser Testing
```
Test in each browser:
1. Chrome (latest)
2. Firefox (latest)
3. Safari (latest)
4. Edge (latest)

For each browser:
- Run functional tests
- Check console for errors
- Verify UI rendering
- Test all features
- Note browser-specific issues
```

---

## Testing Best Practices

### Recording Results

#### 1. Use Consistent Format
```markdown
## Test: [Test ID - Test Name]
**Date:** 2025-10-23
**Browser:** Chrome 119
**Result:** ✅ Pass / ❌ Fail / ⚠️ Warning

**Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected:** [Expected result]
**Actual:** [Actual result]
**Notes:** [Additional observations]
```

#### 2. Capture Evidence
- **Screenshots:** For visual issues
- **Console logs:** For errors/warnings
- **Network traces:** For performance issues
- **Video recordings:** For complex bugs

#### 3. Document Context
- Browser version
- Operating system
- Screen resolution
- Network conditions
- Database state

### Reproducibility

#### Make Bugs Reproducible
```markdown
## Bug Report: [Title]

**Preconditions:**
- Fresh database
- Browser: Chrome 119
- OS: Linux

**Steps to Reproduce:**
1. Navigate to Patterns view
2. Click "Add Pattern"
3. Fill form with [specific data]
4. Click Submit
5. Observe error

**Expected Result:** Pattern added successfully
**Actual Result:** Error message displayed
**Frequency:** 10/10 times
**Severity:** High
**Screenshot:** [attached]
**Console Errors:** [attached]
```

### Test Data Management

#### Use Consistent Test Data
```javascript
// Standard test pattern
{
  "type": "observation",
  "name": "Test Pattern Alpha",
  "description": "Standard test pattern for QA",
  "data": {"test": true, "value": 123}
}

// Standard test episode
{
  "agent_id": "test-agent-1",
  "episode_number": 1,
  "total_reward": 100.5,
  "steps": 50
}

// Standard test causal edge
{
  "from_state": "state_a",
  "to_state": "state_b",
  "action": "test_action",
  "weight": 0.8
}
```

### Performance Benchmarking

#### Establish Baselines
```
Page Load: 1.2s (target: <3s) ✅
DB Init: 0.3s (target: <1s) ✅
Simple Query: 45ms (target: <100ms) ✅
Complex Query: 230ms (target: <500ms) ✅
Modal Open: 120ms (target: <200ms) ✅
```

#### Monitor Trends
- Track performance over time
- Identify regressions early
- Optimize bottlenecks

---

## Tools and Resources

### Browser DevTools

#### Console Tab
```javascript
// Useful console commands

// Clear console
console.clear();

// Time operations
console.time('operation');
// ... do something
console.timeEnd('operation');

// Log objects
console.table(data);

// Group logs
console.group('Test Group');
console.log('Item 1');
console.log('Item 2');
console.groupEnd();

// Track function calls
console.trace();
```

#### Application Tab
```
LocalStorage Inspection:
1. DevTools > Application
2. Storage > Local Storage
3. View AgentDB data
4. Manually edit/delete
5. Test persistence

IndexedDB Inspection:
1. DevTools > Application
2. Storage > IndexedDB
3. Expand databases
4. View tables/data
5. Export data
```

#### Network Tab
```
Performance Analysis:
1. Enable "Disable cache"
2. Filter by type (JS, CSS, XHR)
3. Check waterfall
4. Analyze timing
5. Identify bottlenecks
```

### Testing Checklists

#### Pre-Test Checklist
- [ ] Browser cache cleared
- [ ] LocalStorage cleared
- [ ] DevTools open
- [ ] Test data prepared
- [ ] Documentation ready
- [ ] Screenshot tool ready

#### Post-Test Checklist
- [ ] All results recorded
- [ ] Screenshots captured
- [ ] Bugs documented
- [ ] TEST_RESULTS.md updated
- [ ] BUG_REPORT.md created (if needed)
- [ ] Performance metrics recorded
- [ ] Next steps identified

---

## Reporting Issues

### Bug Report Template

See BUG_REPORT.md for detailed template. Key elements:

1. **Clear Title:** Descriptive, specific
2. **Severity:** Critical, High, Medium, Low
3. **Priority:** P0, P1, P2, P3
4. **Steps to Reproduce:** Detailed, numbered
5. **Expected vs Actual:** Clear comparison
6. **Evidence:** Screenshots, logs, videos
7. **Environment:** Browser, OS, version
8. **Frequency:** How often it occurs
9. **Impact:** User impact assessment

### Issue Severity Guidelines

**Critical (P0):**
- Application crashes
- Data loss
- Security vulnerabilities
- Blocker for release

**High (P1):**
- Major feature broken
- Significant performance degradation
- Poor user experience
- No workaround

**Medium (P2):**
- Minor feature issues
- Workaround available
- UI inconsistencies
- Non-critical bugs

**Low (P3):**
- Cosmetic issues
- Nice-to-have improvements
- Documentation errors
- Minor UI tweaks

---

## Regression Testing

### When to Run Regression Tests

1. **After bug fixes:** Verify fix and no new issues
2. **Before releases:** Full test suite execution
3. **After major changes:** Impact assessment
4. **Regular intervals:** Weekly/monthly health checks

### Regression Test Suite

#### Core Functionality (P0)
- Database initialization
- Navigation
- CRUD operations
- Data persistence

#### Critical Features (P1)
- All modals
- Form submissions
- Export/import
- Search and filtering

#### Standard Features (P2)
- UI/UX elements
- Performance benchmarks
- Mobile responsiveness

#### Nice-to-Have (P3)
- Edge cases
- Browser compatibility
- Accessibility

### Smoke Tests (Quick Verification)

```
5-Minute Smoke Test:
1. Load application (verify no errors)
2. Click each nav item (verify views load)
3. Add one pattern (verify CRUD works)
4. Execute one query (verify SQL works)
5. Export data (verify export works)
6. Check console (verify no errors)

Result: GO/NO-GO for further testing
```

---

## Automation Recommendations

### Future Automation Strategy

#### Phase 1: Unit Tests
```javascript
// Example Jest tests for utility functions
describe('DatabaseUtils', () => {
  test('should initialize database', async () => {
    const db = await initDatabase();
    expect(db).toBeDefined();
  });

  test('should create tables', async () => {
    const tables = await getTables();
    expect(tables).toContain('patterns');
    expect(tables).toContain('episodes');
  });
});
```

#### Phase 2: Integration Tests
```javascript
// Example Playwright tests
describe('Patterns Management', () => {
  test('should add pattern via modal', async ({ page }) => {
    await page.goto('index.html');
    await page.click('[data-view="patterns"]');
    await page.click('.btn-add-pattern');
    await page.fill('#pattern-name', 'Test Pattern');
    await page.click('.btn-submit');
    await expect(page.locator('.pattern-list')).toContainText('Test Pattern');
  });
});
```

#### Phase 3: E2E Tests
```javascript
// Full user workflows
describe('Full Workflow', () => {
  test('complete pattern workflow', async ({ page }) => {
    // Generate sample data
    // Search patterns
    // Filter results
    // Export data
    // Verify export
  });
});
```

### Recommended Tools

**Testing Frameworks:**
- Jest (unit tests)
- Playwright (E2E tests)
- Cypress (E2E tests alternative)

**Performance Tools:**
- Lighthouse
- WebPageTest
- Chrome DevTools Performance

**Accessibility Tools:**
- aXe DevTools
- WAVE
- Lighthouse Accessibility Audit

**Visual Regression:**
- Percy
- Chromatic
- BackstopJS

---

## Appendix

### Keyboard Shortcuts

**Browser DevTools:**
- F12: Open DevTools
- Ctrl+Shift+I: Open DevTools
- Ctrl+Shift+C: Inspect Element
- Ctrl+Shift+M: Toggle Device Toolbar
- Ctrl+Shift+R: Hard Reload
- Ctrl+Shift+Delete: Clear Cache

**Testing:**
- Ctrl+F: Find in page
- Ctrl+Shift+F: Find in files (some browsers)
- F5: Reload
- Ctrl+R: Reload

### Common SQL Test Queries

```sql
-- Select all patterns
SELECT * FROM patterns;

-- Select with filter
SELECT * FROM patterns WHERE type = 'observation';

-- Join patterns and episodes
SELECT p.*, e.total_reward
FROM patterns p
LEFT JOIN episodes e ON p.id = e.pattern_id;

-- Count records
SELECT COUNT(*) FROM patterns;

-- Aggregation
SELECT type, COUNT(*) as count
FROM patterns
GROUP BY type;
```

### Test Data Generators

```javascript
// Generate random pattern
function generateTestPattern(index) {
  return {
    type: ['observation', 'action', 'reward'][index % 3],
    name: `Test Pattern ${index}`,
    description: `Auto-generated test pattern ${index}`,
    data: JSON.stringify({test: true, value: index})
  };
}

// Generate batch test data
function generateTestData(count) {
  return Array.from({length: count}, (_, i) => generateTestPattern(i));
}
```

---

## Conclusion

This testing guide provides a comprehensive framework for ensuring the quality of the AgentDB Management IDE. Key takeaways:

1. **Be systematic:** Follow procedures consistently
2. **Document thoroughly:** Record all findings
3. **Test comprehensively:** Cover all scenarios
4. **Monitor performance:** Track metrics
5. **Report clearly:** Make bugs reproducible
6. **Think long-term:** Plan for automation

**Questions or suggestions?** Update this guide as testing processes evolve.

**Happy Testing!**
