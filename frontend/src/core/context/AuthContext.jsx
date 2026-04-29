import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { getWithDedupe } from '@core/api/dedupe';

const AuthContext = createContext(undefined);

const ROLE_STORAGE_KEYS = {
    customer: 'auth_customer',
    seller: 'auth_seller',
    admin: 'auth_admin',
    delivery: 'auth_delivery',
    pickup_partner: 'auth_pickup_partner',
};

export const AuthProvider = ({ children }) => {
    // Current role based on URL
    const getCurrentRoleFromUrl = () => {
        const path = window.location.pathname;
        if (path.startsWith('/seller')) return 'seller';
        if (path.startsWith('/admin')) return 'admin';
        if (path.startsWith('/delivery')) return 'delivery';
        if (path.startsWith('/pickup')) return 'pickup_partner';
        return 'customer';
    };

    const getProfileEndpointByRole = (role) => {
        if (role === 'pickup_partner') return '/pickup-partner/my/profile';
        return `/${role}/profile`;
    };

    const getSafeToken = (key) => {
        const val = localStorage.getItem(ROLE_STORAGE_KEYS[key]);
        if (!val) return null;
        if (val.startsWith('{')) {
            try { return JSON.parse(val).token; } catch { return val; }
        }
        return val;
    };

    const [authData, setAuthData] = useState({
        customer: getSafeToken('customer'),
        seller: getSafeToken('seller'),
        admin: getSafeToken('admin'),
        delivery: getSafeToken('delivery'),
        pickup_partner: getSafeToken('pickup_partner'),
    });

    const currentRole = getCurrentRoleFromUrl();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const token = authData[currentRole];
    const isAuthenticated = !!token;

    // Fetch user profile on mount or token change
    useEffect(() => {
        const fetchProfile = async () => {
            if (token) {
                try {
                    setIsLoading(true);
                    // Use deduplicated fetch to avoid multiple simultaneous profile calls
                    console.log(`[Auth] Fetching profile for ${currentRole}...`);
                    const endpoint = getProfileEndpointByRole(currentRole);
                    const response = await getWithDedupe(endpoint, {}, { ttl: 5000 });
                    console.log(`[Auth] Profile fetch success:`, response.data.result?._id || 'No ID');
                    setUser(response.data.result);
                } catch (error) {
                    console.error('[Auth] Profile fetch failed:', error.response?.status, error.message);
                    // If 401, axios interceptor will handle it
                } finally {
                    setIsLoading(false);
                }
            } else {
                setUser(null);
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [token, currentRole]);

    const login = (userData) => {
        const role = userData.role?.toLowerCase() || 'customer';
        const storageKey = ROLE_STORAGE_KEYS[role];

        if (storageKey && userData.token) {
            // Save ONLY the token string as requested by the user
            localStorage.setItem(storageKey, userData.token);

            setAuthData(prev => ({ ...prev, [role]: userData.token }));
            setUser(userData); // Set full data initially
        } else {
            console.error('Invalid role or missing token for login:', role);
        }
    };

    const logout = () => {
        // Clear all role-specific tokens from localStorage
        Object.values(ROLE_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });

        // Also clear common 'token' key if implemented
        localStorage.removeItem('token');

        // Reset auth state for all roles to null
        setAuthData({
            customer: null,
            seller: null,
            admin: null,
            delivery: null,
            pickup_partner: null,
        });

        // Clear the current user profile from memory
        setUser(null);

        // Final fallback: redirect based on current path if needed
        const path = window.location.pathname;
        if (path.startsWith('/admin')) window.location.href = '/admin/auth';
        else if (path.startsWith('/seller')) window.location.href = '/seller/auth';
        else if (path.startsWith('/delivery')) window.location.href = '/delivery/auth';
        else if (path.startsWith('/pickup')) window.location.href = '/pickup/auth';
        else window.location.href = '/login';
    };

    const refreshUser = async () => {
        if (token) {
            try {
                const endpoint = getProfileEndpointByRole(currentRole);
                const response = await axiosInstance.get(endpoint);
                setUser(response.data.result);
                return response.data.result;
            } catch (error) {
                console.error('Failed to refresh profile:', error);
            }
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            role: currentRole,
            isAuthenticated,
            isLoading,
            authData,
            login,
            logout,
            refreshUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
