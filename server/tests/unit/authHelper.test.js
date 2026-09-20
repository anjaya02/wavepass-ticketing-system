const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Customer = require("../../models/customer");
const Vendor = require("../../models/vendor");
const { generateToken } = require("../../controllers/authController");

describe("Authentication Helpers & Model Security Unit Tests", () => {
  test("should hash passwords using bcrypt", async () => {
    const rawPassword = "SecurePassword123!";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    expect(hashedPassword).not.toBe(rawPassword);
    const isMatch = await bcrypt.compare(rawPassword, hashedPassword);
    expect(isMatch).toBe(true);

    const wrongMatch = await bcrypt.compare("WrongPassword", hashedPassword);
    expect(wrongMatch).toBe(false);
  });

  test("should never include password field in toJSON() output", () => {
    const customer = new Customer({
      name: "Sanitize Test",
      email: "sanitize@example.com",
      mobileNumber: "0771112233",
      password: "SuperSecretPassword123",
      role: "customer",
    });

    const json = customer.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.name).toBe("Sanitize Test");
    expect(json.email).toBe("sanitize@example.com");
  });

  test("should generate signed JWT containing userId and role", () => {
    const userId = "670000000000000000000001";
    const role = "customer";

    const token = generateToken(userId, role);
    expect(typeof token).toBe("string");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(userId);
    expect(decoded.role).toBe(role);
  });

  test("should verify vendor model matchPassword method and toJSON stripping", async () => {
    const rawPassword = "VendorPassword789!";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    const vendor = new Vendor({
      name: "Vendor Security",
      email: "vendor_sec@example.com",
      password: hashedPassword,
    });

    const correctMatch = await vendor.matchPassword(rawPassword);
    const wrongMatch = await vendor.matchPassword("WrongPassword");

    expect(correctMatch).toBe(true);
    expect(wrongMatch).toBe(false);

    const json = vendor.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.name).toBe("Vendor Security");
    expect(json.email).toBe("vendor_sec@example.com");
  });
});
