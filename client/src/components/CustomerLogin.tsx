import React, { useState, FormEvent, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import { AuthContext } from "../context/AuthContext";

interface LoginResponse {
  message: string;
  customer: {
    email: string;
    id: string;
    mobileNumber: string;
    name: string;
  };
  token: string;
}

const CustomerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  // State variables
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [message, setMessage] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Email validation regex
  const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validation function
  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setIsSuccess(null); // Reset success state

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = "http://localhost:5000/api/customers/login";
      console.log("API URL:", apiUrl);

      const response = await axios.post<LoginResponse>(apiUrl, {
        email,
        password,
      });

      if (response.data.token) {
        setMessage("Login successful!");
        setIsSuccess(true);

        login(response.data.token, "customer", response.data.customer.id);

        // Redirect to the customer dashboard
        navigate("/customer/dashboard");
      } else {
        setMessage(response.data.message || "Login failed. Please try again.");
        setIsSuccess(false);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        setMessage(
          axiosError.response?.data?.message ||
            "An error occurred during login. Please try again."
        );
        console.error(
          "Login Axios error:",
          axiosError.response?.data || axiosError.message
        );
      } else if (error instanceof Error) {
        // Handle generic JavaScript errors
        setMessage(error.message || "An unexpected error occurred.");
        console.error("Login error:", error.message);
      } else {
        // Handle unknown error types
        setMessage("An unknown error occurred.");
        console.error("Login unknown error:", error);
      }
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 px-4">
      <div className="w-full max-w-md bg-gray-900 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-center text-white mb-6">
          Customer Login
        </h2>

        {message && (
          <div
            className={`mb-4 text-center text-sm p-2 rounded ${
              isSuccess ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Email Field */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-300 mb-2">
              Email:
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`w-full px-3 py-2 border ${
                errors.email ? "border-red-500" : "border-gray-700"
              } rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password Field with Visibility Toggle */}
          <div className="mb-6 relative">
            <label htmlFor="password" className="block text-gray-300 mb-2">
              Password:
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              className={`w-full px-3 py-2 border ${
                errors.password ? "border-red-500" : "border-gray-700"
              } rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute top-10 right-3 text-gray-400 focus:outline-none"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                // Eye Icon (Visible)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 3C5 3 1.73 6.11 0 10c1.73 3.89 5 7 10 7s8.27-3.11 10-7c-1.73-3.89-5-7-10-7zM10 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
                  <path d="M10 7a3 3 0 100 6 3 3 0 000-6z" />
                </svg>
              ) : (
                // Eye Off Icon (Hidden)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {/* Eye path */}
                  <path d="M10 3C5 3 1.73 6.11 0 10c1.73 3.89 5 7 10 7s8.27-3.11 10-7c-1.73-3.89-5-7-10-7zM10 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />

                  {/* Slash path */}
                  <path
                    d="M3 3L21 21"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full flex items-center justify-center py-2 px-4 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors ${
              isLoading ? "cursor-not-allowed opacity-50" : ""
            }`}
            disabled={isLoading}
          >
            {isLoading && (
              <svg
                className="animate-spin h-5 w-5 mr-3 inline-block"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4.22 4.22a.75.75 0 011.06 0L12 10.94l6.72-6.72a.75.75 0 111.06 1.06L13.06 12l6.72 6.72a.75.75 0 11-1.06 1.06L12 13.06l-6.72 6.72a.75.75 0 11-1.06-1.06L10.94 12 4.22 5.28a.75.75 0 010-1.06z"
                ></path>
              </svg>
            )}
            {isLoading ? "Logging in..." : "Login"}
          </button>

          {/* Link to Register */}
          <div className="mt-4 text-center">
            <span className="text-gray-400">Don't have an account? </span>
            <Link
              to="/customer/register"
              className="text-blue-400 hover:underline"
            >
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerLogin;
