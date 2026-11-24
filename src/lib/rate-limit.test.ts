import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rate-limit.ts";

describe("createRateLimiter", () => {
  it("allows requests within the limit and blocks requests over the limit", () => {
    const check = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    const t0 = 1_700_000_000_000;

    assert.equal(check("ip-1", t0).allowed, true);
    assert.equal(check("ip-1", t0 + 1000).allowed, true);
    const third = check("ip-1", t0 + 2000);
    assert.equal(third.allowed, true);
    assert.equal(third.remaining, 0);

    const fourth = check("ip-1", t0 + 3000);
    assert.equal(fourth.allowed, false);
    assert.ok(fourth.retryAfterSec >= 57);

    // Different IP is unaffected
    assert.equal(check("ip-2", t0 + 3000).allowed, true);

    // Allowed again once window expires
    assert.equal(check("ip-1", t0 + 61_000).allowed, true);
  });
});
