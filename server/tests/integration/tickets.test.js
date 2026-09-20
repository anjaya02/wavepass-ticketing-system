const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const ticketPool = require("../../classes/TicketPool");

const isDbConnected = () => mongoose.connection.readyState === 1;

describe("Tickets & Purchasing API Integration Tests", () => {
  let vendorToken;
  let customerToken;
  let customerId;
  let otherCustomerId;

  beforeEach(async () => {
    if (!isDbConnected()) return;

    await ticketPool.initialize({
      totalTickets: 200,
      ticketReleaseRate: 5000,
      customerRetrievalRate: 5000,
      maxTicketCapacity: 100,
    });

    const vendorRes = await request(app)
      .post("/api/vendor/register")
      .send({
        name: "Test Vendor",
        email: "tickets_vendor@example.com",
        password: "VendorPassword123",
        ticketsPerRelease: 10,
      });
    vendorToken = vendorRes.body.token;

    const customerRes = await request(app)
      .post("/api/customers/register")
      .send({
        name: "Customer One",
        email: "customer1@example.com",
        mobileNumber: "0771112222",
        password: "CustomerPassword123",
      });
    customerToken = customerRes.body.token;
    customerId = customerRes.body.customer.id;

    const otherCustomerRes = await request(app)
      .post("/api/customers/register")
      .send({
        name: "Customer Two",
        email: "customer2@example.com",
        mobileNumber: "0773334444",
        password: "CustomerPassword123",
      });
    otherCustomerId = otherCustomerRes.body.customer.id;
  });

  test("Vendor releases tickets, customer purchases, availability updates correctly", async () => {
    if (!isDbConnected()) return;

    const addRes = await request(app)
      .post("/api/vendor/add-tickets")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ ticketCount: 10 });

    expect(addRes.status).toBe(200);
    expect(addRes.body.addedTickets).toBe(10);

    const availRes = await request(app)
      .get("/api/customers/available-tickets")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(availRes.status).toBe(200);
    expect(availRes.body.availableTickets).toBe(10);

    const purchaseRes = await request(app)
      .post(`/api/customers/${customerId}/purchase`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ quantity: 3 });

    expect(purchaseRes.status).toBe(200);
    expect(purchaseRes.body.countPurchased).toBe(3);
    expect(purchaseRes.body.purchasedTickets.length).toBe(3);

    const availAfterRes = await request(app)
      .get("/api/customers/available-tickets")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(availAfterRes.body.availableTickets).toBe(7);

    const myTicketsRes = await request(app)
      .get(`/api/customers/${customerId}/tickets`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(myTicketsRes.status).toBe(200);
    expect(myTicketsRes.body.ticketsPurchased.length).toBe(3);
  });

  test("Customer cannot purchase more tickets than are available in the pool", async () => {
    if (!isDbConnected()) return;

    await request(app)
      .post("/api/vendor/add-tickets")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ ticketCount: 2 });

    const purchaseRes = await request(app)
      .post(`/api/customers/${customerId}/purchase`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ quantity: 5 });

    expect(purchaseRes.status).toBe(200);
    expect(purchaseRes.body.countPurchased).toBe(2);
    expect(purchaseRes.body.notPurchased).toBe(3);

    const nextPurchase = await request(app)
      .post(`/api/customers/${customerId}/purchase`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ quantity: 1 });

    expect(nextPurchase.status).toBe(409);
    expect(nextPurchase.body.error.code).toBe("TICKETS_UNAVAILABLE");
  });

  test("Role Isolation: Customer cannot call vendor endpoints (403 Forbidden)", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post("/api/vendor/add-tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ ticketCount: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("Ownership Isolation: Customer A cannot purchase tickets for Customer B (403 Forbidden)", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post(`/api/customers/${otherCustomerId}/purchase`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
