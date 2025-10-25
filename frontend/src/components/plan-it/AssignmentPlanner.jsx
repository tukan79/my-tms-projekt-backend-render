import React, { useState, useMemo } from 'react';
import api from '../../services/api';
import { Trash2 } from 'lucide-react';

const AssignmentPlanner = ({ orders = [], combinations = [], drivers = [], trucks = [], assignments = [], onAssignmentChange }) => {
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedCombination, setSelectedCombination] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filtrujemy zlecenia, które są nowe i nieprzypisane
  const availableOrders = useMemo(() => 
    orders.filter(order => order.status === 'nowe'), 
  [orders]);

  // Wzbogacamy zestawy o pełne informacje do wyświetlenia
  const enrichedCombinations = useMemo(() => 
    combinations.map(combo => {
      const truck = trucks.find(t => t.id === combo.truck_id);
      const driver = drivers.find(d => d.id === combo.driver_id);
      return {
        ...combo,
        displayText: `${driver?.first_name || ''} ${driver?.last_name || ''} - ${truck?.brand || ''} ${truck?.model || ''} (${truck?.registration_plate || ''})`
      };
    }), 
  [combinations, trucks, drivers]);

  // Wzbogacamy listę istniejących przypisań o pełne dane
  const enrichedAssignments = useMemo(() =>
    assignments.map(assignment => {
      const order = orders.find(o => o.id === assignment.order_id);
      const combination = combinations.find(c => c.id === assignment.combination_id);
      const driver = combination ? drivers.find(d => d.id === combination.driver_id) : null;
      const truck = combination ? trucks.find(t => t.id === combination.truck_id) : null;

      return {
        ...assignment,
        order_number: order?.order_number || `ID: ${assignment.order_id}`,
        route: `${order?.sender_details?.city || '?'} → ${order?.recipient_details?.city || '?'}`,
        driver_name: driver ? `${driver.first_name} ${driver.last_name}` : 'No driver',
        truck_plate: truck?.registration_plate || 'No vehicle',
      };
    }),
  [assignments, orders, combinations, drivers, trucks]);

  const handleSubmit = async () => {
    if (!selectedOrder || !selectedCombination) {
      alert('Please select an order and a combination.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/assignments', {
        order_id: parseInt(selectedOrder, 10),
        combination_id: parseInt(selectedCombination, 10),
        notes: notes,
      });
      onAssignmentChange(); // Odśwież wszystkie dane po zmianie
      setSelectedOrder('');
      setSelectedCombination('');
      setNotes('');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An error occurred while creating the assignment.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment? The order status will be reverted to "new".')) {
      return;
    }
    try {
      await api.delete(`/api/assignments/${assignmentId}`);
      onAssignmentChange(); // Odśwież wszystkie dane po zmianie
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An error occurred while deleting the assignment.';
      setError(errorMessage);
    }
  };

  return (
    <div className="card">
      <h2>Assignment Planner (Order to Combination)</h2>
      {error && <div className="error-message">{error}</div>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'end' }}>
        <div className="form-group" style={{ flex: 3 }}>
          <label>Available Orders (status: new)</label>
          <div className="table-container-scrollable">
            <table className="data-table selectable-table">
              <thead>
                <tr>
                  <th>Consignment #</th>
                  <th>Loading Company</th>
                  <th>Loading PC</th>
                  <th>Unloading Company</th>
                  <th>Unloading PC</th>
                  <th>Weight</th>
                  <th>Spaces</th>
                </tr>
              </thead>
              <tbody>
                {availableOrders.map(order => (
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrder(String(order.id))}
                    className={selectedOrder === String(order.id) ? 'selected-row' : ''}
                  >
                    <td>{order.order_number || '-'}</td>
                    <td>{order.sender_details.name}</td>
                    <td>{order.sender_details.postCode}</td>
                    <td>{order.recipient_details.name}</td>
                    <td>{order.recipient_details.postCode}</td>
                    <td>{order.cargo_details?.kilos || '-'}</td>
                    <td>{order.cargo_details?.spaces || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-group" style={{ flex: 2 }}>
          <label>Available Combinations</label>
          <select value={selectedCombination} onChange={(e) => setSelectedCombination(e.target.value)} required>
            <option value="">Select a combination...</option>
            {combinations.map(combo => ( // Używamy przefiltrowanych i wzbogaconych zestawów
              <option key={combo.id} value={combo.id}>
                {combo.displayText}
              </option>
            ))}
          </select>
        </div>

        <button onClick={handleSubmit} className="btn-primary" disabled={loading || !selectedOrder || !selectedCombination}>
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </div>

      <div className="form-group">
        <label>Notes for Driver (optional)</label>
        <textarea 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          rows="3"
          placeholder="E.g., gate code, notification number..."
        />
      </div>

      <h3 style={{ marginTop: '2rem' }}>Scheduled Assignments</h3>
      <div className="list">
        {enrichedAssignments.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedAssignments.map(assignment => (
                <tr key={assignment.id}>
                  <td>{assignment.order_number}</td>
                  <td>{assignment.route}</td>
                  <td>{assignment.driver_name}</td>
                  <td>{assignment.truck_plate}</td>
                  <td>{assignment.notes || '-'}</td>
                  <td className="actions-cell">
                    <button onClick={() => handleDeleteAssignment(assignment.id)} className="btn-icon btn-danger" title="Delete assignment">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No scheduled assignments.</p>
        )}
      </div>
    </div>
  );
};

export default AssignmentPlanner;