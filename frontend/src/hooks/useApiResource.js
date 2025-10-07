import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

export const useApiResource = (resourceUrl, resourceName = 'resource') => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!resourceUrl) return; // Nie wykonuj zapytania, jeśli URL jest nullem
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(resourceUrl);
      setData(response.data);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || `Failed to fetch ${resourceName}.`;
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [resourceUrl, resourceName]);

  // Automatyczne pobieranie danych przy pierwszym renderowaniu
  useEffect(() => {
    if (resourceUrl) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceUrl]); // Uruchom tylko, gdy zmieni się resourceUrl

  const createResource = useCallback(async (resourceData, optimisticUpdate) => {
    let tempId = null;
    if (optimisticUpdate) {
      tempId = `temp-${Date.now()}`;
      const optimisticData = optimisticUpdate(resourceData, tempId);
      setData(prevData => [...prevData, optimisticData]);
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post(resourceUrl, resourceData);
      // Replace optimistic data with actual data from server
      setData(prevData => 
        prevData.map(item => (item.id === tempId ? response.data : item))
      );
      return response.data;
    } catch (err) {
      // Revert optimistic update on error
      if (optimisticUpdate) {
        setData(prevData => prevData.filter(item => item.id !== tempId));
      }
      const errorMessage = err.response?.data?.error || `Failed to create ${resourceName}.`;
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [resourceUrl, resourceName]);

  const deleteResource = useCallback(async (resourceId) => {
    // Przechowujemy usunięty element i jego pozycję, aby móc go przywrócić w razie błędu
    let deletedItem = null;
    let originalIndex = -1;

    setData(currentData => {
      originalIndex = currentData.findIndex(item => item.id === resourceId);
      if (originalIndex === -1) return currentData; // Elementu nie znaleziono
      deletedItem = currentData[originalIndex];
      return currentData.filter(item => item.id !== resourceId);
    });

    if (originalIndex === -1) return; // Nie wykonuj żądania, jeśli element nie istniał w stanie

    setIsLoading(true);
    setError(null);
    try {
      await api.delete(`${resourceUrl}/${resourceId}`);
    } catch (err) {
      // Przywróć stan w przypadku błędu
      setData(currentData => {
        const newData = [...currentData];
        newData.splice(originalIndex, 0, deletedItem);
        return newData;
      });
      const errorMessage = err.response?.data?.error || `Failed to delete ${resourceName}.`;
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [resourceUrl, resourceName, setData]);

  const updateResource = useCallback(async (resourceId, resourceData) => {
    // Przechowujemy oryginalny stan na wypadek błędu
    let originalData = null;
    setData(currentData => {
      originalData = [...currentData];
      return currentData.map(item =>
        item.id === resourceId ? { ...item, ...resourceData } : item
      );
    });

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.put(`${resourceUrl}/${resourceId}`, resourceData);
      // Zastąp danymi z serwera, aby zapewnić spójność
      setData(prevData =>
        prevData.map(item => (item.id === resourceId ? response.data : item))
      );
      return response.data;
    } catch (err) {
      // Wycofaj zmiany w przypadku błędu
      if (originalData) {
        setData(originalData);
      }
      const errorMessage = err.response?.data?.error || `Failed to update ${resourceName}.`;
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [resourceUrl, resourceName, setData]);

  return { data, isLoading, error, fetchData, createResource, updateResource, deleteResource, setData };
};