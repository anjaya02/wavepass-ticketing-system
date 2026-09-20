import axios from 'axios';
import {
  TotalReleasedTicketsResponse,
  SoldTicketsResponse,
  VendorReleasedTicketsResponse,
} from "../types/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const userRole = localStorage.getItem('userRole');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('customerId');
      localStorage.removeItem('vendorId');

      // Do not hard redirect if already on login or register page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register') && currentPath !== '/') {
        window.location.href = userRole === 'vendor' ? '/vendor/login' : '/customer/login';
      }
    }
    return Promise.reject(error);
  }
);

export const fetchTotalReleasedTickets = async (): Promise<number> => {
  const response = await api.get<TotalReleasedTicketsResponse>('/vendor/total-released-tickets');
  if (response.status === 200 && typeof response.data.releasedTickets === 'number') {
    return response.data.releasedTickets;
  }
  throw new Error("Failed to fetch total released tickets.");
};

export const fetchSoldTickets = async (): Promise<number> => {
  const response = await api.get<SoldTicketsResponse>('/vendor/sold-tickets');
  if (response.status === 200 && typeof response.data.soldTickets === 'number') {
    return response.data.soldTickets;
  }
  throw new Error("Failed to fetch sold tickets.");
};

export const fetchReleasedTickets = async (): Promise<number> => {
  const response = await api.get<VendorReleasedTicketsResponse>('/vendor/released-tickets');
  if (response.status === 200 && typeof response.data.releasedTickets === 'number') {
    return response.data.releasedTickets;
  }
  throw new Error("Failed to fetch released tickets.");
};

export default api;
