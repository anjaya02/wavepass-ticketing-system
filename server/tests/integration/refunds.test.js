const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const ticketPool = require("../../classes/TicketPool");

const isDbConnected = () => mongoose.connection.readyState === 1;

describe("Refunds API Integration Tests", () => {
  let vendorToken;
  let customer1Token;
  let customer1Id;
  let customer2Token;
  let customer2Id;
  let purchasedTicketId;

  beforeEach(async () => {
    if (!isDbConnected()) return;

    await ticketPool.initialize({
      totalTickets: 100,
      ticketReleaseRate: 1000,
      customerRetrievalRate: 1000,
      maxTicketCapacity: 50,
    });

    const vendorRes = await request(app)
      .post("/api/vendor/register")
      .send({
        name: "Refund Vendor",
        email: "vendor_refund@example.com",
        password: "VendorPassword123",
      });
    vendorToken = vendorRes.body.token;

    const c1Res = await request(app)
      .post("/api/customers/register")
      .send({
        name: "Customer One",
        email: "c1_refund@example.com",
        mobileNumber: "0771112233",
        password: "CustomerPassword123",
      });
    customer1Token = c1Res.body.token;
    customer1Id = c1Res.body.customer.id;

    const c2Res = await request(app)
      .post("/api/customers/register")
      .send({
        name: "Customer Two",
        email: "c2_refund@example.com",
        mobileNumber: "0774445566",
        password: "CustomerPassword123",
      });
    customer2Token = c2Res.body.token;
    customer2Id = c2Res.body.customer.id;

    await request(app)
      .post("/api/vendor/add-tickets")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ ticketCount: 2 });

    const purchaseRes = await request(app)
      .post(`/api/customers/${customer1Id}/purchase`)
      .set("Authorization", `Bearer ${customer1Token}`)
      .send({ quantity: 1 });

    purchasedTicketId = purchaseRes.body.purchasedTickets[0].id;
  });

  test("Valid refund returns ticket to pool and increases availability", async () => {
    if (!isDbConnected()) return;

    const refundRes = await request(app)
      .post(`/api/customers/${customer1Id}/refund`)
      .set("Authorization", `Bearer ${customer1Token}`)
      .send({ ticketId: purchasedTicketId });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.success).toBe(true);
    expect(refundRes.body.ticket.status).toBe("available");

    const availAfter = await ticketPool.getAvailableTickets();
    expect(availAfter).toBe(2);
  });

  test("Customer cannot refund a ticket they do not own", async () => {
    if (!isDbConnected()) return;

    const refundRes = await request(app)
      .post(`/api/customers/${customer2Id}/refund`)
      .set("Authorization", `Bearer ${customer2Token}`)
      .send({ ticketId: purchasedTicketId });

    expect(refundRes.status).toBe(404);
    expect(refundRes.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  test("Repeated refund attempt is rejected cleanly", async () => {
    if (!isDbConnected()) return;

    await request(app)
      .post(`/api/customers/${customer1Id}/refund`)
      .set("Authorization", `Bearer ${customer1Token}`)
      .send({ ticketId: purchasedTicketId });

    const secondRefund = await request(app)
      .post(`/api/customers/${customer1Id}/refund`)
      .set("Authorization", `Bearer ${customer1Token}`)
      .send({ ticketId: purchasedTicketId });

    expect(secondRefund.status).toBe(404);
    expect(secondRefund.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  test("Customer A cannot call refund route of Customer B (403 Forbidden)", async () => {
    if (!isDbConnected()) return;

    const res = await request(app)
      .post(`/api/customers/${customer2Id}/refund`)
      .set("Authorization", `Bearer ${customer1Token}`)
      .send({ ticketId: purchasedTicketId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
