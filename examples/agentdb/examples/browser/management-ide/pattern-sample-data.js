/**
 * AgentDB Management IDE - Sample Pattern Data Generator
 *
 * This file generates realistic sample pattern data for testing and demonstration
 * of the advanced pattern management features.
 */

// Sample pattern templates with realistic data
const samplePatternTemplates = [
  {
    pattern_type: 'causal',
    description: 'User engagement increases when personalized recommendations are shown',
    tags: ['engagement', 'recommendations', 'personalization', 'UX'],
    usage_count: 45,
    effectiveness: 0.87,
    content: {
      cause: 'Display personalized product recommendations',
      effect: 'Increase in user session duration and conversion rate',
      confidence: 0.87,
      supporting_data: 'A/B test results from 10,000 users over 30 days'
    }
  },
  {
    pattern_type: 'temporal',
    description: 'Peak traffic occurs between 6-9 PM on weekdays',
    tags: ['traffic', 'timing', 'analytics', 'optimization'],
    usage_count: 32,
    effectiveness: 0.92,
    content: {
      pattern: 'Time-based load distribution',
      window: '6-9 PM weekdays',
      recurrence: 'daily',
      confidence: 0.92
    }
  },
  {
    pattern_type: 'reasoning',
    description: 'If user abandons cart, send reminder email after 24 hours',
    tags: ['cart', 'email', 'marketing', 'automation'],
    usage_count: 67,
    effectiveness: 0.73,
    content: {
      condition: 'Cart abandonment detected',
      action: 'Schedule reminder email',
      delay: '24 hours',
      expected_outcome: '15-20% cart recovery rate'
    }
  },
  {
    pattern_type: 'optimization',
    description: 'Cache frequently accessed API responses for 5 minutes',
    tags: ['caching', 'performance', 'API', 'optimization'],
    usage_count: 89,
    effectiveness: 0.95,
    content: {
      optimization_type: 'Response caching',
      duration: '5 minutes',
      impact: '40% reduction in API calls',
      resources_saved: 'CPU: 30%, Memory: 15%'
    }
  },
  {
    pattern_type: 'causal',
    description: 'Simplified checkout process reduces cart abandonment by 25%',
    tags: ['checkout', 'conversion', 'UX', 'optimization'],
    usage_count: 54,
    effectiveness: 0.81,
    content: {
      cause: 'Reduce checkout steps from 5 to 3',
      effect: 'Cart abandonment decreased by 25%',
      confidence: 0.81,
      implementation: 'One-page checkout with progressive disclosure'
    }
  },
  {
    pattern_type: 'reasoning',
    description: 'New users require onboarding tutorial for feature adoption',
    tags: ['onboarding', 'tutorial', 'UX', 'adoption'],
    usage_count: 41,
    effectiveness: 0.78,
    content: {
      condition: 'First-time user login',
      action: 'Display interactive tutorial',
      expected_outcome: 'Increase feature adoption by 40%',
      skip_option: true
    }
  },
  {
    pattern_type: 'temporal',
    description: 'Database backups scheduled during low-traffic hours (2-4 AM)',
    tags: ['database', 'backup', 'scheduling', 'maintenance'],
    usage_count: 28,
    effectiveness: 0.98,
    content: {
      pattern: 'Automated backup scheduling',
      window: '2-4 AM daily',
      type: 'Full backup',
      retention: '30 days'
    }
  },
  {
    pattern_type: 'optimization',
    description: 'Lazy load images below the fold to improve page load time',
    tags: ['images', 'performance', 'loading', 'web'],
    usage_count: 76,
    effectiveness: 0.89,
    content: {
      optimization_type: 'Lazy loading',
      target: 'Below-the-fold images',
      impact: '35% faster initial page load',
      technique: 'Intersection Observer API'
    }
  },
  {
    pattern_type: 'causal',
    description: 'Push notifications increase app retention by 30%',
    tags: ['notifications', 'retention', 'mobile', 'engagement'],
    usage_count: 58,
    effectiveness: 0.76,
    content: {
      cause: 'Send relevant push notifications',
      effect: '30% increase in 7-day retention',
      confidence: 0.76,
      frequency: 'Max 2 per day',
      personalization: true
    }
  },
  {
    pattern_type: 'reasoning',
    description: 'High-value customers receive priority support routing',
    tags: ['support', 'customer-service', 'prioritization', 'VIP'],
    usage_count: 36,
    effectiveness: 0.91,
    content: {
      condition: 'Customer LTV > $10,000',
      action: 'Route to senior support team',
      expected_outcome: 'Improved satisfaction scores',
      SLA: 'Response within 2 hours'
    }
  },
  {
    pattern_type: 'temporal',
    description: 'Email campaigns sent Tuesday mornings have highest open rates',
    tags: ['email', 'marketing', 'timing', 'engagement'],
    usage_count: 49,
    effectiveness: 0.84,
    content: {
      pattern: 'Optimal email send time',
      window: 'Tuesday 9-11 AM',
      metric: 'Open rate 28% vs 18% average',
      tested_against: '50,000 recipients'
    }
  },
  {
    pattern_type: 'optimization',
    description: 'Compress assets using Brotli for 20% size reduction',
    tags: ['compression', 'assets', 'performance', 'bandwidth'],
    usage_count: 63,
    effectiveness: 0.93,
    content: {
      optimization_type: 'Asset compression',
      algorithm: 'Brotli',
      impact: '20% reduction in transfer size',
      browser_support: '95%+'
    }
  },
  {
    pattern_type: 'causal',
    description: 'Social proof elements increase conversion rate by 15%',
    tags: ['social-proof', 'conversion', 'psychology', 'CRO'],
    usage_count: 52,
    effectiveness: 0.79,
    content: {
      cause: 'Display "X people bought this" messages',
      effect: '15% increase in purchase conversion',
      confidence: 0.79,
      threshold: 'Show when >10 purchases in 24h'
    }
  },
  {
    pattern_type: 'reasoning',
    description: 'Inactive users receive re-engagement campaign after 30 days',
    tags: ['retention', 'email', 'engagement', 'lifecycle'],
    usage_count: 44,
    effectiveness: 0.68,
    content: {
      condition: 'No activity for 30 days',
      action: 'Send personalized re-engagement email',
      expected_outcome: '12% reactivation rate',
      include_incentive: true
    }
  },
  {
    pattern_type: 'temporal',
    description: 'Server scaling triggered at 70% CPU utilization',
    tags: ['scaling', 'infrastructure', 'automation', 'performance'],
    usage_count: 71,
    effectiveness: 0.96,
    content: {
      pattern: 'Auto-scaling threshold',
      trigger: 'CPU > 70% for 5 minutes',
      action: 'Add 2 instances',
      cooldown: '10 minutes'
    }
  },
  {
    pattern_type: 'optimization',
    description: 'Database query optimization reduces average response time by 60%',
    tags: ['database', 'query', 'performance', 'indexing'],
    usage_count: 81,
    effectiveness: 0.94,
    content: {
      optimization_type: 'Query optimization',
      techniques: ['Indexing', 'Query rewriting', 'Materialized views'],
      impact: '60% faster response time',
      from: '450ms',
      to: '180ms'
    }
  },
  {
    pattern_type: 'causal',
    description: 'Free shipping threshold drives average order value up 22%',
    tags: ['shipping', 'AOV', 'pricing', 'psychology'],
    usage_count: 47,
    effectiveness: 0.83,
    content: {
      cause: 'Free shipping on orders >$50',
      effect: '22% increase in average order value',
      confidence: 0.83,
      additional_effect: 'Cart size increased from $38 to $54'
    }
  },
  {
    pattern_type: 'reasoning',
    description: 'Multi-factor authentication required for high-risk transactions',
    tags: ['security', 'authentication', 'fraud', 'risk'],
    usage_count: 39,
    effectiveness: 0.97,
    content: {
      condition: 'Transaction >$500 or new device',
      action: 'Require MFA verification',
      expected_outcome: '85% reduction in fraud',
      methods: ['SMS', 'Authenticator app', 'Email']
    }
  },
  {
    pattern_type: 'temporal',
    description: 'Content published on Thursdays receives 40% more engagement',
    tags: ['content', 'publishing', 'social-media', 'timing'],
    usage_count: 34,
    effectiveness: 0.77,
    content: {
      pattern: 'Optimal publishing schedule',
      window: 'Thursday 1-3 PM',
      metric: '40% more likes and shares',
      content_type: 'Blog posts and social updates'
    }
  },
  {
    pattern_type: 'optimization',
    description: 'Connection pooling reduces database connection overhead by 50%',
    tags: ['database', 'connections', 'pooling', 'performance'],
    usage_count: 68,
    effectiveness: 0.91,
    content: {
      optimization_type: 'Connection pooling',
      pool_size: '20 connections',
      impact: '50% reduction in connection overhead',
      max_wait_time: '100ms'
    }
  }
];

