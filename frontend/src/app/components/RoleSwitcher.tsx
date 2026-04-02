import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { UserRole } from '../types/roles';

export const RoleSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, switchRole, connectWallet, disconnectWallet } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleSwitch = (role: UserRole) => {
    if (role === 'public') {
      disconnectWallet();
      navigate('/');
    } else {
      if (user?.role === 'public') {
        connectWallet();
      }
      switchRole(role);
      
      // Navigate to appropriate dashboard
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'verifier') {
        navigate('/verifier/dashboard');
      } else if (role === 'user') {
        navigate('/dashboard');
      }
    }
    setIsOpen(false);
  };

  const roles: { role: UserRole; label: string; color: string }[] = [
    { role: 'public', label: 'Public', color: 'bg-slate-600' },
    { role: 'user', label: 'User', color: 'bg-blue-600' },
    { role: 'verifier', label: 'Verifier', color: 'bg-purple-600' },
    { role: 'admin', label: 'Admin', color: 'bg-red-600' },
  ];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        aria-label="Role Switcher"
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <Settings className="w-6 h-6 text-white" />}
      </button>

      {/* Role Switcher Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80">
          <Card className="bg-slate-900 border-slate-700 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white text-sm">Role Switcher (Demo)</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Current: <span className="font-semibold text-white">{user?.role?.toUpperCase()}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {roles.map((roleInfo) => (
                  <Button
                    key={roleInfo.role}
                    onClick={() => handleRoleSwitch(roleInfo.role)}
                    disabled={user?.role === roleInfo.role}
                    className={`w-full justify-start ${
                      user?.role === roleInfo.role
                        ? 'bg-slate-700 cursor-not-allowed'
                        : `${roleInfo.color} hover:opacity-90`
                    } text-white`}
                    size="sm"
                  >
                    {roleInfo.label}
                    {user?.role === roleInfo.role && (
                      <span className="ml-auto text-xs">(Active)</span>
                    )}
                  </Button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate('/demo');
                    setIsOpen(false);
                  }}
                  className="w-full text-xs border-slate-600 hover:bg-slate-800 text-slate-300"
                  size="sm"
                >
                  View Layout Documentation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};
