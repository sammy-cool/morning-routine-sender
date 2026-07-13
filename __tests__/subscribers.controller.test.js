const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

// Explicit factory, not jest.mock("../helper/shared-data") alone: without
// a factory, Jest's auto-mock still has to require() the REAL module once
// to discover its export shape -- which runs shared-data.js's own
// require("../db/knex"), which tries to open a real Postgres connection
// via knexfile.js and throws immediately in a test environment with no
// DB env vars set. This crashed the entire suite before any test ran.
// An explicit factory never touches the real file at all.
jest.mock("../helper/shared-data", () => ({
  getAllUsers: jest.fn(),
  getUsers: jest.fn(),
  getUserByEmail: jest.fn(),
  addUser: jest.fn(),
  removeUser: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
}));
const sharedData = require("../helper/shared-data");

const subscribersRoutes = require("../routes/subscribers.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(subscribersRoutes);
  return app;
}

describe("subscribers admin API", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe("requireAdmin gate", () => {
    test("blocks GET /admin/subscribers without the admin cookie", async () => {
      const res = await request(app).get("/admin/subscribers");
      expect(res.status).toBe(403);
      expect(sharedData.getAllUsers).not.toHaveBeenCalled();
    });

    test("blocks POST /admin/subscribers without the admin cookie", async () => {
      const res = await request(app)
        .post("/admin/subscribers")
        .send({ email: "new@example.com" });
      expect(res.status).toBe(403);
      expect(sharedData.addUser).not.toHaveBeenCalled();
    });

    test("allows requests with the mrn_role=admin cookie through to the controller", async () => {
      sharedData.getAllUsers.mockResolvedValue([]);
      const res = await request(app)
        .get("/admin/subscribers")
        .set("Cookie", ["mrn_role=admin"]);
      expect(res.status).toBe(200);
      expect(sharedData.getAllUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /admin/subscribers", () => {
    test("returns the list from getAllUsers()", async () => {
      sharedData.getAllUsers.mockResolvedValue([
        { email: "a@example.com", isActive: true },
        { email: "b@example.com", isActive: false },
      ]);

      const res = await request(app)
        .get("/admin/subscribers")
        .set("Cookie", ["mrn_role=admin"]);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.subscribers).toHaveLength(2);
    });
  });

  describe("POST /admin/subscribers", () => {
    const adminCookie = ["mrn_role=admin"];

    test("rejects an invalid email", async () => {
      const res = await request(app)
        .post("/admin/subscribers")
        .set("Cookie", adminCookie)
        .send({ email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(sharedData.addUser).not.toHaveBeenCalled();
    });

    test("rejects an invalid cron pattern", async () => {
      const res = await request(app)
        .post("/admin/subscribers")
        .set("Cookie", adminCookie)
        .send({ email: "new@example.com", cronPattern: "not a cron" });

      expect(res.status).toBe(400);
      expect(sharedData.addUser).not.toHaveBeenCalled();
    });

    test("creates a subscriber with valid input", async () => {
      sharedData.addUser.mockResolvedValue({ created: true, email: "new@example.com" });

      const res = await request(app)
        .post("/admin/subscribers")
        .set("Cookie", adminCookie)
        .send({ email: "New@Example.com", cronPattern: "0 8 * * *" });

      expect(res.status).toBe(201);
      // Confirms the controller lowercases/trims before storing
      expect(sharedData.addUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: "new@example.com" }),
      );
    });

    test("returns 409 when addUser reports the subscriber already exists", async () => {
      sharedData.addUser.mockResolvedValue({ created: false, email: "dup@example.com" });

      const res = await request(app)
        .post("/admin/subscribers")
        .set("Cookie", adminCookie)
        .send({ email: "dup@example.com" });

      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /admin/subscribers/:email", () => {
    const adminCookie = ["mrn_role=admin"];

    test("requires at least one field to update", async () => {
      const res = await request(app)
        .patch("/admin/subscribers/a@example.com")
        .set("Cookie", adminCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    test("pauses a subscriber via isActive:false", async () => {
      sharedData.setUserActive.mockResolvedValue(true);

      const res = await request(app)
        .patch("/admin/subscribers/a@example.com")
        .set("Cookie", adminCookie)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(sharedData.setUserActive).toHaveBeenCalledWith("a@example.com", false);
    });

    test("returns 404 when the subscriber doesn't exist", async () => {
      sharedData.setUserActive.mockResolvedValue(false);

      const res = await request(app)
        .patch("/admin/subscribers/ghost@example.com")
        .set("Cookie", adminCookie)
        .send({ isActive: true });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/subscribers/:email", () => {
    const adminCookie = ["mrn_role=admin"];

    test("deletes an existing subscriber", async () => {
      sharedData.removeUser.mockResolvedValue(true);

      const res = await request(app)
        .delete("/admin/subscribers/a@example.com")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });

    test("returns 404 when the subscriber doesn't exist", async () => {
      sharedData.removeUser.mockResolvedValue(false);

      const res = await request(app)
        .delete("/admin/subscribers/ghost@example.com")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
    });
  });
});
