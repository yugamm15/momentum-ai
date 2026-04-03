import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUP, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    let res;

    try {
      if (isSignUP) {
        res = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin + '/dashboard'
          }
        });
      } else {
        res = await supabase.auth.signInWithPassword({ email, password });
      }

      if (res.error) throw res.error;
      
      if (!res.error && !isSignUP) {
        navigate('/dashboard');
      } else if (isSignUP) {
        alert("Verification email sent! Please check your inbox.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard'
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">M</div>
          <h2 className="text-2xl font-bold text-slate-900">{isSignUP ? 'Create an account' : 'Welcome back'}</h2>
          <p className="text-slate-500 mt-2">Sign in to Momentum AI to view your meetings</p>
        </div>

        <button 
          onClick={handleGoogleAuth}
          disabled={googleLoading}
          className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex justify-center items-center gap-3 mb-6 shadow-sm"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.94 0 3.51.68 4.79 1.97l3.58-3.58C18.16 1.28 15.3 0 12 0 7.33 0 3.3 2.67 1.28 6.59l4.15 3.22c.98-2.92 3.73-5.04 6.57-5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.8-.07-1.56-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.88c2.16-1.99 3.42-4.93 3.42-8.7z"/><path fill="#FBBC05" d="M5.43 14.19c-.24-.72-.37-1.49-.37-2.19 0-.71.13-1.47.37-2.19L1.28 6.59C.46 8.22 0 10.05 0 12c0 1.95.46 3.78 1.28 5.41l4.15-3.22z"/><path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.88c-1.03.69-2.35 1.1-4.26 1.1-3.73 0-6.89-2.52-8.02-6.52l-4.15 3.22C3.3 21.33 7.33 24 12 24z"/></svg>
          )}
          {isSignUP ? 'Sign up with Google' : 'Sign in with Google'}
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500">Or continue with</span></div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400" 
              placeholder="you@company.com" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400" 
              placeholder="••••••••" 
            />
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUP ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isSignUP ? 'Already have an account?' : "Don't have an account?"}
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUP)}
            className="ml-1 text-blue-600 font-medium hover:underline"
          >
            {isSignUP ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
}
