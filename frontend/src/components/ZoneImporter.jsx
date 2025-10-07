import React, { useState } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';

const ZoneImporter = ({ onSuccess, onCancel }) => {
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
            // Sprawdzamy, czy plik ma wymagane kolumny
            const requiredHeaders = ['zone_name', 'postcode_patterns', 'is_home_zone'];
            const hasRequiredHeaders = requiredHeaders.every(h => results.meta.fields.includes(h));
            if (!hasRequiredHeaders) {
              setError(`CSV file must contain the following headers: ${requiredHeaders.join(', ')}`);
              setParsedData([]);
              return;
            }
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
      const response = await api.post('/api/zones/import', parsedData);
      showToast(response.data.message || 'Zones imported successfully!', 'success');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Server error during import.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><UploadCloud size={24} /> Import Postcode Zones from CSV</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>

      {error && <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}><AlertTriangle size={16} /> {error}</div>}

      {!file ? (
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFileChange({ target: { files: e.dataTransfer.files } }); }}
          onClick={() => document.getElementById('file-input-zone').click()}
        >
          <UploadCloud size={48} />
          <p>Drag & drop a CSV file here, or click to select a file.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-color-light)' }}>Required headers: zone_name, postcode_patterns, is_home_zone</p>
          <input
            type="file"
            id="file-input-zone"
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
            <p style={{ marginTop: '1rem' }}>
              <CheckCircle size={16} color="green" /> Found <strong>{parsedData.length}</strong> records to import.
            </p>
          )}
          {parsedData.length > 0 && (
            <div className="form-actions">
              <button type="button" onClick={onCancel} className="btn-secondary" disabled={isLoading}>Cancel</button>
              <button onClick={handleImport} className="btn-primary" disabled={isLoading || parsedData.length === 0}>{isLoading ? 'Importing...' : `Import ${parsedData.length} Zones`}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZoneImporter;