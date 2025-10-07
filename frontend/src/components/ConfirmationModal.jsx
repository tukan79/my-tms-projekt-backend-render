import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content card">
        <button onClick={onClose} className="btn-icon modal-close-button">
          <X size={24} />
        </button>
        <div className="modal-header">
          <AlertTriangle size={48} className="text-danger" />
          <h2 className="modal-title">{title || 'Confirm Action'}</h2>
        </div>
        <div className="modal-body">
          <p>{message || 'Are you sure you want to perform this action?'}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;