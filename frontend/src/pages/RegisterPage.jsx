import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'candidate'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await apiCall('POST', '/auth/register', formData);
            if (data.access_token) {
                login(data.access_token);
                if (formData.role === 'recruiter') {
                    navigate('/recruiter/dashboard');
                } else {
                    navigate('/jobs');
                }
            } else {
                navigate('/login?registered=true');
            }
        } catch (err) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Create Account</h2>
                
                {error && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="full_name">Full Name</label>
                        <input 
                            type="text" 
                            id="full_name" 
                            name="full_name" 
                            className="form-control" 
                            required 
                            value={formData.full_name}
                            onChange={handleChange}
                        />
                    </div>
                    
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
                    
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label className="form-label">I am a...</label>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input 
                                    type="radio" 
                                    name="role" 
                                    value="candidate" 
                                    checked={formData.role === 'candidate'} 
                                    onChange={handleChange} 
                                    style={{ accentColor: 'var(--color-primary)' }}
                                />
                                Candidate
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input 
                                    type="radio" 
                                    name="role" 
                                    value="recruiter" 
                                    checked={formData.role === 'recruiter'} 
                                    onChange={handleChange} 
                                    style={{ accentColor: 'var(--color-primary)' }}
                                />
                                Recruiter
                            </label>
                        </div>
                    </div>
                    
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>
                
                <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    Already have an account? <Link to="/login" style={{ fontWeight: '500' }}>Log In</Link>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
