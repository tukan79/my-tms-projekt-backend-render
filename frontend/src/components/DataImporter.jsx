import React, { useState } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '@/services/api';
import { useToast } from '@/contexts/ToastContext.jsx';

const getNestedValue = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

const DataImporter = ({
  title,
  apiEndpoint,
  postDataKey, // Klucz, pod którym dane mają być wysłane, np. 'trucks' dla { trucks: data }
  dataMappingFn,
  previewColumns,
  onSuccess,
  onCancel,
}) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parsingErrors, setParsingErrors] = useState([]);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setParsingErrors([]);

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        bom: true,
        complete: (results) => {
          if (results.errors.length) {
            setError('Error parsing CSV file. Please check its structure.');
            setParsingErrors(results.errors);
            // Logujemy szczegółowe błędy do konsoli deweloperskiej
            console.error("CSV Parsing Errors:", results.errors);
            setParsedData([]);
          } else {
            const mappedData = results.data.map(dataMappingFn).filter(Boolean);
            setParsedData(mappedData);
            setParsingErrors([]);
          }
        },
        error: () => {
          setError('Cannot read the file. Please ensure it is a valid CSV file.');
          setParsedData([]);
        },
      });
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      showToast('No valid data to import.', 'warning');
      return;
    }
    setIsLoading(true);
    setError(null);

    const payload = postDataKey ? { [postDataKey]: parsedData } : parsedData;

    try {
      const response = await api.post(apiEndpoint, payload);
      const result = response.data;
      showToast(result.message || 'Import finished successfully!', 'success');
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
        setError(`Import completed with some issues:\n${errorMessages}`);
      }
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
    handleFileChange({ target: { files: e.dataTransfer.files } });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><UploadCloud size={24} /> {title}</h2>
        <button onClick={onCancel} className="btn-icon"><X size={20} /></button>
      </div>

      {error && <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}><AlertTriangle size={16} /> {error}</div>}

      {!file ? ( 
        <div className="dropzone" onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => document.getElementById('file-input-generic').click()}>
          <UploadCloud size={48} />
          <p>Drag & drop a CSV file here, or click to select a file.</p>
          <input type="file" id="file-input-generic" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      ) : (
        <div>
          <div className="file-info" style={{ marginTop: '1.5rem' }}>
            <FileText size={24} />
            <span>{file.name}</span>
            <button onClick={() => { setFile(null); setParsedData([]); setError(null); setParsingErrors([]); }} className="btn-icon"><X size={16} /></button>
          </div>

          {parsingErrors.length > 0 && (
            <div className="error-message" style={{ marginTop: '1rem', maxHeight: '150px', overflowY: 'auto', padding: '1rem', background: '#fff3f3', borderRadius: '6px' }}>
              <strong>Parsing Errors Found:</strong>
              <ul>
                {parsingErrors.slice(0, 5).map((err, index) => (
                  <li key={index}>Row {err.row}: {err.message}</li>
                ))}
              </ul>
              {parsingErrors.length > 5 && <p>...and {parsingErrors.length - 5} more errors.</p>}
            </div>
          )}

          {parsedData.length > 0 && (
            <>
              <p style={{ marginTop: '1rem' }}><CheckCircle size={16} color="green" /> Found <strong>{parsedData.length}</strong> records to import.</p>
              <div className="table-container-scrollable" style={{ maxHeight: '300px', marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {previewColumns.map(col => <th key={col.key}>{col.header}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {previewColumns.map(col => (
                          <td key={col.key}>
                            {col.render ? col.render(row) : getNestedValue(row, col.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 5 && <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>...and {parsedData.length - 5} more rows.</p>}
            </>
          )}

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={isLoading}>Cancel</button>
            <button onClick={handleImport} className="btn-primary" disabled={isLoading || parsedData.length === 0}>
              {isLoading ? 'Importing...' : `Import ${parsedData.length} Records`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImporter;