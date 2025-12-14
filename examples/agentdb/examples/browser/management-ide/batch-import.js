// Batch Pattern Import Functionality for AgentDB Management IDE

let batchPatternsData = null;

// Pattern Templates
const patternTemplates = {
  marketing: {
    name: 'Marketing Optimization',
    description: 'Pre-built patterns for marketing campaigns, customer segmentation, and conversion optimization.',
    patterns: [
      {
        name: 'Customer Segmentation Analysis',
        pattern_type: 'cognitive',
        content: 'Analyze customer behavior patterns to identify distinct segments based on purchase history, engagement levels, and demographic data. Apply clustering techniques to group similar customers.',
        metadata: { category: 'marketing', difficulty: 'intermediate' }
      },
      {
        name: 'Conversion Funnel Optimization',
        pattern_type: 'behavioral',
        content: 'Track user journey through conversion funnel stages. Identify drop-off points and optimize each stage for maximum conversion. Use A/B testing patterns for validation.',
        metadata: { category: 'marketing', difficulty: 'advanced' }
      },
      {
        name: 'Campaign Performance Prediction',
        pattern_type: 'cognitive',
        content: 'Predict campaign ROI based on historical performance data, audience targeting, and creative elements. Use regression analysis and time-series forecasting.',
        metadata: { category: 'marketing', difficulty: 'advanced' }
      },
      {
        name: 'Content Personalization Engine',
        pattern_type: 'behavioral',
        content: 'Deliver personalized content recommendations based on user preferences, browsing history, and engagement patterns. Implement collaborative filtering and content-based filtering.',
        metadata: { category: 'marketing', difficulty: 'intermediate' }
      },
      {
        name: 'Churn Prevention Strategy',
        pattern_type: 'cognitive',
        content: 'Identify at-risk customers using engagement metrics, support tickets, and usage patterns. Trigger retention campaigns when churn probability exceeds threshold.',
        metadata: { category: 'marketing', difficulty: 'advanced' }
      }
    ]
  },
  healthcare: {
    name: 'Healthcare Diagnostics',
    description: 'Medical reasoning patterns for diagnostics, treatment planning, and patient care optimization.',
    patterns: [
      {
        name: 'Symptom-Based Differential Diagnosis',
        pattern_type: 'cognitive',
        content: 'Analyze patient symptoms to generate ranked list of potential diagnoses. Consider symptom severity, duration, and patient history. Use Bayesian reasoning for probability assessment.',
        metadata: { category: 'healthcare', difficulty: 'expert' }
      },
      {
        name: 'Treatment Protocol Selection',
        pattern_type: 'cognitive',
        content: 'Recommend evidence-based treatment protocols based on diagnosis, patient characteristics, comorbidities, and contraindications. Reference clinical guidelines and research.',
        metadata: { category: 'healthcare', difficulty: 'expert' }
      },
      {
        name: 'Patient Risk Stratification',
        pattern_type: 'behavioral',
        content: 'Assess patient risk levels for adverse events based on vital signs, lab results, medical history, and current conditions. Prioritize interventions for high-risk patients.',
        metadata: { category: 'healthcare', difficulty: 'advanced' }
      },
      {
        name: 'Medication Interaction Checker',
        pattern_type: 'cognitive',
        content: 'Identify potential drug-drug interactions, contraindications, and dosage conflicts in prescribed medications. Alert providers to dangerous combinations.',
        metadata: { category: 'healthcare', difficulty: 'advanced' }
      },
      {
        name: 'Patient Outcome Prediction',
        pattern_type: 'cognitive',
        content: 'Predict patient outcomes and recovery trajectories based on diagnosis, treatment plan, patient demographics, and historical data. Support care planning decisions.',
        metadata: { category: 'healthcare', difficulty: 'expert' }
      }
    ]
  },
  financial: {
    name: 'Financial Analysis',
    description: 'Patterns for trading strategies, risk assessment, and financial forecasting.',
    patterns: [
      {
        name: 'Market Trend Analysis',
        pattern_type: 'cognitive',
        content: 'Identify market trends using technical indicators, price action, volume analysis, and sentiment data. Recognize support/resistance levels and chart patterns.',
        metadata: { category: 'finance', difficulty: 'intermediate' }
      },
      {
        name: 'Portfolio Risk Assessment',
        pattern_type: 'cognitive',
        content: 'Evaluate portfolio risk using VaR (Value at Risk), beta analysis, correlation matrices, and stress testing. Recommend rebalancing strategies to optimize risk-return profile.',
        metadata: { category: 'finance', difficulty: 'advanced' }
      },
      {
        name: 'Credit Default Prediction',
        pattern_type: 'cognitive',
        content: 'Predict probability of loan default based on credit history, income, debt ratios, employment stability, and macroeconomic indicators. Use logistic regression and decision trees.',
        metadata: { category: 'finance', difficulty: 'advanced' }
      },
      {
        name: 'Fraud Detection Pattern',
        pattern_type: 'behavioral',
        content: 'Detect fraudulent transactions using anomaly detection algorithms. Monitor for unusual spending patterns, geographic inconsistencies, and velocity checks.',
        metadata: { category: 'finance', difficulty: 'expert' }
      },
      {
        name: 'Algorithmic Trading Strategy',
        pattern_type: 'behavioral',
        content: 'Execute trades based on predefined rules and market conditions. Implement mean reversion, momentum, and arbitrage strategies with risk management controls.',
        metadata: { category: 'finance', difficulty: 'expert' }
      }
    ]
  }
};

