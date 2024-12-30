const ConfigurationModel = require("../models/configuration");

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

  // Singleton Instance
  static async getInstance() {
    if (!Configuration.instance) {
      // Load from the database or create default
      let configDoc = await ConfigurationModel.findOne({ singleton: true });
      if (!configDoc) {
        // Create default configuration
        configDoc = new ConfigurationModel({
          totalTickets: 500,
          ticketReleaseRate: 10000, // ms
          customerRetrievalRate: 15000, // ms
          maxTicketCapacity: 200,
          singleton: true,
        });
        await configDoc.save();
        console.log("Default configuration created.");
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
    if (totalTickets > 0) {
      this.#totalTickets = totalTickets;
    } else {
      throw new Error("Total tickets must be a positive number");
    }
  }

  setTicketReleaseRate(ticketReleaseRate) {
    if (ticketReleaseRate > 0) {
      this.#ticketReleaseRate = ticketReleaseRate;
    } else {
      throw new Error("Ticket release rate must be a positive number");
    }
  }

  setCustomerRetrievalRate(customerRetrievalRate) {
    if (customerRetrievalRate > 0) {
      this.#customerRetrievalRate = customerRetrievalRate;
    } else {
      throw new Error("Customer retrieval rate must be a positive number");
    }
  }

  setMaxTicketCapacity(maxTicketCapacity) {
    if (maxTicketCapacity > 0 && maxTicketCapacity < this.#totalTickets) {
      this.#maxTicketCapacity = maxTicketCapacity;
    } else {
      throw new Error(
        "Max ticket capacity must be less than total tickets and positive"
      );
    }
  }

  // Method to update configuration in the database and in-memory
  async updateConfiguration({
    totalTickets,
    ticketReleaseRate,
    customerRetrievalRate,
    maxTicketCapacity,
  }) {
    // Validate maxTicketCapacity < totalTickets
    if (maxTicketCapacity >= totalTickets) {
      throw new Error("Max ticket capacity must be less than total tickets");
    }

    // Update the properties
    this.setTotalTickets(totalTickets);
    this.setTicketReleaseRate(ticketReleaseRate);
    this.setCustomerRetrievalRate(customerRetrievalRate);
    this.setMaxTicketCapacity(maxTicketCapacity);

    // Update in the database
    await ConfigurationModel.findOneAndUpdate(
      { singleton: true },
      {
        totalTickets: this.#totalTickets,
        ticketReleaseRate: this.#ticketReleaseRate,
        customerRetrievalRate: this.#customerRetrievalRate,
        maxTicketCapacity: this.#maxTicketCapacity,
      },
      { new: true, upsert: true }
    );

    console.log("Configuration updated successfully.");
  }

  // Method to reset configuration to default
  async resetConfiguration() {
    // Reset to default values
    this.setTotalTickets(500);
    this.setTicketReleaseRate(10000);
    this.setCustomerRetrievalRate(15000);
    this.setMaxTicketCapacity(200);

    // Update in the database
    await ConfigurationModel.findOneAndUpdate(
      { singleton: true },
      {
        totalTickets: this.#totalTickets,
        ticketReleaseRate: this.#ticketReleaseRate,
        customerRetrievalRate: this.#customerRetrievalRate,
        maxTicketCapacity: this.#maxTicketCapacity,
      },
      { new: true, upsert: true }
    );

    console.log("Configuration reset to default successfully.");
  }
}

module.exports = Configuration;
