import React, { useState } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';

const DriverImporter = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        bom: true, // Automatically handle Byte Order Mark
        complete: (results) => {
          if (results.errors.length) {
            const errorDetails = results.errors.map(err => `Row ${err.row + 2}: ${err.message}`).join('\n');
            setError(`Error parsing CSV:\n${errorDetails}`);
            setParsedData([]);
          } else {
            setParsedData(results.data);
          }
        },
      });
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/drivers/import', parsedData);
      const result = response.data;
      showToast(result.message || 'Import finished.', 'success');
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
        setError(`Import completed with some issues:\n${errorMessages}`);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Server error during import.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      handleFileChange({ target: { files: [droppedFile] } });
    } else {
      showToast('Please drop a valid CSV file.', 'error');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><UploadCloud size={24} /> Import Drivers from CSV</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>
      {error && <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}><AlertTriangle size={16} /> {error}</div>}
      {!file ? (
        <div
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input-driver').click()}
        >
          <UploadCloud size={48} />
          <p>Drag & drop a CSV file here, or click to select a file.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-color-light)' }}>Required headers: first_name, last_name, login_code, etc.</p>
          <input
            type="file"
            id="file-input-driver"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div>
          <div className="file-info" style={{ marginTop: '1.5rem' }}>
            <FileText size={24} />
            <span>{file.name}</span>
            <button onClick={() => { setFile(null); setParsedData([]); setError(''); }} className="btn-icon">
              <X size={16} />
            </button>
          </div>
          {parsedData.length > 0 && (
            <>
              <p><CheckCircle size={16} color="green" /> Found <strong>{parsedData.length}</strong> records to import.</p>
              <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={isLoading}>Cancel</button>
                <button onClick={handleImport} className="btn-primary" disabled={isLoading || parsedData.length === 0}>{isLoading ? 'Importing...' : `Import ${parsedData.length} Drivers`}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverImporter;