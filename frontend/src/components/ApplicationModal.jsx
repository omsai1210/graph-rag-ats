import React, { useState } from 'react';
import { apiCall } from '../utils/api';

const ApplicationModal = ({ job, onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError("Please upload your resume");
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append("job_id", job.id);
            formData.append("file", file);

            await apiCall('POST', '/applications', formData, true);
            onSuccess();
        } catch (err) {
            setError(err.message || "Failed to submit application");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Apply for {job.title}</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {error && (
                        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" style={{ marginBottom: '1rem' }}>Upload Resume (PDF only)</label>
                            <div 
                                className="file-upload-wrapper"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                            >
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                
                                {file ? (
                                    <p style={{ fontWeight: '500', color: 'var(--color-text)' }}>{file.name}</p>
                                ) : (
                                    <>
                                        <p style={{ fontWeight: '500', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Click or drag file to this area to upload</p>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Supported format: PDF</p>
                                    </>
                                )}
                                
                                <input 
                                    type="file" 
                                    accept=".pdf" 
                                    onChange={handleFileChange} 
                                />
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading || !file}>
                                {loading ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplicationModal;
