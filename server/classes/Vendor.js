const { getIO } = require("../utils/socket");
const socketEvents = require("../utils/socketEvents");
const VendorModel = require("../models/vendor");
const ticketPool = require("../classes/TicketPool");
const logger = require("../utils/logger");

const safelyGetIO = () => {
  try {
    return getIO();
  } catch (err) {
    return null;
  }
};

/**
 * Vendor service class responsible for managing periodic ticket release intervals.
 */
class Vendor {
  constructor(vendorId, ticketsPerRelease, ticketReleaseRate) {
    if (!vendorId) {
      throw new Error("vendorId is required.");
    }

    const perRelease = parseInt(ticketsPerRelease, 10);
    if (isNaN(perRelease) || perRelease <= 0) {
      throw new Error("ticketsPerRelease must be a positive integer.");
    }

    const releaseRate = parseInt(ticketReleaseRate, 10);
    if (isNaN(releaseRate) || releaseRate <= 0) {
      throw new Error("ticketReleaseRate must be a positive integer (in milliseconds).");
    }

    this.vendorId = vendorId.toString();
    this.ticketsPerRelease = perRelease;
    this.releaseInterval = releaseRate;
    this.intervalId = null;
  }

  /**
   * Starts periodic automated ticket release into the shared TicketPool.
   *
   * @param {TicketPool} ticketPoolInstance
   */
  async startReleasingTickets(ticketPoolInstance = ticketPool) {
    if (this.intervalId) {
      logger.warn(`Vendor ${this.vendorId} is already actively releasing tickets.`);
      return;
    }

    logger.info(`Vendor ${this.vendorId} starting automated ticket release every ${this.releaseInterval} ms.`);

    this.intervalId = setInterval(async () => {
      try {
        const poolResult = await ticketPoolInstance.addTickets(
          this.ticketsPerRelease,
          this.vendorId
        );

        if (poolResult.added > 0) {
          // Atomically increment vendor's lifetime addedTickets count
          const updatedVendor = await VendorModel.findByIdAndUpdate(
            this.vendorId,
            { $inc: { addedTickets: poolResult.added } },
            { new: true }
          );

          if (!updatedVendor) {
            logger.error(`Vendor ${this.vendorId} not found during release. Halting interval.`);
            this.stopReleasingTickets();
            return;
          }

          logger.info(
            `Vendor ${this.vendorId} released ${poolResult.added} tickets (lifetime total: ${updatedVendor.addedTickets}).`
          );
        }

        // Check if pool is full; if so, stop automated release
        const availableSpace = await ticketPoolInstance.getAvailableSpace();
        if (availableSpace === 0) {
          logger.info(`Ticket pool capacity reached. Vendor ${this.vendorId} pausing ticket release.`);
          this.stopReleasingTickets();

          const io = safelyGetIO();
          if (io) {
            io.emit(socketEvents.SYSTEM_STATUS, {
              status: "ticketPoolFull",
              message: `Ticket pool is at maximum capacity. Automated ticket release paused.`,
              eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
              eventDate: process.env.EVENT_DATE || "2024-12-20",
              availableTickets: await ticketPoolInstance.getAvailableTickets(),
            });
          }
        }
      } catch (error) {
        logger.error(`Error during automated ticket release for vendor ${this.vendorId}: %s`, error.message);
      }
    }, this.releaseInterval);
  }

  /**
   * Stops the automated ticket release interval.
   */
  async stopReleasingTickets() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info(`Vendor ${this.vendorId} stopped automated ticket release.`);

      const io = safelyGetIO();
      if (io) {
        const availableTickets = await ticketPool.getAvailableTickets();
        io.emit(socketEvents.SYSTEM_STATUS, {
          status: "ticketReleaseStopped",
          message: `Vendor ${this.vendorId} has stopped releasing tickets.`,
          eventName: process.env.EVENT_NAME || "WavePass: Your Boat Ride Ticketing System",
          eventDate: process.env.EVENT_DATE || "2024-12-20",
          availableTickets,
        });
      }
    }
  }

  /**
   * Updates the release interval and restarts if running.
   */
  async updateReleaseRate(newReleaseRate, ticketPoolInstance = ticketPool) {
    const wasRunning = this.intervalId !== null;
    if (wasRunning) {
      await this.stopReleasingTickets();
    }
    this.releaseInterval = newReleaseRate;
    if (wasRunning) {
      await this.startReleasingTickets(ticketPoolInstance);
    }
  }
}

module.exports = Vendor;
