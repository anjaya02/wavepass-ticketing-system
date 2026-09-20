const Ticket = require("../models/ticket");
const VendorModel = require("../models/vendor");

const { Mutex } = require("async-mutex");
const mongoose = require("mongoose");
const { getIO } = require("../utils/socket");
const socketEvents = require("../utils/socketEvents");
const logger = require("../utils/logger");

const getFixedTicketPrice = () => {
  return parseInt(process.env.TICKET_PRICE, 10) || 2800;
};

/**
 * Safely retrieve the Socket.IO server instance.
 * Returns null if Socket.IO is not initialized (e.g. during headless unit testing).
 */
const safelyGetIO = () => {
  try {
    return getIO();
  } catch (err) {
    return null;
  }
};

/**
 * Shared TicketPool repository managing ticket inventory, concurrency locks,
 * and real-time event notifications.
 */
class TicketPool {
  #totalTickets;
  #maxCapacity;
  #mutex;
  #ticketReleaseRate;
  #customerRetrievalRate;

  constructor() {
    if (TicketPool.instance) {
      return TicketPool.instance;
    }
    this.#totalTickets = 500;
    this.#maxCapacity = 200;
    this.#ticketReleaseRate = 10000;
    this.#customerRetrievalRate = 15000;
    this.#mutex = new Mutex();
    TicketPool.instance = this;
    logger.info("TicketPool singleton instance created.");
  }

  async initialize({ totalTickets, ticketReleaseRate, customerRetrievalRate, maxTicketCapacity } = {}) {
    if (totalTickets) this.setTotalTickets(totalTickets);
    if (maxTicketCapacity) this.setMaxCapacity(maxTicketCapacity);
    if (ticketReleaseRate) this.#ticketReleaseRate = parseInt(ticketReleaseRate, 10);
    if (customerRetrievalRate) this.#customerRetrievalRate = parseInt(customerRetrievalRate, 10);

    const availableTicketsCount = await this.getAvailableTickets();
    logger.info(`Ticket pool initialized with capacity=${this.#maxCapacity}, totalTickets=${this.#totalTickets}, currently available=${availableTicketsCount}.`);

    const io = safelyGetIO();
    if (io) {
      io.emit(socketEvents.SYSTEM_STATUS, {
        status: "initialized",
        message: "Ticket pool has been initialized successfully.",
        eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
      });
    }
  }

  getTotalTickets() {
    return this.#totalTickets;
  }

  setTotalTickets(total) {
    const val = parseInt(total, 10);
    if (!isNaN(val) && val > 0) {
      this.#totalTickets = val;
    }
  }

  getMaxCapacity() {
    return this.#maxCapacity;
  }

  setMaxCapacity(capacity) {
    if (capacity > 0) {
      this.#maxCapacity = capacity;
    }
  }

