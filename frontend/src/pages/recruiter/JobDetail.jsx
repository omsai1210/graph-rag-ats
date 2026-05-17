import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiCall } from '../../../src/utils/api';
import LoadingSpinner from '../../components/recruiter/LoadingSpinner';
import StatusBadge from '../../components/recruiter/StatusBadge';

const JobDetail = () => {
    const { jobId } = useParams();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showMoreDesc, setShowMoreDesc] = useState(false);

    // Shortlisting State
    const [shortlistCount, setShortlistCount] = useState(10);
    const [shortlistLoading, setShortlistLoading] = useState(false);
    const [taskInfo, setTaskInfo] = useState(null); // { task_id, status: 'queued'|'running'|'done'|'failed', progress: 0 }
    const [showModal, setShowModal] = useState(false);

    // Applicants State
    const [activeTab, setActiveTab] = useState('All');
    const [applicants, setApplicants] = useState([]);
    const [applicantsLoading, setApplicantsLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState({});

    useEffect(() => {
        fetchJob();
        // Check if there's a stored task for this job in localStorage to resume polling
        const storedTaskId = localStorage.getItem(`shortlist_task_${jobId}`);
        if (storedTaskId) {
            setShowModal(true);
            setTaskInfo({ task_id: storedTaskId, status: 'running' });
            pollTaskStatus(storedTaskId);
        }
    }, [jobId]);

    useEffect(() => {
        if (job) fetchApplicants();
    }, [job, activeTab]);

    const fetchJob = async () => {
        try {
            const data = await apiCall('GET', `/jobs/${jobId}`);
            setJob(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch job details');
        } finally {
            setLoading(false);
        }
    };

    const fetchApplicants = async () => {
        try {
            setApplicantsLoading(true);
            let endpoint = `/jobs/${jobId}/applicants`;
            if (activeTab === 'Eligible') {
                // To fetch eligible but not yet shortlisted/rejected, they are 'pending'
                endpoint += `?status=pending`;
            } else if (activeTab === 'Shortlisted' || activeTab === 'Rejected') {
                endpoint += `?status=${activeTab.toLowerCase()}`;
            }
            
            let data = await apiCall('GET', endpoint);
            
            // For 'Eligible' tab, backend doesn't filter by eligibility_status automatically via query param 'status' (it filters shortlist_status).
            // Let's ensure we only show eligibility_status === 'passed' if tab is Eligible.
            if (activeTab === 'Eligible') {
                data = data.filter(a => a.eligibility_status === 'passed');
            }
            
            setApplicants(data);
            setExpandedRows({});
        } catch (err) {
            console.error('Failed to fetch applicants:', err);
        } finally {
            setApplicantsLoading(false);
        }
    };

    const toggleJobStatus = async () => {
        try {
            const updated = await apiCall('PUT', `/jobs/${jobId}`, { is_active: !job.is_active });
            setJob(updated);
        } catch (err) {
            alert(err.message || 'Failed to update job status');
        }
    };

    const runShortlisting = async () => {
        try {
            setShortlistLoading(true);
            const data = await apiCall('POST', '/shortlist/', { job_id: jobId, shortlist_count: Number(shortlistCount) });
            const taskId = data.task_id;
            localStorage.setItem(`shortlist_task_${jobId}`, taskId);
            setTaskInfo({ task_id: taskId, status: 'queued', message: data.message });
            setShowModal(true);
            pollTaskStatus(taskId);
        } catch (err) {
            alert(err.message || 'Failed to start shortlisting');
            setShortlistLoading(false);
        }
    };

    const pollTaskStatus = async (taskId) => {
        const interval = setInterval(async () => {
            try {
                const data = await apiCall('GET', `/shortlist/status/${taskId}`);
                setTaskInfo(data);
                
                if (data.status === 'done' || data.status === 'failed') {
                    clearInterval(interval);
                    setShortlistLoading(false);
                    localStorage.removeItem(`shortlist_task_${jobId}`);
                }
            } catch (err) {
                console.error("Polling error:", err);
                clearInterval(interval);
                setTaskInfo({ status: 'failed', error_message: 'Lost connection to task status' });
                setShortlistLoading(false);
            }
        }, 2000);
    };

    const downloadResume = async (applicationId) => {
        try {
            const data = await apiCall('GET', `/applications/${applicationId}/resume-url`);
            window.open(data.url, '_blank');
        } catch (err) {
            alert(err.message || 'Failed to get resume URL');
        }
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="container" style={{ padding: '2rem' }}><div style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '1rem', borderRadius: '8px' }}>{error}</div></div>;
    if (!job) return null;

    const parseJsonSafely = (str) => {
        try { return JSON.parse(str); } catch { return []; }
    };

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <Link to="/recruiter/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                &larr; Back to Dashboard
            </Link>

            {/* TOP SECTION */}
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{job.title}</h1>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            <StatusBadge status={job.is_active ? 'Active' : 'Closed'} type="job" />
                            <span>Deadline: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'No deadline'}</span>
                            <span>👥 {job.applicant_count || 0} / {job.max_applicants} applicants</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-secondary" disabled title="Editing jobs coming soon">Edit Job</button>
                        <button 
                            className="btn btn-secondary" 
                            style={{ borderColor: job.is_active ? '#ef4444' : '#16a34a', color: job.is_active ? '#ef4444' : '#16a34a' }}
                            onClick={toggleJobStatus}
                        >
                            {job.is_active ? 'Close Job' : 'Reopen Job'}
                        </button>
                    </div>
                </div>
                
                {job.esco_occupation_code && (
                    <div style={{ marginBottom: '1rem' }}>
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            ESCO: {job.esco_occupation_code}
                        </span>
                    </div>
                )}

                <div style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                    {showMoreDesc ? job.description : (job.description.length > 200 ? `${job.description.substring(0, 200)}...` : job.description)}
                    {job.description.length > 200 && (
                        <button onClick={() => setShowMoreDesc(!showMoreDesc)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', marginLeft: '0.5rem' }}>
                            {showMoreDesc ? 'Show less' : 'Show more'}
                        </button>
                    )}
                </div>
            </div>

            {/* SHORTLISTING PANEL */}
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--color-primary)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                    ⚡ Run AI Shortlisting
                </h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                    Graph RAG will score all eligible resumes against the ESCO occupation graph.
                </p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>Shortlist top</span>
                    <input 
                        type="number" 
                        min="1" 
                        max={job.applicant_count || 1} 
                        className="form-control" 
                        style={{ width: '80px', padding: '0.5rem' }} 
                        value={shortlistCount} 
                        onChange={e => setShortlistCount(e.target.value)} 
                    />
                    <span>candidates</span>
                    <button className="btn btn-primary" style={{ fontWeight: 'bold' }} onClick={runShortlisting} disabled={shortlistLoading || job.applicant_count === 0}>
                        {shortlistLoading ? 'Queuing...' : 'Run Shortlisting'}
                    </button>
                </div>
            </div>

            {/* APPLICANTS SECTION */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
                    {['All', 'Eligible', 'Shortlisted', 'Rejected'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '1rem', fontWeight: '500',
                                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {applicantsLoading ? (
                    <LoadingSpinner text="Loading applicants..." />
                ) : applicants.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <p style={{ color: 'var(--color-text-muted)' }}>
                            {activeTab === 'All' ? 'No applications yet. Share the job link to attract candidates.' :
                             activeTab === 'Shortlisted' ? 'Run shortlisting above to see ranked candidates.' :
                             activeTab === 'Rejected' ? 'No rejected candidates.' :
                             'No eligible applications found.'}
                        </p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{activeTab === 'Shortlisted' ? 'Rank' : '#'}</th>
                                    <th>Name</th>
                                    {activeTab === 'All' || activeTab === 'Eligible' ? (
                                        <>
                                            <th>Email</th>
                                            <th>Branch</th>
                                            <th>CGPA</th>
                                            <th>Status</th>
                                        </>
                                    ) : (
                                        <>
                                            <th>Score</th>
                                            <th>Matched Skills</th>
                                            <th>Actions</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {applicants.map((app, idx) => (
                                    <React.Fragment key={app.id}>
                                        <tr>
                                            <td>{idx + 1}</td>
                                            <td style={{ fontWeight: '500' }}>{app.full_name}</td>
                                            
                                            {activeTab === 'All' || activeTab === 'Eligible' ? (
                                                <>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>{app.email}</td>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>{app.branch}</td>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>{app.cgpa}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                            <StatusBadge status={app.eligibility_status} type="eligibility" />
                                                            {app.eligibility_status === 'passed' && (
                                                                <StatusBadge status={app.shortlist_status} type="shortlist" />
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ width: '200px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ flexGrow: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ 
                                                                    height: '100%', 
                                                                    width: `${app.graph_rag_score || 0}%`, 
                                                                    backgroundColor: (app.graph_rag_score || 0) >= 70 ? '#4ade80' : (app.graph_rag_score || 0) >= 40 ? '#facc15' : '#f87171' 
                                                                }}></div>
                                                            </div>
                                                            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{app.graph_rag_score || 0}%</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>
                                                        {parseJsonSafely(app.matched_skills).length} skills
                                                    </td>
                                                    <td>
                                                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => toggleRow(app.id)}>
                                                            {expandedRows[app.id] ? 'Collapse' : 'Expand'}
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                        
                                        {/* EXPANDED ROW */}
                                        {expandedRows[app.id] && (activeTab === 'Shortlisted' || activeTab === 'Rejected') && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '0' }}>
                                                    <div style={{ padding: '1.5rem', backgroundColor: 'rgba(15,23,42,0.3)', borderBottom: '1px solid var(--color-border)' }}>
                                                        
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                                            <div style={{ flex: '1', paddingRight: '2rem' }}>
                                                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>🤖 AI Analysis</h4>
                                                                <div style={{ backgroundColor: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '8px', fontStyle: 'italic', fontSize: '0.875rem', lineHeight: '1.5' }}>
                                                                    {app.graph_rag_explanation || 'No explanation provided.'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <button className="btn btn-primary" onClick={() => downloadResume(app.id)}>
                                                                    📄 Download Resume
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                                            <div style={{ flex: '1' }}>
                                                                <h4 style={{ marginBottom: '0.5rem', color: '#4ade80' }}>✅ Matched Skills</h4>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                                    {parseJsonSafely(app.matched_skills).map(s => (
                                                                        <span key={s} className="badge badge-shortlisted">{s}</span>
                                                                    ))}
                                                                    {parseJsonSafely(app.matched_skills).length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No direct skill matches.</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{ flex: '1' }}>
                                                                <h4 style={{ marginBottom: '0.5rem', color: '#f87171' }}>❌ Skill Gaps</h4>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                                    {parseJsonSafely(app.missing_skills).map(s => (
                                                                        <span key={s} className="badge badge-rejected">{s}</span>
                                                                    ))}
                                                                    {parseJsonSafely(app.missing_skills).length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No critical skill gaps identified 🎉</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* PROGRESS MODAL */}
            {showModal && taskInfo && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ padding: '2rem', textAlign: 'center' }}>
                        {taskInfo.status === 'done' ? (
                            <>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Shortlisting Complete!</h3>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                                    {shortlistCount} candidates shortlisted · Emails sent automatically
                                </p>
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setShowModal(false); setActiveTab('Shortlisted'); fetchApplicants(); }}>
                                    View Results
                                </button>
                            </>
                        ) : taskInfo.status === 'failed' ? (
                            <>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#f87171' }}>Shortlisting failed</h3>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                                    {taskInfo.error_message || 'An unexpected error occurred.'}
                                </p>
                                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowModal(false)}>
                                    Close
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚡ Shortlisting in Progress</h3>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
                                    Graph RAG is analyzing resumes against ESCO skill graph
                                </p>
                                
                                <div style={{ height: '8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${taskInfo.progress || 0}%`, 
                                        backgroundColor: 'var(--color-primary)',
                                        transition: 'width 0.5s ease'
                                    }}></div>
                                </div>
                                
                                <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Analyzing {Math.floor((taskInfo.progress || 0) / 100 * (job.applicant_count || 1))} of {job.applicant_count || 1} resumes...
                                </p>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                    {taskInfo.current_candidate ? `Current: ${taskInfo.current_candidate}` : 'Preparing...'}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobDetail;
