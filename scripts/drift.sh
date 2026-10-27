#!/usr/bin/env bash
# Reports how far an app's copy of the starter's infrastructure has drifted.
#
#   scripts/drift.sh <app-backend-dir>          summary for every tracked file
#   scripts/drift.sh <app-backend-dir> <file>   full diff for one file (starter → app)
#
# Fixes land here first, then get pulled into apps. A file the app has and the
# starter lacks is invisible to this script — that is the point: domain code is not tracked.
set -euo pipefail

STARTER="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:?usage: scripts/drift.sh <app-backend-dir> [file]}"
APP="$(cd "$APP" && pwd)"

if [[ $# -ge 2 ]]; then
  git diff --no-index -- "$STARTER/$2" "$APP/$2" || true
  exit 0
fi

# Should be byte-identical in every app. A difference is a missed fix or an unshared one.
VERBATIM=(
  src/config/prisma.ts
  src/config/queueRedis.ts
  src/config/redis.ts
  src/config/resend.ts
  src/config/storage.ts
  src/lib/canonical.ts
  src/lib/idempotency/runOnce.ts
  src/lib/idempotency/store.ts
  src/lib/logger.ts
  src/lib/network.ts
  src/lib/pagination.ts
  src/lib/ratelimit/limiter.ts
  src/middleware/error.middleware.ts
  src/middleware/requestLogger.middleware.ts
  src/middleware/upload.middleware.ts
  src/middleware/validate.middleware.ts
  src/queues/maintenance.queue.ts
  src/workers/maintenance.worker.ts
  tests/mocks/prisma.ts
  tests/mocks/redis.ts
  tests/resolver.cjs
  jest.config.mjs
)

# Expected to differ at the owner key, policy list or domain error classes. Review the diff
# for anything beyond that.
ADAPTED=(
  src/lib/auth.ts
  src/lib/error.ts
  src/middleware/auth.middleware.ts
  src/middleware/idempotency.middleware.ts
  src/middleware/ratelimiter.middleware.ts
  src/index.ts
  src/worker.ts
)

report() {
  local file="$1"
  if [[ ! -e "$APP/$file" ]]; then
    printf '  %-48s missing\n' "$file"
    return
  fi
  local stat
  stat="$(git diff --no-index --numstat -- "$STARTER/$file" "$APP/$file" | awk '{print "+"$1" -"$2}' || true)"
  if [[ -z "$stat" ]]; then
    printf '  %-48s same\n' "$file"
  else
    printf '  %-48s differs (%s)\n' "$file" "$stat"
  fi
}

echo "starter: $STARTER"
echo "app:     $APP"
echo
echo "verbatim — should match:"
for file in "${VERBATIM[@]}"; do report "$file"; done
echo
echo "adapted — differs by design, check the diff stays at the seams:"
for file in "${ADAPTED[@]}"; do report "$file"; done
