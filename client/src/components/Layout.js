import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import OfflineIndicator from './OfflineIndicator';
import EmergencyFloatingButton from './EmergencyFloatingButton';

const Layout = ({ children }) => {
  const location = useLocation();
  
  // Don't show header/footer on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <OfflineIndicator />
        {children}
        <EmergencyFloatingButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OfflineIndicator />
      <Header />
      <main className="flex-1 p-4">
        {children}
      </main>
      <Footer />
      <EmergencyFloatingButton />
    </div>
  );
};

export default Layout;