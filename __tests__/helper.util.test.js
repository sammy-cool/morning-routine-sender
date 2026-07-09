const {
  maskEmail,
  todayUTCYYYYMMDD,
  generateRandomMessageID,
  setRoleCookie,
} = require("../helper/util");

describe("maskEmail", () => {
  test("masks the local part but keeps first/last character and domain", () => {
    expect(maskEmail("priyanshu@gmail.com")).toBe("p*******u@gmail.com");
  });

  test("handles very short local parts without throwing", () => {
    // local part length 2 -> Math.max(length - 2, 1) === 1 asterisk
    expect(maskEmail("ab@example.com")).toBe("a*b@example.com");
  });

  test("preserves the domain exactly", () => {
    const result = maskEmail("someone@company.co.in");
    expect(result.endsWith("@company.co.in")).toBe(true);
  });
});

describe("todayUTCYYYYMMDD", () => {
  test("returns today's date in UTC as YYYY-MM-DD", () => {
    const result = todayUTCYYYYMMDD();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const expected = new Date().toISOString().slice(0, 10);
    expect(result).toBe(expected);
  });
});

describe("generateRandomMessageID", () => {
  test("returns a 20-character hex string", () => {
    const id = generateRandomMessageID();
    expect(id).toMatch(/^[a-f0-9]{20}$/);
  });

  test("returns a different value on each call", () => {
    const first = generateRandomMessageID();
    const second = generateRandomMessageID();
    expect(first).not.toBe(second);
  });
});

describe("setRoleCookie", () => {
  test("sets the mrn_role cookie with the given role", () => {
    const res = { cookie: jest.fn() };
    setRoleCookie(res, "admin");

    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      "mrn_role",
      "admin",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        maxAge: 5 * 60 * 1000,
      }),
    );
  });

  test("uses secure:false and sameSite:'lax' outside production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const res = { cookie: jest.fn() };
    setRoleCookie(res, "user");

    const [, , options] = res.cookie.mock.calls[0];
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");

    process.env.NODE_ENV = originalEnv;
  });
});