  /**
   * Calculates currently available capacity in the pool.
   */
  async getAvailableSpace(session = null) {
    const query = Ticket.countDocuments({ status: "available" });
    if (session) query.session(session);
    const availableCount = await query;
    return Math.max(0, this.#maxCapacity - availableCount);
  }

  /**
   * Retrieves the current count of available tickets.
   */
  async getAvailableTickets() {
    return await Ticket.countDocuments({ status: "available" });
  }

  /**
   * Counts the total number of available tickets released across all vendors.
   */
  async getTotalReleasedTickets() {
    return await Ticket.countDocuments({ status: "available" });
  }

  /**
   * Counts available tickets released by a specific vendor.
   */
  async getReleasedTickets(vendorId) {
    return await Ticket.countDocuments({
      vendor: vendorId,
      status: "available",
    });
  }

  /**
   * Producer Operation: Add/Release tickets to the shared pool.
   * Uses mutual exclusion to protect the critical capacity calculation and space reservation.
   *
   * @param {number} ticketCount - Desired number of tickets to release
   * @param {string|ObjectId} vendorId - ID of the vendor releasing tickets
   * @param {ClientSession} [session] - Optional Mongoose session
   * @returns {Promise<{ added: number, notAdded: number }>}
   */
  async addTickets(ticketCount, vendorId, session = null) {
    const count = parseInt(ticketCount, 10);
    if (isNaN(count) || count <= 0) {
      return { added: 0, notAdded: 0 };
    }

    let ticketsActuallyAdded = 0;
    let ticketsNotAdded = 0;
    let totalAvailableAfter = 0;

    // Critical Section: Calculate space and insert tickets atomically under mutex
    await this.#mutex.runExclusive(async () => {
      const availableSpace = await this.getAvailableSpace(session);
      const totalCreated = await Ticket.countDocuments({});
      const remainingTotalTickets = Math.max(0, this.#totalTickets - totalCreated);

      const allowedToAdd = Math.min(count, availableSpace, remainingTotalTickets);

      if (allowedToAdd <= 0) {
        ticketsActuallyAdded = 0;
        ticketsNotAdded = count;
        return;
      }

      ticketsActuallyAdded = allowedToAdd;
      ticketsNotAdded = count - ticketsActuallyAdded;

      const price = getFixedTicketPrice();
      const eventName = process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System";
      const eventDate = process.env.EVENT_DATE ? new Date(process.env.EVENT_DATE) : new Date("2024-12-20");

      const ticketsToCreate = [];
      for (let i = 0; i < ticketsActuallyAdded; i++) {
        ticketsToCreate.push({
          status: "available",
          vendor: vendorId,
          price: price,
          eventName: eventName,
          eventDate: eventDate,
        });
      }

      if (ticketsToCreate.length > 0) {
        const insertOptions = session ? { session } : {};
        await Ticket.insertMany(ticketsToCreate, insertOptions);
      }

      totalAvailableAfter = await this.getTotalReleasedTickets();
    });

    logger.info(
      `Vendor ${vendorId} added ${ticketsActuallyAdded} tickets to pool (${ticketsNotAdded} rejected by capacity limit).`
    );

    // Emit Socket.IO updates strictly after successful database insert
    const io = safelyGetIO();
    if (io && ticketsActuallyAdded > 0) {
      const eventPayload = {
        vendorId: vendorId ? vendorId.toString() : null,
        quantity: ticketsActuallyAdded,
        releasedTickets: ticketsActuallyAdded,
        message: `${ticketsActuallyAdded} tickets released successfully.`,
        eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
        availableTickets: totalAvailableAfter,
      };

      // Broadcast ticket update to all clients
      io.emit(socketEvents.TICKET_UPDATE, {
        eventName: eventPayload.eventName,
        eventDate: eventPayload.eventDate,
        availableTickets: totalAvailableAfter,
      });

      // Broadcast vendor released tickets
      io.emit(socketEvents.VENDOR_RELEASED_TICKETS, eventPayload);
    }

    return {
      added: ticketsActuallyAdded,
      notAdded: ticketsNotAdded,
    };
  }

  /**
   * Alias for addTickets to support uniform naming across interfaces.
   */
  async releaseTickets(ticketCount, vendorId, session = null) {
    const result = await this.addTickets(ticketCount, vendorId, session);
    return result.added;
  }

  /**
   * Consumer Operation: Removes one available ticket from the pool and assigns it to customer.
   * Utilizes MongoDB's atomic findOneAndUpdate conditional update to ensure mutual exclusion
   * at the database level.
   *
   * @param {string|ObjectId} customerId
   * @returns {Promise<Document|null>}
   */
  async removeOneTicket(customerId) {
    const ticket = await Ticket.findOneAndUpdate(
      { status: "available" },
      { $set: { status: "sold", owner: customerId } },
      { new: true }
    );

    if (ticket) {
      logger.info(`Ticket ${ticket._id} atomically purchased by customer ${customerId}.`);
      return ticket;
    }

    logger.warn(`Ticket purchase attempt failed: No available tickets in pool.`);
    return null;
  }

  /**
   * Sells a single ticket to a customer and emits real-time events.
   */
  async sellTicket(customerId, session = null) {
    const queryOptions = { new: true };
    if (session) queryOptions.session = session;

    const availableTicket = await Ticket.findOneAndUpdate(
      { status: "available" },
      { $set: { status: "sold", owner: customerId } },
      queryOptions
    );

    if (availableTicket) {
      const totalAvailable = await this.getTotalReleasedTickets();
      const io = safelyGetIO();
      if (io) {
        io.emit(socketEvents.TICKET_SOLD, {
          ticketId: availableTicket._id.toString(),
          availableTickets: totalAvailable,
          message: "A ticket has been sold.",
        });
        io.emit(socketEvents.TICKET_UPDATE, {
          eventName: availableTicket.eventName,
          eventDate: availableTicket.eventDate,
          availableTickets: totalAvailable,
        });
      }
      return availableTicket;
    }

    return null;
  }

