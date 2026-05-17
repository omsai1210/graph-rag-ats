import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('registered') === 'true') {
            setSuccessMsg('Registration successful. Please log in.');
        }
    }, [location]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const data = await apiCall('POST', '/auth/login', formData);
            
            login(data.access_token);
            if (data.user && data.user.role === 'recruiter') {
                navigate('/recruiter/dashboard');
            } else {
                navigate('/jobs');
            }
        } catch (err) {
            setError(err.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Welcome Back</h2>
                
                {successMsg && (
                    <div style={{ backgroundColor: 'rgba(22, 163, 74, 0.2)', color: '#4ade80', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        {successMsg}
                    </div>
                )}
                
                {error && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email Address</label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email" 
                            className="form-control" 
                            required 
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label className="form-label" htmlFor="password">Password</label>
                        <input 
                            type="password" 
                            id="password" 
                            name="password" 
                            className="form-control" 
                            required 
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Logging in...' : 'Log In'}
                    </button>
                </form>
                
                <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    Don't have an account? <Link to="/register" style={{ fontWeight: '500' }}>Register</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
