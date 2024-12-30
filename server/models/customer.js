const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define the Customer Schema
const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Customer email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Email is invalid."],
    },
    mobileNumber: {
      type: String,
      required: [true, "Customer mobile number is required."],
      unique: true,
      trim: true,
      match: [
        /^(0\d{9})|(\+\d{10,15})$/,
        "Please enter a valid mobile number. It should start with '0' followed by 9 digits or '+' followed by country code and number.",
      ],
    },
    
    ticketsPurchased: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket",
      },
    ],
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must be at least 6 characters long."],
    },
    role: {
      type: String,
      enum: ["customer", "vendor"],
      default: "customer",
    },
  },
  { timestamps: true }
);

// Pre-save middleware to hash passwords
customerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
customerSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Prevent OverwriteModelError
const Customer =
  mongoose.models.Customer || mongoose.model("Customer", customerSchema);

module.exports = Customer;
