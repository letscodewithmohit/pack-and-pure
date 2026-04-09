import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:7000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

const readTokenFromStorage = (key) => {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return null;

    // Backward compatibility: some older flows may have stored JSON instead of raw token.
    if (rawValue.startsWith('{')) {
        try {
            const parsed = JSON.parse(rawValue);
            if (typeof parsed?.token === 'string') return parsed.token;
        } catch {
            return null;
        }
    }

    return rawValue;
};

const parseUrlPath = (rawUrl) => {
    if (!rawUrl) return '';
    const value = String(rawUrl);
    if (value.startsWith('/')) return value;
    try {
        return new URL(value).pathname || '';
    } catch {
        return value;
    }
};

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
    (config) => {
        let token = null;
        const urlPath = parseUrlPath(config.url);
        const pagePath = window.location.pathname;
        const isCustomerPage = !pagePath.startsWith('/admin') && !pagePath.startsWith('/seller') && !pagePath.startsWith('/delivery') && !pagePath.startsWith('/pickup');

        // Determination strategy: 
        // 1. If we are on a module-specific page (e.g. /seller/dashboard), prioritize that module's token
        // This is crucial for shared APIs like /products or /admin/categories
        if (pagePath.startsWith('/seller')) {
            token = readTokenFromStorage('auth_seller');
        } else if (pagePath.startsWith('/admin')) {
            token = readTokenFromStorage('auth_admin');
        } else if (pagePath.startsWith('/delivery')) {
            token = readTokenFromStorage('auth_delivery');
        } else if (pagePath.startsWith('/pickup')) {
            token = readTokenFromStorage('auth_pickup_partner');
        } else if (isCustomerPage) {
            token = readTokenFromStorage('auth_customer');
        }

        // 2. Fallback to URL-based detection
        if (!token) {
            if (urlPath.includes('/seller')) token = readTokenFromStorage('auth_seller');
            else if (urlPath.includes('/admin')) token = readTokenFromStorage('auth_admin');
            else if (urlPath.includes('/delivery')) token = readTokenFromStorage('auth_delivery');
            else if (urlPath.includes('/pickup-partner')) token = readTokenFromStorage('auth_pickup_partner');
            else if (
                urlPath.includes('/customer') ||
                urlPath.includes('/cart') ||
                urlPath.includes('/wishlist') ||
                urlPath.includes('/categories') ||
                urlPath.includes('/products')
            ) {
                token = readTokenFromStorage('auth_customer');
            }
        }

        // 3. Final default: if we are on a general page and STILL no token, try customer token
        if (!token && isCustomerPage) {
            token = readTokenFromStorage('auth_customer');
        }

        // 4. Last fallback: Check common 'token' key if implemented
        if (!token) {
            token = readTokenFromStorage('token');
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for API calls
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Only force logout when this request was actually sent with an auth header.
            // Prevents accidental global logout if a protected API is called without token header.
            const sentAuthHeader = Boolean(originalRequest?.headers?.Authorization || originalRequest?.headers?.authorization);
            if (!sentAuthHeader) {
                return Promise.reject(error);
            }

            // If no token exists, skip reload to avoid infinite loop on public pages.
            const hasToken = ['auth_seller', 'auth_admin', 'auth_delivery', 'auth_pickup_partner', 'auth_customer', 'token'].some(
                (key) => localStorage.getItem(key)
            );
            if (!hasToken) {
                return Promise.reject(error);
            }

            // Clear all possible auth tokens from localStorage
            const storageKeys = ['auth_seller', 'auth_admin', 'auth_delivery', 'auth_pickup_partner', 'auth_customer', 'token'];
            storageKeys.forEach(key => localStorage.removeItem(key));

            // Reload will trigger ProtectedRoute to redirect to proper login page
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
