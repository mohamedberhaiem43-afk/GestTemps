// src/api.js
import axios from 'axios';

const apiInstance = axios.create({
    baseURL: import.meta.env.VITE_REACT_APP_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true // Enable cookies to be sent automatically
});

// Add a response interceptor to handle token refresh on 401
apiInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Attempt to refresh the token - send empty body, cookies are sent automatically
                await axios.post(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/refresh`,
                    {},
                    { withCredentials: true }
                );

                // Retry the original request with new token (automatically included in cookies)
                return apiInstance(originalRequest);
            } catch (refreshError) {
                // Refresh failed - redirect to login
                console.error('Token refresh failed:', refreshError);
                window.location.href = '/';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default apiInstance;