/**
 * Generate mock embedding vector (384 dimensions)
 * In production, use actual embedding model like sentence-transformers
 */
function generateMockEmbedding(text) {
  const embedding = [];
  // Simple hash-based mock embedding
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }

  // Generate 384-dimensional vector based on hash
  const random = new Math.seedrandom(hash);
  for (let i = 0; i < 384; i++) {
    embedding.push(random() * 2 - 1); // Values between -1 and 1
  }

  return embedding;
}

// Simple seedable random number generator
Math.seedrandom = function(seed) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

/**
 * Generate sample patterns with realistic data
 */
async function generateSamplePatterns(db, count = 20) {
  console.log(`Generating ${count} sample patterns...`);

  const templates = [...samplePatternTemplates];
  const generatedPatterns = [];

  for (let i = 0; i < count && i < templates.length; i++) {
    const template = templates[i];

    // Create pattern metadata
    const metadata = {
      description: template.description,
      tags: template.tags,
      usage_count: template.usage_count,
      effectiveness: template.effectiveness,
      similarity_score: Math.random() * 0.3 + 0.7, // 0.7-1.0
      content: template.content,
      created_by: 'demo',
      last_used: Date.now() - Math.random() * 86400000 * 30 // Last 30 days
    };

    // Generate embedding
    const embedding = generateMockEmbedding(template.description);

    // Store pattern
    try {
      await db.storePattern({
        pattern_type: template.pattern_type,
        embedding: embedding,
        metadata: metadata
      });

      generatedPatterns.push({
        type: template.pattern_type,
        description: template.description
      });

      console.log(`✓ Generated: ${template.description.substring(0, 50)}...`);
    } catch (error) {
      console.error(`✗ Failed to generate pattern: ${error.message}`);
    }
  }

  console.log(`\n✅ Successfully generated ${generatedPatterns.length} sample patterns`);
  return generatedPatterns;
}

