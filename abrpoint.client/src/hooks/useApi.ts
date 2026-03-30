import apiInstance from '../components/API/apiInstance';

/**
 * Centralized API hook for making authenticated requests
 * Automatically handles token refresh on 401 responses
 */
export const useApi = () => {
    const get = async <T,>(url: string, config?: any) => {
        const response = await apiInstance.get<T>(url, config);
        return response.data;
    };

    const post = async <T,>(url: string, data?: any, config?: any) => {
        const response = await apiInstance.post<T>(url, data, config);
        return response.data;
    };

    const put = async <T,>(url: string, data?: any, config?: any) => {
        const response = await apiInstance.put<T>(url, data, config);
        return response.data;
    };

    const patch = async <T,>(url: string, data?: any, config?: any) => {
        const response = await apiInstance.patch<T>(url, data, config);
        return response.data;
    };

    const delete_ = async <T,>(url: string, config?: any) => {
        const response = await apiInstance.delete<T>(url, config);
        return response.data;
    };

    return { get, post, put, patch, delete: delete_ };
};
