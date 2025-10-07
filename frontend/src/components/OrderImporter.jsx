import React, { useState } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext.jsx';

const OrderImporter = ({ onSuccess, onCancel }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const { showToast } = useToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setImportResult(null);

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        bom: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError('An error occurred while parsing the CSV file. Please check its structure.');
            setParsedData([]);
          } else {
            const mappedData = results.data.map(row => ({
              order_number: row.ConsignmentNumber,
              customer_reference: row.CustomerReference,
              // Zakładamy, że AccountCode to kod klienta, potrzebujemy znaleźć ID klienta
              // Na razie zostawiamy to pole puste, serwer będzie musiał sobie z tym poradzić
              customer_code: row.AccountCode, 
              status: 'nowe',
              sender_details: {
                name: row.CollectionName,
                address1: row.CollectionAddress1,
                address2: row.CollectionAddress2,
                townCity: row.CollectionTownCity,
                postCode: row.CollectionPostCode,
              },
              recipient_details: {
                name: row.DeliveryName,
                address1: row.DeliveryAddress1,
                address2: row.DeliveryAddress2,
                townCity: row.DeliveryTownCity,
                postCode: row.DeliveryPostCode,
              },
              loading_date_time: row.CollectionDate ? `${row.CollectionDate}T${row.CollectionTime || '12:00:00'}` : null,
              unloading_date_time: row.DeliveryDate ? `${row.DeliveryDate}T${row.DeliveryTime || '12:00:00'}` : null,
              cargo_details: {
                description: `Spaces: ${row.TotalSpaces}, Kilos: ${row.TotalKilos}`,
                pallets: {
                  full: { count: row.FullQ || 0 },
                  half: { count: row.HalfQ || 0 },
                  plus_half: { count: row.HalfPlusQ || 0 },
                  quarter: { count: row.QuarterQ || 0 },
                  micro: { count: row.MicroQ || 0 },
                  },
                  total_kilos: parseFloat(row.TotalKilos) || 0,
              },
              service_level: row.ServiceCode || 'A',
            }));
            setParsedData(mappedData);
          }
        },
        error: () => {
          setError('Cannot read the file. Please ensure it is a valid CSV file.');
          setParsedData([]);
        }
      });
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      setError('No data to import. Please select a valid CSV file.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const response = await api.post('/api/orders/import', parsedData);
      const result = response.data;
      showToast(result.message || `Import finished. Processed ${result.count} orders.`, 'success');
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
        setError(`Import completed with some issues:\n${errorMessages}`);
      }
      onSuccess(); // Odśwież listę zleceń w tle
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An unexpected server error occurred.';
      showToast(errorMessage, 'error');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2><UploadCloud size={24} style={{ marginRight: '0.5rem' }} /> Import Orders from CSV</h2>
        <button onClick={onCancel} className="btn-icon">
          <X size={20} />
        </button>
      </div>

      {error && <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}><AlertTriangle size={16} /> {error}</div>}

      <div className="form-group">
        <label>Select CSV File</label>
        <input type="file" accept=".csv" onChange={handleFileChange} className="file-input" />
      </div>

      {parsedData.length > 0 && (
        <>
          <div className="preview-section">
            <h4><FileText size={16} /> Data Preview ({parsedData.length} rows)</h4>
            <p>Below is a preview of the first 5 rows from your file. Please ensure the data is correct.</p>
            <div className="list">
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(parsedData[0]).map(key => <th key={key}>{key}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((val, i) => (
                        <td key={i}>
                          {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={isLoading}>
              Cancel
            </button>
            <button onClick={handleImport} className="btn-primary" disabled={isLoading || parsedData.length === 0}>
              {isLoading ? 'Importing...' : `Import ${parsedData.length} Orders`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default OrderImporter;