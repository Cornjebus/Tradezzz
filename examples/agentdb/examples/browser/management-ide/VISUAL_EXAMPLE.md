# Trajectory Visualization - Visual Example

## Modal Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📈 Episode Trajectories                                               [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │    42    │  │ 0.753 ↑ │  │  73.8%   │  │  0.950   │                  │
│  │  Total   │  │   Avg    │  │ Success  │  │   Peak   │                  │
│  │ Episodes │  │  Reward  │  │   Rate   │  │  Reward  │                  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │
│                                                                             │
│  📊 Reward Distribution                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  ┌────────┐      ┌────────┐      ┌────────┐                        │  │
│  │  │   15   │      │   20   │      │   7    │                        │  │
│  │  │  High  │      │ Medium │      │  Low   │                        │  │
│  │  │ (≥0.7) │      │(0.3-.7)│      │ (<0.3) │                        │  │
│  │  └────────┘      └────────┘      └────────┘                        │  │
│  │                                                                      │  │
│  │         Trend: 📈 Improving (+0.127)                                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  📅 Episode Timeline (Latest 20)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ● Optimize database queries          Reward: 0.950    Dec 23, 14:30│  │
│  │ ● Implement caching layer            Reward: 0.875    Dec 23, 12:15│  │
│  │ ● Add error handling                 Reward: 0.820    Dec 23, 10:45│  │
│  │ ● Refactor authentication            Reward: 0.750    Dec 22, 16:20│  │
│  │ ● Fix memory leak                    Reward: 0.450    Dec 22, 14:00│  │
│  │ ● Update dependencies                Reward: 0.320    Dec 22, 11:30│  │
│  │ ...                                                                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  🏆 Top Performing Strategies                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ #1 Performance Optimization          0.897 avg (8x)                 │  │
│  │ #2 Security Improvements             0.834 avg (12x)                │  │
│  │ #3 Code Refactoring                  0.765 avg (15x)                │  │
│  │ #4 Bug Fixes                         0.623 avg (20x)                │  │
│  │ #5 Documentation                     0.548 avg (5x)                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                                          [Close]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Color Scheme

### Statistics Cards
```
┌──────────────────┐
│      42         │  ← Large accent-colored number (#00ff88)
│   Total         │  ← Small uppercase label (gray)
│   Episodes      │
└──────────────────┘
```

### Reward Distribution Bars
```
High:    [████████████████████] Green border & background
Medium:  [████████████████████] Yellow border & background
Low:     [████████████████████] Red border & background
```

### Timeline Items

**High Reward (≥0.7)**
```
│ ⦿ Optimize database queries          Reward: 0.950    Dec 23, 14:30│
   ^
   Green glowing marker
```

**Medium Reward (0.3-0.7)**
```
│ ⦿ Fix memory leak                    Reward: 0.450    Dec 22, 14:00│
   ^
   Yellow glowing marker
```

**Low Reward (<0.3)**
```
│ ⦿ Update dependencies                Reward: 0.320    Dec 22, 11:30│
   ^
   Red glowing marker
```

## Trend Indicators

```
↑  Improving    (Green)   - Second half avg > First half avg + 0.1
→  Stable       (Yellow)  - Difference within ±0.1
↓  Declining    (Red)     - Second half avg < First half avg - 0.1
```

## Interactive Elements

### Hover Effects

**Timeline Items**
```
Before hover:  │ ⦿ Task name          Reward: 0.750  │
After hover:   │ ⦿ Task name          Reward: 0.750  │ ← Slight translate right
                                                        ← Darker background
```

**Statistics Cards**
```
Normal:  Subtle border
Hover:   Slightly brighter border (no animation to maintain professionalism)
```

## Responsive Behavior

**Desktop (>900px)**
```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  Stat  │ │  Stat  │ │  Stat  │ │  Stat  │
└────────┘ └────────┘ └────────┘ └────────┘
```

**Tablet (600-900px)**
```
┌────────┐ ┌────────┐
│  Stat  │ │  Stat  │
└────────┘ └────────┘
┌────────┐ ┌────────┐
│  Stat  │ │  Stat  │
└────────┘ └────────┘
```

**Mobile (<600px)**
```
┌────────┐
│  Stat  │
└────────┘
┌────────┐
│  Stat  │
└────────┘
┌────────┐
│  Stat  │
└────────┘
┌────────┐
│  Stat  │
└────────┘
```

## Data Example

### Sample Episode Data
```javascript
{
  id: 1,
  task: "Optimize database queries",
  action: "Added indexes on frequently queried columns",
  reward: 0.950,
  created_at: 1703342400,
  metadata: JSON.stringify({
    strategy: "Performance Optimization",
    duration_ms: 1250,
    improvement_pct: 45
  })
}
```

### Rendered Timeline Item
```html
<div class="timeline-item reward-high">
  <div class="timeline-marker"></div>
  <div class="timeline-content">
    <div class="timeline-task">Optimize database queries</div>
    <div class="timeline-reward">Reward: 0.950</div>
  </div>
  <div class="timeline-time">Dec 23, 14:30</div>
</div>
```

## CSS Animation Examples

### Marker Glow (High Reward)
```css
.reward-high .timeline-marker {
  background: hsl(142 76% 50%);
  box-shadow: 0 0 8px hsl(142 76% 50%);
  /* Subtle pulsing glow effect */
}
```

### Progress Bar Fill
```css
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg,
    hsl(142 76% 50% / 0.1),
    hsl(142 76% 50%)
  );
  transition: width 0.3s ease;
}
```

## User Flow Example

```
1. User navigates to Episodes panel
   ↓
2. User sees 15 episodes listed
   ↓
3. User clicks "📈 Trajectories" button
   ↓
4. Modal opens with smooth fade-in
   ↓
5. User views statistics:
   - 15 total episodes
   - 0.753 average reward (↑ improving)
   - 73.8% success rate
   - 0.950 peak reward
   ↓
6. User scrolls through timeline
   ↓
7. User hovers over timeline items
   (items animate with slight translation)
   ↓
8. User reviews top strategies
   ↓
9. User clicks "Close" button
   ↓
10. Modal closes with fade-out
```

## Accessibility Features

- Semantic HTML structure
- Color + icon indicators (not color alone)
- Keyboard navigation support (modal can be closed with Escape)
- High contrast ratios for text
- Clear visual hierarchy
- Descriptive labels for all metrics

## Dark Theme Integration

All colors follow the IDE's existing color scheme:
```css
--bg-primary: hsl(0 0% 10%)      /* Dark background */
--bg-secondary: hsl(0 0% 15%)    /* Cards background */
--bg-tertiary: hsl(0 0% 20%)     /* Chart backgrounds */
--border-color: hsl(0 0% 25%)    /* Borders */
--text-primary: hsl(0 0% 95%)    /* Main text */
--text-secondary: hsl(0 0% 70%)  /* Secondary text */
--accent: hsl(142 76% 50%)       /* Green accent */
--success: hsl(142 76% 50%)      /* Success states */
--warning: hsl(45 76% 50%)       /* Warning states */
--danger: hsl(0 76% 50%)         /* Error states */
```

This creates a cohesive experience throughout the entire IDE interface.
