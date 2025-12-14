# Batch Pattern Import Feature

## Overview

The Batch Pattern Import feature allows you to import multiple reasoning patterns at once into the AgentDB Management IDE. This is useful for:

- Quickly populating your database with pre-built pattern sets
- Importing patterns from external sources
- Sharing pattern collections with team members
- Migrating patterns between environments

## How to Use

### Method 1: File Upload

1. Click the **⚡ Batch Add** button in the Patterns panel
2. Go to the **📁 File Upload** tab
3. Click **Choose File** and select a JSON file containing your patterns
4. The patterns will be automatically validated and previewed
5. Review the preview and click **Import Patterns** to complete the import

### Method 2: Paste JSON

1. Click the **⚡ Batch Add** button in the Patterns panel
2. Go to the **📁 File Upload** tab
3. Paste your JSON array directly into the text area
4. Click **🔍 Preview Patterns**
5. Review and click **Import Patterns**

### Method 3: Pre-Built Templates

1. Click the **⚡ Batch Add** button in the Patterns panel
2. Go to the **📚 Templates** tab
3. Select a template from the dropdown:
   - **Marketing Optimization** - 5 patterns for marketing use cases
   - **Healthcare Diagnostics** - 5 patterns for medical reasoning
   - **Financial Analysis** - 5 patterns for finance/trading
4. Click **🔍 Preview Patterns**
5. Review and click **Import Patterns**

## JSON Format

Patterns must be provided as a JSON array of objects. Each pattern object requires:

```json
[
  {
    "name": "Pattern Name",
    "pattern_type": "cognitive|behavioral",
    "content": "Detailed pattern description...",
    "metadata": {
      "category": "optional category",
      "difficulty": "optional difficulty level",
      "tags": ["optional", "tags"]
    }
  }
]
```

### Required Fields

- **name** (string): Unique name for the pattern
- **pattern_type** (string): Type of pattern (e.g., "cognitive", "behavioral")
- **content** (string): Detailed description of the pattern

### Optional Fields

- **metadata** (object): Additional information about the pattern
  - Can include any custom fields
  - Common fields: category, difficulty, tags, author, version

## Features

### Duplicate Detection

- Automatically detects patterns with names that already exist in the database
- Duplicate patterns are highlighted in yellow with a "DUPLICATE" badge
- Option to skip duplicates during import (enabled by default)

### Validation

- Validates JSON syntax before preview
- Checks that all required fields are present
- Ensures correct data types for each field
- Displays detailed error messages if validation fails

### Preview

- Shows all patterns before import
- Displays pattern name, type, and content preview
- Highlights duplicates
- Shows total pattern count

### Import Options

- **Skip duplicates**: When enabled, existing patterns won't be overwritten
- When disabled, duplicates will be updated with new content

## Example Files

### Sample Pattern File

See `sample-patterns.json` for a working example:

```json
[
  {
    "name": "Customer Segmentation Analysis",
    "pattern_type": "cognitive",
    "content": "Analyze customer behavior patterns...",
    "metadata": {
      "category": "marketing",
      "difficulty": "intermediate"
    }
  }
]
```

## Pre-Built Templates

### Marketing Optimization (5 patterns)

- Customer Segmentation Analysis
- Conversion Funnel Optimization
- Campaign Performance Prediction
- Content Personalization Engine
- Churn Prevention Strategy

### Healthcare Diagnostics (5 patterns)

- Symptom-Based Differential Diagnosis
- Treatment Protocol Selection
- Patient Risk Stratification
- Medication Interaction Checker
- Patient Outcome Prediction

### Financial Analysis (5 patterns)

- Market Trend Analysis
- Portfolio Risk Assessment
- Credit Default Prediction
- Fraud Detection Pattern
- Algorithmic Trading Strategy

## Error Handling

The batch import system provides clear error messages for:

- Invalid JSON syntax
- Missing required fields
- Incorrect data types
- Empty arrays
- Database insertion errors

All errors are displayed in the modal with specific details about what went wrong and how to fix it.

## Console Logging

All import operations are logged to the console panel:

- **INFO**: Modal opened, preview generated
- **SUCCESS**: Patterns loaded, imported successfully
- **WARNING**: Duplicates skipped
- **ERROR**: Validation errors, import failures

## Tips

1. **Start Small**: Test with a few patterns first before importing large sets
2. **Use Templates**: Explore pre-built templates to see examples of well-structured patterns
3. **Backup First**: Export existing patterns before importing large batches
4. **Check Duplicates**: Review the duplicate detection before importing
5. **Validate JSON**: Use a JSON validator if you're creating files manually

## Keyboard Shortcuts

- **Esc**: Close the batch import modal (coming soon)
- **Enter**: Import patterns when preview is ready (coming soon)

## Troubleshooting

### "Invalid JSON format" error

- Ensure your JSON is valid (use a validator)
- Check for trailing commas
- Verify quote marks are correct
- Ensure proper array/object structure

### Patterns not showing after import

- Check the console panel for error messages
- Verify you're on the Patterns view
- Click the 🔄 Refresh button

### Duplicate patterns not being skipped

- Ensure "Skip duplicates" checkbox is checked
- Note: Duplicates are matched by exact name only

## Future Enhancements

Planned improvements:

- Export pattern templates
- Custom template creation
- Batch edit/update patterns
- Import from URL
- Merge strategies for duplicates
- Pattern validation rules
