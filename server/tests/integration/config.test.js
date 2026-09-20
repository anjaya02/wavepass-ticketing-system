const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");

const isDbConnected = () => mongoose.connection.readyState === 1;

describe("Configuration API Integration Tests", () => {
  let vendorToken;
  let customerToken;

  beforeEach(async () => {
    if (!isDbConnected()) return;

    const vendorRes = await request(app)
      .post("/api/vendor/register")
      .send({
        name: "Config Vendor",
        email: "config_vendor@example.com",
        password: "VendorPassword123",
      });
    vendorToken = vendorRes.body.token;

    const customerRes = await request(app)
      .post("/api/customers/register")
      .send({
        name: "Config Customer",
        email: "config_customer@example.com",
        mobileNumber: "0778889900",
        password: "CustomerPassword123",
      });
    customerToken = customerRes.body.token;
  });

  test("GET /api/config/ - should return current system configuration", async () => {
    if (!isDbConnected()) return;

    const res = await request(app).get("/api/config/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalTickets).toBeDefined();
    expect(res.body.maxTicketCapacity).toBeDefined();
  });

  test("POST /api/config/set - Vendor can update configuration with valid parameters", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post("/api/config/set")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({
        totalTickets: 600,
        ticketReleaseRate: 4000,
        customerRetrievalRate: 7000,
        maxTicketCapacity: 250,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("POST /api/config/set - should reject configuration if maxTicketCapacity >= totalTickets", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post("/api/config/set")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({
        totalTickets: 300,
        ticketReleaseRate: 4000,
        customerRetrievalRate: 7000,
        maxTicketCapacity: 300,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("POST /api/config/set - Customer cannot modify configuration (403 Forbidden)", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post("/api/config/set")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        totalTickets: 500,
        ticketReleaseRate: 5000,
        customerRetrievalRate: 5000,
        maxTicketCapacity: 200,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
