import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User, Shield, AlertCircle, Award, UserCheck, Sparkles } from 'lucide-react';
import { UserRole } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultRole }) => {
  const { loginWithGoogle, loginWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(defaultRole || 'trainee');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await signUpWithEmail(email, password, name, role);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      let msg = err?.message || 'Authentication error occurred.';
      if (
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/invalid-credential'
      ) {
        msg = 'Invalid email or password.';
      } else if (err?.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (err?.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle(role);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // One-click demo accounts for quick RBAC verification & hackathon grading
  const handleQuickDemoLogin = async (demoRole: UserRole) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    const demoEmail =
      demoRole === 'instructor'
        ? 'command.instructor@sih26248.local'
        : demoRole === 'admin'
        ? 'aditiwari026@gmail.com'
        : 'cadet.trainee@sih26248.local';
    const demoPass = 'TacticalDemo2026!';
    const demoName =
      demoRole === 'instructor'
        ? 'Col. Vikram Rathore (Instructor)'
        : demoRole === 'admin'
        ? 'Lead Admin (SIH26248)'
        : 'Cadet Alex Mercer (Trainee)';

    try {
      try {
        await loginWithEmail(demoEmail, demoPass);
      } catch (loginErr: any) {
        // If not created yet, register the demo user immediately
        await signUpWithEmail(demoEmail, demoPass, demoName, demoRole);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not sign in with demo credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold tracking-tight text-white">
            {isSignUp ? 'Create Simulation Account' : 'Sign In to Simulation'}
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Authenticate to access role-authorized simulation features, persist tactical decisions, and record activity.
        </p>

        {/* Quick Demo Credentials Panel for SIH26248 Evaluators */}
        <div className="mb-4 p-3 bg-slate-950/90 border border-slate-800 rounded-lg">
          <div className="text-[11px] font-mono text-cyan-400 font-semibold mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Role-Based Demo Logins:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickDemoLogin('trainee')}
              className="py-1.5 px-2 bg-slate-900 hover:bg-slate-850 border border-cyan-800/60 rounded-md text-left text-cyan-300 transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <div className="truncate">
                <div className="font-semibold text-[11px]">Cadet Trainee</div>
                <div className="text-[9px] text-slate-400 font-mono">Trainee Station</div>
              </div>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickDemoLogin('instructor')}
              className="py-1.5 px-2 bg-slate-900 hover:bg-slate-850 border border-amber-800/60 rounded-md text-left text-amber-300 transition-colors flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <div className="truncate">
                <div className="font-semibold text-[11px]">Command Instructor</div>
                <div className="text-[9px] text-slate-400 font-mono">Instructor Station</div>
              </div>
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="mb-4 p-2.5 bg-rose-950/40 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google One-Click Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-white transition-colors mb-3 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center mb-3">
          <div className="w-full border-t border-slate-800"></div>
          <span className="absolute bg-slate-900 px-2 text-[10px] text-slate-500 font-mono">
            OR USE EMAIL CREDENTIALS
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Full Name / Rank
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g., Cadet John Doe or Maj. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="operator@command.mil"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Requested Simulation Role
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRole('trainee')}
                  className={`py-2 px-3 rounded-lg border text-left transition-colors ${
                    role === 'trainee'
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="font-semibold">Trainee</div>
                  <div className="text-[10px] text-slate-500 font-mono">Trainee Console Only</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('instructor')}
                  className={`py-2 px-3 rounded-lg border text-left transition-colors ${
                    role === 'instructor'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="font-semibold">Instructor</div>
                  <div className="text-[10px] text-slate-500 font-mono">Scenario & Live Controls</div>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm mt-2"
          >
            {isSubmitting ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMsg(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMsg(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Sign Up
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
