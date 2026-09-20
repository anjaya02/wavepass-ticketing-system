const mongoose = require("mongoose");
const Configuration = require("../classes/Configuration");

// Configure test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_super_secret_jwt_key_12345";
process.env.PORT = "5001";
process.env.TICKET_PRICE = "2800";
process.env.EVENT_NAME = "WavePass: Your Boat Ride Ticketing System";
process.env.EVENT_DATE = "2024-12-20";

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://localhost:27017/wavepass_test";

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(TEST_MONGO_URI, { serverSelectionTimeoutMS: 2000 });
    } catch (err) {
      console.warn(`[Test Setup] Could not connect to test database (${TEST_MONGO_URI}). Tests requiring live DB will be skipped or mock-tested.`);
    }
  }
});

afterEach(async () => {
  // Clear collections if connected
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }

  // Reset in-memory Configuration singleton
  Configuration.resetInstance();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    } catch (err) {
      // Ignore disconnect errors in test teardown
    }
  }
});
