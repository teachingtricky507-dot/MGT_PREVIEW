import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';

interface AuthContextType {
  currentUser: { uid: string; displayName: string } | null;
  userProfile: User | null;
  loading: boolean;
  login: (name: string, pass: string) => Promise<void>;
  logout: () => void;
  updateProfile: (name: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  updateProfile: async () => {},
  register: async () => {},
  resendVerification: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<{ uid: string; displayName: string } | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncAllProfiles = async () => {
    try {
      const res = await fetch('/api/auth/profiles/all');
      if (res.ok) {
        const list = await res.json();
        const profilesMap: Record<string, User> = {};
        list.forEach((p: User) => {
          profilesMap[p.uid] = p;
        });
        localStorage.setItem('local_profiles', JSON.stringify(profilesMap));
      }
    } catch (err) {
      console.error("Failed to sync SQLite profiles with localStorage:", err);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      // Sync profiles mapping
      await syncAllProfiles();

      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);

          // Fetch latest profile from backend SQLite
          const res = await fetch('/api/auth/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: [user.uid] })
          });

          if (res.ok) {
            const profiles = await res.json();
            if (profiles && profiles.length > 0) {
              setUserProfile(profiles[0]);
            } else {
              localStorage.removeItem('auth_user');
              setCurrentUser(null);
            }
          }
        } catch (err) {
          console.error("Failed to restore auth session:", err);
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const login = async (identifier: string, pass: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass })
      });

      if (!res.ok) {
        const body = await res.json();
        if (res.status === 403 && body.error === 'EMAIL_UNVERIFIED') {
          throw new Error('EMAIL_UNVERIFIED');
        }
        throw new Error(body.error || 'Login failed');
      }

      const profile = await res.json();
      const user = { uid: profile.uid, displayName: profile.displayName };
      
      localStorage.setItem('auth_user', JSON.stringify(user));
      setCurrentUser(user);
      setUserProfile(profile);

      // Sync latest profiles list
      await syncAllProfiles();
    } catch (err: any) {
      setLoading(false);
      throw err;
    }
    setLoading(false);
  };

  const register = async (email: string, pass: string, name: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, displayName: name })
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Registration failed');
      }

      // Sync profiles list
      await syncAllProfiles();
    } catch (err) {
      setLoading(false);
      throw err;
    }
    setLoading(false);
  };

  const resendVerification = async (email: string) => {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || 'Failed to resend verification');
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_user');
    setCurrentUser(null);
    setUserProfile(null);
  };

  const updateProfile = async (newName: string, newPhotoURL?: string) => {
    if (!currentUser) return;
    
    try {
      const finalPhotoURL = newPhotoURL || currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`;
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, displayName: newName, photoURL: finalPhotoURL })
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update profile');
      }

      const profile = await res.json();
      const updatedUser = { ...currentUser, displayName: newName, photoURL: finalPhotoURL };
      
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setUserProfile(updatedUser);
      setUserProfile(profile);

      // Sync latest profiles list
      await syncAllProfiles();
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, login, logout, updateProfile, register, resendVerification }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
