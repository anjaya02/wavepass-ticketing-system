const Ticket = require("../models/ticket");
const VendorModel = require("../models/vendor");
const { Mutex } = require("async-mutex");
const mongoose = require("mongoose");
const { getIO, getConnectedVendorSocketId } = require("../utils/socket");
const socketEvents = require("../utils/socketEvents");

const FIXED_TICKET_PRICE = parseInt(process.env.TICKET_PRICE, 10) || 2800;

class TicketPool {
  #maxCapacity;
  #mutex; // Mutex for thread-safe operations
  #ticketReleaseRate;
  #customerRetrievalRate;

  constructor() {
    if (TicketPool.instance) {
      return TicketPool.instance;
    }
    this.#maxCapacity = 0; // Will be set during initialization
    this.#ticketReleaseRate = 10000; // Default value (in milliseconds)
    this.#customerRetrievalRate = 15000; // Default value (in milliseconds)
    this.#mutex = new Mutex();
    TicketPool.instance = this;
    console.log("TicketPool instance created.");
  }

  // Getter to retrieve the max capacity
  getMaxCapacity() {
    return this.#maxCapacity;
  }

  // Method to get available space
  async getAvailableSpace(session = null) {
    const availableCount = await Ticket.countDocuments({
      status: "available",
    }).session(session);
    return this.#maxCapacity - availableCount;
  }

  // Method to get the count of available tickets
  async getAvailableTickets() {
    try {
      const count = await Ticket.countDocuments({ status: "available" });
      return count;
    } catch (error) {
      console.error("Error in getAvailableTickets:", error);
      throw error;
    }
  }

  // Removes one available ticket and assigns it to a customer.
  async removeOneTicket(customerId) {
    const release = await this.#mutex.acquire();
    try {
      const ticket = await Ticket.findOneAndUpdate(
        { status: "available" },
        { status: "sold", owner: customerId },
        { new: true }
      );

      if (ticket) {
        console.log(`Ticket ${ticket._id} sold to customer ${customerId}`);
        return ticket;
      } else {
        console.log("No available tickets to remove.");
        return null;
      }
    } catch (error) {
      console.error("Error in removeOneTicket:", error);
      throw error;
    } finally {
      release();
    }
  }

  // Counts the number of released tickets for a specific vendor
  async getReleasedTickets(vendorId) {
    try {
      const count = await Ticket.countDocuments({
        vendor: vendorId,
        status: "available",
      });
      return count;
    } catch (error) {
      console.error("Error in getReleasedTickets:", error);
      throw error;
    }
  }

  // Counts the total number of released tickets across all vendors
  async getTotalReleasedTickets() {
    try {
      const count = await Ticket.countDocuments({ status: "available" });
      return count; 
    } catch (error) {
      console.error("Error in getTotalReleasedTickets:", error);
      throw error;
    }
  }

  // Adds an existing ticket back to the pool (used for refunds)
  async addExistingTicket(ticket, session = null) {
    try {
      ticket.status = "available";
      ticket.owner = null;
      ticket.updatedAt = new Date();
      await ticket.save({ session });
      console.log(`Ticket ${ticket._id} added back to the pool.`);
    } catch (error) {
      console.error("Error in addExistingTicket:", error);
      throw error;
    }
  }

