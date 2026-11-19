import React, { useState } from 'react';
import { CheckCircle2, LogIn, MessageSquarePlus, X } from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import type { FeedbackItem } from '../types/campus';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { user, signInWithGoogle, submitFeedback } = useCampus();
  const [category, setCategory] = useState<FeedbackItem['category']>('map_correction');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (subject.trim().length < 3) {
      setError('Please enter a subject of at least 3 characters.');
      return;
    }
    if (message.trim().length < 5) {
      setError('Please enter details of at least 5 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({ category, subject, message });
      setSubmitted(true);
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <MessageSquarePlus className="w-4 h-4" />
            </div>
            <h2 id="feedback-modal-title" className="text-base font-semibold text-slate-900">
              Submit Campus Feedback
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close feedback modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!user ? (
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Sign in with Google to submit a map correction, room availability discrepancy, or
              navigation suggestion for MSAJCE administrators.
            </p>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign in with Google
            </button>
          </div>
        ) : submitted ? (
          <div className="py-6 text-center">
            <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Feedback Recorded
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              Thank you. Your submission is now visible to Smart Campus administrators.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackItem['category'])}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="map_correction">Map or Building Correction</option>
                <option value="room_issue">Room Number / Status Issue</option>
                <option value="navigation">Walking Route Suggestion</option>
                <option value="general">General Campus Feedback</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={140}
                placeholder="e.g., Update floor count for Block B"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Details
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Share the verified room number, building wing, or footpath note..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
