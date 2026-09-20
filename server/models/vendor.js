const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vendor name is required."],
      trim: true,
    },
    addedTickets: {
      type: Number,
      default: 0,
      min: [0, "Added tickets cannot be negative."],
    },
    email: {
      type: String,
      required: [true, "Please provide a valid email."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Email is invalid."],
    },
    password: {
      type: String,
      required: [true, "Please provide a password."],
      minlength: [6, "Password must be at least 6 characters long."],
    },
    ticketsPerRelease: {
      type: Number,
      default: 10,
    },
    releaseInterval: {
      type: Number,
      default: 10000,
    },
    role: {
      type: String,
      enum: ["vendor"],
      default: "vendor",
    },
  },
  { timestamps: true }
);

// Pre-save middleware to hash passwords
vendorSchema.pre("save", async function (next) {
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

// Compare password helper
vendorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Security: Strip password whenever converted to JSON
vendorSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const Vendor = mongoose.models.Vendor || mongoose.model("Vendor", vendorSchema);
module.exports = Vendor;
