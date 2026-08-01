const { checkHoneypot } = require("../middleware/honeypot");

function mockReqRes(body) {
  const req = { body, originalUrl: "/subscribe", ip: "127.0.0.1" };
  const res = { json: jest.fn() };
  return { req, res };
}

describe("checkHoneypot", () => {
  const GENERIC = { message: "generic success" };

  test("calls next() when the honeypot field is empty", () => {
    const middleware = checkHoneypot("website", GENERIC);
    const { req, res } = mockReqRes({ email: "real@example.com", website: "" });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });

  test("calls next() when the honeypot field is entirely absent from the body", () => {
    const middleware = checkHoneypot("website", GENERIC);
    const { req, res } = mockReqRes({ email: "real@example.com" });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("short-circuits with the generic response when the honeypot is filled in", () => {
    const middleware = checkHoneypot("website", GENERIC);
    const { req, res } = mockReqRes({
      email: "bot@example.com",
      website: "https://spam.example",
    });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(GENERIC);
  });

  test("the response is byte-identical to a real success -- a bot gets no detection signal", () => {
    const middleware = checkHoneypot("website", GENERIC);
    const { req, res } = mockReqRes({
      email: "bot@example.com",
      website: "spam",
    });

    middleware(req, res, jest.fn());

    // Same object reference/shape passed straight through -- not a
    // different status code, not an extra field, nothing a bot could
    // use to distinguish "caught by honeypot" from "worked normally".
    expect(res.json.mock.calls[0][0]).toEqual(GENERIC);
  });
});
