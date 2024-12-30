const mongoose = require("mongoose");

const configurationSchema = new mongoose.Schema(
  {
    totalTickets: {
      type: Number,
      required: true,
      min: [1, "Total tickets must be at least 1"],
    },
    ticketReleaseRate: {
      type: Number,
      required: true,
      min: [1, "Ticket release rate must be at least 1 ms"],
    },
    customerRetrievalRate: {
      type: Number,
      required: true,
      min: [1, "Customer retrieval rate must be at least 1 ms"],
    },
    maxTicketCapacity: {
      type: Number,
      required: true,
      min: [1, "Max ticket capacity must be at least 1"],
      validate: {
        validator: function (value) {
          // Ensure maxTicketCapacity < totalTickets
          return value < this.totalTickets;
        },
        message: "Max ticket capacity must be less than total tickets",
      },
    },
    singleton: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Enforce singleton pattern using a unique index on the singleton field
configurationSchema.index({ singleton: 1 }, { unique: true });

const Configuration = mongoose.model("Configuration", configurationSchema);

module.exports = Configuration;
