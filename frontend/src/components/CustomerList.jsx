// frontend/src/components/CustomerList.jsx
import React from 'react';
import DataTable from './DataTable.jsx';
import { useTableData } from '../hooks/useTableData.js';

const CustomerList = ({ items = [], onEdit, onDelete }) => {
  const columns = [
    { key: 'customer_code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'address_line1', header: 'Address' },
    { key: 'postcode', header: 'Postcode' },
    { key: 'phone_number', header: 'Phone' },
    { key: 'vat_number', header: 'VAT Number' },
    {
      key: 'created_at',
      header: 'Creation Date',
      render: (item) => new Date(item.created_at).toLocaleDateString(),
    },
  ];

  const {
    sortedAndFilteredData,
    sortConfig,
    filterText,
    setFilterText,
    handleSort,
  } = useTableData(items, { initialSortKey: 'name', filterKeys: ['name', 'customer_code', 'postcode'] });

  return (
    <div className="card">
      <h2>Customers</h2>
      <input
        type="text"
        placeholder="Filter customers..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        className="filter-input"
      />
      <div className="table-wrapper">
        <DataTable
          columns={columns}
          items={sortedAndFilteredData}
          sortConfig={sortConfig}
          onSort={handleSort}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
};

export default CustomerList;