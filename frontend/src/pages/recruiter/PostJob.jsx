import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiCall } from '../../../src/utils/api';

const PostJob = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    
    // Requirements
    const [skillInput, setSkillInput] = useState('');
    const [skills, setSkills] = useState([]);
    const [experience, setExperience] = useState('');
    const [escoCode, setEscoCode] = useState('');
    
    // Settings
    const [maxApplicants, setMaxApplicants] = useState(100);
    const [deadline, setDeadline] = useState('');
    
    // Eligibility
    const [selectedGenders, setSelectedGenders] = useState(['Male', 'Female', 'Other']);
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [minCgpa, setMinCgpa] = useState('');
    const [selectedYears, setSelectedYears] = useState([]);

    const branchOptions = [
        "Computer Science", "Information Technology", "Electronics & Communication", 
        "Mechanical Engineering", "Civil Engineering", "Chemical Engineering", "Electrical Engineering"
    ];
    
    const yearOptions = ["2022", "2023", "2024", "2025", "2026", "2027"];

    const handleAddSkill = (e) => {
        e.preventDefault();
        if (skillInput.trim() && !skills.includes(skillInput.trim())) {
            setSkills([...skills, skillInput.trim()]);
            setSkillInput('');
        }
    };

    const removeSkill = (skillToRemove) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    const toggleGender = (g) => {
        if (selectedGenders.includes(g)) {
            setSelectedGenders(selectedGenders.filter(i => i !== g));
        } else {
            setSelectedGenders([...selectedGenders, g]);
        }
    };

    const toggleBranch = (b) => {
        if (selectedBranches.includes(b)) {
            setSelectedBranches(selectedBranches.filter(i => i !== b));
        } else {
            setSelectedBranches([...selectedBranches, b]);
        }
    };

    const toggleYear = (y) => {
        if (selectedYears.includes(y)) {
            setSelectedYears(selectedYears.filter(i => i !== y));
        } else {
            setSelectedYears([...selectedYears, y]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !description) {
            setError("Title and description are required.");
            return;
        }

        setLoading(true);
        setError('');

        const payload = {
            title,
            description,
            requirements: { skills, experience },
            esco_occupation_code: escoCode || null,
            max_applicants: Number(maxApplicants),
            deadline: deadline ? new Date(deadline).toISOString() : null,
            eligibility: {
                gender_allowed: selectedGenders.length > 0 ? selectedGenders : null,
                branches_allowed: selectedBranches.length > 0 ? selectedBranches : null,
                min_cgpa: minCgpa ? Number(minCgpa) : null,
                graduation_years: selectedYears.length > 0 ? selectedYears.map(Number) : null
            }
        };

        try {
            const data = await apiCall('POST', '/jobs/', payload);
            navigate(`/recruiter/jobs/${data.id}`);
        } catch (err) {
            setError(err.message || 'Failed to post job');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <Link to="/recruiter/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                &larr; Back to Dashboard
            </Link>
            
            <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>Post a New Job</h1>

            {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                {/* LEFT COLUMN - FORM */}
                <div style={{ flex: '1 1 600px' }}>
                    <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem' }}>
                        
                        {/* SECTION 1 */}
                        <div style={{ marginBottom: '3rem' }}>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>1. Job Details</h3>
                            
                            <div className="form-group">
                                <label className="form-label">Job Title *</label>
                                <input type="text" className="form-control" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Developer" />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Description *</label>
                                <textarea className="form-control" required rows="6" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the role, responsibilities, and what makes it exciting..."></textarea>
                            </div>
                        </div>

                        {/* SECTION 2 */}
                        <div style={{ marginBottom: '3rem' }}>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>2. Requirements</h3>
                            
                            <div className="form-group">
                                <label className="form-label">Skill Tags</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="text" className="form-control" value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="e.g. Python, FastAPI" onKeyDown={e => { if (e.key === 'Enter') handleAddSkill(e); }} />
                                    <button className="btn btn-secondary" onClick={handleAddSkill}>Add</button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    {skills.map(s => (
                                        <span key={s} className="badge badge-shortlisted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {s}
                                            <button type="button" onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', lineHeight: '1' }}>&times;</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Experience</label>
                                <input type="text" className="form-control" value={experience} onChange={e => setExperience(e.target.value)} placeholder="e.g. 1-2 years, Fresher" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">ESCO Occupation Code</label>
                                <input type="text" className="form-control" value={escoCode} onChange={e => setEscoCode(e.target.value)} placeholder="Full ESCO URI e.g. http://data.europa.eu/esco/occupation/..." />
                                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                                    Find codes at <a href="https://esco.ec.europa.eu/en/classification/occupation" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>esco.ec.europa.eu</a>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3 */}
                        <div style={{ marginBottom: '3rem' }}>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>3. Application Settings</h3>
                            
                            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ flex: '1 1 200px' }}>
                                    <label className="form-label">Max Applicants</label>
                                    <input type="number" className="form-control" min="1" value={maxApplicants} onChange={e => setMaxApplicants(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ flex: '1 1 200px' }}>
                                    <label className="form-label">Application Deadline</label>
                                    <input type="datetime-local" className="form-control" value={deadline} onChange={e => setDeadline(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* SECTION 4 */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>4. Eligibility Filters</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Leave blank to allow all</p>
                            
                            <div className="form-group">
                                <label className="form-label">Allowed Genders</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {['Male', 'Female', 'Other'].map(g => (
                                        <button 
                                            key={g} type="button" 
                                            className={`btn ${selectedGenders.includes(g) ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
                                            onClick={() => toggleGender(g)}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Minimum CGPA</label>
                                <input type="number" step="0.1" min="0" max="10" className="form-control" value={minCgpa} onChange={e => setMinCgpa(e.target.value)} placeholder="Leave empty for no minimum" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Graduation Years</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {yearOptions.map(y => (
                                        <button 
                                            key={y} type="button" 
                                            className={`btn ${selectedYears.includes(y) ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
                                            onClick={() => toggleYear(y)}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Allowed Branches</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {branchOptions.map(b => (
                                        <button 
                                            key={b} type="button" 
                                            className={`btn ${selectedBranches.includes(b) ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
                                            onClick={() => toggleBranch(b)}
                                        >
                                            {b}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }} disabled={loading}>
                            {loading ? 'Publishing...' : 'Publish Job'}
                        </button>
                    </form>
                </div>

                {/* RIGHT COLUMN - PREVIEW */}
                <div style={{ flex: '1 1 350px' }}>
                    <div style={{ position: 'sticky', top: '2rem' }}>
                        <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Live Preview</h4>
                        <div className="glass-card job-card">
                            <h2 className="job-title" style={{ minHeight: '1.75rem' }}>{title || 'Job Title Preview'}</h2>
                            <div className="job-meta">
                                <span>{experience || 'Experience Level'}</span>
                            </div>
                            <p className="job-desc" style={{ minHeight: '3rem' }}>
                                {description ? (description.length > 200 ? description.substring(0, 200) + '...' : description) : 'Job description will appear here...'}
                            </p>
                            
                            {skills.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    {skills.map(s => (
                                        <span key={s} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>{s}</span>
                                    ))}
                                </div>
                            )}

                            <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                                <div style={{ marginBottom: '0.5rem' }}><strong>Open to:</strong> {selectedGenders.length > 0 ? selectedGenders.join(', ') : 'All'}</div>
                                <div style={{ marginBottom: '0.5rem' }}><strong>Branches:</strong> {selectedBranches.length > 0 ? selectedBranches.join(', ') : 'All'}</div>
                                <div style={{ marginBottom: '0.5rem' }}><strong>CGPA:</strong> {minCgpa ? `${minCgpa}+` : 'No minimum'}</div>
                                <div><strong>Deadline:</strong> {deadline ? new Date(deadline).toLocaleString() : 'No deadline'}</div>
                            </div>

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled>Apply Now (Preview)</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostJob;
