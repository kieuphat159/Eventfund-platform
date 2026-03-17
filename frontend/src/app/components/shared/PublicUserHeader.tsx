import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Wallet, Menu, X, User, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export const PublicUserHeader: React.FC = () => {
  const { user, connectWallet, disconnectWallet } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isPublic = user?.role === 'public';

  // Navigation links - same for all users (Dashboard is in sidebar only)
  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Explore Events', path: '/explore' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'About', path: '/about' },
  ];

  const isActiveLink = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              EventChain
            </span>
          </Link>

          {/* Desktop Navigation - Always visible */}
          <nav className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative pb-1 transition-colors ${
                    isActive 
                      ? 'text-white' 
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {link.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Wallet Connection / User Menu */}
          <div className="flex items-center space-x-4">
            {isPublic ? (
              <Button
                onClick={connectWallet}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-slate-900 border-slate-700 hover:bg-slate-800"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm text-slate-300">
                        {user?.walletAddress?.slice(0, 6)}...{user?.walletAddress?.slice(-4)}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-700">
                  <div className="px-2 py-1.5 text-sm text-slate-400">
                    <div className="font-medium text-white">{user?.name}</div>
                    <div className="text-xs mt-1">
                      {user?.walletAddress?.slice(0, 14)}...{user?.walletAddress?.slice(-4)}
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem
                    onClick={() => navigate('/account/profile')}
                    className="cursor-pointer hover:bg-slate-800"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={disconnectWallet}
                    className="cursor-pointer hover:bg-slate-800 text-red-400"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu Button - Always visible */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Always available */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800">
          <nav className="px-4 py-4 space-y-2">
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 transition-colors ${
                    isActive
                      ? 'text-white bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-l-2 border-purple-500 pl-3'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};