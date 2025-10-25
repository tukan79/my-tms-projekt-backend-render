import React, { createContext, useContext, useState, useEffect } from 'react';

const PopOutContext = createContext(null);

export const usePopOut = () => useContext(PopOutContext);

export const PopOutProvider = ({ children }) => {
  const [popOutData, setPopOutData] = useState({
    orders: [],
    runs: [],
    assignments: [],
    drivers: [],
    trucks: [],
    trailers: [],
    zones: [],
  });

  useEffect(() => {
    const storedData = sessionStorage.getItem('popOutData');
    if (storedData) {
      setPopOutData(JSON.parse(storedData));
    }
  }, []);

  return (
    <PopOutContext.Provider value={popOutData}>{children}</PopOutContext.Provider>
  );
};