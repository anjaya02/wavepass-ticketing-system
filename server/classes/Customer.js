const CustomerModel = require("../models/customer");
const Configuration = require("./Configuration"); 

class Customer {
  #customerId; // This will come from MongoDB's ObjectId
  #retrievalInterval;
  #intervalId;
  #ticketPool;

  // Constructs a new Customer instance
  constructor(customerId, ticketPool) {
    // Validate customerId
    if (!customerId) {
      throw new Error("customerId is required.");
    }

    // Ensure a valid ticketPool is provided
    if (!ticketPool || typeof ticketPool.removeTicket !== "function") {
      throw new Error("A valid ticketPool is required.");
    }

    // Initialize configuration
    const config = Configuration.getInstance();
    this.#retrievalInterval = config.getCustomerRetrievalRate();
    this.#intervalId = null;
    this.#ticketPool = ticketPool;
    this.#customerId = customerId;
  }

  // Starts the ticket retrieval process at specified intervals
  startRetrievingTickets() {
    if (this.#intervalId !== null) {
      console.warn(`Customer ${this.#customerId} is already retrieving tickets.`);
      return;
    }

    this.#intervalId = setInterval(async () => {
      try {
        const ticket = await this.#ticketPool.removeTicket(this.#customerId);
        if (ticket) {
          console.log(`Customer ${this.#customerId} retrieved ticket: ${ticket._id}`);
        } else {
          console.log(`Customer ${this.#customerId} attempted to retrieve a ticket, but the pool is empty.`);
        }
      } catch (error) {
        console.error(`Error retrieving ticket for Customer ${this.#customerId}:`, error.message);
      }
    }, this.#retrievalInterval);

    console.log(`Customer ${this.#customerId} started retrieving tickets every ${this.#retrievalInterval} ms.`);
  }

  // Stops the ticket retrieval process
  stopRetrievingTickets() {
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
      console.log(`Customer ${this.#customerId} stopped retrieving tickets.`);
    }
  }

  // Updates the retrieval interval
  setRetrievalInterval(newInterval) {
    if (!Number.isInteger(newInterval) || newInterval <= 0) {
      throw new Error("retrievalInterval must be a positive integer.");
    }

    this.#retrievalInterval = newInterval;

    // If retrieval is already running, restart with the new interval
    if (this.#intervalId !== null) {
      this.stopRetrievingTickets();
      this.startRetrievingTickets();
      console.warn("Retrieval interval updated and retrieval process restarted.");
    }

    console.log(`Customer ${this.#customerId} retrieval interval set to ${this.#retrievalInterval} ms.`);
  }

  // Retrieves the current state of the customer
  getState() {
    return {
      customerId: this.#customerId,
      retrievalInterval: this.#retrievalInterval,
      isRetrieving: this.#intervalId !== null,
    };
  }

  // Associates the customer with the provided ticket pool and sets the customer ID
  associateWithCustomerId(customerId) {
    if (!customerId) {
      throw new Error("customerId is required to associate with the customer.");
    }
    this.#customerId = customerId;
    console.log(`Customer instance associated with customerId: ${this.#customerId}`);
  }

  // Saves the customer instance to the database
  async saveToDatabase() {
    try {
      const updatedCustomer = await CustomerModel.findByIdAndUpdate(
        this.#customerId,
        { retrievalInterval: this.#retrievalInterval },
        { new: true, runValidators: true }
      );

      if (!updatedCustomer) {
        throw new Error("Customer not found in the database.");
      }

      console.log(`Customer ${this.#customerId} updated in the database.`);
      return updatedCustomer;
    } catch (error) {
      console.error(`Error saving customer ${this.#customerId} to database:`, error.message);
      throw error;
    }
  }
}

module.exports = Customer;
