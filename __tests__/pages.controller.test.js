const { health } = require("../controllers/pages.controller");

describe("pages.controller health", () => {
  test("responds with status ok and a timestamp", () => {
    const req = {};
    const res = { json: jest.fn() };

    health(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];

    expect(payload.status).toBe("ok");
    expect(payload.mode).toBe("auto-scheduling-enabled");
    expect(() => new Date(payload.timestamp).toISOString()).not.toThrow();
  });
});
