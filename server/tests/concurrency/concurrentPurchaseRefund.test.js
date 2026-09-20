const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const ticketPool = require("../../classes/TicketPool");
const Ticket = require("../../models/ticket");

const isDbConnected = () => mongoose.connection.readyState === 1;

describe("High-Concurrency Stress Test: Interleaved Purchases and Refunds", () => {
  let vendorToken;
  const buyers = [];

  beforeEach(async () => {
    if (!isDbConnected()) return;

    await ticketPool.initialize({
      totalTickets: 100,
      ticketReleaseRate: 5000,
      customerRetrievalRate: 5000,
      maxTicketCapacity: 50,
    });

    const vendorRes = await request(app)
      .post("/api/vendor/register")
      .send({
        name: "Cycle Vendor",
        email: "cycle_vendor@example.com",
        password: "VendorPassword123!",
      });
    vendorToken = vendorRes.body.token;

    buyers.length = 0;
    for (let i = 0; i < 10; i++) {
      const regRes = await request(app)
        .post("/api/customers/register")
        .send({
          name: `Cycle Buyer ${i}`,
          email: `cycle_buyer_${i}@example.com`,
          mobileNumber: `077555${String(i).padStart(4, "0")}`,
          password: "Password123!",
        });
      buyers.push({
        id: regRes.body.customer.id,
        token: regRes.body.token,
      });
    }

    await request(app)
      .post("/api/vendor/add-tickets")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ ticketCount: 10 });
  });

  test("Concurrent purchases and refunds must preserve database integrity and exact ticket balance", async () => {
    if (!isDbConnected()) return;

    const initialPurchases = await Promise.all(
      buyers.slice(0, 5).map((b) =>
        request(app)
          .post(`/api/customers/${b.id}/purchase`)
          .set("Authorization", `Bearer ${b.token}`)
          .send({ quantity: 1 })
      )
    );

    const boughtTicketIds = initialPurchases.map((res) => res.body.purchasedTickets[0].id);

    const concurrentOperations = [
      request(app)
        .post(`/api/customers/${buyers[0].id}/refund`)
        .set("Authorization", `Bearer ${buyers[0].token}`)
        .send({ ticketId: boughtTicketIds[0] }),
      request(app)
        .post(`/api/customers/${buyers[1].id}/refund`)
        .set("Authorization", `Bearer ${buyers[1].token}`)
        .send({ ticketId: boughtTicketIds[1] }),
      request(app)
        .post(`/api/customers/${buyers[2].id}/refund`)
        .set("Authorization", `Bearer ${buyers[2].token}`)
        .send({ ticketId: boughtTicketIds[2] }),

      request(app)
        .post(`/api/customers/${buyers[5].id}/purchase`)
        .set("Authorization", `Bearer ${buyers[5].token}`)
        .send({ quantity: 1 }),
      request(app)
        .post(`/api/customers/${buyers[6].id}/purchase`)
        .set("Authorization", `Bearer ${buyers[6].token}`)
        .send({ quantity: 1 }),
      request(app)
        .post(`/api/customers/${buyers[7].id}/purchase`)
        .set("Authorization", `Bearer ${buyers[7].token}`)
        .send({ quantity: 1 }),
      request(app)
        .post(`/api/customers/${buyers[8].id}/purchase`)
        .set("Authorization", `Bearer ${buyers[8].token}`)
        .send({ quantity: 1 }),
      request(app)
        .post(`/api/customers/${buyers[9].id}/purchase`)
        .set("Authorization", `Bearer ${buyers[9].token}`)
        .send({ quantity: 1 }),
    ];

    await Promise.all(concurrentOperations);

    const totalInDb = await Ticket.countDocuments({});
    expect(totalInDb).toBe(10);

    const soldCount = await Ticket.countDocuments({ status: "sold" });
    const availCount = await Ticket.countDocuments({ status: "available" });

    expect(soldCount + availCount).toBe(10);
  });
});
