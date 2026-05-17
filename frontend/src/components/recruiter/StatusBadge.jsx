import React from 'react';

const StatusBadge = ({ status, type }) => {
    let colorClass = '';
    let displayText = status;

    if (!status) return null;

    if (type === 'job') {
        colorClass = status === 'Active' ? 'badge-shortlisted' : 'badge-rejected';
    } else if (type === 'eligibility') {
        colorClass = status.toLowerCase() === 'passed' ? 'badge-shortlisted' : 'badge-rejected';
    } else if (type === 'shortlist') {
        switch(status.toLowerCase()) {
            case 'shortlisted': colorClass = 'badge-shortlisted'; break;
            case 'rejected': colorClass = 'badge-rejected'; break;
            default: colorClass = 'badge-pending'; break;
        }
    }

    // In index.css, badge-shortlisted is green, badge-rejected is red, badge-pending is yellow
    // For closed jobs, we can use a gray style, but for now we fallback to badge-rejected to make it red
    if (type === 'job' && status === 'Closed') {
        return (
            <span className="badge" style={{ backgroundColor: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8' }}>
                {displayText}
            </span>
        );
    }

    return (
        <span className={`badge ${colorClass}`}>
            {displayText}
        </span>
    );
};

export default StatusBadge;
