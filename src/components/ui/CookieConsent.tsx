'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../providers/ThemeProvider';

export default function CookieConsent() {
  const { cookieConsent, setCookieConsent } = useTheme();
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Show banner only if consent hasn't been given
    // Small delay to prevent flash during hydration
    const timer = setTimeout(() => {
      if (!cookieConsent) {
        setShowBanner(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cookieConsent]);

  const handleAccept = () => {
    setCookieConsent(true);
    setShowBanner(false);
  };

  const handleDecline = () => {
    setCookieConsent(false);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-gray-900 dark:bg-gray-800 border-t border-gray-700 shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-white text-sm">
              We use cookies to remember your preferences (like dark mode). No tracking or analytics cookies are used.
              {showDetails && (
                <span className="block mt-2 text-gray-300 text-xs">
                  <strong>Preference cookies:</strong> ecod_theme (stores your dark/light mode preference),
                  ecod_cookie_consent (remembers if you accepted cookies). These cookies are stored locally
                  on your browser and are not sent to any third parties.
                </span>
              )}
            </p>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1"
            >
              {showDetails ? 'Hide details' : 'Learn more'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
