import React from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Package, Calendar, Link2, Users, Truck, User, LogOut, Plus, Upload, LayoutDashboard, Settings, ExternalLink, DollarSign, Download } from 'lucide-react';
import DriverList from './components/DriverList.jsx';
import TruckImporter from './components/TruckImporter.jsx';
import AddDriverForm from './components/AddDriverForm.jsx';
import TrailerImporter from './components/TrailerImporter.jsx';
import api from './services/api.js';
import { DragDropContext } from '@hello-pangea/dnd';
import TruckList from './components/TruckList.jsx';
import AddTruckForm from './components/AddTruckForm.jsx';
import TrailerList from './components/TrailerList.jsx';
import AddTrailerForm from './components/AddTrailerForm.jsx';
import CustomerList from './components/CustomerList.jsx';
import AddCustomerForm from './components/AddCustomerForm.jsx';
import OrderList from './components/OrderList.jsx';
import AddOrderForm from './components/AddOrderForm.jsx';
import OrderImporter from './components/OrderImporter.jsx';
import UserList from './components/UserList.jsx';
import UserImporter from './components/UserImporter.jsx';
import AddUserForm from './components/AddUserForm.jsx'; // Corrected path
import RunManager from './components/RunManager.jsx';
import PlanItOrders from './components/PlanItOrders.jsx';
import PricingPage from './components/PricingPage.jsx'; // Corrected path
import PlanItAssignments from './components/PlanItAssignments.jsx';
import PlanItPage from './components/PlanItPage.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx'; // ✅ Użycie dedykowanego komponentu
import DriverImporter from './components/DriverImporter.jsx';
import { useAuth } from './contexts/AuthContext.jsx'; // Ten import jest już poprawny po zmianie w AuthContext.jsx
import ConfirmationModal from './components/ConfirmationModal.jsx';
import { useDashboardState, useDataFetching } from './hooks/useDashboard.js';
import LoginPage from './pages/LoginPage.jsx';
import { useBroadcastChannel } from './hooks/useBroadcastChannel.js'; // Corrected path
import CustomerImporter from './components/CustomerImporter.jsx';
import { ToastProvider, useToast } from './contexts/ToastContext.jsx';
import RegisterPage from './pages/RegisterPage';

const getInitials = (user) => {
  if (!user) return '';

  // Priorytet: użyj imienia i nazwiska, jeśli są dostępne.
  // Priority: use first and last name if available.
  if (user.first_name && user.last_name) {
    return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
  }

  // Fallback: użyj logiki opartej na e-mailu.
  // Fallback: use email-based logic.
  const namePart = user.email.split('@')[0];
  const parts = namePart.split(/[._-]/).filter(Boolean); // .filter(Boolean) usuwa puste stringi
  return parts.map(part => part.charAt(0)).join('').substring(0, 2).toUpperCase();
};


