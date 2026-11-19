import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import type { UserAffiliation } from '../types/campus';

const AFFILIATION_OPTIONS: Array<{ value: UserAffiliation; label: string }> = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty Member' },
  { value: 'staff', label: 'Administrative Staff' },
  { value: 'visitor', label: 'Campus Visitor' },
];

export function AuthPage() {
  const {
    authMode,
    setAuthMode,
    user,
    userProfile,
    isAdmin,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    signOutUser,
    setActivePage,
  } = useCampus();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [affiliation, setAffiliation] = useState<UserAffiliation>('student');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setAuthMode(nextMode);
    setLocalError(null);
    setSuccessNotice(null);
    clearAuthError();
  };

  const handleGoogleAuth = async () => {
    setLocalError(null);
    setSuccessNotice(null);
    setSubmitting(true);
    try {
      const hints =
        authMode === 'signup'
          ? {
              displayName: displayName.trim() || undefined,
              affiliation,
              department: department.trim() || undefined,
            }
          : undefined;
      await signInWithGoogle(hints);
      setSuccessNotice('Signed in successfully with Google.');
    } catch {
      // authError state is populated by CampusContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);
    clearAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    if (authMode === 'signup') {
      if (displayName.trim().length < 2) {
        setLocalError('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (authMode === 'signin') {
        await signInWithEmail(cleanEmail, password);
        setSuccessNotice('Signed in successfully.');
      } else {
        const result = await signUpWithEmail({
          displayName: displayName.trim(),
          email: cleanEmail,
          password,
          affiliation,
          department: department.trim(),
        });
        setSuccessNotice(
          result.verificationSent
            ? 'Account created. Please check your inbox and verify your email address to enable Firestore write actions.'
            : 'Account created successfully.'
        );
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setLocalError(null);
    try {
      await resendVerificationEmail();
      setSuccessNotice('Verification email sent. Refresh after confirming your inbox.');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Could not send verification email right now.'
      );
    }
  };

  const displayedError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Architectural Institutional Panel */}
      <div className="lg:col-span-5 bg-[#0F2557] text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <button
            type="button"
            onClick={() => setActivePage('landing')}
            className="inline-flex items-center gap-2 text-xs font-medium text-blue-200 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Smart Campus Home
          </button>

          <div className="mt-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">Smart Campus</div>
              <div className="text-xs text-blue-200">MSAJCE · Siruseri, Chennai</div>
            </div>
          </div>

          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-8 leading-snug"
            style={{ textWrap: 'balance' }}
          >
            One institutional account for campus navigation, layout uploads, and admin review.
          </h1>
          <p className="text-sm text-blue-100/85 mt-3 leading-relaxed max-w-md">
            Sign in with your verified Google account or campus credentials to submit map layouts
            for legitimacy verification, report room updates, and access administrator tools.
          </p>

          <div className="mt-8 rounded-xl overflow-hidden border border-white/15 bg-blue-950/60">
            {!imgFailed ? (
              <img
                src="/src/assets/images/campus_architectural_blueprint_1795062988387.jpg"
                alt="Campus engineering blueprint on architect desk"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-44 object-cover opacity-90"
              />
            ) : null}
            <div className="p-4 space-y-2 text-xs text-blue-100">
              <div className="flex items-center gap-2 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-blue-300 shrink-0" />
                Protected by Firebase Authentication &amp; Firestore Rules
              </div>
              <p className="text-blue-200/90 leading-relaxed">
                Public navigation works without an account. Uploading map layouts and administrator
                verification require a verified user identity.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-10 pt-6 border-t border-white/10 text-xs text-blue-200/80 flex flex-wrap items-center justify-between gap-2">
          <span>Mohamed Sathak A.J. College of Engineering</span>
          <button
            type="button"
            onClick={() => setActivePage('map')}
            className="text-white hover:underline underline-offset-4 cursor-pointer"
          >
            Continue as Guest →
          </button>
        </div>
      </div>

      {/* Right Authentication Form Surface */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">
          {user ? (
            /* Signed-in Account View */
            <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-blue-700">Authenticated Session</p>
                  <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
                    {userProfile?.displayName || user.displayName || 'Campus Account'}
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">{user.email}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
              </div>

              <div className="border-t border-b border-slate-100 py-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Access Role</span>
                  <span className="font-semibold text-slate-900">
                    {isAdmin ? 'Campus Administrator' : 'Verified Campus Member'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email Verification</span>
                  <span
                    className={`font-semibold ${
                      user.emailVerified ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {user.emailVerified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
                {userProfile?.affiliation && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Affiliation</span>
                    <span className="font-medium text-slate-800 capitalize">
                      {userProfile.affiliation}
                      {userProfile.department ? ` · ${userProfile.department}` : ''}
                    </span>
                  </div>
                )}
              </div>

              {!user.emailVerified && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <p>
                    Your email is not yet verified. Verify your inbox to upload map layouts or
                    submit feedback to Cloud Firestore.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    className="font-semibold text-amber-950 underline underline-offset-2 cursor-pointer"
                  >
                    Resend verification email
                  </button>
                </div>
              )}

              {successNotice && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successNotice}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setActivePage('dashboard')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0F2557] text-white text-sm font-medium rounded-lg hover:bg-blue-900 transition-colors cursor-pointer"
                >
                  Open Smart Campus Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setActivePage('admin')}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Go to Admin Map Verification Console
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Sign In / Sign Up Card */
            <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8 shadow-xs">
              {/* Mode Switcher */}
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signin'}
                  onClick={() => switchMode('signin')}
                  className={`py-2 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    authMode === 'signin'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  onClick={() => switchMode('signup')}
                  className={`py-2 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold text-slate-950">
                  {authMode === 'signin' ? 'Sign in to Smart Campus' : 'Create a campus account'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {authMode === 'signin'
                    ? 'Access map layout submissions, room status tracking, and admin controls.'
                    : 'Register as a student, faculty member, staff, or campus visitor.'}
                </p>
              </div>

              {displayedError && (
                <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{displayedError}</span>
                </div>
              )}

              {successNotice && (
                <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successNotice}</span>
                </div>
              )}

              {/* Primary Instant Google Sign-In / Sign-Up */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleGoogleAuth()}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[#0F2557] text-white text-sm font-medium rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.47-1.71 4.31-5.27 4.31-3.17 0-5.76-2.63-5.76-5.88s2.59-5.88 5.76-5.88c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.78 4.1 14.69 3.2 12.17 3.2 7.21 3.2 3.2 7.22 3.2 12.2s4.01 9 8.97 9c5.18 0 8.62-3.64 8.62-8.77 0-.59-.06-1.04-.14-1.33z"
                  />
                </svg>
                {authMode === 'signin'
                  ? 'Continue with Google'
                  : 'Create Account with Google'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400">
                    or use email &amp; password
                  </span>
                </div>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {authMode === 'signup' && (
                  <>
                    <div>
                      <label
                        htmlFor="auth-fullname"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Full Name
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="auth-fullname"
                          type="text"
                          required
                          maxLength={120}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Dr. A. Rahman / Student Name"
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="auth-affiliation"
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Campus Role
                        </label>
                        <select
                          id="auth-affiliation"
                          value={affiliation}
                          onChange={(e) =>
                            setAffiliation(e.target.value as UserAffiliation)
                          }
                          className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          {AFFILIATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="auth-dept"
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Department
                        </label>
                        <input
                          id="auth-dept"
                          type="text"
                          maxLength={100}
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="CSE, ECE, Admin..."
                          className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@msajce-edu.in"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        authMode === 'signin' ? 'Enter your password' : 'Minimum 6 characters'
                      }
                      className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {authMode === 'signup' && (
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-white text-slate-900 border border-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? 'Please wait...'
                    : authMode === 'signin'
                    ? 'Sign In with Email'
                    : 'Create Account with Email'}
                </button>
              </form>

              <p className="mt-5 text-[11px] text-slate-500 leading-relaxed">
                Google Sign-In works immediately. New accounts default to standard campus access;
                administrator permissions are controlled exclusively by Firestore Security Rules.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
