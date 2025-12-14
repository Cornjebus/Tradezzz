// Enhanced Help System with Context Awareness

// Context mapping for opening help to relevant sections
const helpContextMap = {
  'sql-editor': { tab: 'features', subtab: 'sql-editor' },
  'data-browser': { tab: 'getting-started', subtab: 'interface' },
  'patterns': { tab: 'features', subtab: 'patterns' },
  'episodes': { tab: 'features', subtab: 'episodes' },
  'causal-graph': { tab: 'features', subtab: 'causal' },
  'vector-search': { tab: 'features', subtab: 'vector' },
  'optimizer': { tab: 'features', subtab: 'optimizer' },
  'query': { tab: 'examples', subtab: 'sql' },
  'pattern-search': { tab: 'examples', subtab: 'patterns' },
  'episode-tracking': { tab: 'examples', subtab: 'episodes' },
  'vector-query': { tab: 'examples', subtab: 'vector' },
  'schema': { tab: 'reference', subtab: 'schema' },
  'api': { tab: 'reference', subtab: 'api' },
  'shortcuts': { tab: 'reference', subtab: 'shortcuts' },
  'faq': { tab: 'faq', subtab: null },
  'default': { tab: 'getting-started', subtab: 'overview' }
};

/**
 * Show help modal with optional context awareness
 * @param {string} context - Context identifier (e.g., 'patterns', 'sql-editor')
 */
function showHelp(context = 'default') {
  const modal = document.getElementById('helpModal');
  if (!modal) return;

  // Get context mapping
  const contextInfo = helpContextMap[context] || helpContextMap['default'];

  // Switch to appropriate tab
  switchHelpTab(contextInfo.tab, false);

  // Switch to appropriate subtab if specified
  if (contextInfo.subtab) {
    setTimeout(() => {
      switchHelpSubtab(contextInfo.tab, contextInfo.subtab);
    }, 100);
  }

  // Show modal
  modal.classList.add('active');

  // Log to console
  logToConsole('info', `Help opened: ${contextInfo.tab}${contextInfo.subtab ? ' > ' + contextInfo.subtab : ''}`);
}

/**
 * Close help modal
 */
function closeHelp() {
  const modal = document.getElementById('helpModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Switch main help tab
 * @param {string} tabName - Tab identifier
 * @param {boolean} resetSubtabs - Whether to reset to first subtab
 */
function switchHelpTab(tabName, resetSubtabs = true) {
  // Update tab buttons
  document.querySelectorAll('.help-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.help-tab-content').forEach(content => {
    if (content.id === `help-tab-${tabName}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Reset to first subtab if requested
  if (resetSubtabs) {
    const firstSubtab = document.querySelector(`#help-tab-${tabName} .help-subtab`);
    if (firstSubtab) {
      const firstSubtabName = firstSubtab.getAttribute('onclick').match(/'([^']+)'/g)[1].replace(/'/g, '');
      switchHelpSubtab(tabName, firstSubtabName);
    }
  }
}

/**
 * Switch help subtab within a main tab
 * @param {string} mainTab - Main tab identifier
 * @param {string} subtabName - Subtab identifier
 */
function switchHelpSubtab(mainTab, subtabName) {
  const mainTabContent = document.getElementById(`help-tab-${mainTab}`);
  if (!mainTabContent) return;

  // Update subtab buttons
  mainTabContent.querySelectorAll('.help-subtab').forEach(subtab => {
    const onclick = subtab.getAttribute('onclick');
    if (onclick && onclick.includes(`'${subtabName}'`)) {
      subtab.classList.add('active');
    } else {
      subtab.classList.remove('active');
    }
  });

  // Update subsection content
  mainTabContent.querySelectorAll('.help-subsection').forEach(subsection => {
    if (subsection.id === `help-${mainTab}-${subtabName}`) {
      subsection.classList.add('active');
    } else {
      subsection.classList.remove('active');
    }
  });
}

// Keyboard shortcuts for help
document.addEventListener('keydown', (e) => {
  // Press '?' to open help
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const activeElement = document.activeElement;
    // Don't trigger if typing in an input/textarea
    if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      showHelp();
    }
  }

  // Press Escape to close help
  if (e.key === 'Escape') {
    const helpModal = document.getElementById('helpModal');
    if (helpModal && helpModal.classList.contains('active')) {
      closeHelp();
    }
  }
});

// Context-aware help button handlers
// Add data-help-context attributes to buttons to enable context-aware help
document.addEventListener('DOMContentLoaded', () => {
  // Add help context to sidebar navigation items
  const navItems = {
    'sql-editor': 'sql-editor',
    'data-browser': 'data-browser',
    'patterns': 'patterns',
    'episodes': 'episodes',
    'causal-graph': 'causal-graph',
    'vector-search': 'vector-search',
    'optimizer': 'optimizer'
  };

  // If sidebar navigation exists, add context handlers
  Object.entries(navItems).forEach(([view, context]) => {
    const navItem = document.querySelector(`.nav-item[onclick*="${view}"]`);
    if (navItem) {
      // Add help icon or context data if needed
      navItem.setAttribute('data-help-context', context);
    }
  });
});

// Utility: Add help button to any panel
function addHelpButton(panelId, context, label = '❓ Help') {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  // Check if help button already exists
  if (panel.querySelector('.panel-help-btn')) return;

  // Create help button
  const helpBtn = document.createElement('button');
  helpBtn.className = 'btn btn-sm btn-secondary panel-help-btn';
  helpBtn.textContent = label;
  helpBtn.onclick = () => showHelp(context);

  // Find a good place to insert it (typically in panel header)
  const panelHeader = panel.querySelector('.panel-header') || panel.querySelector('.view-header');
  if (panelHeader) {
    panelHeader.appendChild(helpBtn);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showHelp,
    closeHelp,
    switchHelpTab,
    switchHelpSubtab,
    addHelpButton
  };
}
