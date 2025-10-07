import React, { useState } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';

const UserImporter = ({ onSuccess, onCancel }) => {
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
    if (parsedData.length === 0) {
      showToast('No data to import.', 'warning');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/users/import', parsedData);
      const result = response.data;
      showToast(result.message || 'Import finished.', 'success');
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
        setError(`Import completed with some issues:\n${errorMessages}`);
      }
      onSuccess();
    } catch (err) {
      showToast(err.response?.data?.error || 'Server error during import.', 'error');
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
        <h2><UploadCloud size={24} /> Import Users from CSV</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>

      {error && <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}><AlertTriangle size={16} /> {error}</div>}

      {!file ? (
        <div 
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input-user').click()}
        >
          <UploadCloud size={48} />
          <p>Drag & drop a CSV file here, or click to select a file.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-color-light)' }}>Required headers: email, first_name, last_name, password, role</p>
          <input 
            type="file" 
            id="file-input-user"
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
              <div className="table-container-scrollable" style={{ maxHeight: '300px', marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>{Object.keys(parsedData[0]).map(key => <th key={key}>{key}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, index) => (
                      <tr key={index}>{Object.values(row).map((val, i) => <td key={i}>{i === 3 ? '******' : val}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={isLoading}>Cancel</button>
            <button onClick={handleImport} className="btn-primary" disabled={isLoading || parsedData.length === 0}>{isLoading ? 'Importing...' : `Import ${parsedData.length} Users`}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserImporter;