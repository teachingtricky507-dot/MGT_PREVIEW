import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

type VerificationStatus = 'loading' | 'success' | 'expired' | 'invalid' | 'resending' | 'resent';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resendVerification } = useAuth();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setStatus('invalid');
        setErrorMessage('Verification token is missing. Please check the link in your email.');
        return;
      }

      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (res.ok) {
          setEmail(data.email);
          setStatus('success');
          toast.success('Email verified successfully!');
        } else {
          if (data.error === 'LINK_EXPIRED') {
            setStatus('expired');
            setEmail(data.email || '');
          } else {
            setStatus('invalid');
            setErrorMessage(data.error || 'This verification link is invalid or expired.');
          }
        }
      } catch (err) {
        console.error(err);
        setStatus('invalid');
        setErrorMessage('An error occurred during verification. Please try again.');
      }
    };

    // Small delay to make it feel smooth and premium
    const timer = setTimeout(performVerification, 1200);
    return () => clearTimeout(timer);
  }, [token]);

  const handleResend = async () => {
    if (!email) return;
    setStatus('resending');
    try {
      await resendVerification(email);
      setStatus('resent');
      toast.success(`Verification email resent to ${email}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to resend verification email.');
      setStatus('expired');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFC] p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#171717] text-white rounded-[2rem] mb-6 shadow-2xl ring-8 ring-white">
            <span className="text-4xl font-bold italic tracking-tighter">E</span>
          </div>
          <h1 className="text-4xl font-black text-[#171717] tracking-tighter">MGT.</h1>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-[0.3em] text-[9px] opacity-60">Simple Project Intelligence</p>
        </div>

        <Card className="border border-gray-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="space-y-3 p-10 pb-6 text-center">
            <div className="flex justify-center mb-2">
              {status === 'loading' && (
                <div className="w-16 h-16 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-black" />
                </div>
              )}
              {status === 'success' && (
                <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center border border-green-100 shadow-sm animate-pulse">
                  <CheckCircle2 size={32} />
                </div>
              )}
              {(status === 'expired' || status === 'resending' || status === 'resent') && (
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center border border-amber-100 shadow-sm">
                  <AlertTriangle size={32} />
                </div>
              )}
              {status === 'invalid' && (
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-100 shadow-sm">
                  <XCircle size={32} />
                </div>
              )}
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-[#171717]">
              {status === 'loading' && 'Verifying Email...'}
              {status === 'success' && 'Verified!'}
              {(status === 'expired' || status === 'resending' || status === 'resent') && 'Link Expired'}
              {status === 'invalid' && 'Invalid Link'}
            </CardTitle>
            <CardDescription className="text-sm font-medium text-gray-400">
              {status === 'loading' && 'Checking security verification token...'}
              {status === 'success' && 'Your account has been activated.'}
              {status === 'expired' && 'The email verification link has expired.'}
              {status === 'resending' && 'Requesting new verification email...'}
              {status === 'resent' && 'Check your mock inbox for new link.'}
              {status === 'invalid' && 'The verification link could not be processed.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-10 pt-0 text-center space-y-6">
            {status === 'loading' && (
              <p className="text-sm text-gray-500">
                Please wait a moment while we validate your credentials and activate your project workspace access.
              </p>
            )}

            {status === 'success' && (
              <>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Congratulations! Your email <strong className="text-black">{email}</strong> has been successfully verified. You can now access your project boards and team tools.
                </p>
                <Button 
                  onClick={() => navigate('/login')} 
                  className="w-full bg-[#171717] hover:bg-black h-14 text-base font-black rounded-2xl shadow-xl shadow-gray-200 mt-2 flex items-center justify-center gap-2"
                >
                  Proceed to Login
                  <ArrowRight size={18} />
                </Button>
              </>
            )}

            {status === 'expired' && (
              <>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Security verification links are valid for <strong className="text-black">2 hours</strong>. If you did not verify in time, request a new verification email for <strong className="text-black">{email}</strong>.
                </p>
                <Button 
                  onClick={handleResend} 
                  className="w-full bg-[#171717] hover:bg-black h-14 text-base font-black rounded-2xl shadow-xl shadow-gray-200 mt-2 flex items-center justify-center gap-2"
                >
                  <Mail size={18} />
                  Resend Verification Email
                </Button>
              </>
            )}

            {status === 'resending' && (
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <Loader2 size={24} className="animate-spin text-gray-400" />
                <p className="text-xs text-gray-400">Generating secure token and sending mock email...</p>
              </div>
            )}

            {status === 'resent' && (
              <>
                <p className="text-sm text-gray-500 leading-relaxed">
                  A new secure verification link has been sent to <strong className="text-black">{email}</strong>. Please check your mock email inbox drawer to activate your account.
                </p>
                <Button 
                  onClick={() => navigate('/login')} 
                  className="w-full bg-gray-100 hover:bg-gray-200 text-black h-14 text-base font-black rounded-2xl shadow-sm mt-2"
                >
                  Back to Login
                </Button>
              </>
            )}

            {status === 'invalid' && (
              <>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {errorMessage || 'This link is invalid or expired. Try registering a new account or resending the email if you registered recently.'}
                </p>
                <Button 
                  onClick={() => navigate('/login')} 
                  className="w-full bg-[#171717] hover:bg-black h-14 text-base font-black rounded-2xl shadow-xl shadow-gray-200 mt-2"
                >
                  Back to Login
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
