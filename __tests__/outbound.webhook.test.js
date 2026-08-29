const {
  computeSignature,
  sendOutboundWebhook,
  testOutboundWebhook,
} = require("../helper/outboundWebhookDispatcher");

describe("Outbound Webhook Automation Engine", () => {
  test("computeSignature generates valid sha256 HMAC signature", () => {
    const payload = JSON.stringify({ event: "routine.completed", streak: 10 });
    const secret = "test_webhook_secret_key_123";

    const sig = computeSignature(payload, secret);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);

    const emptySig = computeSignature(payload, "");
    expect(emptySig).toBe("");
  });

  test("sendOutboundWebhook validates destination URL and returns error on missing URL", async () => {
    const result = await sendOutboundWebhook({
      webhookUrl: "",
      event: "test.ping",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing or invalid webhook endpoint URL");
  });

  test("testOutboundWebhook sends test ping structure", async () => {
    // Mock global fetch to verify dispatched request
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"received": true}',
    });

    const result = await testOutboundWebhook({
      webhookUrl: "https://hooks.zapier.com/test",
      webhookSecret: "secret123",
      subscriberEmail: "tester@example.com",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://hooks.zapier.com/test");
    expect(callArgs[1].headers["X-MorningRoutine-Event"]).toBe("test.ping");
    expect(callArgs[1].headers["X-MorningRoutine-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);

    global.fetch = originalFetch;
  });
});