  // Adds tickets to the pool
  async addTickets(ticketCount, vendorId, session = null) {
    console.log(
      `Received request to add ${ticketCount} tickets for vendor ${vendorId}.`
    );
    let ticketsActuallyAdded = 0;
    let ticketsNotAdded = 0;

    await this.#mutex.runExclusive(async () => {
      const availableSpace = await this.getAvailableSpace(session);
      console.log(`Available space in the pool: ${availableSpace}`);

      // Prevent adding more tickets than available space
      if (ticketCount <= 0 || availableSpace <= 0) {
        console.log("No tickets to add or pool is full.");
        ticketsActuallyAdded = 0;
        ticketsNotAdded = ticketCount;
        return;
      }

      ticketsActuallyAdded = Math.min(ticketCount, availableSpace);
      ticketsNotAdded = ticketCount - ticketsActuallyAdded;

      console.log(
        `Attempting to add ${ticketsActuallyAdded} tickets for vendor ${vendorId}.`
      );

      const newTickets = [];

      for (let i = 0; i < ticketsActuallyAdded; i++) {
        const newTicket = new Ticket({
          status: "available",
          vendor: vendorId,
          price: FIXED_TICKET_PRICE,
          eventName: "WavePass: Your Boat Ride Ticketing System",
          eventDate: new Date("2024-12-20"),
        });
        await newTicket.save(session ? { session } : {});
        newTickets.push(newTicket); // Collect tickets to emit events later
      }

      console.log(
        `${ticketsActuallyAdded} tickets added to the pool by vendor ${vendorId}.`
      );

      // Emit VENDOR_RELEASED_TICKETS and TICKET_UPDATE events to the specific vendor
      const io = getIO();
      const vendorSocketId = getConnectedVendorSocketId(vendorId.toString());

      const totalReleasedTickets = await this.getTotalReleasedTickets();
      console.log("Emitting VENDOR_RELEASED_TICKETS with availableTickets:", totalReleasedTickets);

      if (vendorSocketId) {
        io.to(vendorSocketId).emit(socketEvents.VENDOR_RELEASED_TICKETS, {
          vendorId: vendorId.toString(),
          quantity: ticketsActuallyAdded,
          message: `${ticketsActuallyAdded} tickets released successfully.`,
          eventName: "WavePass: Your Boat Ride Ticketing System",
          eventDate: "2024-12-20",
          availableTickets: totalReleasedTickets,
          releasedTickets: ticketsActuallyAdded,
        });

        io.to(vendorSocketId).emit(socketEvents.TICKET_UPDATE, {
          eventName: "WavePass: Your Boat Ride Ticketing System",
          eventDate: "2024-12-20",
          availableTickets: totalReleasedTickets,
        });
      }

      if (ticketsNotAdded > 0) {
        console.log(
          `${ticketsNotAdded} tickets could not be added because the pool is full.`
        );
      }
    });

    return {
      added: ticketsActuallyAdded,
      notAdded: ticketsNotAdded,
    };
  }

  // Sells a single ticket to a customer
  async sellTicket(customerId, session = null) {
    return await this.#mutex.runExclusive(async () => {
      const queryOptions = session ? { session } : {};
      const availableTicket = await Ticket.findOneAndUpdate(
        { status: "available" }, // Find the first available ticket
        { status: "sold", owner: customerId }, // Mark it as sold and assign the customer
        { new: true, ...queryOptions } // Return the updated ticket
      );

      if (availableTicket) {
        console.log(`Ticket purchased by customer: ${customerId}`);

        // Emit ticketSold event to all clients
        const io = getIO();
        const totalReleasedTickets = await this.getTotalReleasedTickets();
        io.emit(socketEvents.TICKET_SOLD, {
          ticketId: availableTicket._id.toString(),
          availableTickets: totalReleasedTickets,
          message: "A ticket has been sold.",
        });

        return availableTicket;
      } else {
        console.log("No tickets available!");
        return null;
      }
    });
  }

  // Sells multiple tickets to a customer (bulk purchase)
  async sellMultipleTickets(customerId, ticketCount, session = null) {
    return await this.#mutex.runExclusive(async () => {
      const queryOptions = session ? { session } : {};
      const availableTickets = await Ticket.find({ status: "available" })
        .limit(ticketCount)
        .session(session)
        .exec();

      const purchasedTickets = [];

      for (const ticket of availableTickets) {
        ticket.status = "sold";
        ticket.owner = customerId;
        await ticket.save({ session });
        purchasedTickets.push(ticket);

        const io = getIO();
        const totalReleasedTickets = await this.getTotalReleasedTickets();
        io.emit(socketEvents.TICKET_SOLD, {
          ticketId: ticket._id.toString(),
          availableTickets: totalReleasedTickets,
          message: "A ticket has been sold.",
        });
      }

      const notPurchased = ticketCount - purchasedTickets.length;

      return {
        purchasedTickets,
        notPurchased,
      };
    });
  }

  // Releases tickets back to the pool
  async releaseTickets(ticketCount, vendorId, session = null) {
    console.log(`Received request to release ${ticketCount} tickets.`);
    let ticketsActuallyReleased = 0;
    let ticketsNotReleased = 0;

    await this.#mutex.runExclusive(async () => {
      const availableSpace = await this.getAvailableSpace(session);
      console.log(`Available space in the pool: ${availableSpace}`);

      // Prevent releasing more tickets than available space
      if (ticketCount <= 0 || availableSpace <= 0) {
        console.log("No tickets to release or pool is full.");
        ticketsActuallyReleased = 0;
        ticketsNotReleased = ticketCount;
        return;
      }

      ticketsActuallyReleased = Math.min(ticketCount, availableSpace);
      ticketsNotReleased = ticketCount - ticketsActuallyReleased;

      console.log(`Attempting to release ${ticketsActuallyReleased} tickets.`);

      const releasedTickets = [];

      for (let i = 0; i < ticketsActuallyReleased; i++) {
        const newTicket = new Ticket({
          status: "available",
          vendor: vendorId,
          price: FIXED_TICKET_PRICE,
          eventName: "WavePass: Your Boat Ride Ticketing System",
          eventDate: new Date("2024-12-20"),
        });
        await newTicket.save(session ? { session } : {});
        releasedTickets.push(newTicket);
      }

      console.log(`${ticketsActuallyReleased} tickets released to the pool.`);

      // Emit VENDOR_RELEASED_TICKETS and TICKET_UPDATE events to the specific vendor
      const io = getIO();
      const vendorSocketId = getConnectedVendorSocketId(vendorId.toString());

      const totalReleasedTickets = await this.getTotalReleasedTickets();
      console.log("Emitting VENDOR_RELEASED_TICKETS with availableTickets:", totalReleasedTickets);

      if (vendorSocketId) {
        io.to(vendorSocketId).emit(socketEvents.VENDOR_RELEASED_TICKETS, {
          vendorId: vendorId.toString(),
          quantity: ticketsActuallyReleased,
          message: `${ticketsActuallyReleased} tickets released successfully.`,
          eventName: "WavePass: Your Boat Ride Ticketing System",
          eventDate: "2024-12-20",
          availableTickets: totalReleasedTickets,
          releasedTickets: ticketsActuallyReleased,
        });

        io.to(vendorSocketId).emit(socketEvents.TICKET_UPDATE, {
          eventName: "WavePass: Your Boat Ride Ticketing System",
          eventDate: "2024-12-20",
          availableTickets: totalReleasedTickets,
        });
      }

      if (ticketsNotReleased > 0) {
        console.log(
          `${ticketsNotReleased} tickets could not be released because the pool is full.`
        );
      }
    });

    return ticketsActuallyReleased;
  }

  // Initializes the ticket pool by loading available tickets from the database
  async initialize({
    totalTickets,
    ticketReleaseRate,
    customerRetrievalRate,
    maxTicketCapacity,
  }) {
    try {
      this.#maxCapacity = maxTicketCapacity;
      this.#ticketReleaseRate = ticketReleaseRate;
      this.#customerRetrievalRate = customerRetrievalRate;

      // Load available tickets from the database
      const availableTicketsCount = await this.getAvailableTickets();
      console.log(
        `\n${availableTicketsCount} tickets loaded from the database.`
      );

      // Ensure that the number of available tickets does not exceed maxCapacity
      if (availableTicketsCount > this.#maxCapacity) {
        console.warn(
          "Available tickets exceed max capacity. Trimming excess tickets."
        );
      }

      console.log(
        `Ticket pool initialized with ${availableTicketsCount} tickets.`
      );

      // Emit systemStatus event for initialization
      const io = getIO();
      io.emit(socketEvents.SYSTEM_STATUS, {
        status: "initialized",
        message: "Ticket pool has been initialized successfully.",
        eventName: "WavePass: Your Boat Ride Ticketing System",
        eventDate: "2024-12-20",
      });
    } catch (error) {
      console.error("Error initializing ticket pool:", error);
      throw error;
    }
  }

  async deleteAvailableTickets() {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step 1: Find all available tickets before deleting them
      const availableTickets = await Ticket.find({
        status: "available",
      }).session(session);
      console.log("Tickets before deletion:", availableTickets); // Log tickets before deletion
      console.log(
        `Available tickets before deletion: ${availableTickets.length}`
      );

      // Step 2: Delete all available tickets
      const deleteResult = await Ticket.deleteMany({
        status: "available",
      }).session(session);
      console.log(`Deleted ${deleteResult.deletedCount} tickets.`);

      // Step 3: Identify vendors associated with deleted tickets
      const vendorTicketCounts = {};
      availableTickets.forEach((ticket) => {
        if (ticket.vendor) {
          const vendorId = ticket.vendor.toString();
          if (vendorTicketCounts[vendorId]) {
            vendorTicketCounts[vendorId]++;
          } else {
            vendorTicketCounts[vendorId] = 1;
          }
          console.log(`Detected vendor ${vendorId} for ticket deletion.`);
        } else {
          console.log(`No vendor found for ticket: ${ticket._id}`);
        }
      });

      // Step 4: Reset addedTickets for affected vendors
      const vendorUpdates = Object.entries(vendorTicketCounts).map(
        ([vendorId, count]) => {
          console.log(`Resetting addedTickets for vendor: ${vendorId}`);
          return VendorModel.findByIdAndUpdate(
            vendorId,
            { $inc: { addedTickets: -count } },
            { new: true, session }
          );
        }
      );

      await Promise.all(vendorUpdates);
      console.log(`Vendors' addedTickets updated accordingly.`);

      // Step 5: Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Step 6: Emit systemStatus event after deletion
      const io = getIO();
      io.emit(socketEvents.SYSTEM_STATUS, {
        status: "tickets_deleted",
        message: `${deleteResult.deletedCount} available tickets have been deleted.`,
        eventName: "WavePass: Your Boat Ride Ticketing System",
        eventDate: "2024-12-20",
      });

      return deleteResult.deletedCount; // Return the number of deleted tickets
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error in deleteAvailableTickets:", error);
      throw new Error("Failed to delete available tickets.");
    }
  }

  // Re-adds an existing ticket back to the pool
  async reAddTicket(ticketId, session = null) {
    return await this.#mutex.runExclusive(async () => {
      // Ensure we don't exceed max capacity
      const availableSpace = await this.getAvailableSpace(session);
      if (availableSpace <= 0) {
        console.log("Cannot re-add ticket; pool is full.");
        throw new Error("Ticket pool is full.");
      }

      // Update ticket status and owner
      const ticket = await Ticket.findByIdAndUpdate(
        ticketId,
        { status: "available", owner: null },
        { new: true, session }
      );

      if (ticket) {
        console.log(`Ticket ${ticketId} re-added to the pool.`);

        // Emit ticketUpdate event
        const io = getIO();
        const totalReleasedTickets = await this.getTotalReleasedTickets();
        io.emit(socketEvents.TICKET_UPDATE, {
          eventName: "WavePass: Your Boat Ride Ticketing System",
          eventDate: "2024-12-20",
          availableTickets: totalReleasedTickets,
        });

        return ticket;
      } else {
        console.log(`Failed to re-add ticket: ${ticketId}`);
        return null;
      }
    });
  }

  // Resets the ticket pool (for testing purposes).
  async resetPool() {
    await this.#mutex.runExclusive(async () => {
      // Delete all available tickets from the database
      await Ticket.deleteMany({ status: "available" });
      console.log("Ticket pool has been reset.");
    });
  }
}

const instance = new TicketPool();
module.exports = instance;
