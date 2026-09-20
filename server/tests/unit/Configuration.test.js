const Configuration = require("../../classes/Configuration");

describe("Configuration Unit Tests", () => {
  let config;

  beforeEach(() => {
    config = new Configuration(500, 10000, 15000, 200);
  });

  test("should initialize with correct default getters", () => {
    expect(config.getTotalTickets()).toBe(500);
    expect(config.getMaxTicketCapacity()).toBe(200);
    expect(config.getTicketReleaseRate()).toBe(10000);
    expect(config.getCustomerRetrievalRate()).toBe(15000);
  });

  test("should enforce maxTicketCapacity strictly less than totalTickets", () => {
    expect(() => {
      config.setMaxTicketCapacity(500); // Equal to totalTickets (500)
    }).toThrow("Max ticket capacity must be strictly less than total tickets.");

    expect(() => {
      config.setMaxTicketCapacity(600); // Greater than totalTickets (500)
    }).toThrow("Max ticket capacity must be strictly less than total tickets.");
  });

  test("should allow valid maxTicketCapacity updates below totalTickets", () => {
    config.setMaxTicketCapacity(300);
    expect(config.getMaxTicketCapacity()).toBe(300);
  });

  test("should reject non-positive configuration values", () => {
    expect(() => config.setTotalTickets(0)).toThrow("positive integer");
    expect(() => config.setTotalTickets(-10)).toThrow("positive integer");
    expect(() => config.setTicketReleaseRate(0)).toThrow("positive integer");
    expect(() => config.setCustomerRetrievalRate(-100)).toThrow("positive integer");
    expect(() => config.setMaxTicketCapacity(0)).toThrow("positive integer");
    expect(() => config.setMaxTicketCapacity(-50)).toThrow("positive integer");
  });

  test("should successfully update rates with valid positive values", () => {
    config.setTicketReleaseRate(5000);
    config.setCustomerRetrievalRate(8000);
    config.setTotalTickets(1000);

    expect(config.getTicketReleaseRate()).toBe(5000);
    expect(config.getCustomerRetrievalRate()).toBe(8000);
    expect(config.getTotalTickets()).toBe(1000);
  });
});
