// __tests__/deliverability.routes.test.js
const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const cookieSignature = require("cookie-signature");
const deliverabilityRoutes = require("../routes/deliverability.routes");
const { performDeliverabilityAudit } = require("../helper/dnsGuard");
const suppressionService = require("../email-core/suppressionService");

jest.mock("../helper/dnsGuard");
jest.mock("../email-core/suppressionService");
jest.mock("../db/knex", () => {
  const mockDb = jest.fn(() => mockDb);
  mockDb.schema = {
    hasTable: jest.fn().mockResolvedValue(true),
  };
  mockDb.where = jest.fn().mockReturnThis();
  mockDb.select = jest.fn().mockReturnThis();
  mockDb.count = jest.fn().mockReturnThis();
  mockDb.groupBy = jest.fn().mockResolvedValue([]);
  mockDb.first = jest.fn().mockResolvedValue({ total: 0 });
  mockDb.orderBy = jest.fn().mockReturnThis();
  mockDb.limit = jest.fn().mockResolvedValue([]);
  return mockDb;
});

describe("Deliverability Routes Integration Tests", () => {
  let app;
  const cookieSecret = "test-cookie-secret";
  const signedAdminCookie = `mrn_role=s%3A${encodeURIComponent(cookieSignature.sign("admin", cookieSecret))}`;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser(cookieSecret));
    app.use("/admin/deliverability", deliverabilityRoutes);
    jest.clearAllMocks();
  });

  test("GET /admin/deliverability/dns-audit returns 403 when not authenticated as admin", async () => {
    const res = await request(app).get("/admin/deliverability/dns-audit");
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Forbidden");
  });

  test("GET /admin/deliverability/dns-audit returns 200 and audit data when admin cookie present", async () => {
    performDeliverabilityAudit.mockResolvedValue({
      domain: "example.com",
      healthScore: 100,
      grade: "A",
      summaryStatus: "HEALTHY",
      checks: {},
    });

    const res = await request(app)
      .get("/admin/deliverability/dns-audit")
      .set("Cookie", signedAdminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.healthScore).toBe(100);
  });

  test("POST /admin/deliverability/unsuppress reactivates email", async () => {
    suppressionService.unsuppressEmail.mockResolvedValue({ success: true, email: "reactivated@example.com" });

    const res = await request(app)
      .post("/admin/deliverability/unsuppress")
      .set("Cookie", signedAdminCookie)
      .send({ email: "reactivated@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("Routes are mounted cleanly without throwing TypeError", () => {
    expect(typeof deliverabilityRoutes).toBe("function");
  });
});
