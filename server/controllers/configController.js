const ConfigurationClass = require("../classes/Configuration");
const ConfigurationModel = require("../models/configuration");
const logger = require("../utils/logger");
const ticketPool = require("../classes/TicketPool");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Set or update global system configuration
 */
const setConfiguration = async (req, res, next) => {
  try {
    const { totalTickets, ticketReleaseRate, customerRetrievalRate, maxTicketCapacity } = req.body;

    const total = parseInt(totalTickets, 10);
    const maxCap = parseInt(maxTicketCapacity, 10);
    const releaseRate = parseInt(ticketReleaseRate, 10);
    const retrievalRate = parseInt(customerRetrievalRate, 10);

    if (maxCap >= total) {
      return errorResponse(res, 400, "Max Ticket Capacity must be strictly less than Total Tickets.", "INVALID_CAPACITY");
    }

    const configInstance = await ConfigurationClass.getInstance();
    const configDoc = await configInstance.updateConfiguration({
      totalTickets: total,
      ticketReleaseRate: releaseRate,
      customerRetrievalRate: retrievalRate,
      maxTicketCapacity: maxCap,
    });

    // Re-initialize TicketPool with new max capacity
    await ticketPool.initialize({
      totalTickets: total,
      ticketReleaseRate: releaseRate,
      customerRetrievalRate: retrievalRate,
      maxTicketCapacity: maxCap,
    });

    return successResponse(res, 200, "Configuration updated successfully.", {
      configuration: configDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve global system configuration
 */
const getConfiguration = async (req, res, next) => {
  try {
    const configInstance = await ConfigurationClass.getInstance();
    const configDoc = await ConfigurationModel.findOne({ singleton: true });

    if (!configDoc) {
      return errorResponse(res, 404, "Configuration document not found.", "NOT_FOUND");
    }

    return successResponse(res, 200, "Configuration retrieved.", {
      totalTickets: configDoc.totalTickets,
      ticketReleaseRate: configDoc.ticketReleaseRate,
      customerRetrievalRate: configDoc.customerRetrievalRate,
      maxTicketCapacity: configDoc.maxTicketCapacity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset global configuration to defaults
 */
const resetConfiguration = async (req, res, next) => {
  try {
    const configInstance = await ConfigurationClass.getInstance();
    const configDoc = await configInstance.resetConfiguration();

    await ticketPool.initialize({
      totalTickets: configDoc.totalTickets,
      ticketReleaseRate: configDoc.ticketReleaseRate,
      customerRetrievalRate: configDoc.customerRetrievalRate,
      maxTicketCapacity: configDoc.maxTicketCapacity,
    });

    return successResponse(res, 200, "Configuration reset to default successfully.", {
      configuration: configDoc,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  setConfiguration,
  getConfiguration,
  resetConfiguration,
};
