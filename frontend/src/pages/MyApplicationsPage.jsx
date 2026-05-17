import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

const MyApplicationsPage = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        try {
            const data = await apiCall('GET', '/applications/me');
            setApplications(data);
        } catch (err) {
            setError('Failed to fetch your applications');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch(status?.toLowerCase()) {
            case 'shortlisted': return 'badge-shortlisted';
            case 'rejected': return 'badge-rejected';
            default: return 'badge-pending';
        }
    };

    if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>Loading your applications...</div>;

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>My Applications</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                Track the status of your submitted applications.
            </p>

            {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                    {error}
                </div>
            )}

            {applications.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>You haven't applied to any positions yet.</p>
                    <a href="/jobs" className="btn btn-primary">Browse Jobs</a>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Job Title</th>
                                <th>Department</th>
                                <th>Applied On</th>
                                <th>Status</th>
                                <th>AI Match Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applications.map(app => (
                                <tr key={app.id}>
                                    <td style={{ fontWeight: '500' }}>{app.job?.title || 'Unknown Job'}</td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>{app.job?.department || '-'}</td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>
                                        {new Date(app.created_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <span className={`badge ${getStatusBadgeClass(app.status)}`}>
                                            {app.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td>
                                        {app.ai_score !== null && app.ai_score !== undefined ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ flexGrow: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                                                    <div style={{ 
                                                        height: '100%', 
                                                        width: `${app.ai_score}%`, 
                                                        backgroundColor: app.ai_score >= 70 ? '#4ade80' : app.ai_score >= 40 ? '#facc15' : '#f87171' 
                                                    }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{app.ai_score}%</span>
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Evaluating...</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MyApplicationsPage;
