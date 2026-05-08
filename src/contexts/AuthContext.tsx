import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';

interface AuthContextType {
  currentUser: { uid: string; displayName: string } | null;
  userProfile: User | null;
  loading: boolean;
  login: (name: string, pass: string) => Promise<void>;
  logout: () => void;
  updateProfile: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  updateProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<{ uid: string; displayName: string } | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing session
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      
      // Load or create local profile
      const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
      if (profiles[user.uid]) {
        setUserProfile(profiles[user.uid]);
      } else {
        const newProfile: User = {
          uid: user.uid,
          email: `${user.uid}@example.com`,
          displayName: user.displayName,
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          createdAt: new Date().toISOString(),
        };
        profiles[user.uid] = newProfile;
        localStorage.setItem('local_profiles', JSON.stringify(profiles));
        setUserProfile(newProfile);
      }
    }
    setLoading(false);
  }, []);

  const login = async (name: string, _pass: string) => {
    setLoading(true);
    const uid = name.toLowerCase().replace(/\s+/g, '_');
    const user = { uid, displayName: name };
    
    localStorage.setItem('auth_user', JSON.stringify(user));
    setCurrentUser(user);

    const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
    if (!profiles[uid]) {
      const newProfile: User = {
        uid,
        email: `${uid}@example.com`,
        displayName: name,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        createdAt: new Date().toISOString(),
      };
      profiles[uid] = newProfile;
      localStorage.setItem('local_profiles', JSON.stringify(profiles));
      setUserProfile(newProfile);
    } else {
      setUserProfile(profiles[uid]);
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('auth_user');
    setCurrentUser(null);
    setUserProfile(null);
  };

  const updateProfile = async (newName: string) => {
    if (!currentUser) return;
    
    const updatedUser = { ...currentUser, displayName: newName };
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);

    const profiles = JSON.parse(localStorage.getItem('local_profiles') || '{}');
    if (profiles[currentUser.uid]) {
      const updatedProfile = { ...profiles[currentUser.uid], displayName: newName };
      profiles[currentUser.uid] = updatedProfile;
      localStorage.setItem('local_profiles', JSON.stringify(profiles));
      setUserProfile(updatedProfile);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, login, logout, updateProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
