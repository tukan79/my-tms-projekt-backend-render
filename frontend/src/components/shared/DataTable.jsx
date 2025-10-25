// DataTable.js
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ArrowUp, ArrowDown, Edit, Trash2 } from 'lucide-react';
import { useTableData } from '../../hooks/useTableData';

// Funkcja pomocnicza do pobierania wartości z zagnieżdżonych obiektów
const getNestedValue = (obj, path) => {
  if (!obj || !path || typeof obj !== 'object') return undefined;
  try {
    // Używamy `reduce` do bezpiecznego przechodzenia przez zagnieżdżone właściwości
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  } catch (error) {
    // Logujemy błąd, ale nie przerywamy działania aplikacji
    console.warn('Error accessing nested value:', { path, obj, error });
    return undefined;
  }
};

const DataTable = ({
  items = [],
  columns = [],
  onRefresh,
  onEdit,
  onDelete,
  title = '',
  customActions = [],
  filterPlaceholder = "Search...",
  initialSortKey,
  filterKeys = [],
  currentUser, // Opcjonalny, dla UserList
  isLoading = false,
  loadingText = "Loading...",
  onContextMenu,
  footerData, // Nowy prop dla danych stopki
}) => {
  // Walidacja props
  if (!Array.isArray(items) || !Array.isArray(columns)) {
    console.error('DataTable: items and columns must be arrays');
    return null;
  }

  const {
    sortedAndFilteredData,
    sortConfig,
    filterText,
    setFilterText,
    handleSort,
  } = useTableData(items, {
    initialSortKey,
    filterKeys, // Przekazujemy klucze do filtrowania
  });

  // Krok 1: Lokalny stan dla pola input, aby zapewnić natychmiastową odpowiedź UI.
  const [inputValue, setInputValue] = useState(filterText);

  // Krok 2: Efekt do debouncingu. Aktualizuje `filterText` dopiero po 300ms od ostatniej zmiany w `inputValue`.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterText(inputValue);
    }, 300); // Opóźnienie 300ms

    // Krok 3: Funkcja czyszcząca, która resetuje timer, jeśli użytkownik wpisze kolejny znak.
    return () => clearTimeout(timer);
  }, [inputValue, setFilterText]);

  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? 
        <ArrowUp size={14} aria-label="sorted ascending" /> : 
        <ArrowDown size={14} aria-label="sorted descending" />;
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
      <h2>{title} ({sortedAndFilteredData.length})</h2>
      <input
        type="text"
        placeholder={filterPlaceholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="filter-input"
        style={{ marginTop: '1rem' }}
        aria-label="Filter table data"
      />

      <div className="table-wrapper">
        {sortedAndFilteredData.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th 
                    key={col.key} 
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    aria-sort={
                      sortConfig.key === col.key ? 
                      (sortConfig.direction === 'ascending' ? 'ascending' : 'descending') : 
                      'none'
                    }
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {col.icon}
                      <span>{col.header}</span>
                      {col.sortable && getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
                {(onEdit || onDelete || customActions.length > 0) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredData.map(item => (
                <tr 
                  key={item.id}
                  onContextMenu={onContextMenu ? (e) => onContextMenu(e, item) : undefined}
                  style={onContextMenu ? { cursor: 'context-menu' } : {}}
                >
                  {columns.map(col => (
                    <td key={`${item.id}-${col.key}`}>
                      {col.render ? col.render(item) : getNestedValue(item, col.key)}
                    </td>
                  ))}
                  {(onEdit || onDelete || customActions.length > 0) && (
                    <td className="actions-cell">
                      {currentUser && currentUser.id === item.id ? (
                        <span className="text-muted" aria-label="Current user">This is you</span>
                      ) : (
                        <>
                          {onEdit && (
                            <button 
                              onClick={() => onEdit(item)} 
                              className="btn-icon" 
                              title="Edit"
                              aria-label={`Edit ${item.name || 'item'}`}
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {onDelete && (
                            <button 
                              onClick={() => onDelete(item)} 
                              className="btn-icon btn-danger" 
                              title="Delete"
                              aria-label={`Delete ${item.name || 'item'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                      {customActions.map((action, index) => (
                        <button 
                          key={index} 
                          onClick={() => action.onClick(item)} 
                          className="btn-icon" 
                          title={action.title}
                          aria-label={action.title}
                        >
                          {action.icon}
                        </button>
                      ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {footerData && (
              <tfoot>
                <tr>
                  {columns.map(col => (
                    <td key={`footer-${col.key}`}>
                      {footerData[col.key] ? (
                        <strong>{footerData[col.key]}</strong>
                      ) : null}
                    </td>
                  ))}
                  {(onEdit || onDelete || customActions.length > 0) && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          <p className="no-results-message" aria-live="polite">
            {filterText ? 'No results match the search criteria.' : 'No data in the database.'}
          </p>
        )}
      </div>
    </div>
  );
};

DataTable.propTypes = {
  items: PropTypes.array,
  columns: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    header: PropTypes.string.isRequired,
    sortable: PropTypes.bool,
    render: PropTypes.func,
    icon: PropTypes.node
  })),
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  title: PropTypes.string,
  customActions: PropTypes.array,
  filterPlaceholder: PropTypes.string,
  initialSortKey: PropTypes.string,
  filterKeys: PropTypes.array,
  currentUser: PropTypes.object,
  onContextMenu: PropTypes.func,
  footerData: PropTypes.object,
};

export default DataTable;