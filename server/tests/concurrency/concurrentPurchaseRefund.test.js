const mongoose = require("mongoose");
const request = require("supertest");
const { app } = require("../../server");
const ticketPool = require("../../classes/TicketPool");
const Ticket = require("../../models/ticket");
const Customer = require("../../models/customer");
const Vendor = require("../../models/vendor");
const { describeIfDb } = require("../dbCheck");

describeIfDb("High-Concurrency Stress Test: Interleaved Purchases and Refunds", () => {
  let vendorToken;
  const buyers = [];

  beforeEach(async () => {
    jest.setTimeout(30000);
    await Ticket.deleteMany({});
    await Vendor.deleteMany({});
    await Customer.deleteMany({});

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

  test("Concurrent vendor release and customer refund at capacity boundary must never exceed maxTicketCapacity", async () => {
    // Set capacity to 10
    ticketPool.setMaxCapacity(10);

    // Initial state: 9 available tickets in pool, 1 sold ticket to buyer 0
    // Total in system = 10 (1 sold, 9 available)
    await Ticket.deleteMany({});
    
    // Create 1 sold ticket owned by buyer 0
    const soldTicket = new Ticket({
      status: "sold",
      owner: buyers[0].id,
      vendor: new mongoose.Types.ObjectId(),
      price: 2800,
      eventName: "Capacity Race Event",
      eventDate: new Date("2024-12-20"),
    });
    await soldTicket.save();

    // Create 9 available tickets
    const availTickets = [];
    for (let i = 0; i < 9; i++) {
      availTickets.push({
        status: "available",
        owner: null,
        vendor: new mongoose.Types.ObjectId(),
        price: 2800,
        eventName: "Capacity Race Event",
        eventDate: new Date("2024-12-20"),
      });
    }
    await Ticket.insertMany(availTickets);

    // Concurrently: Vendor attempts to release 3 tickets AND Buyer 0 attempts to refund their sold ticket
    // 9 + 3 + 1 = 13 > 10 (max capacity)
    const [releaseRes, refundRes] = await Promise.all([
      request(app)
        .post("/api/vendor/add-tickets")
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ ticketCount: 3 }),
      request(app)
        .post(`/api/customers/${buyers[0].id}/refund`)
        .set("Authorization", `Bearer ${buyers[0].token}`)
        .send({ ticketId: soldTicket._id.toString() }),
    ]);

    // Available count in DB must NEVER exceed maxCapacity (10)
    const availableInDb = await Ticket.countDocuments({ status: "available" });
    expect(availableInDb).toBeLessThanOrEqual(10);

    const poolAvailable = await ticketPool.getAvailableTickets();
    expect(poolAvailable).toBeLessThanOrEqual(10);
  });
});
