import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionBannerProps {
  isOnline: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-stone-950 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-30 shadow-md animate-fade-in">
      <WifiOff className="w-4 h-4" />
      <span>You're currently offline. Trying to reconnect...</span>
      <RefreshCw className="w-3.5 h-3.5 animate-spin ml-1" />
    </div>
  );
};
