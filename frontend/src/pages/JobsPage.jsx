import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ApplicationModal from '../components/ApplicationModal';

const JobsPage = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const { currentUser } = useAuth();

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            const data = await apiCall('GET', '/jobs');
            setJobs(data);
        } catch (err) {
            setError('Failed to fetch jobs');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyClick = (job) => {
        if (!currentUser) {
            // Need to be logged in to apply
            window.location.href = '/login';
            return;
        }
        setSelectedJob(job);
        setSuccessMsg('');
    };

    const handleApplicationSuccess = () => {
        setSelectedJob(null);
        setSuccessMsg('Application submitted successfully! Our AI is evaluating your resume.');
        // Clear message after 5 seconds
        setTimeout(() => setSuccessMsg(''), 5000);
    };

    if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>Loading jobs...</div>;

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Open Positions</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                Find your next role. Our Graph RAG system evaluates candidates fairly based on skills and experience.
            </p>

            {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                    {error}
                </div>
            )}

            {successMsg && (
                <div style={{ backgroundColor: 'rgba(22, 163, 74, 0.2)', color: '#4ade80', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                    {successMsg}
                </div>
            )}

            {jobs.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <p style={{ color: 'var(--color-text-muted)' }}>No open positions currently available. Please check back later.</p>
                </div>
            ) : (
                <div className="jobs-grid">
                    {jobs.map(job => (
                        <div key={job.id} className="glass-card job-card">
                            <h2 className="job-title">{job.title}</h2>
                            <div className="job-meta">
                                <span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem', verticalAlign: 'middle' }}>
                                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                    </svg>
                                    {job.department}
                                </span>
                                <span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem', verticalAlign: 'middle' }}>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    {job.location || 'Remote'}
                                </span>
                            </div>
                            <p className="job-desc">{job.description}</p>
                            <button 
                                className="btn btn-primary" 
                                style={{ width: '100%', marginTop: 'auto' }}
                                onClick={() => handleApplyClick(job)}
                            >
                                Apply Now
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {selectedJob && (
                <ApplicationModal 
                    job={selectedJob} 
                    onClose={() => setSelectedJob(null)} 
                    onSuccess={handleApplicationSuccess} 
                />
            )}
        </div>
    );
};

export default JobsPage;
