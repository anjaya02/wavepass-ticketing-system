const { getIO } = require("../utils/socket");
const socketEvents = require("../utils/socketEvents");
const VendorModel = require("../models/vendor");
const ticketPool = require("../classes/TicketPool"); 

class Vendor {
  constructor(vendorId, ticketsPerRelease, ticketReleaseRate) {
    if (!vendorId) {
      throw new Error("vendorId is required.");
    }

    if (!Number.isInteger(ticketsPerRelease) || ticketsPerRelease <= 0) {
      throw new Error("ticketsPerRelease must be a positive integer.");
    }

    if (!Number.isInteger(ticketReleaseRate) || ticketReleaseRate <= 0) {
      throw new Error(
        "ticketReleaseRate must be a positive integer (in milliseconds)."
      );
    }

    this.vendorId = vendorId;
    this.ticketsPerRelease = ticketsPerRelease;
    this.releaseInterval = ticketReleaseRate;
    this.intervalId = null;
  }

  async startReleasingTickets(ticketPoolInstance) {
    if (this.intervalId) {
      console.warn(`Vendor ${this.vendorId} is already releasing tickets.`);
      return; // Prevent multiple intervals
    }

    this.intervalId = setInterval(async () => {
      try {
        console.log(
          `Vendor ${this.vendorId} releasing ${this.ticketsPerRelease} tickets.`
        );

        // Add tickets to the pool
        const poolResult = await ticketPoolInstance.addTickets(
          this.ticketsPerRelease,
          this.vendorId
        );

        console.log(
          `Vendor ${this.vendorId} added ${poolResult.added} tickets to the pool.`
        );

        // Update vendor's addedTickets using atomic operation
        if (poolResult.added > 0) {
          const updatedVendor = await VendorModel.findByIdAndUpdate(
            this.vendorId,
            { $inc: { addedTickets: poolResult.added } },
            { new: true }
          );

          if (updatedVendor) {
            console.log(
              `Vendor ${this.vendorId} addedTickets updated to ${updatedVendor.addedTickets}.`
            );
          } else {
            console.error(`Vendor with ID ${this.vendorId} not found.`);
            // Stop releasing tickets if vendor not found
            this.stopReleasingTickets();

            // Emit SYSTEM_STATUS event
            const io = getIO();
            io.emit(socketEvents.SYSTEM_STATUS, {
              status: "vendorNotFound",
              message: `Vendor with ID ${this.vendorId} not found.`,
              eventName:
                process.env.EVENT_NAME ||
                "WavePass: Your Boat Ride Ticketing System",
              eventDate: process.env.EVENT_DATE || "2024-12-20",
            });

            return;
          }

          // Await availableTickets
          const availableTickets = await ticketPoolInstance.getAvailableTickets();

          // Emit VENDOR_RELEASED_TICKETS event
          const io = getIO();
          io.emit(socketEvents.VENDOR_RELEASED_TICKETS, {
            vendorId: this.vendorId,
            releasedTickets: poolResult.added,
            message: `Vendor ${this.vendorId} released ${poolResult.added} tickets.`,
            eventName:
              process.env.EVENT_NAME ||
              "WavePass: Your Boat Ride Ticketing System",
            eventDate: process.env.EVENT_DATE || "2024-12-20",
            availableTickets,
          });

          // Emit TICKET_UPDATE event
          io.emit(socketEvents.TICKET_UPDATE, {
            eventName:
              process.env.EVENT_NAME ||
              "WavePass: Your Boat Ride Ticketing System",
            eventDate: process.env.EVENT_DATE || "2024-12-20",
            availableTickets,
          });

          console.log(
            `Emitted VENDOR_RELEASED_TICKETS and TICKET_UPDATE events for vendor ${this.vendorId}.`
          );
        } else {
          console.log(
            `No tickets were added to the pool for vendor ${this.vendorId}.`
          );
          // Emit an event indicating no tickets were added
          const io = getIO();
          io.emit(socketEvents.SYSTEM_STATUS, {
            status: "noTicketsAdded",
            message: `No tickets were added to the pool for vendor ${this.vendorId}.`,
            eventName:
              process.env.EVENT_NAME ||
              "WavePass: Your Boat Ride Ticketing System",
            eventDate: process.env.EVENT_DATE || "2024-12-20",
          });
        }

        // Check if the pool is full after adding tickets
        const availableSpace = await ticketPoolInstance.getAvailableSpace();
        if (availableSpace === 0) {
          console.log(
            `Ticket pool is full! Vendor ${this.vendorId} is stopping ticket release.`
          );
          this.stopReleasingTickets();

          // Emit SYSTEM_STATUS event
          const io = getIO();
          io.emit(socketEvents.SYSTEM_STATUS, {
            status: "ticketPoolFull",
            message: `Ticket pool is full! Vendor ${this.vendorId} has stopped releasing tickets.`,
            eventName:
              process.env.EVENT_NAME ||
              "WavePass: Your Boat Ride Ticketing System",
            eventDate: process.env.EVENT_DATE || "2024-12-20",
            availableTickets: await ticketPoolInstance.getAvailableTickets(),
          });
        }
      } catch (error) {
        console.error(
          `Error adding tickets for vendor ${this.vendorId}:`,
          error.message
        );

        // Emit SYSTEM_STATUS event indicating error
        const io = getIO();
        io.emit(socketEvents.SYSTEM_STATUS, {
          status: "ticketReleaseError",
          message: `Error releasing tickets for vendor ${this.vendorId}: ${error.message}`,
          eventName:
            process.env.EVENT_NAME ||
            "WavePass: Your Boat Ride Ticketing System",
          eventDate: process.env.EVENT_DATE || "2024-12-20",
        });
      }
    }, this.releaseInterval);

    console.log(
      `Vendor ${this.vendorId} started releasing tickets every ${this.releaseInterval} ms.`
    );
  }

  stopReleasingTickets() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`Vendor ${this.vendorId} stopped releasing tickets.`);

      // Emit SYSTEM_STATUS event indicating ticket release stopped
      const io = getIO();
      io.emit(socketEvents.SYSTEM_STATUS, {
        status: "ticketReleaseStopped",
        message: `Vendor ${this.vendorId} has stopped releasing tickets.`,
        eventName:
          process.env.EVENT_NAME ||
          "WavePass: Your Boat Ride Ticketing System",
        eventDate: process.env.EVENT_DATE || "2024-12-20",
        availableTickets: ticketPool.getAvailableTickets(), 
      });
    } else {
      console.warn(`Vendor ${this.vendorId} is not releasing tickets.`);
    }
  }

  // Updates the ticket release rate
  async updateReleaseRate(newReleaseRate, ticketPoolInstance) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log(
        `Vendor ${this.vendorId} cleared existing interval to update release rate.`
      );
    }

    this.releaseInterval = newReleaseRate;
    console.log(
      `Vendor ${this.vendorId} updated release interval to ${newReleaseRate} ms.`
    );

    // Restart releasing tickets with the new rate
    await this.startReleasingTickets(ticketPoolInstance);
  }
}

module.exports = Vendor;
