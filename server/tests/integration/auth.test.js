const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");

const isDbConnected = () => mongoose.connection.readyState === 1;

describe("Authentication API Integration Tests", () => {
  const customerPayload = {
    name: "John Doe",
    email: "john.doe@example.com",
    mobileNumber: "0771234567",
    password: "password123",
  };

  const vendorPayload = {
    name: "Acme Boats",
    email: "vendor@acmeboats.com",
    password: "VendorSecurePassword123",
    ticketsPerRelease: 15,
  };

  test("POST /api/customers/register - should successfully register a new customer", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post("/api/customers/register")
      .send(customerPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.customer.email).toBe(customerPayload.email);
    expect(res.body.customer.password).toBeUndefined();
  });

  test("POST /api/customers/register - should reject duplicate email", async () => {
    if (!isDbConnected()) return;

    await request(app).post("/api/customers/register").send(customerPayload);

    const res = await request(app)
      .post("/api/customers/register")
      .send(customerPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("DUPLICATE_RESOURCE");
  });

  test("POST /api/customers/login - should successfully authenticate valid credentials", async () => {
    if (!isDbConnected()) return;

    await request(app).post("/api/customers/register").send(customerPayload);

    const res = await request(app)
      .post("/api/customers/login")
      .send({
        email: customerPayload.email,
        password: customerPayload.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.customer.email).toBe(customerPayload.email);
  });

  test("POST /api/customers/login - should reject invalid credentials", async () => {
    if (!isDbConnected()) return;

    await request(app).post("/api/customers/register").send(customerPayload);

    const res = await request(app)
      .post("/api/customers/login")
      .send({
        email: customerPayload.email,
        password: "WrongPassword123",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("POST /api/vendor/register - should successfully register a new vendor", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post("/api/vendor/register")
      .send(vendorPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.vendor.email).toBe(vendorPayload.email);
    expect(res.body.vendor.password).toBeUndefined();
  });

  test("POST /api/vendor/login - should authenticate valid vendor credentials", async () => {
    if (!isDbConnected()) return;

    await request(app).post("/api/vendor/register").send(vendorPayload);

    const res = await request(app)
      .post("/api/vendor/login")
      .send({
        email: vendorPayload.email,
        password: vendorPayload.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  test("Token Protection: should reject protected routes when Authorization header is missing", async () => {
    const res = await request(app).get("/api/vendor/ticket-pool");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  test("Token Protection: should reject protected routes when token is malformed", async () => {
    const res = await request(app)
      .get("/api/vendor/ticket-pool")
      .set("Authorization", "Bearer invalid.malformed.token");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});
