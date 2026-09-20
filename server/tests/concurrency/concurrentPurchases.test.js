const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const ticketPool = require("../../classes/TicketPool");
const Ticket = require("../../models/ticket");

const isDbConnected = () => mongoose.connection.readyState === 1;

describe("High-Concurrency Stress Test: Simultaneous Ticket Purchases", () => {
  const TOTAL_AVAILABLE_TICKETS = 10;
  const CONCURRENT_BUYERS = 50;

  let vendorToken;
  const customers = [];

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
        name: "Concurrent Vendor",
        email: "concurrency_vendor@example.com",
        password: "VendorPassword123",
      });
    vendorToken = vendorRes.body.token;

    await request(app)
      .post("/api/vendor/add-tickets")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ ticketCount: TOTAL_AVAILABLE_TICKETS });

    customers.length = 0;
    for (let i = 0; i < CONCURRENT_BUYERS; i++) {
      const email = `concurrent_buyer_${i}@example.com`;
      const mobile = `077000${String(i).padStart(4, "0")}`;

      const regRes = await request(app)
        .post("/api/customers/register")
        .send({
          name: `Buyer ${i}`,
          email,
          mobileNumber: mobile,
          password: "Password123!",
        });

      customers.push({
        id: regRes.body.customer.id,
        token: regRes.body.token,
        email,
      });
    }
  });

  test(`Should handle ${CONCURRENT_BUYERS} simultaneous purchase attempts for ${TOTAL_AVAILABLE_TICKETS} tickets with zero overselling`, async () => {
    if (!isDbConnected()) return;

    const initialAvailable = await ticketPool.getAvailableTickets();
    expect(initialAvailable).toBe(TOTAL_AVAILABLE_TICKETS);

    const purchasePromises = customers.map((buyer) =>
      request(app)
        .post(`/api/customers/${buyer.id}/purchase`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ quantity: 1 })
    );

    const responses = await Promise.all(purchasePromises);

    const successfulResponses = responses.filter((r) => r.status === 200);
    const rejectedResponses = responses.filter((r) => r.status === 409 || r.status === 400);

    expect(successfulResponses.length).toBe(TOTAL_AVAILABLE_TICKETS);
    expect(rejectedResponses.length).toBe(CONCURRENT_BUYERS - TOTAL_AVAILABLE_TICKETS);

    rejectedResponses.forEach((r) => {
      expect(r.body.success).toBe(false);
      expect(r.body.error.code).toBe("TICKETS_UNAVAILABLE");
    });

    const allTicketsInDb = await Ticket.find({}).lean();
    expect(allTicketsInDb.length).toBe(TOTAL_AVAILABLE_TICKETS);

    const soldTickets = allTicketsInDb.filter((t) => t.status === "sold");
    const availableTickets = allTicketsInDb.filter((t) => t.status === "available");

    expect(soldTickets.length).toBe(TOTAL_AVAILABLE_TICKETS);
    expect(availableTickets.length).toBe(0);

    const ownerIds = soldTickets.map((t) => t.owner.toString());
    const uniqueOwners = new Set(ownerIds);
    expect(uniqueOwners.size).toBe(TOTAL_AVAILABLE_TICKETS);

    const poolAvailableCount = await ticketPool.getAvailableTickets();
    expect(poolAvailableCount).toBe(0);
  });
});
