import { useState, useEffect } from 'react';
import { googleSheetsService } from '../services/googleSheets.service.js';

/**
 * Custom hook for managing Google Sheets integration
 */
export function useGoogleSheets(shouldFetch = false) {
  const [status, setStatus] = useState(null);
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await googleSheetsService.fetchStatus();
      setStatus(data);
      if (data && data.connected) {
        // Fetch spreadsheets when connected
        try {
          const spreadsheetsData =
            await googleSheetsService.fetchSpreadsheets();
          setSpreadsheets(spreadsheetsData || []);
        } catch (spreadsheetErr) {
          console.error(
            'Error fetching spreadsheets after status check:',
            spreadsheetErr
          );
          setSpreadsheets([]);
        }
      } else {
        setSpreadsheets([]);
      }
    } catch (err) {
      setError(err.message);
      setStatus({ connected: false });
      setSpreadsheets([]);
      console.error('Error fetching Google Sheets status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpreadsheets = async () => {
    try {
      const data = await googleSheetsService.fetchSpreadsheets();
      setSpreadsheets(data);
    } catch (err) {
      setError(err.message);
      setSpreadsheets([]);
      console.error('Error fetching spreadsheets:', err);
    }
  };

  const fetchSheets = async spreadsheetId => {
    if (!spreadsheetId) {
      setSheets([]);
      return;
    }
    try {
      const data = await googleSheetsService.fetchSheets(spreadsheetId);
      setSheets(data);
    } catch (err) {
      setError(err.message);
      setSheets([]);
      console.error('Error fetching sheets:', err);
    }
  };

  const fetchColumns = async (spreadsheetId, sheetName) => {
    if (!spreadsheetId || !sheetName) {
      setColumns([]);
      return;
    }
    try {
      const data = await googleSheetsService.fetchColumns(
        spreadsheetId,
        sheetName
      );
      setColumns(data);
    } catch (err) {
      setError(err.message);
      setColumns([]);
      console.error('Error fetching columns:', err);
    }
  };

  const authenticate = async () => {
    try {
      await googleSheetsService.authenticate();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const disconnect = async () => {
    try {
      await googleSheetsService.disconnect();
      setStatus({ connected: false });
      setSpreadsheets([]);
      setSheets([]);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    if (shouldFetch) {
      fetchStatus();
    }
  }, [shouldFetch]);

  return {
    status,
    spreadsheets,
    sheets,
    columns,
    loading,
    error,
    fetchStatus,
    fetchSpreadsheets,
    fetchSheets,
    fetchColumns,
    authenticate,
    disconnect,
  };
}
