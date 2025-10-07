import React, { useState } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';

const RateCardImporter = ({ rateCardId, onSuccess, onCancel }) => {
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

      const reader = new FileReader();
      reader.onload = (e) => {
        const rawText = e.target.result;
        console.log('Raw file content:', rawText);
        
        // USUŃ PIERWSZY WIERSZ (nazwę pliku) przed parsowaniem
        const lines = rawText.split('\n');
        if (lines.length > 1) {
          // Pomijamy pierwszy wiersz i łączymy resztę
          const cleanedText = lines.slice(1).join('\n');
          console.log('Cleaned text:', cleanedText);
          
          // Parsuj oczyszczony tekst
          Papa.parse(cleanedText, {
            header: true,
            skipEmptyLines: true,
            delimiter: ",",
            transformHeader: (header) => header?.trim(),
            transform: (value) => value?.trim(),
            complete: (results) => {
              console.log('Parse results:', results);
              console.log('First row:', results.data[0]);
              
              if (results.errors.length > 0) {
                const errorDetails = results.errors.map(err => 
                  `Row ${err.row}: ${err.message}${err.field ? ` - Field: ${err.field}` : ''}`
                ).join('\n');
                setError(`Error parsing CSV:\n${errorDetails}`);
                setParsedData([]);
              } else {
                // Filtruj puste wiersze
                const filteredData = results.data.filter(row => 
                  Object.values(row).some(value => value && value.toString().trim() !== '')
                );
                setParsedData(filteredData);
                
                if (filteredData.length === 0) {
                  setError('No valid data found in CSV file after cleaning.');
                }
              }
            },
          });
        } else {
          setError('File is empty or has invalid format.');
        }
      };
      reader.onerror = () => {
        setError('Error reading file. Please try again.');
      };
      reader.readAsText(selectedFile, 'UTF-8');
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
      const response = await api.post(`/api/rate-cards/${rateCardId}/import`, { entries: parsedData });
      showToast(response.data.message || 'Import finished successfully!', 'success');
      onSuccess();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Server error during import.';
      showToast(errorMessage, 'error');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      handleFileChange({ target: { files: [droppedFile] } });
    } else {
      showToast('Please drop a valid CSV file.', 'error');
    }
  };

  const removeFile = () => {
    setFile(null);
    setParsedData([]);
    setError('');
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><UploadCloud size={24} /> Import Rate Entries</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>

      {error && (
        <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!file ? (
        <div 
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input-rate-card').click()}
        >
          <UploadCloud size={48} />
          <p>Drag & drop a CSV file here, or click to select a file.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-color-light)' }}>
            Use the exported template for the correct format.
          </p>
          <input 
            type="file" 
            id="file-input-rate-card"
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
            <button onClick={removeFile} className="btn-icon">
              <X size={16} />
            </button>
          </div>

          {parsedData.length > 0 ? (
            <>
              <p><CheckCircle size={16} color="green" /> Found <strong>{parsedData.length}</strong> records to import.</p>
              <div className="table-container-scrollable" style={{ maxHeight: '300px', marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(parsedData[0]).slice(0, 5).map(key => (
                        <th key={key}>{key}</th>
                      ))}
                      {Object.keys(parsedData[0]).length > 5 && <th>...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).slice(0, 5).map((val, i) => (
                          <td key={i}>{val}</td>
                        ))}
                        {Object.values(row).length > 5 && <td>...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 5 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-color-light)', marginTop: '0.5rem' }}>
                  Showing first 5 of {parsedData.length} rows
                </p>
              )}
            </>
          ) : (
            <p style={{ marginTop: '1rem' }}>No data parsed from file.</p>
          )}

          <div className="form-actions">
            <button 
              type="button" 
              onClick={onCancel} 
              className="btn-secondary" 
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              onClick={handleImport} 
              className="btn-primary" 
              disabled={isLoading || parsedData.length === 0}
            >
              {isLoading ? 'Importing...' : `Import ${parsedData.length} Entries`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateCardImporter;