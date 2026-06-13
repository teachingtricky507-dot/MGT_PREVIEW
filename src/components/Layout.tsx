import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Menu, 
  Users,
  Search,
  Bell,
  ChevronDown,
  Command,
  Plus,
  Star,
  Clock,
  Bot,
  Inbox,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useNotifications } from '../contexts/NotificationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';
import { CommandMenu } from './CommandMenu';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const { theme, setTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Timesheets', icon: Clock, path: '/timesheets' },
    { name: 'Emergent Chatti', icon: Bot, path: '/chatbot' },
    { name: 'Members', icon: Users, path: '/members' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      <CommandMenu />
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-[#171717] text-white flex flex-col z-50 shrink-0 border-r border-[#262626]"
          >
            {/* Workspace Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                  <Command size={14} className="text-[#171717]" />
                </div>
                <span className="font-bold text-sm tracking-tight text-gray-200">Emergent</span>
              </div>
              <button className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400">
                <Plus size={14} />
              </button>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 mt-2 px-2 space-y-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all group ${
                    location.pathname === item.path
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <item.icon size={16} className={`${location.pathname === item.path ? 'text-white' : 'group-hover:text-white'}`} />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              ))}

              <div className="pt-6 pb-2 px-2.5">
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Favorite Projects</span>
              </div>

              <Link
                  to="/"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-gray-400 hover:bg-white/5 hover:text-white group"
                >
                  <div className="w-4 h-4 bg-blue-500/20 border border-blue-500/30 rounded flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-sm" />
                  </div>
                  <span className="text-sm font-medium">Internal Web</span>
                  <Star size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-orange-400 fill-orange-400" />
                </Link>
            </nav>

            {/* Profile Footer */}
            <div className="p-3 border-t border-white/5">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="flex items-center gap-2.5 w-full p-2 hover:bg-white/5 rounded-md transition-all text-left">
                      <Avatar className="w-6 h-6 border border-white/10">
                        <AvatarImage src={userProfile?.photoURL} />
                        <AvatarFallback className="bg-white/10 text-white text-[10px] font-bold">
                          {userProfile?.displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold truncate text-gray-200">{userProfile?.displayName}</p>
                      </div>
                      <ChevronDown size={12} className="text-gray-500" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56 bg-[#1A1A1A] border-[#262626] text-gray-200 shadow-2xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-bold text-gray-500 uppercase tracking-widest">My Account</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 bg-background/50 backdrop-blur-md border-b flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-400"
            >
              <Menu size={18} />
            </button>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
               <span>Projects</span>
               <span className="text-gray-200">/</span>
               <span className="text-gray-900">{navItems.find((item) => item.path === location.pathname)?.name || 'Project'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0052CC] transition-colors" size={14} />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-4 py-1.5 bg-muted/50 border-none focus:bg-background focus:ring-1 focus:ring-border rounded-md text-xs w-48 outline-none transition-all placeholder:font-medium"
              />
            </div>
            
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground relative">
              <Bell size={18} />
              {unreadCount > 0 && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full ring-2 ring-background flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">{unreadCount}</span>
                </div>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background/50 custom-scrollbar">
          <div className="max-w-6xl mx-auto p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
