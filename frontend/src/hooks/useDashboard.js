import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApiResource } from './useApiResource';
import { useBroadcastChannel } from './useBroadcastChannel.js';
import { importerConfig } from '../importerConfig.js';

/**
 * Manages the UI state of the dashboard, including the current view,
 * Zarządza stanem interfejsu użytkownika pulpitu, w tym bieżącym widokiem,
 * form visibility, and modal states.
 * widocznością formularzy i stanami modali.
 */
export const useDashboardState = () => {
  const [currentView, setCurrentView] = useState('orders');
  const [showForm, setShowForm] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [activeImporterConfig, setActiveImporterConfig] = useState(null);
  const [modalState, setModalState] = useState({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  const handleViewChange = (view) => {
    setCurrentView(view);
    setShowForm(false);
    setActiveImporterConfig(null);
    setItemToEdit(null);
  };

  const handleEditClick = (item) => {
    setItemToEdit(item);
    setActiveImporterConfig(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setItemToEdit(null);
  };

  const handleShowImporter = (view) => setActiveImporterConfig(importerConfig[view]);
  const handleHideImporter = () => setActiveImporterConfig(null);

  const handleDeleteRequest = (message, confirmCallback) => {
    setModalState({
      isOpen: true,
      message,
      onConfirm: async () => {
        await confirmCallback();
        setModalState({ isOpen: false, message: '', onConfirm: () => {} });
      },
    });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, message: '', onConfirm: () => {} });
  };

  return {
    currentView,
    showForm,
    itemToEdit,
    importerConfig: activeImporterConfig,
    modalState,
    handleViewChange,
    handleEditClick,
    handleCancelForm,
    handleShowImporter,
    handleHideImporter,
    handleDeleteRequest,
    handleCloseModal,
    setShowForm,
    setItemToEdit,
  };
};

/**
 * Fetches all necessary data for the dashboard based on user role.
 * Pobiera wszystkie niezbędne dane dla pulpitu na podstawie roli użytkownika.
 */
export const useDataFetching = () => {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === 'admin';

  const refreshAll = () => {
    console.log('🔄 Refreshing all resources...');
    Object.values(resources).forEach(resource => resource.fetchData && resource.fetchData());
  };

  useBroadcastChannel(refreshAll);

  const resources = {
    orders: useApiResource('/api/orders', isAuthenticated),
    drivers: useApiResource(isAdmin ? '/api/drivers' : null, isAuthenticated),
    trucks: useApiResource(isAdmin ? '/api/trucks' : null, isAuthenticated),
    trailers: useApiResource(isAdmin ? '/api/trailers' : null, isAuthenticated),
    users: useApiResource(isAdmin ? '/api/users' : null, isAuthenticated),
    assignments: useApiResource('/api/assignments', isAuthenticated), // 'assignments' is correct
    customers: useApiResource(isAdmin ? '/api/customers' : null, isAuthenticated),
    zones: useApiResource(isAdmin ? '/api/zones' : null, isAuthenticated),
    runs: useApiResource('/api/runs', isAuthenticated),
  };

  // Destrukturyzacja zasobów w celu uzyskania stabilnych referencji do poszczególnych haków.
  // Destructuring resources to get stable references for individual hooks.
  const { orders, drivers, trucks, trailers, users, assignments, runs, customers, zones } = resources;

  const isLoading = useMemo(() => 
    Object.values(resources).some(r => r.isLoading),
    [resources]
  );

  const anyError = useMemo(() => 
    Object.values(resources).map(r => r.error).find(e => e != null),
    [resources]
  );

  const handleRefresh = (view) => {
    if (resources[view] && resources[view].fetchData) {
      resources[view].fetchData();
    }
  };

  // Użyj useMemo, aby uniknąć ponownego tworzenia obiektu 'data' przy każdym renderowaniu.
  // Use useMemo to avoid re-creating the 'data' object on every render.
  // Tablica zależności teraz poprawnie wymienia poszczególne, stabilne obiekty zasobów.
  // The dependency array now correctly lists the individual, stable resource objects.
  const data = useMemo(() => 
    Object.fromEntries(Object.entries(resources).map(([key, resource]) => [key, resource.data])),
    [resources] // This is correct, as `resources` object reference is stable.
  );

  return { data, isLoading, anyError, handleRefresh, refreshAll };
};