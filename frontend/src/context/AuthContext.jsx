import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiCall } from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [authToken, setAuthToken] = useState(localStorage.getItem('auth_token') || '');
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            if (authToken) {
                try {
                    const data = await apiCall('GET', '/auth/me');
                    setCurrentUser(data);
                } catch (error) {
                    console.error("Failed to fetch user:", error);
                    setAuthToken('');
                    setCurrentUser(null);
                    localStorage.removeItem('auth_token');
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        };
        fetchUser();
    }, [authToken]);

    const login = (token) => {
        localStorage.setItem('auth_token', token);
        setAuthToken(token);
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setAuthToken('');
        setCurrentUser(null);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider value={{ authToken, currentUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
