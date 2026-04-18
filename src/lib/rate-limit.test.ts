import test from "node:test";
import assert from "node:assert/strict";

import { checkRateLimit } from "@/lib/rate-limit";

test("rate limiter allows initial requests", () => {
  const first = checkRateLimit("test-key-allow");
  assert.equal(first.limited, false);
});

test("rate limiter blocks after threshold", () => {
  const key = `test-key-block-${Date.now()}`;
  let last = checkRateLimit(key);

  for (let i = 0; i < 25; i += 1) {
    last = checkRateLimit(key);
  }

  assert.equal(last.limited, true);
  assert.ok(last.retryAfterSeconds > 0);
});
