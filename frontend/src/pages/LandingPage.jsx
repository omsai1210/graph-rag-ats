import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
    return (
        <div className="container">
            <section className="hero">
                <h1>AI-Powered Recruitment</h1>
                <p>
                    Experience the future of hiring with our Graph RAG Applicant Tracking System. 
                    We match your unique skills and experiences with the perfect role using advanced AI.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Link to="/jobs" className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2rem' }}>
                        Browse Open Roles
                    </Link>
                    <Link to="/register" className="btn btn-secondary" style={{ fontSize: '1.125rem', padding: '1rem 2rem' }}>
                        Create an Account
                    </Link>
                </div>
            </section>
            
            <section style={{ padding: '4rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                    </div>
                    <h3 style={{ marginBottom: '1rem' }}>Graph RAG Matching</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        Our system uses advanced graph databases and LLMs to understand your true potential beyond keyword matching.
                    </p>
                </div>
                
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                    </div>
                    <h3 style={{ marginBottom: '1rem' }}>Instant Shortlisting</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        Applications are processed asynchronously in the background for blazing fast candidate evaluation.
                    </p>
                </div>
                
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h3 style={{ marginBottom: '1rem' }}>Automated Follow-ups</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        Receive immediate feedback via email, keeping you informed at every step of your application journey.
                    </p>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
