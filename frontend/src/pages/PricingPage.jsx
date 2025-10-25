import React, { useState } from 'react';
import ZoneManager from '../components/ZoneManager.jsx';
import RateCardEditor from '../components/RateCardEditor.jsx';

const PricingPage = ({ customers = [], zones = [], onRefresh }) => {
  const [activeTab, setActiveTab] = useState('zones');

  return (
    <div className="card">
      <h2>Pricing Management</h2>
      <div className="tabs-container" style={{ marginBottom: '2rem' }}>
        <button 
          className={`tab-button ${activeTab === 'zones' ? 'active' : ''}`}
          onClick={() => setActiveTab('zones')}
        >
          Postcode Zones
        </button>
        <button 
          className={`tab-button ${activeTab === 'rates' ? 'active' : ''}`}
          onClick={() => setActiveTab('rates')}
        >
          Rate Cards
        </button>
      </div>

      {activeTab === 'zones' && <ZoneManager zones={zones} onRefresh={onRefresh} />}
      {activeTab === 'rates' && <RateCardEditor customers={customers} zones={zones} />}

    </div>
  );
};

export default PricingPage;