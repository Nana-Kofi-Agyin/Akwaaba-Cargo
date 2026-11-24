import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildStatusSmsMessage,
  sendSmsQueue,
  toArkeselRecipient,
} from "./arkesel.ts";

describe("Arkesel SMS helpers & queue", () => {
  it("formats Ghanaian phone numbers without leading +", () => {
    assert.equal(toArkeselRecipient("+233241234567"), "233241234567");
  });

  it("builds short, friendly English SMS messages with optional note", () => {
    const msg = buildStatusSmsMessage({
      title: "Rechargeable Mini Fan",
      status: "ready",
      note: "Pickup at Circle Mall Shop 12",
      trackUrl: "https://akwaaba.gh/l/fan-k7m2",
    });

    assert.match(msg, /Akwaaba Cargo:/);
    assert.match(msg, /ready for pickup/i);
    assert.match(msg, /Pickup at Circle Mall Shop 12/);
    assert.match(msg, /https:\/\/akwaaba\.gh\/l\/fan-k7m2/);
  });

  it("isolates failures in sendSmsQueue so one error never blocks the rest", async () => {
    const recipients = [
      "+233241111111",
      "+233552222222",
      "+233503333333",
      "+233241111111", // duplicate should be deduplicated
    ];

    const results = await sendSmsQueue({
      recipients,
      message: "Your batch has shipped!",
      concurrency: 2,
      sender: async ({ recipientPhone }) => {
        if (recipientPhone === "+233552222222") {
          throw new Error("Simulated Arkesel timeout");
        }
        return {
          recipientPhone,
          deliveryStatus: "sent",
          providerResponse: '{"status":"success"}',
          errorMessage: null,
        };
      },
    });

    assert.equal(results.length, 3);
    assert.equal(results[0].deliveryStatus, "sent");
    assert.equal(results[1].deliveryStatus, "failed");
    assert.match(results[1].errorMessage ?? "", /Simulated Arkesel timeout/);
    assert.equal(results[2].deliveryStatus, "sent");
  });
});
