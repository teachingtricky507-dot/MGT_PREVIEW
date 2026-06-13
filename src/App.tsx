import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginView } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProjectView } from './pages/ProjectView';
import { Settings } from './pages/Settings';
import { Members } from './pages/Members';
import { Timesheets } from './pages/Timesheets';
import { AiAssistant } from './pages/AiAssistant';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052CC]"></div>
    </div>
  );
  
  if (!currentUser) return <Navigate to="/login" />;
  
  return <Layout>{children}</Layout>;
};

import { ThemeProvider } from 'next-themes';
import { NotificationProvider } from './contexts/NotificationContext';

const ThemeProviderAny = ThemeProvider as any;

export default function App() {
  return (
    <ThemeProviderAny attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider>
            <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <PrivateRoute>
                  <ProjectView />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
            <Route
              path="/members"
              element={
                <PrivateRoute>
                  <Members />
                </PrivateRoute>
              }
            />
            <Route
              path="/timesheets"
              element={
                <PrivateRoute>
                  <Timesheets />
                </PrivateRoute>
              }
            />
            <Route
              path="/chatbot"
              element={
                <PrivateRoute>
                  <AiAssistant />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Toaster position="bottom-right" />
        </BrowserRouter>
      </TooltipProvider>
    </NotificationProvider>
  </AuthProvider>
</ThemeProviderAny>
);
}
