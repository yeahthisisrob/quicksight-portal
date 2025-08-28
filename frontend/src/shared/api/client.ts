import axios from 'axios';

import { config } from '@/shared/config';

export const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Track if we're currently refreshing auth
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

api.interceptors.request.use(async (requestConfig) => {
  const idToken = localStorage.getItem('idToken');
  if (idToken) {
    requestConfig.headers.Authorization = `Bearer ${idToken}`;
  }
  return requestConfig;
});

let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

api.interceptors.response.use(
  (response) => {
    retryCount = 0;
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 errors
    if (error.response?.status === 401) {
      // Skip auth endpoints
      if (originalRequest.url?.includes('/auth/') || originalRequest.url?.includes('/identity')) {
        return Promise.reject(error);
      }
      
      // If already retried, reject
      if (originalRequest._retry) {
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      if (isRefreshing) {
        // Wait for refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      isRefreshing = true;
      
      // Clear auth and redirect to login
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      processQueue(error, null);
      isRefreshing = false;
      
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?error=session_expired';
      }
      
      return Promise.reject(error);
    }
    
    // Handle network errors with retry
    if (!error.response && retryCount < MAX_RETRIES && !originalRequest._retry) {
      originalRequest._retry = true;
      retryCount++;
      
      const delay = RETRY_DELAY * Math.pow(2, retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }
    
    return Promise.reject(error);
  }
);

export const authApi = axios.create({
  baseURL: config.API_URL.replace('/api', ''),
  headers: {
    'Content-Type': 'application/json',
  },
});

authApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);