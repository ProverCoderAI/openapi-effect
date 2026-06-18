#!/bin/bash
# CHANGE: Add anti-any/unknown lint check script
# WHY: Enforce type safety policy per blocking review requirements
# QUOTE(ТЗ): "Автоматическая проверка \"нет any/unknown\" - добавить отдельную команду"
# REF: PR#3 blocking review section 4.4

# Exit on error
set -e

echo "Checking for any usage and unknown usage outside typed boundaries..."

# Files allowed to contain unknown at runtime/type boundaries
UNKNOWN_ALLOWED_FILES=(
  "src/core/axioms.ts"
  "src/shell/api-client/openapi-compat-request.ts"
  "src/shell/api-client/openapi-compat-serializers.ts"
  "src/shell/api-client/openapi-compat-path.ts"
  "src/shell/api-client/openapi-compat-value-guards.ts"
  "src/shell/api-client/create-client-runtime-types.ts"
  "src/shell/api-client/create-client-runtime-helpers.ts"
  "src/shell/api-client/create-client-runtime.ts"
  "src/shell/api-client/create-client-middleware.ts"
  "src/shell/api-client/create-client-types.ts"
  "src/shell/api-client/create-client-response.ts"
)

ANY_PATTERN='(: any\b|as any\b)'
UNKNOWN_PATTERN='\bunknown\b'

FOUND_VIOLATIONS=""
for file in $(find src -name "*.ts" -type f); do
  ANY_MATCHES=$(grep -nE "$ANY_PATTERN" "$file" 2>/dev/null || true)
  if [ -n "$ANY_MATCHES" ]; then
    FOUND_VIOLATIONS="$FOUND_VIOLATIONS\n$file:\n$ANY_MATCHES\n"
  fi

  IS_UNKNOWN_ALLOWED=false
  for allowed in "${UNKNOWN_ALLOWED_FILES[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      IS_UNKNOWN_ALLOWED=true
      break
    fi
  done

  if [ "$IS_UNKNOWN_ALLOWED" = false ]; then
    MATCHES=$(grep -nE "$UNKNOWN_PATTERN" "$file" 2>/dev/null | grep -vE 'extends.*unknown|Record<string, unknown>' || true)
    if [ -n "$MATCHES" ]; then
      FOUND_VIOLATIONS="$FOUND_VIOLATIONS\n$file:\n$MATCHES\n"
    fi
  fi
done

if [ -n "$FOUND_VIOLATIONS" ]; then
  echo -e "\n❌ Found any/unknown usage outside allowed files:"
  echo -e "$FOUND_VIOLATIONS"
  echo ""
  echo "Unknown-allowed files: ${UNKNOWN_ALLOWED_FILES[*]}"
  echo "Please move boundary unknown usage to the listed modules or eliminate it."
  exit 1
else
  echo "✅ No any/unknown violations found!"
  exit 0
fi