function showBatchPatterns() {
  document.getElementById('batchImportModal').classList.add('active');
  // Reset form
  document.getElementById('batch-file-input').value = '';
  document.getElementById('batch-json-input').value = '';
  document.getElementById('batch-template-select').value = '';
  document.getElementById('template-description').style.display = 'none';
  document.getElementById('batch-preview').style.display = 'none';
  batchPatternsData = null;
  logToConsole('info', 'Batch import modal opened');
}

function closeBatchImport() {
  document.getElementById('batchImportModal').classList.remove('active');
  batchPatternsData = null;
}

function switchBatchImportTab(tab) {
  document.querySelectorAll('#batchImportModal .tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tab));
  });
  document.querySelectorAll('#batchImportModal .tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `batch-${tab}`);
  });
  // Hide preview when switching tabs
  document.getElementById('batch-preview').style.display = 'none';
  batchPatternsData = null;
}

function handleBatchFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const patterns = JSON.parse(e.target.result);
      previewBatchImport(patterns);
      logToConsole('success', `Loaded ${patterns.length} patterns from file: ${file.name}`);
    } catch (error) {
      logToConsole('error', `Failed to parse JSON file: ${error.message}`);
      showValidationErrors([`Invalid JSON format: ${error.message}`]);
    }
  };
  reader.readAsText(file);
}

function previewBatchImportFromText() {
  const jsonText = document.getElementById('batch-json-input').value.trim();
  if (!jsonText) {
    logToConsole('warning', 'Please enter JSON data or upload a file');
    return;
  }

  try {
    const patterns = JSON.parse(jsonText);
    previewBatchImport(patterns);
    logToConsole('success', `Parsed ${patterns.length} patterns from text input`);
  } catch (error) {
    logToConsole('error', `Failed to parse JSON: ${error.message}`);
    showValidationErrors([`Invalid JSON format: ${error.message}`]);
  }
}

function showTemplateDescription() {
  const templateKey = document.getElementById('batch-template-select').value;
  const descDiv = document.getElementById('template-description');

  if (!templateKey) {
    descDiv.style.display = 'none';
    return;
  }

  const template = patternTemplates[templateKey];
  document.getElementById('template-description-text').textContent = template.description;
  descDiv.style.display = 'block';
}

function previewTemplatePatterns() {
  const templateKey = document.getElementById('batch-template-select').value;
  if (!templateKey) {
    logToConsole('warning', 'Please select a template');
    return;
  }

  const template = patternTemplates[templateKey];
  previewBatchImport(template.patterns);
  logToConsole('success', `Loaded ${template.name} template with ${template.patterns.length} patterns`);
}

function validatePattern(pattern, index) {
  const errors = [];

  if (!pattern.name || typeof pattern.name !== 'string') {
    errors.push(`Pattern ${index + 1}: Missing or invalid 'name' field`);
  }
  if (!pattern.pattern_type || typeof pattern.pattern_type !== 'string') {
    errors.push(`Pattern ${index + 1}: Missing or invalid 'pattern_type' field`);
  }
  if (!pattern.content || typeof pattern.content !== 'string') {
    errors.push(`Pattern ${index + 1}: Missing or invalid 'content' field`);
  }

  return errors;
}

