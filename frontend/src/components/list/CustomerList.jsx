// frontend/src/components/CustomerList.jsx
import React from 'react';
import DataTable from '../shared/DataTable.jsx';
import api from '../../services/api.js';
import { useToast } from '../../contexts/ToastContext.jsx';

const CustomerList = ({ items = [], onRefresh, onEdit }) => {
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

  const { showToast } = useToast();

  const handleDelete = async (customer) => {
    if (window.confirm(`Are you sure you want to delete customer "${customer.name}"?`)) {
      try {
        await api.delete(`/api/customers/${customer.id}`);
        showToast('Customer deleted successfully.', 'success');
        onRefresh();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete customer.', 'error');
      }
    }
  };

  return (
    <DataTable
      items={items}
      columns={columns}
      onEdit={onEdit}
      onDelete={handleDelete}
      onRefresh={onRefresh}
      title="Customers"
      filterPlaceholder="Filter customers..."
      initialSortKey="name"
      filterKeys={['name', 'customer_code', 'postcode']}
    />
  );
};

export default CustomerList;