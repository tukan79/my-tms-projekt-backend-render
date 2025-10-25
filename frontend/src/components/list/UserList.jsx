import React from 'react';
import api from '../../services/api';
import DataTable from '../shared/DataTable.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';

const UserList = ({ items: users = [], onRefresh, onEdit, currentUser }) => {
  const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (user) => `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email },
    { key: 'email', header: 'Email', sortable: true },
    { 
      key: 'role',
      header: 'Role',
      sortable: true,
      // Renderowanie bardziej przyjaznych nazw ról
      render: (user) => user.role === 'admin' ? 'Admin' : 'Dispatcher'
    },
  ];

  const { showToast } = useToast();

  const handleDelete = async (user) => {
    if (window.confirm(`Are you sure you want to delete user ${user.email}?`)) {
      try {
        await api.delete(`/api/users/${user.id}`);
        showToast('User deleted successfully.', 'success');
        onRefresh();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete user.', 'error');
      }
    }
  };
  
  return (
    <DataTable
      items={users}
      columns={columns}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onDelete={handleDelete}
      title="User List"
      filterPlaceholder="Filter by email or role..."
      initialSortKey="name"
      filterKeys={['email', 'role']}
      currentUser={currentUser}
    />
  );
};

export default UserList;