function previewBatchImport(patterns) {
  // Validate input
  if (!Array.isArray(patterns)) {
    showValidationErrors(['Input must be an array of pattern objects']);
    return;
  }

  if (patterns.length === 0) {
    showValidationErrors(['Array is empty - no patterns to import']);
    return;
  }

  // Validate each pattern
  const allErrors = [];
  patterns.forEach((pattern, index) => {
    const errors = validatePattern(pattern, index);
    allErrors.push(...errors);
  });

  if (allErrors.length > 0) {
    showValidationErrors(allErrors);
    return;
  }

  // Store validated patterns
  batchPatternsData = patterns;

  // Check for duplicates
  const existingPatterns = sqlAll('SELECT name FROM reasoning_patterns', []);
  const existingNames = new Set(existingPatterns.map(p => p.name));

  // Generate preview HTML
  const previewContainer = document.getElementById('preview-patterns');
  previewContainer.innerHTML = patterns.map((pattern, index) => {
    const isDuplicate = existingNames.has(pattern.name);
    return `
      <div style="padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; margin-bottom: 0.75rem; border-left: 3px solid ${isDuplicate ? 'var(--warning)' : 'var(--accent)'};">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div style="font-weight: 600; color: var(--text-primary);">${index + 1}. ${pattern.name}</div>
          <div style="display: flex; gap: 0.5rem;">
            <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--bg-tertiary); border-radius: 3px; color: var(--text-secondary);">
              ${pattern.pattern_type}
            </span>
            ${isDuplicate ? '<span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--warning); border-radius: 3px; color: var(--bg-primary);">DUPLICATE</span>' : ''}
          </div>
        </div>
        <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">
          ${pattern.content.length > 150 ? pattern.content.substring(0, 150) + '...' : pattern.content}
        </div>
      </div>
    `;
  }).join('');

  // Update count
  document.getElementById('preview-count').textContent = patterns.length;

  // Show preview section
  document.getElementById('batch-preview').style.display = 'block';
  document.getElementById('validation-errors').style.display = 'none';
  document.getElementById('execute-import-btn').disabled = false;

  logToConsole('info', `Preview ready: ${patterns.length} patterns (${patterns.filter(p => existingNames.has(p.name)).length} duplicates detected)`);
}

function showValidationErrors(errors) {
  const errorList = document.getElementById('error-list');
  errorList.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
  document.getElementById('validation-errors').style.display = 'block';
  document.getElementById('batch-preview').style.display = 'none';
  document.getElementById('execute-import-btn').disabled = true;
}

async function executeBatchImport() {
  if (!batchPatternsData || batchPatternsData.length === 0) {
    logToConsole('error', 'No patterns to import');
    return;
  }

  const skipDuplicates = document.getElementById('skip-duplicates').checked;
  const existingPatterns = sqlAll('SELECT name FROM reasoning_patterns', []);
  const existingNames = new Set(existingPatterns.map(p => p.name));

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const pattern of batchPatternsData) {
    try {
      // Check for duplicate
      if (existingNames.has(pattern.name)) {
        if (skipDuplicates) {
          skipped++;
          logToConsole('warning', `Skipped duplicate: ${pattern.name}`);
          continue;
        }
      }

      // Insert pattern
      const metadata = JSON.stringify(pattern.metadata || {});
      state.db.run(
        `INSERT OR REPLACE INTO reasoning_patterns (name, pattern_type, content, metadata, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [pattern.name, pattern.pattern_type, pattern.content, metadata, Date.now()]
      );

      imported++;
      logToConsole('success', `Imported: ${pattern.name}`);
    } catch (error) {
      failed++;
      logToConsole('error', `Failed to import ${pattern.name}: ${error.message}`);
    }
  }

  // Show results
  const message = `Batch import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`;
  logToConsole('success', message);

  // Refresh patterns list if we're on that view
  if (state.currentView === 'patterns') {
    loadPatterns();
  }

  // Close modal
  setTimeout(() => {
    closeBatchImport();
  }, 1500);
}
