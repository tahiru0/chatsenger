'use client';

import React, { createContext, useContext } from 'react';
import { toast, ToastContainer, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTheme } from './ThemeProvider';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastContextProps {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  
  // Detect if theme is dark
  const isDarkTheme = ['dark', 'dracula', 'night', 'synthwave', 'halloween', 'forest', 'cyberpunk'].includes(theme);

  const addToast = (message: string, type: ToastType) => {
    const toastOptions: ToastOptions = {
      position: "top-center",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      className: `toast-${type} ${isDarkTheme ? 'toast-dark' : 'toast-light'}`
    };

    switch(type) {
      case 'success':
        toast.success(message, toastOptions);
        break;
      case 'error':
        toast.error(message, toastOptions);
        break;
      case 'warning':
        toast.warning(message, toastOptions);
        break;
      case 'info':
      default:
        toast.info(message, toastOptions);
    }
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer 
        position="top-center"
        theme={isDarkTheme ? "dark" : "light"}
      />
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
