import { useState, useCallback, useEffect, useRef } from 'react';

const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!b.hasOwnProperty(key) || a[key] !== b[key]) return false;
  }
  return true;
};

/**
 * Generyczny hook do zarządzania stanem formularzy, walidacją i wysyłaniem danych.
 * @param {object} options - Opcje konfiguracyjne hooka.
 * @param {object} options.initialState - Początkowy stan formularza.
 * @param {Function} options.validate - Funkcja walidująca, która zwraca obiekt błędów.
 * @param {Function} options.onSubmit - Funkcja wywoływana po pomyślnej walidacji.
 * @param {object | null} options.itemToEdit - Obiekt do edycji, wypełniający formularz.
 * @returns {object} - Zwraca stan formularza, błędy, handlery i status ładowania.
 */
export const useForm = ({
  initialState,
  validate,
  onSubmit,
  itemToEdit = null,
}) => {
  // Używamy ref, aby uniknąć problemów z zamykaniem (closure) i zapewnić,
  // że zawsze mamy dostęp do najnowszej wersji initialState bez powodowania re-renderów.
  const initialStateRef = useRef(initialState);
  // Poprawka: Zawsze inicjuj stan z `initialState`, aby uniknąć błędu "uncontrolled to controlled".
  // `useEffect` poniżej zajmie się wypełnieniem danych do edycji.
  const [formData, setFormData] = useState(initialStateRef.current);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Bazowy stan
    const base = initialState ?? initialStateRef.current;

    if (itemToEdit) {
      // Uproszczona i bardziej niezawodna logika scalania.
      // Zawsze bierzemy `initialState` jako bazę i nadpisujemy go danymi z `itemToEdit`.
      const merged = { ...base, ...itemToEdit };

      // Normalizacja `pallets` z obiektu na tablicę, jeśli to konieczne.
      if (merged.cargo_details) {
        const pallets = merged.cargo_details.pallets;
        if (pallets && typeof pallets === 'object' && !Array.isArray(pallets)) {
          merged.cargo_details.pallets = Object.entries(pallets)
            .map(([type, details]) => ({
              type,
              quantity: Number(details?.quantity ?? details?.count ?? 0) || 0,
              spaces: Number(details?.spaces ?? 0) || 0,
              weight: Number(details?.weight ?? 0) || 0,
            }))
            .filter(p => p.quantity > 0);
        } else if (!Array.isArray(pallets)) {
          // Jeśli `pallets` to nie tablica i nie obiekt (np. null, undefined), ustaw pustą tablicę.
          merged.cargo_details.pallets = [];
        }
      }

      // Ustaw tylko, jeśli faktycznie się zmieniło
      setFormData(prev => (shallowEqual(prev, merged) ? prev : merged));
      setErrors({});
    } else {
      // Brak edycji: wróć do base tylko jeśli to zmiana
      setFormData(prev => (shallowEqual(prev, base) ? prev : base));
      setErrors({});
    }
    // Resetujemy błędy przy zmianie trybu edycji/dodawania
  }, [itemToEdit]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setFormData(prev => {
      const next = { ...prev, [name]: val };
      return shallowEqual(prev, next) ? prev : next;
    });
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleNestedChange = useCallback((group, e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = {
        ...prev,
        [group]: {
          ...(prev[group] ?? {}),
          [name]: value,
        },
      };
      return shallowEqual(prev, next) ? prev : next;
    });
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const validationErrors = validate ? validate(formData) : {};
    setErrors(validationErrors);

    // Bardziej niezawodne sprawdzanie błędów, które ignoruje puste obiekty.
    const hasErrors = Object.values(validationErrors).some(error => {
      if (typeof error === 'object' && error !== null) {
        return Object.keys(error).length > 0;
      }
      return Boolean(error);
    });

    if (hasErrors) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      // Błędy specyficzne dla API powinny być obsługiwane w `onSubmit`
      console.error("Form submission error:", err);
    } finally {
      setLoading(false);
    }
  }, [formData, onSubmit, validate]);

  return {
    formData, setFormData, errors, loading, handleChange, handleNestedChange, handleSubmit,
  };
};