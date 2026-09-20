const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const ticketPool = require("../../classes/TicketPool");
const Ticket = require("../../models/ticket");

const isDbConnected = () => mongoose.connection.readyState === 1;

describe("High-Concurrency Stress Test: Simultaneous Vendor Releases Near Capacity", () => {
  const MAX_CAPACITY = 25;
  const VENDOR_COUNT = 5;
  const TICKETS_PER_VENDOR_RELEASE = 10;

  const vendors = [];

  beforeEach(async () => {
    if (!isDbConnected()) return;

    await ticketPool.initialize({
      totalTickets: 100,
      ticketReleaseRate: 5000,
      customerRetrievalRate: 5000,
      maxTicketCapacity: MAX_CAPACITY,
    });

    vendors.length = 0;
    for (let i = 0; i < VENDOR_COUNT; i++) {
      const email = `concurrent_vendor_${i}@example.com`;
      const regRes = await request(app)
        .post("/api/vendor/register")
        .send({
          name: `Vendor ${i}`,
          email,
          password: "VendorPassword123!",
        });

      vendors.push({
        id: regRes.body.vendor.id,
        token: regRes.body.token,
        email,
      });
    }
  });

  test("Simultaneous releases across multiple vendors must never exceed maximum ticket pool capacity", async () => {
    if (!isDbConnected()) return;

    const releasePromises = vendors.map((v) =>
      request(app)
        .post("/api/vendor/add-tickets")
        .set("Authorization", `Bearer ${v.token}`)
        .send({ ticketCount: TICKETS_PER_VENDOR_RELEASE })
    );

    const responses = await Promise.all(releasePromises);

    let totalReportedAdded = 0;
    let totalReportedNotAdded = 0;

    responses.forEach((r) => {
      totalReportedAdded += r.body.addedTickets || 0;
      totalReportedNotAdded += r.body.notAddedTickets || 0;
    });

    expect(totalReportedAdded).toBe(MAX_CAPACITY);
    expect(totalReportedNotAdded).toBe(VENDOR_COUNT * TICKETS_PER_VENDOR_RELEASE - MAX_CAPACITY);

    const countInDb = await Ticket.countDocuments({ status: "available" });
    expect(countInDb).toBe(MAX_CAPACITY);

    const poolAvailable = await ticketPool.getAvailableTickets();
    expect(poolAvailable).toBe(MAX_CAPACITY);

    const poolSpace = await ticketPool.getAvailableSpace();
    expect(poolSpace).toBe(0);
  });
});
