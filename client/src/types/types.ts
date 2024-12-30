export interface InitialData {
  availableTickets: number;
}

export interface TicketUpdate {
  ticketId: string;
  status: "sold" | "available";
  owner: string | null;
  availableTickets: number;
}

export interface VendorReleasedTickets {
  vendorId: string;
  quantity: number;
  message: string;
  eventName: string;
  eventDate: string;
  availableTickets: number;
  releasedTickets: number;
}

export interface PurchaseSuccess {
  ticketIds: string[];
  availableTickets: number;
}

export interface PurchaseFailure {
  message: string;
}

export interface TicketRefunded {
  message: string;
  ticketId: string;
  customerId: string;
  eventName: string;
  eventDate: string;
}

export interface SystemStatus {
  status: string;
  message: string;
  eventName: string;
  eventDate: string;
}

export interface ConfigurationData {
  maxTicketCapacity: number;
}
