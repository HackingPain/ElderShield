import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            {/* Logo - Footer */}
            <div className="flex items-center mb-4 sm:mb-0">
              <img 
                src="/images/logos/eldershield-text-logo.svg"
                alt="ElderShield - Senior Care Platform"
                className="h-6 w-auto"
                onError={(e) => {
                  // Fallback to text if logo fails to load
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span className="hidden text-lg font-bold text-gray-600">ElderShield</span>
            </div>

            {/* Copyright and Links */}
            <div className="flex flex-col sm:flex-row items-center text-sm text-gray-500 space-y-2 sm:space-y-0 sm:space-x-6">
              <p>&copy; 2024 ElderShield. All rights reserved.</p>
              <div className="flex space-x-4">
                <a href="#" className="hover:text-gray-700 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-gray-700 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-gray-700 transition-colors">Support</a>
              </div>
            </div>
          </div>

          {/* Additional Footer Content */}
          <div className="mt-4 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
            <p>Secure • HIPAA Compliant • Senior-Friendly</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;