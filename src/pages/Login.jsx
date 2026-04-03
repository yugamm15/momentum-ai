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
    try {
      if (isSignUP) {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: window.location.origin + '/dashboard' }
        });
        if (error) throw error;
        alert("Verification email sent! Click the link in your email to log in.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) navigate('/dashboard');
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      console.log("Starting Google Auth...");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard'
        }
      });
      if (error) {
        console.error("Google Auth Setup Error:", error);
        throw error;
      }
      // Note: signInWithOAuth redirects the entire page, so code below might not run if successful
    } catch (err) {
      console.error("Critical Google OAuth Error:", err);
      setError("OAuth Error: " + err.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-lg shadow-blue-100">M</div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{isSignUP ? 'Join Momentum' : 'Welcome back'}</h2>
          <p className="text-slate-500 mt-2 font-medium">Elevating your meeting intelligence</p>
        </div>

        <button 
          onClick={handleGoogleAuth}
          disabled={googleLoading}
          className="w-full py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex justify-center items-center gap-3 mb-8 shadow-sm active:scale-[0.98]"
        >
          {googleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.94 0 3.51.68 4.79 1.97l3.58-3.58C18.16 1.28 15.3 0 12 0 7.33 0 3.3 2.67 1.28 6.59l4.15 3.22c.98-2.92 3.73-5.04 6.57-5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.8-.07-1.56-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.88c2.16-1.99 3.42-4.93 3.42-8.7z"/><path fill="#FBBC05" d="M5.43 14.19c-.24-.72-.37-1.49-.37-2.19 0-.71.13-1.47.37-2.19L1.28 6.59C.46 8.22 0 10.05 0 12c0 1.95.46 3.78 1.28 5.41l4.15-3.22z"/><path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.88c-1.03.69-2.35 1.1-4.26 1.1-3.73 0-6.89-2.52-8.02-6.52l-4.15 3.22C3.3 21.33 7.33 24 12 24z"/></svg>
          )}
          {isSignUP ? 'Sign up with Google' : 'Sign in with Google'}
        </button>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-white px-4 text-slate-400 font-bold">Or use email</span></div>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-medium" 
              placeholder="you@company.com" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-medium" 
              placeholder="••••••••" 
            />
          </div>

          {error && <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100 animate-pulse">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-slate-900 border-b-4 border-slate-950 text-white rounded-xl font-black text-lg hover:translate-y-[-2px] active:translate-y-[2px] active:border-b-0 transition-all disabled:opacity-50 flex justify-center items-center gap-3"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSignUP ? 'Create Account' : 'Sign In Now'}
          </button>
        </form>

        <div className="mt-10 text-center text-sm font-bold text-slate-500">
          {isSignUP ? 'Back to' : "New to Momentum?"}
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUP)}
            className="ml-2 text-blue-600 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-4"
          >
            {isSignUP ? 'Sign in' : 'Start for free'}
          </button>
        </div>
      </div>
    </div>
  );
}
