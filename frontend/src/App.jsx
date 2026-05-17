import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import JobsPage from './pages/JobsPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import RecruiterDashboard from './pages/recruiter/RecruiterDashboard';
import PostJob from './pages/recruiter/PostJob';
import JobDetail from './pages/recruiter/JobDetail';

const Header = () => {
    const { currentUser, logout } = useAuth();
    const isRecruiter = currentUser?.role === 'recruiter';

    return (
        <header className="header container">
            <Link to={isRecruiter ? "/recruiter/dashboard" : "/"} className="header-logo" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span><span style={{ color: 'var(--color-primary)' }}>Graph</span>ATS</span>
                </div>
                {isRecruiter && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: '400' }}>Recruiter Portal</span>
                )}
            </Link>
            <nav className="header-nav">
                {currentUser ? (
                    <>
                        {isRecruiter ? (
                            <>
                                <Link to="/recruiter/dashboard">Dashboard</Link>
                                <Link to="/recruiter/jobs/new" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', marginLeft: '1rem' }}>
                                    + Post New Job
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/jobs">Jobs</Link>
                                <Link to="/my-applications">My Applications</Link>
                            </>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem', borderLeft: '1px solid var(--color-border)', paddingLeft: '1rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{currentUser.full_name}</span>
                            <button className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
                                Sign Out
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <Link to="/jobs">Jobs</Link>
                        <Link to="/login">Login</Link>
                        <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                            Register
                        </Link>
                    </>
                )}
            </nav>
        </header>
    );
};

const PrivateRoute = ({ children, role }) => {
    const { authToken, currentUser, loading } = useAuth();
    
    if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
    
    if (!authToken) return <Navigate to="/login" />;
    
    if (role && currentUser && currentUser.role !== role) {
        return <Navigate to={currentUser.role === 'recruiter' ? '/recruiter/dashboard' : '/jobs'} />;
    }
    
    return children;
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <Header />
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/jobs" element={<JobsPage />} />
                    
                    <Route 
                        path="/my-applications" 
                        element={
                            <PrivateRoute role="candidate">
                                <MyApplicationsPage />
                            </PrivateRoute>
                        } 
                    />
                    
                    {/* Recruiter Routes */}
                    <Route 
                        path="/recruiter/dashboard" 
                        element={
                            <PrivateRoute role="recruiter">
                                <RecruiterDashboard />
                            </PrivateRoute>
                        } 
                    />
                    <Route 
                        path="/recruiter/jobs/new" 
                        element={
                            <PrivateRoute role="recruiter">
                                <PostJob />
                            </PrivateRoute>
                        } 
                    />
                    <Route 
                        path="/recruiter/jobs/:jobId" 
                        element={
                            <PrivateRoute role="recruiter">
                                <JobDetail />
                            </PrivateRoute>
                        } 
                    />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
