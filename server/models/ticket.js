const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["available", "sold"],
      default: "available",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, "Ticket price is required."],
      min: [0, "Price cannot be negative."],
    },
    eventName: {
      type: String,
      required: true,
      default: "WavePass: Your Boat Ride Ticketing System",
    },
    eventDate: {
      type: Date,
      required: true,
      default: new Date("2024-12-20"),
    },
  },
  { timestamps: true }
);

// Compound index to optimize finding available tickets rapidly during concurrent purchases
TicketSchema.index({ status: 1, eventName: 1, eventDate: 1 });

const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
module.exports = Ticket;
