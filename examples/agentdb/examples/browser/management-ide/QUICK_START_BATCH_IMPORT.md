# Quick Start: Batch Pattern Import

## 🚀 Get Started in 30 Seconds

### Option 1: Use a Template (Easiest)

1. Click **⚡ Batch Add** in the Patterns panel
2. Click the **📚 Templates** tab
3. Select **Marketing Optimization** from dropdown
4. Click **🔍 Preview Patterns**
5. Click **Import Patterns**
6. Done! 5 marketing patterns imported ✅

### Option 2: Upload Sample File

1. Download `sample-patterns.json` from the IDE folder
2. Click **⚡ Batch Add** in the Patterns panel
3. Click **Choose File** and select the downloaded file
4. Click **Import Patterns**
5. Done! 3 sample patterns imported ✅

### Option 3: Paste JSON

1. Copy this JSON:
```json
[
  {
    "name": "Quick Test Pattern",
    "pattern_type": "cognitive",
    "content": "This is a quick test of the batch import feature.",
    "metadata": { "category": "test" }
  }
]
```

2. Click **⚡ Batch Add** in the Patterns panel
3. Paste into the text area
4. Click **🔍 Preview Patterns**
5. Click **Import Patterns**
6. Done! 1 pattern imported ✅

## 📝 JSON Template

Copy and modify this template for your own patterns:

```json
[
  {
    "name": "Your Pattern Name",
    "pattern_type": "cognitive",
    "content": "Describe your reasoning pattern here in detail. What problem does it solve? How should it be applied?",
    "metadata": {
      "category": "your-category",
      "difficulty": "beginner|intermediate|advanced|expert",
      "tags": ["tag1", "tag2"],
      "author": "Your Name"
    }
  },
  {
    "name": "Another Pattern",
    "pattern_type": "behavioral",
    "content": "Another pattern description...",
    "metadata": {}
  }
]
```

## ⚠️ Common Mistakes

### ❌ Wrong: Missing required fields
```json
[
  {
    "name": "Pattern Name"
    // Missing pattern_type and content!
  }
]
```

### ✅ Correct: All required fields
```json
[
  {
    "name": "Pattern Name",
    "pattern_type": "cognitive",
    "content": "Pattern description"
  }
]
```

### ❌ Wrong: Not an array
```json
{
  "name": "Pattern",
  "pattern_type": "cognitive",
  "content": "Description"
}
```

### ✅ Correct: Array of patterns
```json
[
  {
    "name": "Pattern",
    "pattern_type": "cognitive",
    "content": "Description"
  }
]
```

### ❌ Wrong: Trailing comma
```json
[
  {
    "name": "Pattern",
    "pattern_type": "cognitive",
    "content": "Description",  // ← Extra comma!
  }
]
```

### ✅ Correct: No trailing commas
```json
[
  {
    "name": "Pattern",
    "pattern_type": "cognitive",
    "content": "Description"
  }
]
```

## 💡 Pro Tips

1. **Test First**: Start with 1-2 patterns before importing large sets
2. **Use Templates**: Explore the 3 pre-built templates to learn the format
3. **Check Duplicates**: Review the preview before importing
4. **Watch Console**: Console panel shows detailed import progress
5. **Keep Backups**: Export existing patterns before large imports

## 🎯 Pattern Types

Use these common pattern types:

- `cognitive` - Thinking and reasoning patterns
- `behavioral` - Action and behavior patterns
- `analytical` - Analysis and evaluation patterns
- `creative` - Creative problem-solving patterns
- `strategic` - Strategic planning patterns
- `diagnostic` - Diagnostic and troubleshooting patterns

## 📊 Available Templates

### Marketing Optimization (5 patterns)
Perfect for marketing teams and growth hackers
- Customer segmentation
- Conversion optimization
- Campaign prediction
- Content personalization
- Churn prevention

### Healthcare Diagnostics (5 patterns)
Medical reasoning and patient care
- Differential diagnosis
- Treatment selection
- Risk stratification
- Drug interactions
- Outcome prediction

### Financial Analysis (5 patterns)
Trading, risk, and financial modeling
- Market trends
- Portfolio risk
- Credit scoring
- Fraud detection
- Trading strategies

## 🔧 Troubleshooting

### "Invalid JSON format" error
- Use a JSON validator: https://jsonlint.com
- Check for missing commas, quotes, or brackets
- Ensure no trailing commas

### Patterns not appearing
- Click 🔄 Refresh in Patterns panel
- Check console for error messages
- Verify you're on the Patterns view

### Import button disabled
- Preview patterns first
- Fix any validation errors shown in red
- Ensure at least one pattern in array

## 📚 Learn More

- Full Guide: `BATCH_IMPORT_GUIDE.md`
- Implementation Details: `IMPLEMENTATION_SUMMARY.md`
- Sample File: `sample-patterns.json`

---

**Need Help?** Check the console panel for detailed error messages and import status.
