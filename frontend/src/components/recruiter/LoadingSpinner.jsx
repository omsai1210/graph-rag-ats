import React from 'react';

const LoadingSpinner = ({ text = "Loading..." }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(22, 163, 74, 0.2)',
                borderTop: '4px solid var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '1rem'
            }}></div>
            <style>
                {`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                `}
            </style>
            <span style={{ color: 'var(--color-text-muted)' }}>{text}</span>
        </div>
    );
};

export default LoadingSpinner;
