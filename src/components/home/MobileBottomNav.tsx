import React from 'react';
import { Home, HeartPulse, Activity, UserPlus, UserCheck } from 'lucide-react';
import type { User, Requester } from '../../types';

interface MobileBottomNavProps {
  activeView: string;
  onNavigate: (view: any) => void;
  loggedInUser?: User | null;
  loggedInRequester?: Requester | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onNavigate,
  loggedInUser,
  loggedInRequester
}) => {
  const getDashboardView = () => {
    if (loggedInUser) return 'donor-dashboard';
    if (loggedInRequester) return 'requester-portal';
    return 'auth-signin';
  };

  const navItems = [
    {
      id: 'home',
      label: 'Explore',
      icon: Home,
      view: 'home',
      activeColor: 'text-blood-600',
    },
    {
      id: 'request',
      label: 'SOS Request',
      icon: HeartPulse,
      view: 'request',
      isSOS: true,
      activeColor: 'text-blood-600',
    },
    {
      id: 'tracking',
      label: 'Track Code',
      icon: Activity,
      view: 'tracking',
      activeColor: 'text-blood-600',
    },
    {
      id: 'signup',
      label: 'Sign Up',
      icon: UserPlus,
      view: 'auth-signup',
      activeColor: 'text-blood-600',
    },
    {
      id: 'dashboard',
      label: loggedInUser || loggedInRequester ? 'My Portal' : 'Sign In',
      icon: UserCheck,
      view: getDashboardView(),
      activeColor: 'text-blood-600',
    },
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-2xl border-t border-ink-200/80 shadow-[0_-6px_24px_rgba(0,0,0,0.12)] px-2 py-1.5 pb-safe"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          if (item.isSOS) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.view)}
                className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blood-500 to-blood-600 text-white flex items-center justify-center shadow-[0_6px_16px_rgba(244,63,87,0.45)] group-active:scale-95 transition-transform border-2 border-white">
                  <Icon className="w-6 h-6 animate-pulse" />
                </div>
                <span className="text-[10px] font-bold text-blood-600 mt-1 tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
                isActive ? 'text-blood-600 font-bold' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 text-blood-600' : ''
                }`}
              />
              <span className={`text-[10px] tracking-tight mt-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
