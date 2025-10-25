import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../services/api.js';

const BugReportButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  if (!user) {
    return null; // Don't show the button if the user is not logged in
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      showToast('Please provide a description of the issue.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        description,
        context: {
          url: window.location.href,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          userAgent: navigator.userAgent,
        },
      };

      await api.post('/api/feedback/report-bug', payload);
      showToast('Bug report sent successfully. Thank you!', 'success');
      setIsModalOpen(false);
      setDescription('');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to send bug report.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="btn-icon"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: 'var(--danger-color)',
          color: 'white',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 999,
        }}
        title="Report a Bug"
      >
        <Bug size={24} />
      </button>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ width: '500px' }}>
            <form onSubmit={handleSubmit}>
              <h4>Report a Bug</h4>
              <p>Please describe the issue you encountered. Include steps to reproduce it if possible.</p>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="6" required style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" disabled={isLoading}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Sending...' : 'Send Report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BugReportButton;