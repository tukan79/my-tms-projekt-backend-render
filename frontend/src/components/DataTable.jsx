import React from 'react';
import { ArrowUp, ArrowDown, Edit, Trash2 } from 'lucide-react';
import { useTableData } from '../hooks/useTableData';

// Funkcja pomocnicza do pobierania wartości z zagnieżdżonych obiektów
const getNestedValue = (obj, path) => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const DataTable = ({
  items = [],
  columns = [],
  onRefresh,
  onEdit,
  onDelete,
  title,
  filterPlaceholder,
  initialSortKey,
  filterKeys = [],
  currentUser, // Opcjonalny, dla UserList
}) => {
  const {
    sortedAndFilteredData,
    sortConfig,
    filterText,
    setFilterText,
    handleSort,
  } = useTableData(items, {
    initialSortKey,
    filterKeys,
  });

  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    }
    return null;
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{title} ({sortedAndFilteredData.length})</h2>
        <button onClick={onRefresh} className="btn-secondary">Refresh</button>
      </div>

      <input
        type="text"
        placeholder={filterPlaceholder}
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        className="filter-input"
      />

      <div className="table-wrapper">
        {sortedAndFilteredData.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} onClick={col.sortable ? () => handleSort(col.key) : undefined}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {col.icon}
                      <span>{col.header}</span>
                      {col.sortable && getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
                {(onEdit || onDelete) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredData.map(item => (
                <tr key={item.id}>
                  {columns.map(col => (
                    <td key={`${item.id}-${col.key}`}>
                      {col.render ? col.render(item) : getNestedValue(item, col.key)}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="actions-cell">
                      {currentUser && currentUser.id === item.id ? (
                        <span className="text-muted">This is you</span>
                      ) : (
                        <>
                          {onEdit && (
                            <button onClick={() => onEdit(item)} className="btn-icon" title="Edit">
                              <Edit size={16} />
                            </button>
                          )}
                          {onDelete && (
                            <button onClick={() => onDelete(item)} className="btn-icon btn-danger" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-results-message">
            {filterText ? 'No results match the search criteria.' : 'No data in the database.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default DataTable;