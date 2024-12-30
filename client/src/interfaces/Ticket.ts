export interface Ticket {
  id: string;
  status: "available" | "sold";
  owner: string | null;
  vendor: string;
  price: number;
  eventName: string;
  eventDate: string;
  createdAt: string;
  updatedAt: string;
}
