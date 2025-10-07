import React from 'react';
import api from '../services/api';
import DataTable from './DataTable';

const UserList = ({ items: users = [], onRefresh, onEdit, onDelete, currentUser }) => {
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

  const handleDelete = (user) => {
    onDelete('Are you sure you want to delete this user? This action cannot be undone.', async () => {
      try {
        await api.delete(`/api/users/${user.id}`);
        onRefresh();
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'An error occurred while deleting the user.';
        console.error("Deletion error:", errorMessage);
      }
    });
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