import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Mail, User, Lock, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  const { login, register, resendVerification, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) {
      setLoginError('Please enter your Name, ID or Email');
      return;
    }
    setLoginError(null);
    setUnverifiedEmail(null);
    setLoading(true);
    try {
      await login(loginIdentifier, password);
      toast.success('Logged in successfully!');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.message === 'EMAIL_UNVERIFIED') {
        setUnverifiedEmail(loginIdentifier.trim());
        setLoginError('Email verification required.');
      } else {
        setLoginError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!displayName.trim()) {
      toast.error('Please enter your display name');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    try {
      await register(email, password, displayName);
      setRegSuccess(true);
      toast.success('Registration successful! Verification email sent.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (targetEmail: string) => {
    setResending(true);
    try {
      await resendVerification(targetEmail);
      toast.success(`Verification email resent to ${targetEmail}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const resetToggleState = () => {
    setIsRegistering(!isRegistering);
    setUnverifiedEmail(null);
    setRegSuccess(false);
    setPassword('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFC] p-4 sm:p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Brand Header */}
        <div className="mb-8 sm:mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#171717] text-white rounded-[2rem] mb-5 shadow-2xl ring-8 ring-white">
            <span className="text-4xl font-bold italic tracking-tighter">E</span>
          </div>
          <h1 className="text-4xl font-black text-[#171717] tracking-tighter">MGT.</h1>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-[0.3em] text-[9px] opacity-60">Simple Project Intelligence</p>
        </div>

        {/* Card Panel */}
        <Card className="border border-gray-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] bg-white rounded-[2.5rem] overflow-hidden">
          <AnimatePresence mode="wait">
            {regSuccess ? (
              <motion.div
                key="reg-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="p-8 sm:p-10 text-center space-y-6"
              >
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center border border-green-100 shadow-sm animate-bounce">
                    <CheckCircle2 size={32} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-[#171717] tracking-tight">Verify your email.</h2>
                  <p className="text-sm text-gray-400 font-medium">Please check your email address.</p>
                </div>

                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-sm text-gray-600 text-left space-y-3">
                  <p className="leading-relaxed">
                    We've sent an activation link to <strong className="text-black">{email}</strong>.
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Click the link inside the email to verify and activate your account.
                  </p>
                </div>

                <div className="pt-2 space-y-3">
                  <Button 
                    onClick={() => {
                      setRegSuccess(false);
                      setIsRegistering(false);
                      setLoginIdentifier(email);
                    }}
                    className="w-full bg-[#0052CC] hover:bg-[#0047B3] text-white h-14 text-base font-black rounded-2xl shadow-lg shadow-[#0052CC]/25 transition-all"
                  >
                    Back to Login
                  </Button>
                  
                  <button
                    onClick={() => handleResend(email)}
                    disabled={resending}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-black transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                    Resend verification email
                  </button>
                </div>
              </motion.div>
            ) : isRegistering ? (
              <motion.div
                key="register-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="space-y-3 p-8 sm:p-10 pb-6">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-[3px] w-10 bg-black rounded-full" />
                    <span className="text-[10px] font-black text-black uppercase tracking-widest">
                      Create Account
                    </span>
                  </div>
                  <CardTitle className="text-4xl font-black tracking-tight text-[#171717]">
                    Join us.
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 sm:p-10 pt-0 space-y-6">
                  <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Display Name</Label>
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <Input 
                          id="reg-name" 
                          type="text" 
                          placeholder="Your name" 
                          required 
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="bg-gray-50/50 border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-white h-12 pl-12 rounded-2xl focus:ring-2 focus:ring-[#0052CC]/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <Input 
                          id="reg-email" 
                          type="email" 
                          placeholder="name@domain.com" 
                          required 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-gray-50/50 border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-white h-12 pl-12 rounded-2xl focus:ring-2 focus:ring-[#0052CC]/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-password" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <Input 
                          id="reg-password" 
                          type="password" 
                          placeholder="At least 6 characters"
                          required 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-gray-50/50 border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-white h-12 pl-12 rounded-2xl focus:ring-2 focus:ring-[#0052CC]/50 transition-all"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-[#0052CC] hover:bg-[#0047B3] text-white h-14 text-base font-black rounded-2xl shadow-lg shadow-[#0052CC]/25 transition-all mt-2 flex items-center justify-center gap-2" disabled={loading}>
                      {loading ? 'Creating...' : 'Register'}
                      <ArrowRight size={18} />
                    </Button>
                  </form>

                  <div className="border-t border-gray-100 pt-5 text-center">
                    <button 
                      onClick={resetToggleState}
                      className="text-xs font-bold text-gray-400 hover:text-black transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                      Already have an account? Sign in
                    </button>
                  </div>
                </CardContent>
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="space-y-3 p-8 sm:p-10 pb-6">
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
                <CardContent className="p-8 sm:p-10 pt-0 space-y-6">
                  {/* Unverified Email Warning Panel */}
                  {unverifiedEmail && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl p-4 text-xs space-y-3 text-left"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="font-bold text-amber-950">Email verification required</p>
                          <p className="text-[11px] text-amber-800/80 mt-0.5 leading-relaxed">
                            You must verify your email <strong className="font-semibold">{unverifiedEmail}</strong> before logging in.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-1 border-t border-amber-200/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResend(unverifiedEmail)}
                          disabled={resending}
                          className="h-8 text-xs font-black text-amber-900 hover:text-black hover:bg-amber-100/50 bg-amber-100/30 px-3 rounded-lg flex items-center gap-1.5"
                        >
                          <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                          Resend Verification Link
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {loginError && !unverifiedEmail && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-50 border border-red-100 text-red-900 rounded-2xl p-4 text-xs flex items-center gap-2.5"
                    >
                      <AlertCircle className="text-red-600 flex-shrink-0" size={16} />
                      <p className="font-semibold">{loginError}</p>
                    </motion.div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Name, ID or Email</Label>
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <Input 
                          id="name" 
                          type="text" 
                          placeholder="Username or email address" 
                          required 
                          value={loginIdentifier}
                          onChange={(e) => {
                            setLoginIdentifier(e.target.value);
                            setLoginError(null);
                          }}
                          className="bg-gray-50/50 border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-white h-12 pl-12 rounded-2xl focus:ring-2 focus:ring-[#0052CC]/50 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <Input 
                          id="password" 
                          type="password" 
                          placeholder="••••••••"
                          required 
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setLoginError(null);
                          }}
                          className="bg-gray-50/50 border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-white h-12 pl-12 rounded-2xl focus:ring-2 focus:ring-[#0052CC]/50 transition-all"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-[#0052CC] hover:bg-[#0047B3] text-white h-14 text-base font-black rounded-2xl shadow-lg shadow-[#0052CC]/25 transition-all mt-2 flex items-center justify-center gap-2" disabled={loading}>
                      {loading ? 'Entering...' : 'Log In'}
                      <ArrowRight size={18} />
                    </Button>
                  </form>

                  <div className="border-t border-gray-100 pt-5 text-center">
                    <button 
                      onClick={resetToggleState}
                      className="text-xs font-bold text-gray-400 hover:text-black transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                    >
                      Need an account? Sign up
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
};

