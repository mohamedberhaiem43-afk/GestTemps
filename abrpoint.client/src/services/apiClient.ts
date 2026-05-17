import axios, { AxiosRequestConfig } from "axios";
import { PurgeParams } from "../hooks/pointeuseHooks/usePurgePointeuse";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_REACT_APP_API_URL,
    withCredentials: true,  // <--- tokens are sent automatically via httpOnly cookies
});

// Coalesce concurrent refresh attempts (cf. apiInstance.ts pour le détail).
let refreshInFlight: Promise<unknown> | null = null;

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const url: string = originalRequest?.url ?? '';
        const isRefreshCall = url.includes('/Utilisateurs/refresh');

        if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
            originalRequest._retry = true;

            try {
                if (!refreshInFlight) {
                    refreshInFlight = axios.post(
                        `${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/refresh`,
                        {},
                        { withCredentials: true }
                    ).finally(() => { refreshInFlight = null; });
                }
                await refreshInFlight;
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

class ApiClient<T>{

    endPoint:string

    constructor(endPoint:string){
        this.endPoint = endPoint;
    }

    getAllWithParamsObject = (url: string, query: any) => {
  return axiosInstance
    .get<T[]>(`${this.endPoint}/${url}`, { params: query })
    .then((res) => res.data);
};
    purgePointeuseApi = async (params: PurgeParams) => {
    return axiosInstance
        .post(`${this.endPoint}/purger`, null, { params }) // <--- params passés en query
        .then((res) => res.data);
    };



    getAll = (config:AxiosRequestConfig ) =>{
        return axiosInstance
        .get<T[]>(this.endPoint,config)
        .then((res)=>res.data);
    }
    getAllWithoutParams = () =>{
        return axiosInstance
        .get<T[]>(this.endPoint)
        .then((res)=>res.data);
    }
    getAllWithParams = (params: string) =>{
        return axiosInstance
        .get<T[]>(`${this.endPoint}/${params}`)
        .then((res)=>res.data)
    }
    getAllWithBody = (params: string, data: any) =>{
        return axiosInstance
        .get<T[]>(`${this.endPoint}/${params}`, data)
        .then((res)=>res.data)
    }
    getWithParams = (params: string) =>{
        return axiosInstance
        .get<T>(`${this.endPoint}/${params}`)
        .then((res)=>res.data)
    }
    getReport = (params: string, responseType: 'json' | 'blob' = 'json') => {
        return axiosInstance
            .get<T>(`${this.endPoint}/${params}`, { responseType })
            .then((res) => res.data);
    };

    post = (data: T) => {
        return axiosInstance
            .post<T>(this.endPoint, data)
            .then((res) => {
                return res.data;
            })
            .catch((error) => {
                throw error;
            });
    };
    // POST avec query string ad hoc — sert pour les opt-in côté backend (ex.
    // `?confirmOverage=true` sur Employes pour déverrouiller la création d'un
    // collaborateur supplémentaire après confirmation du paiement par l'admin).
    postWithQuery = (data: T, query: Record<string, string | number | boolean>) => {
        return axiosInstance
            .post<T>(this.endPoint, data, { params: query })
            .then((res) => res.data);
    };
    postWithoutParams = (url?: string) => {
    return axiosInstance
        .post<T>(url ? `${this.endPoint}/${url}` : this.endPoint, {})
        .then((res) => res.data);
    };

    postWithParams = (params:string,data: T) => {
        return axiosInstance
            .post<T>(`${this.endPoint}/${params}`, data)
            .then((res) => {
                return res.data;
            })
            .catch((error) => {
                throw error;
            });
    };
    
    
    delete = (soccod: string|null, code?: string | number |null) => {
    if (code)
        return axiosInstance
        .delete(`${this.endPoint}/${soccod}/${code}`)
        .then((res) => res.data);
    else
        return axiosInstance
        .delete(`${this.endPoint}/${soccod}`)
        .then((res) => res.data);
    };

    deleteObject = (data: any) => {
        return axiosInstance
            .delete(this.endPoint, { data })
            .then((res) => res.data);
        };

    

    put = (soccod: string, empcod: string, predat: string, presence: any) => {
        return axiosInstance
            .put(`${this.endPoint}/${soccod}/${empcod}/${predat}`, presence)
            .then((res) => res.data);
    };
    putWithParams = (params: string) =>{
    if (params)
        return axiosInstance
        .put(`${this.endPoint}/${params}`)
        .then((res) => res.data);
    else
        return axiosInstance
        .put(`${this.endPoint}/${params}`)
        .then((res) => res.data);
    };
    
    putWithManyParams = (param1: string, param2: string, param3: string, param4: string) =>{
    if (param1 && param2 && param3 && param4)
        return axiosInstance
        .put(`${this.endPoint}/${param1}/${param2}/${param3}/${param4}`)
        .then((res) => res.data);
    else
        return axiosInstance
        .put(`${this.endPoint}/${param1}/${param2}/${param3}`)
        .then((res) => res.data);
    };
    putObject = (params:string,object: T) =>{
        return axiosInstance
        .put(`${this.endPoint}/${params}`,object)
        .then((res)=>res.data)
    }
    putWithoutParams = (data:T) => {
    if (data)
        return axiosInstance
        .put(`${this.endPoint}`,data)
        .then((res) => res.data);
    else
        return axiosInstance
        .put(`${this.endPoint}`,data)
        .then((res) => res.data);
    };
    putWithoutParamsList = (data:T[]) => {
        return axiosInstance
            .put(`${this.endPoint}`, data)
            .then((res) => res.data);
    };
    putWithParamsList = (params:string,data:T[]) => {
        return axiosInstance
            .put(`${this.endPoint}/${params}`, data)
            .then((res) => res.data);
    };
    
}

export default ApiClient;