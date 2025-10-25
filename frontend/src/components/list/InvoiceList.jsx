import React from 'react';
import DataTable from '../shared/DataTable.jsx';
import { FileText, Calendar, User, PoundSterling, Download } from 'lucide-react';
import api from '../../services/api.js';
import { useToast } from '../../contexts/ToastContext.jsx';

const InvoiceList = ({ invoices = [] }) => {
  const { showToast } = useToast();
  const columns = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      icon: <FileText size={16} />,
      sortable: true,
    },
    {
      key: 'customer_name',
      header: 'Customer',
      icon: <User size={16} />,
      sortable: true,
    },
    {
      key: 'issue_date',
      header: 'Issue Date',
      icon: <Calendar size={16} />,
      render: (item) => new Date(item.issue_date).toLocaleDateString(),
      sortable: true,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (item) => new Date(item.due_date).toLocaleDateString(),
      sortable: true,
    },
    {
      key: 'total_amount',
      header: 'Amount',
      icon: <PoundSterling size={16} />,
      render: (item) => `£${parseFloat(item.total_amount).toFixed(2)}`,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <span className={`status status-${item.status}`}>{item.status}</span>,
      sortable: true,
    },
  ];

  const handleDownloadPDF = async (invoiceId) => {
    try {
      const response = await api.get(`/api/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showToast('Failed to download invoice PDF.', 'error');
    }
  };

  return (
    <DataTable
      items={invoices}
      columns={columns}
      title="Generated Invoices"
      filterPlaceholder="Filter invoices..."
      filterKeys={['invoice_number', 'customer_name', 'status']}
      initialSortKey="issue_date"
      customActions={[{
        icon: <Download size={16} />,
        onClick: (item) => handleDownloadPDF(item.id),
        title: 'Download PDF',
      }]}
    />
  );
};

export default InvoiceList;