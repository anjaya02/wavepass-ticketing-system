export type TicketStatus = "available" | "sold";

export const validateStatus = (status?: string): TicketStatus => {
  if (status === "available" || status === "sold") {
    return status;
  }
  console.warn(`Invalid status "${status}" encountered. Defaulting to "available".`);
  return "available";
};
