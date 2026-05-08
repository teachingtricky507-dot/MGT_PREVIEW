import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export const LoginView: React.FC = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your Name or ID');
      return;
    }
    setLoading(true);
    try {
      await login(name, password);
      toast.success('Logged in successfully!');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFC] p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#171717] text-white rounded-[2rem] mb-6 shadow-2xl ring-8 ring-white">
            <span className="text-4xl font-bold italic tracking-tighter">E</span>
          </div>
          <h1 className="text-4xl font-black text-[#171717] tracking-tighter">Emergent.</h1>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-[0.3em] text-[9px] opacity-60">Simple Project Intelligence</p>
        </div>

        <Card className="border border-gray-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="space-y-3 p-10 pb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-[3px] w-10 bg-black rounded-full" />
              <span className="text-[10px] font-black text-black uppercase tracking-widest">
                Quick Access
              </span>
            </div>
            <CardTitle className="text-4xl font-black tracking-tight text-[#171717]">
              Sign in.
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 pt-0">
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Name or ID</Label>
                <Input 
                  id="name" 
                  type="text" 
                  placeholder="Enter your name" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-50/50 border-gray-100 h-12 rounded-2xl focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••"
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-50/50 border-gray-100 h-12 rounded-2xl focus:ring-2 focus:ring-black/5"
                />
              </div>
              <Button type="submit" className="w-full bg-[#171717] hover:bg-black h-14 text-base font-black rounded-2xl shadow-2xl shadow-gray-200 mt-2" disabled={loading}>
                {loading ? 'Entering...' : 'Log In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
