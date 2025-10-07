import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

const TruckImporter = ({ onCancel, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCsv(selectedFile);
    }
  };

  const parseCsv = (fileToParse) => {
    setLoading(true);
    setError('');
    Papa.parse(fileToParse, {
      header: true,
      skipEmptyLines: true,
      bom: true, // Automatically handle Byte Order Mark
      complete: (results) => {
        if (results.errors.length) {
          const errorDetails = results.errors.map(err => `Row ${err.row + 2}: ${err.message}`).join('\n');
          setError(`Error parsing CSV:\n${errorDetails}`);
          showToast('Error parsing CSV file.', 'error');
          setLoading(false);
          return;
        }
        
        const mappedData = results.data.map(row => ({
          // Map headers from the exported CSV file
          registration_plate: row.registration_plate || '',
          brand: row.brand || '',
          model: row.model || '',
          vin: row.vin || '',
          production_year: row.production_year ? parseInt(row.production_year, 10) : null,
          type_of_truck: row.type_of_truck || 'tractor',
          total_weight: row.total_weight ? parseInt(row.total_weight, 10) : null,
          pallet_capacity: row.pallet_capacity ? parseInt(row.pallet_capacity, 10) : null,
          max_payload_kg: row.max_payload_kg ? parseInt(row.max_payload_kg, 10) : null,
          is_active: !(row.is_deleted === 'true' || row.is_deleted === true), // Set status based on is_deleted
        }));

        setParsedData(mappedData);
        setLoading(false);
      },
      error: () => {
        setError('Failed to parse CSV file.');
        showToast('Failed to parse CSV file.', 'error');
        setLoading(false);
      }
    });
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      showToast('No data to import.', 'warning');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/trucks/import', { trucks: parsedData });
      showToast(`${response.data.importedCount} trucks imported successfully!`, 'success');
      onSuccess(); // Refresh the list in the parent component
      onCancel(); // Close the importer
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An error occurred during import.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseCsv(droppedFile);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Import Trucks from CSV</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {!file ? (
        <div
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input-truck').click()}
        >
          <UploadCloud size={48} />
          <p>Drag & drop a CSV file here, or click to select a file.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-color-light)' }}>Required headers: Vehicle Code, Vehicle Reg, Vehicle Description, etc.</p>
          <input
            type="file"
            id="file-input-truck"
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

          {loading && <p>Parsing file...</p>}
          {error && <div className="error-message"><AlertCircle size={16} /> {error}</div>}

          {parsedData.length > 0 && (
            <>
              <p><CheckCircle size={16} color="green" /> Found <strong>{parsedData.length}</strong> records to import.</p>
              <div className="table-container-scrollable" style={{ maxHeight: '300px', marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Reg. Plate</th>
                      <th>Description</th>
                      <th>Brand</th>
                      <th>Max Weight (kg)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((truck, index) => ( // Preview first 10 rows
                      <tr key={index}>
                        <td>{truck.registration_plate}</td>
                        <td>{truck.description}</td>
                        <td>{truck.brand}</td>
                        <td>{truck.max_weight_kg}</td>
                        <td><span className={`status ${truck.status === 'active' ? 'active' : 'inactive'}`}>{truck.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>...and {parsedData.length - 10} more rows.</p>}
              </div>
            </>
          )}

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="button" onClick={handleImport} className="btn-primary" disabled={loading || parsedData.length === 0}>
              {loading ? 'Importing...' : `Import ${parsedData.length} Records`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TruckImporter;