  /**
   * Consumer Operation: Synchronously purchases multiple tickets for a customer.
   * Allocates tickets using atomic conditional updates to prevent partial race conditions.
   *
   * @param {string|ObjectId} customerId
   * @param {number} ticketCount
   * @returns {Promise<{ purchasedTickets: Array, notPurchased: number }>}
   */
  async purchaseMultipleTickets(customerId, ticketCount) {
    const count = parseInt(ticketCount, 10);
    if (isNaN(count) || count <= 0) {
      return { purchasedTickets: [], notPurchased: 0 };
    }

    const purchasedTickets = [];

    for (let i = 0; i < count; i++) {
      const ticket = await this.removeOneTicket(customerId);
      if (!ticket) {
        break; // Pool exhausted
      }
      purchasedTickets.push(ticket);
    }

    const notPurchased = count - purchasedTickets.length;

    // Emit real-time events after successful purchases
    if (purchasedTickets.length > 0) {
      const totalAvailable = await this.getTotalReleasedTickets();
      const io = safelyGetIO();
      if (io) {
        purchasedTickets.forEach((t) => {
          io.emit(socketEvents.TICKET_SOLD, {
            ticketId: t._id.toString(),
            availableTickets: totalAvailable,
            message: "A ticket has been sold.",
          });
        });
        io.emit(socketEvents.TICKET_UPDATE, {
          eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
          eventDate: process.env.EVENT_DATE || "2024-12-20",
          availableTickets: totalAvailable,
        });
      }
    }

    return {
      purchasedTickets,
      notPurchased,
    };
  }

  /**
   * Consumer Operation: Atomically refunds a ticket back to the available pool.
   * Validates customer ownership and sold status in a single atomic condition to prevent
   * double-refunds and unauthorized refunds.
   *
   * @param {string|ObjectId} ticketId
   * @param {string|ObjectId} customerId
   * @returns {Promise<Document|null>}
   */
  async refundTicket(ticketId, customerId) {
    let updatedTicket = null;

    // Mutex protects capacity check and status update to guarantee:
    // available tickets <= maxTicketCapacity even under concurrent vendor releases
    await this.#mutex.runExclusive(async () => {
      const availableSpace = await this.getAvailableSpace();
      if (availableSpace <= 0) {
        throw new Error("Cannot refund ticket: ticket pool is at maximum capacity.");
      }

      // Atomic conditional refund: Ticket must match ticketId, must belong to customerId, and must be sold
      updatedTicket = await Ticket.findOneAndUpdate(
        {
          _id: ticketId,
          owner: customerId,
          status: "sold",
        },
        {
          $set: {
            status: "available",
            owner: null,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );
    });

    if (!updatedTicket) {
      return null;
    }

    const totalAvailable = await this.getTotalReleasedTickets();
    const io = safelyGetIO();
    if (io) {
      io.emit(socketEvents.TICKET_REFUNDED, {
        customerId: customerId.toString(),
        ticketId: ticketId.toString(),
        message: "Ticket refunded successfully.",
        eventName: updatedTicket.eventName,
        eventDate: updatedTicket.eventDate,
      });

      io.emit(socketEvents.TICKET_UPDATE, {
        availableTickets: totalAvailable,
        eventName: updatedTicket.eventName,
        eventDate: updatedTicket.eventDate,
      });
    }

    logger.info(`Ticket ${ticketId} refunded successfully by customer ${customerId}.`);
    return updatedTicket;
  }

  /**
   * Adds an existing ticket document back to the pool (compatibility helper).
   */
  async addExistingTicket(ticket, session = null) {
    ticket.status = "available";
    ticket.owner = null;
    ticket.updatedAt = new Date();
    const saveOptions = session ? { session } : {};
    await ticket.save(saveOptions);
    logger.info(`Ticket ${ticket._id} added back to the pool.`);
  }

  /**
   * Re-adds an existing ticket by ID (compatibility helper).
   */
  async reAddTicket(ticketId, session = null) {
    return await this.#mutex.runExclusive(async () => {
      const availableSpace = await this.getAvailableSpace(session);
      if (availableSpace <= 0) {
        throw new Error("Ticket pool is full.");
      }

      const queryOptions = { new: true };
      if (session) queryOptions.session = session;

      const ticket = await Ticket.findOneAndUpdate(
        { _id: ticketId, status: "sold" },
        { $set: { status: "available", owner: null } },
        queryOptions
      );

      if (ticket) {
        const io = safelyGetIO();
        if (io) {
          const totalAvailable = await this.getTotalReleasedTickets();
          io.emit(socketEvents.TICKET_UPDATE, {
            eventName: ticket.eventName,
            eventDate: ticket.eventDate,
            availableTickets: totalAvailable,
          });
        }
        return ticket;
      }
      return null;
    });
  }

  /**
   * Deletes all available tickets from the pool and adjusts vendor counts.
   */
  async deleteAvailableTickets() {
    const session = await mongoose.startSession();
    try {
      let deletedCount = 0;
      await session.withTransaction(async () => {
        const availableTickets = await Ticket.find({ status: "available" }).session(session);
        deletedCount = availableTickets.length;

        await Ticket.deleteMany({ status: "available" }).session(session);

        const vendorTicketCounts = {};
        availableTickets.forEach((ticket) => {
          if (ticket.vendor) {
            const vendorId = ticket.vendor.toString();
            vendorTicketCounts[vendorId] = (vendorTicketCounts[vendorId] || 0) + 1;
          }
        });

        const vendorUpdates = Object.entries(vendorTicketCounts).map(([vendorId, count]) =>
          VendorModel.findByIdAndUpdate(
            vendorId,
            { $inc: { addedTickets: -count } },
            { session }
          )
        );
        await Promise.all(vendorUpdates);
      });

      const io = safelyGetIO();
      if (io) {
        io.emit(socketEvents.SYSTEM_STATUS, {
          status: "tickets_deleted",
          message: `${deletedCount} available tickets have been deleted.`,
          eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
          eventDate: process.env.EVENT_DATE || "2024-12-20",
        });
        io.emit(socketEvents.TICKET_UPDATE, {
          eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
          eventDate: process.env.EVENT_DATE || "2024-12-20",
          availableTickets: 0,
        });
      }

      logger.info(`Deleted ${deletedCount} available tickets and updated vendor records.`);
      return deletedCount;
    } catch (err) {
      // Fallback for standalone MongoDB environments where transactions are not supported
      logger.warn("Transaction failed in deleteAvailableTickets, falling back to atomic sequence:", err.message);
      const availableTickets = await Ticket.find({ status: "available" });
      const deleteResult = await Ticket.deleteMany({ status: "available" });

      const vendorTicketCounts = {};
      availableTickets.forEach((ticket) => {
        if (ticket.vendor) {
          const vendorId = ticket.vendor.toString();
          vendorTicketCounts[vendorId] = (vendorTicketCounts[vendorId] || 0) + 1;
        }
      });

      const vendorUpdates = Object.entries(vendorTicketCounts).map(([vendorId, count]) =>
        VendorModel.findByIdAndUpdate(vendorId, { $inc: { addedTickets: -count } })
      );
      await Promise.all(vendorUpdates);

      const io = safelyGetIO();
      if (io) {
        io.emit(socketEvents.SYSTEM_STATUS, {
          status: "tickets_deleted",
          message: `${deleteResult.deletedCount} available tickets have been deleted.`,
          eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
          eventDate: process.env.EVENT_DATE || "2024-12-20",
        });
        io.emit(socketEvents.TICKET_UPDATE, {
          eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
          eventDate: process.env.EVENT_DATE || "2024-12-20",
          availableTickets: 0,
        });
      }

      return deleteResult.deletedCount;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Resets the ticket pool (used in automated tests).
   */
  async resetPool() {
    await this.#mutex.runExclusive(async () => {
      await Ticket.deleteMany({});
      logger.info("Ticket pool has been completely reset.");
    });
  }
}

const instance = new TicketPool();
module.exports = instance;
