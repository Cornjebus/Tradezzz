#!/bin/bash

# Script to update all WASM example HTML files with consistent AgentDB design system
# Excludes the RAG example which already has the correct design

EXAMPLES=(
    "experience-replay"
    "collaborative-filtering"
    "adaptive-recommendations"
    "swarm-intelligence"
    "meta-learning"
    "neuro-symbolic"
    "quantum-inspired"
    "continual-learning"
)

for example in "${EXAMPLES[@]}"; do
    FILE="/workspaces/agentdb-site/agentdb/examples/browser/${example}/index.html"

    if [ ! -f "$FILE" ]; then
        echo "File not found: $FILE"
        continue
    fi

    echo "Updating $example..."

    # Create backup
    cp "$FILE" "${FILE}.bak"

    # Apply design system changes using sed
    sed -i 's/font-family: -apple-system, BlinkMacSystemFont.*$/font-family: ui-monospace, '\''SF Mono'\'', '\''JetBrains Mono'\'', Menlo, Consolas, monospace;/' "$FILE"
    sed -i 's/background: linear-gradient(135deg, #[0-9a-fA-F]* 0%, #[0-9a-fA-F]* 100%);$/background: hsl(0 0% 12%);/' "$FILE"
    sed -i '/^\s*body\s*{/,/^\s*}/ s/min-height: 100vh;/color: hsl(0 0% 95%);\n            min-height: 100vh;/' "$FILE"

    # Update header styles
    sed -i '/header {/,/}/ {
        s/background: white;/background: hsl(0 0% 15%);/
        s/border-radius: 12px;/border: 1px solid hsl(0 0% 25%);\n            border-radius: 16px;/
        s/box-shadow: 0 10px 30px rgba(0,0,0,0.2);/box-shadow: 0 6px 24px hsl(222 20% 0% \/ 0.24);/
    }' "$FILE"

    # Update h1 and subtitle
    sed -i 's/h1 { color: #[0-9a-fA-F]*;/h1 { color: hsl(195 100% 60%); font-weight: 600; letter-spacing: -0.005em;/' "$FILE"
    sed -i 's/\.subtitle { color: #[0-9a-fA-F]*; }/\.subtitle { color: hsl(0 0% 85%); }/' "$FILE"

    # Update card styles
    sed -i '/\.card {/,/}/ {
        s/background: white;/background: hsl(0 0% 15%);/
        s/border-radius: 12px;/border: 1px solid hsl(0 0% 25%);\n            border-radius: 16px;/
        s/box-shadow: 0 10px 30px rgba(0,0,0,0.2);/box-shadow: 0 6px 24px hsl(222 20% 0% \/ 0.24);/
    }' "$FILE"

    # Update card h2
    sed -i 's/\.card h2 { color: #[0-9a-fA-F]*;/\.card h2 { color: hsl(0 0% 95%); font-weight: 600;/' "$FILE"

    echo "✓ Updated $example"
done

echo "All files updated successfully!"
echo "Backups saved with .bak extension"
