import { useState } from 'react';
import { Preferences } from '@capacitor/preferences';

export const useNativeStorage = () => {
  const [loading, setLoading] = useState(false);

  const setItem = async (key: string, value: any) => {
    setLoading(true);
    try {
      await Preferences.set({
        key,
        value: JSON.stringify(value)
      });
      return true;
    } catch (error) {
      console.error('Error setting item:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getItem = async (key: string) => {
    setLoading(true);
    try {
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting item:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (key: string) => {
    setLoading(true);
    try {
      await Preferences.remove({ key });
      return true;
    } catch (error) {
      console.error('Error removing item:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    setLoading(true);
    try {
      await Preferences.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const keys = async () => {
    try {
      const { keys } = await Preferences.keys();
      return keys;
    } catch (error) {
      console.error('Error getting keys:', error);
      return [];
    }
  };

  return {
    setItem,
    getItem,
    removeItem,
    clear,
    keys,
    loading
  };
};
