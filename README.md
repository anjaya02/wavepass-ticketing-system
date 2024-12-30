# WavePass Ticketing System

WavePass is a comprehensive boat ride ticketing system designed to streamline the process of buying and selling boat ride tickets. It provides real-time analytics, ensuring a seamless experience for both vendors and customers.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
  - [Frontend](#frontend)
  - [Backend](#backend)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

- **User Registration:** Vendors and customers can easily register and manage their accounts.
- **Ticket Management:** Vendors can release tickets to the Ticketpool, and customers can purchase them effortlessly.
- **Real-Time Analytics:** Monitor ticket sales and other metrics in real-time using WebSockets.
- **Interactive Charts:** Visualize data with pie charts powered by Chart.js.
- **Concurrency Handling:** Manage concurrent ticket purchases and prevent race conditions using async mutex.
- **Responsive Design:** A sleek and responsive UI built with Tailwind CSS ensures a great user experience on all devices.

## Technologies Used

### Frontend

- **React.js:** A powerful JavaScript library for building user interfaces.
- **Vite:** A fast build tool that enhances the development experience.
- **Tailwind CSS:** A utility-first CSS framework for rapid UI development.
- **Socket.io:** Enables real-time, bidirectional communication between the client and server.
- **Chart.js:** A flexible JavaScript charting library for visualizing data.

### Backend

- **Node.js:** A JavaScript runtime built on Chrome's V8 engine.
- **Express.js:** A minimal and flexible Node.js web application framework.
- **MongoDB:** A NoSQL database for storing application data.
- **Async Mutex:** Handles concurrency and prevents race conditions during ticket purchases.

## Architecture

WavePass follows the **Consumer-Producer** pattern:

- **Producers (Vendors):** Release tickets to the Ticketpool.
- **Consumers (Customers):** Purchase tickets from the Ticketpool.

The system ensures thread-safe operations using multi-threading and the async mutex package to handle concurrent ticket purchases efficiently.

## Installation

### Prerequisites

- **Node.js** (v14 or later)
- **npm** (v6 or later) or **yarn**
- **MongoDB** instance

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/anjaya02/wavepass-ticketing-system.git
   cd wavepass-ticketing-system
   ```

2. **Setup Backend**

   ```bash
   cd backend
   npm install
   ```

   - Create a `.env` file in the `backend` directory and add your MongoDB connection string:

     ```env
     MONGO_URI=your_mongodb_connection_string
     PORT=5000
     JWT_SECRET=your_jwt_secret
     FRONTEND_URL=your_frontend_url
     ```

3. **Setup Frontend**

   ```bash
   cd ../frontend
   npm install
   ```

4. **Run the Application**

   - **Backend:**

     ```bash
     cd backend
     npm start
     ```

   - **Frontend:**

     ```bash
     cd ../frontend
     npm run dev
     ```

5. **Access the Application**

   Open your browser and navigate to `http://localhost:5173`.

## Usage

1. **Register as a Vendor or Customer**

   - **Vendors:** Can release tickets to the Ticketpool.
   - **Customers:** Can browse and purchase tickets from the Ticketpool.

2. **Release Tickets**

   Vendors can add new boat ride tickets, specifying details such as date, time, and available seats.

3. **Purchase Tickets**

   Customers can browse available tickets and make purchases. The system handles concurrent purchases to prevent overselling.

4. **View Analytics**

   Access real-time analytics to monitor ticket sales and other metrics through interactive charts.

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the Repository**

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/YourFeature
   ```

3. **Commit Your Changes**

   ```bash
   git commit -m "Add some feature"
   ```

4. **Push to the Branch**

   ```bash
   git push origin feature/YourFeature
   ```

5. **Open a Pull Request**

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For any inquiries or support, please contact:

- **Email:** anjayainduwara@gmail.com
- **GitHub:** [@anjaya02](https://github.com/anjaya02)

```