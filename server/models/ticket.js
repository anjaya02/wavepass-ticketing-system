const mongoose = require("mongoose");

// Check if the model has already been registered to prevent OverwriteModelError
const TicketSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["available", "sold"],
      default: "available",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer", // Reference to the customer who purchased the ticket
      default: null,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor", // Reference to the vendor who issued the ticket
      required: true, // Ensure the ticket is always associated with a vendor
    },
    price: {
      type: Number,
      required: [true, "Ticket price is required."],
      min: [0, "Price cannot be negative."],
    },
    eventName: {
      type: String,
      required: true,
      default: "WavePass: Your Boat Ride Ticketing System", // Fixed for all tickets
    },
    eventDate: {
      type: Date,
      required: true,
      default: new Date("2024-12-20"), // Fixed for all tickets
    },
  },
  { timestamps: true }
);

// If the model is already compiled, use the existing one
const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
module.exports = Ticket;
