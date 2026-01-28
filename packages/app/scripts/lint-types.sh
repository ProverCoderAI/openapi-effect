#!/bin/bash
# CHANGE: Add anti-any/unknown lint check script
# WHY: Enforce type safety policy per blocking review requirements
# QUOTE(ТЗ): "Автоматическая проверка \"нет any/unknown\" - добавить отдельную команду"
# REF: PR#3 blocking review section 4.4

# Exit on error
set -e

echo "Checking for any/unknown usage outside axioms.ts..."

# Files allowed to contain any/unknown (Variant B policy)
ALLOWED_FILES=(
  "src/core/axioms.ts"
)

# Pattern to find problematic any/unknown usage
# Excludes:
# - Type comments (/* any */)
# - JSDoc type comments (/** @type {any} */)
# - conditional extends unknown (idiomatic TypeScript)
PATTERN='(: any\b|as any\b|\bunknown\b)'

# Find all TypeScript files in src, excluding allowed files
FOUND_VIOLATIONS=""
for file in $(find src -name "*.ts" -type f); do
  # Check if file is in allowed list
  IS_ALLOWED=false
  for allowed in "${ALLOWED_FILES[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      IS_ALLOWED=true
      break
    fi
  done

  if [ "$IS_ALLOWED" = false ]; then
    # Search for violations, excluding conditional type patterns
    MATCHES=$(grep -nE "$PATTERN" "$file" 2>/dev/null | grep -vE 'extends.*unknown|Record<string, unknown>' || true)
    if [ -n "$MATCHES" ]; then
      FOUND_VIOLATIONS="$FOUND_VIOLATIONS\n$file:\n$MATCHES\n"
    fi
  fi
done

if [ -n "$FOUND_VIOLATIONS" ]; then
  echo -e "\n❌ Found any/unknown usage outside allowed files:"
  echo -e "$FOUND_VIOLATIONS"
  echo ""
  echo "Allowed files: ${ALLOWED_FILES[*]}"
  echo "Please move type casts to axioms.ts or eliminate the usage."
  exit 1
else
  echo "✅ No any/unknown violations found!"
  exit 0
fi