const Dashboard = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const {
    currentView, showForm, itemToEdit, modalState, showImporter, showClientImporter, showDriverImporter, showTruckImporter, showTrailerImporter, showUserImporter,
    handleViewChange, handleEditClick, handleCancelForm, setShowImporter, setShowTruckImporter, setShowTrailerImporter, setShowUserImporter,
    handleDeleteRequest, handleCloseModal, setShowForm, setItemToEdit, setShowClientImporter, setShowDriverImporter
  } = useDashboardState();

  const { data, isLoading, anyError, handleRefresh: refreshData, refreshAll } = useDataFetching();
  const { orders, drivers, trucks, trailers, users, assignments, runs, customers, zones } = data;

  const viewNames = {
    orders: 'order',
    drivers: 'driver',
    trucks: 'truck',
    trailers: 'trailer',
    runs: 'run',
    users: 'user',
    customers: 'customer',
    planit: 'PlanIt', // Poprawiono brakujący przecinek
    pricing: 'Pricing',
  };

  const getViewName = () => viewNames[currentView] || '';

  const handleRefresh = () => {
    refreshData(currentView);
  };

  const handleFormSuccess = () => {
    // Odświeżamy wszystkie dane, aby zapewnić spójność między widokami (np. po dodaniu kierowcy w widoku 'drivers', będzie on od razu widoczny w 'planning').
    // We refresh all data to ensure consistency between views (e.g., after adding a driver in the 'drivers' view, it will be immediately visible in 'planning').
    refreshAll();
    handleCancelForm();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const isDispatcher = user?.role === 'dispatcher';

  // Konfiguracja widoków, aby uniknąć dużego bloku switch.
  // View configuration to avoid a large switch block.
  const viewConfig = {
    // Nowy widok do zarządzania przejazdami
    runs: { Component: RunManager, props: { trucks, trailers, drivers, onDataRefresh: refreshAll } },
    planit: { Component: PlanItPage, props: { orders, runs, assignments, drivers, trucks, trailers, zones, onAssignmentCreated: refreshAll, onEdit: handleEditClick, onDelete: handleDeleteRequest } },
    pricing: { Component: PricingPage, props: { customers, zones, onRefresh: refreshAll } },
    // Widoki dostępne tylko dla admina.
    // Views available only for admin.
    ...(isAdmin && {
      drivers: { ListComponent: DriverList, FormComponent: AddDriverForm, data: drivers },
      trucks: { ListComponent: TruckList, FormComponent: AddTruckForm, data: trucks },
      customers: { ListComponent: CustomerList, FormComponent: AddCustomerForm, data: customers },
      trailers: { ListComponent: TrailerList, FormComponent: AddTrailerForm, data: trailers },
      users: { ListComponent: UserList, FormComponent: AddUserForm, data: users }
    }),
    // Widoki dostępne dla admina i dyspozytora.
    // Views available for admin and dispatcher.
    ...((isAdmin || isDispatcher) && {
      orders: { ListComponent: OrderList, FormComponent: AddOrderForm, data: orders },
    }),
  };

  const renderContent = () => {
    if (!user) return null;

    const currentViewConfig = viewConfig[currentView];
    if (!currentViewConfig) return null;

    // Jeśli widok jest prostym komponentem bez danych (jak PlanIt), renderuj go od razu.
    if (currentViewConfig.Component && !currentViewConfig.ListComponent) {
      return <ErrorBoundary><currentViewConfig.Component {...currentViewConfig.props} /></ErrorBoundary>;
    }

    const dataForView = viewConfig[currentView]?.data;
    if (isLoading && (!dataForView || dataForView.length === 0)) {
      return <div className="loading">Loading data...</div>;
    }

    if (anyError) {
      return (
        <div className="error-container">
          <h3>Error loading data</h3>
          <p className="error-message">{anyError}</p>
          <button onClick={handleRefresh} className="btn-primary">
            Try again
          </button>
        </div>
      );
    }

    const importerConfig = {
      orders: { show: showImporter, Component: OrderImporter, onCancel: () => setShowImporter(false) },
      customers: { show: showClientImporter, Component: CustomerImporter, onCancel: () => setShowClientImporter(false) },
      drivers: { show: showDriverImporter, Component: DriverImporter, onCancel: () => setShowDriverImporter(false) },
      trucks: { show: showTruckImporter, Component: TruckImporter, onCancel: () => setShowTruckImporter(false) },
      trailers: { show: showTrailerImporter, Component: TrailerImporter, onCancel: () => setShowTrailerImporter(false) },
      users: { show: showUserImporter, Component: UserImporter, onCancel: () => setShowUserImporter(false) },
    };

    const activeImporter = importerConfig[currentView];

    // Widoki z listą i formularzem.
    // Views with a list and a form.
    if (currentViewConfig.ListComponent) {
      if (activeImporter && activeImporter.show) {
        return <ErrorBoundary onReset={handleRefresh}><activeImporter.Component onSuccess={handleFormSuccess} onCancel={activeImporter.onCancel} /></ErrorBoundary>;
      }

      if (showForm) {
        const formProps = {
          onSuccess: handleFormSuccess,
          onCancel: handleCancelForm,
          itemToEdit: itemToEdit, // Używamy spójnej nazwy propsa / Use a consistent prop name
          // Przekaż dodatkowe dane, jeśli są potrzebne (np. dla OrderList). / Pass additional data if needed (e.g., for OrderList).
          // Przekazujemy listę klientów do formularza zlecenia
          ...(currentView === 'orders' && { drivers, trucks, trailers, clients: customers }),
        };
        return <ErrorBoundary onReset={handleRefresh}><currentViewConfig.FormComponent {...formProps} /></ErrorBoundary>;
      }

      const listProps = {
        items: currentViewConfig.data, // Używamy spójnej nazwy propa 'items' / Use a consistent prop name 'items'
        onRefresh: handleRefresh, onEdit: handleEditClick, onDelete: handleDeleteRequest, currentUser: user,
        ...(currentView === 'orders' && { drivers, trucks, trailers, zones }),
      };

      return <ErrorBoundary onReset={handleRefresh}><currentViewConfig.ListComponent {...listProps} /></ErrorBoundary>;
    }

    return null;
  };

  // Definicja zakładek nawigacyjnych z ikonami i uprawnieniami.
  // Definition of navigation tabs with icons and permissions.
  const navLinks = [
    {
      title: 'Main',
      icon: <LayoutDashboard size={16} />,
      links: [
        { view: 'orders', label: 'Orders', icon: <Package size={18} />, roles: ['admin', 'dispatcher'] },
        { view: 'runs', label: 'Runs', icon: <Link2 size={18} />, roles: ['admin', 'dispatcher'] },
        
      ]
    },
    {
      title: 'Management',
      icon: <Settings size={16} />,
      links: [
        { view: 'drivers', label: 'Drivers', icon: <User size={18} />, roles: ['admin'] },
        { view: 'trucks', label: 'Vehicles', icon: <Truck size={18} />, roles: ['admin'] },
        { view: 'trailers', label: 'Trailers', icon: <Truck size={18} style={{ transform: 'scaleX(-1)' }} />, roles: ['admin'] },
        { view: 'customers', label: 'Customers', icon: <Users size={18} />, roles: ['admin'] },
        { view: 'users', label: 'Users', icon: <Users size={18} />, roles: ['admin'] },
      ]
    },
    {
      title: 'PlanIt',
      icon: <Truck size={16} />, // Ikona ciężarówki dla nowej sekcji
      links: [{ view: 'planit', label: 'PlanIt', icon: <Truck size={18} />, roles: ['admin', 'dispatcher'] }]
    },
    {
      title: 'Settings',
      icon: <Settings size={16} />,
      links: [{ view: 'pricing', label: 'Pricing', icon: <DollarSign size={18} />, roles: ['admin'] }]
    }
  ];

  const renderNavLinks = () => (
    navLinks.map(section => (
      <div key={section.title} className="sidebar-section">
        <div className="sidebar-section-icon">{section.icon}</div>
        {section.links.filter(link => link.roles.includes(user?.role)).map(link => (
          <button key={link.view} title={link.label} className={`tab ${currentView === link.view ? 'tab-active' : ''}`} onClick={() => handleViewChange(link.view)} disabled={isLoading}>
            {link.icon}
          </button>
        ))}
      </div>
    ))
  );

  const handleGenericExport = async (resource) => {
    try {
      const response = await api.get(`/api/${resource}/export`);
      showToast(response.data.message || `Export for ${resource} successful!`, 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.error || `Failed to export ${resource}.`;
      showToast(errorMessage, 'error');
    }
  };

  // Widoki, które mają mieć opcję eksportu
  const exportableViews = ['drivers', 'trucks', 'trailers', 'customers', 'users'];

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="user-avatar" title={user?.email}>
            <span>{getInitials(user)}</span>
          </div>
          <button onClick={handleLogout} className="btn-icon btn-logout" title="Logout">
            <LogOut size={20} />
          </button>
        </div>
        <h1 className="sidebar-title">🚛 TMS System</h1>
        {isLoading && (
          <div className="global-loading">Loading...</div>
        )}
        <div className="sidebar-content">
          {renderNavLinks()}
        </div>
      </nav>

      <main className="main-content">
        <header className="main-header">
          {/* Pusty div dla wyrównania. */}
          {/* Empty div for alignment. */}
          <div /> 
          <div className="main-header-actions">
             {currentView === 'orders' && user?.role === 'admin' && !showForm && (
              <button onClick={() => setShowImporter(true)} className="btn-secondary" disabled={isLoading}>
                <Upload size={16} /> Import from CSV
              </button>
            )}
            {currentView === 'customers' && user?.role === 'admin' && !showForm && (
              <button onClick={() => setShowClientImporter(true)} className="btn-secondary" disabled={isLoading}>
                <Upload size={16} /> Import from CSV
              </button>
            )}
            {currentView === 'drivers' && user?.role === 'admin' && !showForm && (
              <button onClick={() => setShowDriverImporter(true)} className="btn-secondary" disabled={isLoading}>
                <Upload size={16} /> Import from CSV
              </button>
            )}
            {currentView === 'trucks' && user?.role === 'admin' && !showForm && (
              <button onClick={() => setShowTruckImporter(true)} className="btn-secondary" disabled={isLoading}>
                <Upload size={16} /> Import from CSV
              </button>
            )}
            {currentView === 'trailers' && user?.role === 'admin' && !showForm && (
              <button onClick={() => setShowTrailerImporter(true)} className="btn-secondary" disabled={isLoading}>
                <Upload size={16} /> Import from CSV
              </button>
            )}
            {currentView === 'users' && user?.role === 'admin' && !showForm && (
              <button onClick={() => setShowUserImporter(true)} className="btn-secondary" disabled={isLoading}>
                <Upload size={16} /> Import from CSV
              </button>
            )}
            {exportableViews.includes(currentView) && user?.role === 'admin' && !showForm && (
              <button onClick={() => handleGenericExport(currentView)} className="btn-secondary" disabled={isLoading}>
                <Download size={16} /> Export
              </button>
            )}
            {viewConfig[currentView]?.FormComponent && (
              <button
                onClick={() => {
                  if (showForm) {
                    handleCancelForm();
                  } else {
                    setItemToEdit(null);
                    setShowForm(true);
                    setShowClientImporter(false);
                    setShowDriverImporter(false);
                    setShowTruckImporter(false);
                    setShowUserImporter(false);
                    setShowTrailerImporter(false);
                    setShowImporter(false);
                  }
                }}
                className="btn-primary"
                disabled={isLoading}
              >
                {showForm ? 'Cancel' : <><Plus size={16} /> Add {getViewName()}</>}
              </button>
            )}
          </div>
        </header>
        {renderContent()}
        <ConfirmationModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          onConfirm={modalState.onConfirm}
          title="Confirm Deletion"
          message={modalState.message}
        />
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Lub dedykowany komponent spinnera / Or a dedicated spinner component
    return <div className="loading">Verifying authorization...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PopOutWindow = ({ view }) => {
  const { data, isLoading, anyError } = useDataFetching();
  const { orders, runs, assignments, drivers, trucks } = data;

  // Local state for optimistic updates
  const [localAvailableOrders, setLocalAvailableOrders] = React.useState([]);
  const [localAssignments, setLocalAssignments] = React.useState([]);
  const [error, setError] = React.useState(null);

  const enrichedRuns = React.useMemo(() => runs.map(run => ({...run, displayText: `${drivers.find(d => d.id === run.driver_id)?.first_name || ''} - ${trucks.find(t => t.id === run.truck_id)?.registration_plate || ''}`})), [runs, drivers, trucks]);

  React.useEffect(() => {
    setLocalAvailableOrders(orders.filter(o => o.status === 'nowe'));
    const enriched = assignments.map(a => ({
      ...a,
      order_number: orders.find(o => o.id === a.order_id)?.customer_reference || `ID: ${a.order_id}`,
      run_text: enrichedRuns.find(r => r.id === a.run_id)?.displayText || 'N/A'
    }));
    setLocalAssignments(enriched);
  }, [orders, assignments, enrichedRuns]);

  const { postMessage } = useBroadcastChannel();

  const handlePopOutDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (destination && source.droppableId === 'orders' && destination.droppableId !== 'orders') {
      const orderId = parseInt(draggableId, 10);
      const runId = parseInt(destination.droppableId, 10);

      // Optimistic Update
      const movedOrder = localAvailableOrders.find(o => o.id === orderId);
      if (!movedOrder) return;

      setLocalAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      const tempAssignment = {
        id: `temp-${Date.now()}`,
        order_id: orderId,
        run_id: runId,
        order_number: movedOrder.customer_reference || `ID: ${movedOrder.id}`,
        run_text: enrichedRuns.find(r => r.id === runId)?.displayText || 'N/A',
      };
      setLocalAssignments(prev => [...prev, tempAssignment]);
      setError(null);

      try {
        await api.post('/api/assignments', {
          order_id: orderId,
          run_id: runId,
        });
        postMessage('refresh'); // Notify all windows to refresh with confirmed data
      } catch (err) {
        // Revert on error
        setError('Failed to create assignment. Reverting changes.');
        setLocalAvailableOrders(prev => [...prev, movedOrder]);
        setLocalAssignments(prev => prev.filter(a => a.id !== tempAssignment.id));
      }
    }
  };

  if (isLoading) return <div className="loading">Loading data...</div>;
  if (anyError) return <div className="error-container">{anyError}</div>;

  return (
    <DragDropContext onDragEnd={handlePopOutDragEnd}>
      {error && <div className="error-message" style={{ margin: '1rem' }}>{error}</div>}
      {view === 'orders' && <PlanItOrders orders={localAvailableOrders} onPopOut={() => {}} />}
      {/* {view === 'runs' && <PlanItRuns runs={enrichedRuns} onPopOut={() => {}} />} */}
      {view === 'assignments' && <PlanItAssignments assignments={localAssignments} onPopOut={() => {}} />}
    </DragDropContext>
  );
};

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        {/* Trasy dla "wypchniętych" okien */}
        <Route path="/planit/orders" element={<ProtectedRoute><PopOutWindow view="orders" /></ProtectedRoute>} />
        <Route path="/planit/runs" element={<ProtectedRoute><PopOutWindow view="runs" /></ProtectedRoute>} />
        <Route path="/planit/assignments" element={<ProtectedRoute><PopOutWindow view="assignments" /></ProtectedRoute>} />
      </Routes>
    </ToastProvider>
  );
}

export default App;