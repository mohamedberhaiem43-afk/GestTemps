// src/api.js
import axios from 'axios';

const apiInstance = axios.create({
    baseURL: import.meta.env.VITE_REACT_APP_API_URL,
    headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the dynamic token in all requests
apiInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');  // Dynamically get the token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;  // Add the token to the request headers
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiInstance;
