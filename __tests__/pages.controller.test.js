const { health, robots, sitemap, llmsTxt, llmsFullTxt } = require("../controllers/pages.controller");

describe("pages.controller endpoints", () => {
  test("health responds with status ok and a timestamp", () => {
    const req = {};
    const res = { json: jest.fn() };

    health(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];

    expect(payload.status).toBe("ok");
    expect(payload.mode).toBe("auto-scheduling-enabled");
    expect(() => new Date(payload.timestamp).toISOString()).not.toThrow();
  });

  test("robots responds with valid robots.txt directives and domain replacement", () => {
    const req = { protocol: "https", get: () => "routine.example.com" };
    const res = {
      set: jest.fn(),
      locals: { apiBase: "https://routine.example.com" },
      send: jest.fn(),
    };

    robots(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "text/plain; charset=utf-8");
    expect(res.send).toHaveBeenCalledTimes(1);
    const text = res.send.mock.calls[0][0];
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /css/");
    expect(text).toContain("Sitemap: https://routine.example.com/sitemap.xml");
  });

  test("sitemap responds with XML and replaced domain", () => {
    const req = { protocol: "https", get: () => "routine.example.com" };
    const res = {
      set: jest.fn(),
      locals: { apiBase: "https://routine.example.com" },
      send: jest.fn(),
    };

    sitemap(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/xml; charset=utf-8");
    expect(res.send).toHaveBeenCalledTimes(1);
    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain("https://routine.example.com/");
    expect(xml).toContain("<urlset");
  });

  test("llmsTxt responds with markdown AI context", () => {
    const req = { protocol: "https", get: () => "routine.example.com" };
    const res = {
      set: jest.fn(),
      locals: { apiBase: "https://routine.example.com" },
      send: jest.fn(),
    };

    llmsTxt(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "text/markdown; charset=utf-8");
    expect(res.send).toHaveBeenCalledTimes(1);
    const md = res.send.mock.calls[0][0];
    expect(md).toContain("# Morning Routine Sender");
    expect(md).toContain("https://routine.example.com/");
  });
});