/**
 * Add sample patterns through UI
 */
async function addSamplePatternsToIDE() {
  if (!state || !state.db) {
    alert('Database not initialized. Please ensure AgentDB is loaded.');
    return;
  }

  const count = parseInt(prompt('How many sample patterns to generate? (1-20)', '10'));

  if (!count || count < 1 || count > 20) {
    alert('Please enter a number between 1 and 20');
    return;
  }

  try {
    const patterns = await generateSamplePatterns(state.db, count);
    alert(`Successfully generated ${patterns.length} sample patterns!\n\nRefreshing pattern list...`);

    // Refresh the patterns display
    if (typeof refreshPatterns === 'function') {
      refreshPatterns();
    }

    // Log summary
    logToConsole('success', `Generated ${patterns.length} sample patterns`);

  } catch (error) {
    alert(`Failed to generate sample patterns: ${error.message}`);
    logToConsole('error', `Sample pattern generation failed: ${error.message}`);
  }
}

/**
 * Clear all sample patterns
 */
async function clearSamplePatterns() {
  if (!confirm('Clear all patterns? This cannot be undone.')) {
    return;
  }

  try {
    await sqlRun('DELETE FROM patterns');
    alert('All patterns cleared');

    if (typeof refreshPatterns === 'function') {
      refreshPatterns();
    }

    logToConsole('info', 'All patterns cleared');

  } catch (error) {
    alert(`Failed to clear patterns: ${error.message}`);
    logToConsole('error', `Failed to clear patterns: ${error.message}`);
  }
}

/**
 * Export sample pattern templates
 */
function exportSampleTemplates() {
  const data = JSON.stringify(samplePatternTemplates, null, 2);
  downloadFile('agentdb-sample-patterns.json', data, 'application/json');
  logToConsole('success', 'Sample pattern templates exported');
}

// Add to global scope for console access
if (typeof window !== 'undefined') {
  window.samplePatternData = {
    generateSamplePatterns,
    addSamplePatternsToIDE,
    clearSamplePatterns,
    exportSampleTemplates,
    templates: samplePatternTemplates
  };
}

console.log('✅ AgentDB Sample Pattern Data Generator loaded');
console.log('💡 Use addSamplePatternsToIDE() to generate sample patterns');
