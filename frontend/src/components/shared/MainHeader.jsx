//MainHeader.jsx
import React from 'react';
import { Plus, Upload, Download } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { importerConfig } from '../../importerConfig.js';

const MainHeader = ({ viewConfig }) => {
  const { user } = useAuth(); // Pobieramy użytkownika bezpośrednio z AuthContext
  const {
    currentView,
    showForm,
    importerConfig: activeImporterConfig, // Poprawiona destrukturyzacja
    handleShowImporter,
    handleCancelForm,
    setShowForm,
    setItemToEdit,
    handleHideImporter, // Przywracamy tę funkcję, jest potrzebna dla przycisku "Add"
    handleGenericExport,
    isLoading,
  } = useDashboard();

  // Zabezpieczenie przed renderowaniem, gdy kluczowe dane nie są jeszcze dostępne
  if (!viewConfig || !currentView) {
    return <header className="main-header"><div /><div className="main-header-actions" /></header>;
  }

  const viewNames = {
    orders: 'order',
    drivers: 'driver',
    trucks: 'truck',
    trailers: 'trailer',
    runs: 'run',
    users: 'user',
    customers: 'customer',
    zones: 'zone',
    planit: 'PlanIt',
    finance: 'Finance',
    pricing: 'Pricing',
  };

  const getViewName = () => viewNames[currentView] || '';
  const exportableViews = ['drivers', 'trucks', 'trailers', 'customers', 'users'];
  
  // Używamy czytelnych flag do zarządzania logiką warunkową
  const canImport = importerConfig[currentView] && user?.role === 'admin';
  const canExport = exportableViews.includes(currentView) && user?.role === 'admin';
  const canAdd = viewConfig[currentView]?.FormComponent;

  return (
    <header className="main-header">
      <div />
      <div className="main-header-actions">
        {canImport && (
          <button
            onClick={() => handleShowImporter(currentView)}
            className="btn-secondary"
            // Przycisk jest wyłączony, jeśli formularz jest otwarty lub importer jest już aktywny
            disabled={isLoading || showForm || activeImporterConfig}
          >
            <Upload size={16} /> Import from CSV
          </button>
        )}
        {canExport && (
          <button onClick={() => handleGenericExport(currentView)} className="btn-secondary" disabled={isLoading}>
            <Download size={16} /> Export
          </button>
        )}
        {canAdd && (
          <button
            onClick={() => {
              if (showForm) {
                handleCancelForm();
              } else {
                setItemToEdit(null);
                setShowForm(true);
                handleHideImporter();
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
  );
};

export default MainHeader;