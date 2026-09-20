const ConfigurationModel = require("../models/configuration");
const logger = require("../utils/logger");

class Configuration {
  #totalTickets;
  #ticketReleaseRate;
  #customerRetrievalRate;
  #maxTicketCapacity;

  constructor(
    totalTickets,
    ticketReleaseRate,
    customerRetrievalRate,
    maxTicketCapacity
  ) {
    this.setTotalTickets(totalTickets);
    this.setTicketReleaseRate(ticketReleaseRate);
    this.setCustomerRetrievalRate(customerRetrievalRate);
    this.setMaxTicketCapacity(maxTicketCapacity);
  }

  /**
   * Resets the singleton instance in memory (crucial for isolated test suites)
   */
  static resetInstance() {
    Configuration.instance = null;
  }

  /**
   * Retrieves the Singleton Instance of Configuration, loading from MongoDB or initializing defaults.
   */
  static async getInstance() {
    if (!Configuration.instance) {
      let configDoc = await ConfigurationModel.findOne({ singleton: true });
      if (!configDoc) {
        configDoc = new ConfigurationModel({
          totalTickets: 500,
          ticketReleaseRate: 10000,
          customerRetrievalRate: 15000,
          maxTicketCapacity: 200,
          singleton: true,
        });
        await configDoc.save();
        logger.info("Default system configuration created in database.");
      }

      Configuration.instance = new Configuration(
        configDoc.totalTickets,
        configDoc.ticketReleaseRate,
        configDoc.customerRetrievalRate,
        configDoc.maxTicketCapacity
      );
    }
    return Configuration.instance;
  }

  // Getters
  getTotalTickets() {
    return this.#totalTickets;
  }

  getTicketReleaseRate() {
    return this.#ticketReleaseRate;
  }

  getCustomerRetrievalRate() {
    return this.#customerRetrievalRate;
  }

  getMaxTicketCapacity() {
    return this.#maxTicketCapacity;
  }

  // Setters with validation
  setTotalTickets(totalTickets) {
    const val = parseInt(totalTickets, 10);
    if (!isNaN(val) && val > 0) {
      this.#totalTickets = val;
    } else {
      throw new Error("Total tickets must be a positive integer.");
    }
  }

  setTicketReleaseRate(ticketReleaseRate) {
    const val = parseInt(ticketReleaseRate, 10);
    if (!isNaN(val) && val > 0) {
      this.#ticketReleaseRate = val;
    } else {
      throw new Error("Ticket release rate must be a positive integer (ms).");
    }
  }

  setCustomerRetrievalRate(customerRetrievalRate) {
    const val = parseInt(customerRetrievalRate, 10);
    if (!isNaN(val) && val > 0) {
      this.#customerRetrievalRate = val;
    } else {
      throw new Error("Customer retrieval rate must be a positive integer (ms).");
    }
  }

  setMaxTicketCapacity(maxTicketCapacity) {
    const val = parseInt(maxTicketCapacity, 10);
    if (isNaN(val) || val <= 0) {
      throw new Error("Max ticket capacity must be a positive integer.");
    }
    if (val >= this.#totalTickets) {
      throw new Error("Max ticket capacity must be strictly less than total tickets.");
    }
    this.#maxTicketCapacity = val;
  }

  /**
   * Updates configuration in database and synchronizes in-memory singleton.
   */
  async updateConfiguration({
    totalTickets,
    ticketReleaseRate,
    customerRetrievalRate,
    maxTicketCapacity,
  }) {
    const total = parseInt(totalTickets, 10);
    const maxCap = parseInt(maxTicketCapacity, 10);
    const releaseRate = parseInt(ticketReleaseRate, 10);
    const retrievalRate = parseInt(customerRetrievalRate, 10);

    if (maxCap >= total) {
      throw new Error("Max ticket capacity must be strictly less than total tickets.");
    }

    this.setTotalTickets(total);
    this.setMaxTicketCapacity(maxCap);
    this.setTicketReleaseRate(releaseRate);
    this.setCustomerRetrievalRate(retrievalRate);

    const updatedDoc = await ConfigurationModel.findOneAndUpdate(
      { singleton: true },
      {
        totalTickets: this.#totalTickets,
        ticketReleaseRate: this.#ticketReleaseRate,
        customerRetrievalRate: this.#customerRetrievalRate,
        maxTicketCapacity: this.#maxTicketCapacity,
      },
      { new: true, upsert: true }
    );

    logger.info("System configuration successfully updated and persisted.");
    return updatedDoc;
  }

  /**
   * Resets configuration to default baseline values.
   */
  async resetConfiguration() {
    this.setTotalTickets(500);
    this.setMaxTicketCapacity(200);
    this.setTicketReleaseRate(10000);
    this.setCustomerRetrievalRate(15000);

    const doc = await ConfigurationModel.findOneAndUpdate(
      { singleton: true },
      {
        totalTickets: 500,
        ticketReleaseRate: 10000,
        customerRetrievalRate: 15000,
        maxTicketCapacity: 200,
      },
      { new: true, upsert: true }
    );

    logger.info("System configuration reset to default baseline.");
    return doc;
  }
}

module.exports = Configuration;
