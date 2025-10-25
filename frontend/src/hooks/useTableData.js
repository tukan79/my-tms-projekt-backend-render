// frontend/src/hooks/useTableData.js
import { useState, useMemo, useCallback } from 'react';

// Funkcja pomocnicza do pobierania wartości z zagnieżdżonych obiektów
const getNestedValue = (obj, path) => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const useTableData = (initialData = [], { initialSortKey, filterKeys = [] }) => {
  const [sortConfig, setSortConfig] = useState({ key: initialSortKey, direction: 'ascending' });
  const [filterText, setFilterText] = useState('');

  const sortedData = useMemo(() => {
    if (!initialData) return [];
    
    let sortableData = [...initialData];
    if (sortConfig.key !== null) {
      sortableData.sort((a, b) => {
        const valA = getNestedValue(a, sortConfig.key);
        const valB = getNestedValue(b, sortConfig.key);
        
        // Ulepszenie: sortowanie stringów bez uwzględniania wielkości liter
        const strA = typeof valA === 'string' ? valA.toLowerCase() : valA;
        const strB = typeof valB === 'string' ? valB.toLowerCase() : valB;

        if (strA < strB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (strA > strB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [initialData, sortConfig]); // Zależność od initialData i sortConfig

  const handleSort = useCallback((key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const sortedAndFilteredData = useMemo(() => {
    if (!filterText) return sortedData;
    return sortedData.filter(item =>
      filterKeys.some(key => {
        const value = getNestedValue(item, key);
        return value && String(value).toLowerCase().includes(filterText.toLowerCase());
      })
    );
  }, [sortedData, filterText, filterKeys]);

  return { sortedAndFilteredData, sortConfig, filterText, setFilterText, handleSort };
};
