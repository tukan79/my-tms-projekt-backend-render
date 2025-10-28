import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApiResource } from './useApiResource';
import { useBroadcastChannel } from './useBroadcastChannel.js';
import { importerConfig } from '../config/importerConfig.js';

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
export const useDataFetching = (enabled = true) => {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isDispatcher = user?.role === 'dispatcher';

  const refreshAll = () => {
    console.log('🔄 Refreshing all resources...');
    if (enabled) Object.values(resources).forEach(resource => resource.fetchData && resource.fetchData());
  };

  useBroadcastChannel(refreshAll);

  const resources = {
    orders: useApiResource(enabled ? '/api/orders' : null, isAuthenticated),
    drivers: useApiResource(enabled && isAdmin ? '/api/drivers' : null, isAuthenticated),
    trucks: useApiResource(enabled && isAdmin ? '/api/trucks' : null, isAuthenticated),
    trailers: useApiResource(enabled && isAdmin ? '/api/trailers' : null, isAuthenticated),
    users: useApiResource(enabled && isAdmin ? '/api/users' : null, isAuthenticated),
    assignments: useApiResource(enabled ? '/api/assignments' : null, isAuthenticated),
    customers: useApiResource(enabled && (isAdmin || isDispatcher) ? '/api/customers' : null, isAuthenticated),
    zones: useApiResource(enabled && (isAdmin || isDispatcher) ? '/api/zones' : null, isAuthenticated),
    surcharges: useApiResource(enabled && isAdmin ? '/api/surcharge-types' : null, isAuthenticated),
    invoices: useApiResource(enabled && isAdmin ? '/api/invoices' : null, isAuthenticated),
    // Przywracamy endpoint dla akcji CRUD, ale wyłączamy początkowe pobieranie danych.
    // Dane będą pobierane dynamicznie w PlanItContext.
    runs: useApiResource(enabled ? '/api/runs' : null, isAuthenticated, { initialFetch: false }),
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
  // Zależności to teraz bezpośrednio dane z każdego zasobu, co zapewnia stabilność.
  const data = useMemo(() => 
    Object.fromEntries(Object.entries(resources).map(([key, resource]) => [key, resource.data])),
    [...Object.values(resources).map(r => r.data)]
  );

  // Tworzymy obiekt z akcjami (CRUD) dla każdego zasobu, aby można było je łatwo przekazać do komponentów.
  // We create an object with actions (CRUD) for each resource so they can be easily passed to components.
  const actions = useMemo(() =>
    Object.fromEntries(
      Object.entries(resources).map(([key, resource]) => [key, { 
        create: resource.createResource, 
        update: resource.updateResource, 
        delete: resource.deleteResource,
        bulkCreate: resource.bulkCreate, // Expose the new bulkCreate action
      }])
    ),
    [resources] // Zależność od `resources` jest wystarczająca, ponieważ referencja do obiektu jest stabilna.
  );
  return { data, isLoading, anyError, handleRefresh, refreshAll, actions };
};