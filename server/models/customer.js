const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    },
    retrievalInterval: {
      type: Number,
      default: 15000,
    },
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

// Pre-save middleware to hash passwords with bcrypt
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

// Compare password helper
customerSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Security: Strip password whenever converted to JSON
customerSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
module.exports = Customer;
