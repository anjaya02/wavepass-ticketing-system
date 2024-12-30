const ConfigurationClass = require("../classes/Configuration");
const ConfigurationModel = require("../models/configuration"); 
const logger = require("../utils/logger"); 
const ticketPool = require('../classes/TicketPool'); 

// Set or Update the Global Configuration
const setConfiguration = async ({ totalTickets, ticketReleaseRate, customerRetrievalRate, maxTicketCapacity }) => {
  try {
    // Find the existing configuration
    let configDoc = await ConfigurationModel.findOne({ singleton: true });
    
    if (configDoc) {
      // Update existing configuration
      configDoc.totalTickets = totalTickets;
      configDoc.ticketReleaseRate = ticketReleaseRate;
      configDoc.customerRetrievalRate = customerRetrievalRate;
      configDoc.maxTicketCapacity = maxTicketCapacity;
      await configDoc.save();
      logger.info("Global configuration updated successfully.");
    } else {
      // Create new configuration
      configDoc = new ConfigurationModel({
        totalTickets,
        ticketReleaseRate,
        customerRetrievalRate,
        maxTicketCapacity,
        singleton: true, // Ensure uniqueness
      });
      await configDoc.save();
      logger.info("Global configuration created successfully.");
    }

    // Update the in-memory Configuration singleton
    const configInstance = await ConfigurationClass.getInstance();
    configInstance.setTotalTickets(totalTickets);
    configInstance.setTicketReleaseRate(ticketReleaseRate);
    configInstance.setCustomerRetrievalRate(customerRetrievalRate);
    configInstance.setMaxTicketCapacity(maxTicketCapacity);

    // Re-initialize TicketPool with new configuration
    await ticketPool.initialize({
      totalTickets,
      ticketReleaseRate,
      customerRetrievalRate,
      maxTicketCapacity,
    });

    return configDoc;
  } catch (error) {
    logger.error("Error in setConfiguration:", error);
    throw error;
  }
};

// Get the Global Configuration
const getConfiguration = async () => {
  try {
    const configuration = await ConfigurationModel.findOne({ singleton: true });

    if (!configuration) {
      return null;
    }

    return configuration;
  } catch (error) {
    logger.error("Error in getConfiguration:", error);
    throw error;
  }
};

const resetConfiguration = async () => {
  try {
    const defaultConfig = {
      totalTickets: 500,
      ticketReleaseRate: 10000,
      customerRetrievalRate: 15000,
      maxTicketCapacity: 200,
    };

    let configuration = await ConfigurationModel.findOne({ singleton: true });

    if (configuration) {
      configuration.totalTickets = defaultConfig.totalTickets;
      configuration.ticketReleaseRate = defaultConfig.ticketReleaseRate;
      configuration.customerRetrievalRate = defaultConfig.customerRetrievalRate;
      configuration.maxTicketCapacity = defaultConfig.maxTicketCapacity;
      await configuration.save();
      logger.info("Global configuration reset to default successfully.");
    } else {
      // Create default configuration
      configuration = new ConfigurationModel({
        ...defaultConfig,
        singleton: true,
      });
      await configuration.save();
      logger.info("Default global configuration created successfully.");
    }

    return configuration;
  } catch (error) {
    logger.error("Error in resetConfiguration:", error);
    throw error;
  }
};

module.exports = {
  setConfiguration,
  getConfiguration,
  resetConfiguration,
};
