const mongoose = require("mongoose");
const ticketPool = require("../../classes/TicketPool");
const Ticket = require("../../models/ticket");
const Customer = require("../../models/customer");
const { testIfDb } = require("../dbCheck");

describe("TicketPool Unit Tests", () => {
  let vendorId;
  let customerId;

  beforeEach(async () => {
    vendorId = new mongoose.Types.ObjectId();
    customerId = new mongoose.Types.ObjectId();

    ticketPool.setMaxCapacity(50);
    ticketPool.setTotalTickets(500);
    if (mongoose.connection.readyState === 1) {
      await Ticket.deleteMany({});
    }
  });

  test("should initialize and maintain maximum capacity property", () => {
    expect(ticketPool.getMaxCapacity()).toBe(50);
    ticketPool.setMaxCapacity(100);
    expect(ticketPool.getMaxCapacity()).toBe(100);
    ticketPool.setMaxCapacity(50);
  });

  test("should reject non-positive ticket releases synchronously", async () => {
    const resultZero = await ticketPool.addTickets(0, vendorId);
    expect(resultZero.added).toBe(0);
    expect(resultZero.notAdded).toBe(0);

    const resultNegative = await ticketPool.addTickets(-5, vendorId);
    expect(resultNegative.added).toBe(0);
    expect(resultNegative.notAdded).toBe(0);

    const resultNaN = await ticketPool.addTickets("invalid", vendorId);
    expect(resultNaN.added).toBe(0);
  });

  testIfDb("should add tickets within maximum capacity limits", async () => {
    const result = await ticketPool.addTickets(30, vendorId);
    expect(result.added).toBe(30);
    expect(result.notAdded).toBe(0);

    const available = await ticketPool.getAvailableTickets();
    expect(available).toBe(30);

    const space = await ticketPool.getAvailableSpace();
    expect(space).toBe(20);
  });

  testIfDb("should reject excess tickets when release exceeds max capacity", async () => {
    await ticketPool.addTickets(40, vendorId);
    const result = await ticketPool.addTickets(20, vendorId);
    expect(result.added).toBe(10);
    expect(result.notAdded).toBe(10);

    const totalAvailable = await ticketPool.getAvailableTickets();
    expect(totalAvailable).toBe(50);
  });

  testIfDb("should atomically remove one ticket and assign to customer", async () => {
    await ticketPool.addTickets(5, vendorId);
    const ticket = await ticketPool.removeOneTicket(customerId);
    expect(ticket).not.toBeNull();
    expect(ticket.status).toBe("sold");
    expect(ticket.owner.toString()).toBe(customerId.toString());
  });

  testIfDb("should return null when removing ticket from empty pool", async () => {
    const ticket = await ticketPool.removeOneTicket(customerId);
    expect(ticket).toBeNull();
  });
});
