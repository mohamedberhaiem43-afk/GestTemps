import axios, { AxiosHeaders, AxiosRequestConfig } from "axios";
import { PurgeParams } from "../hooks/pointeuseHooks/usePurgePointeuse";

const axiosInstance = axios.create({
    baseURL:import.meta.env.VITE_REACT_APP_API_URL,
    withCredentials: true,  // <--- this enables sending cookies
});
class ApiClient<T>{
    
    endPoint:string

    constructor(endPoint:string){
        this.endPoint = endPoint;

        axiosInstance.interceptors.request.use((config)=>{
            const token = localStorage.getItem('authToken');
            if(token){
                config.headers = config.headers || new AxiosHeaders();
                (config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`);
            }
            return config
        })
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