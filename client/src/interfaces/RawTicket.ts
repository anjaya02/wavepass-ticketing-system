export interface RawTicket {
  _id?: { $oid: string };
  id?: string;
  status?: "available" | "sold" | string;
  owner?: string | { $oid: string };
  vendor?: string | { $oid: string };
  price?: number;
  eventName?: string;
  eventDate?: string | { $date: string };
  createdAt?: string | { $date: string };
  updatedAt?: string | { $date: string };
}
