import React, { useState } from 'react';
import { Heart, UserCheck, Users, ArrowRight } from 'lucide-react';
import { authenticatedApi } from '../../lib/api';

interface AuthIntentSelectorProps {
  onIntentSelected: (intent: 'donor' | 'requester' | 'both') => void;
  loading?: boolean;
}

export default function AuthIntentSelector({ onIntentSelected, loading: externalLoading }: AuthIntentSelectorProps) {
  const [selectedIntent, setSelectedIntent] = useState<'donor' | 'requester' | 'both' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntent) return;
    setError('');
    setLoading(true);
    try {
      // Save intent to DB profile and compute capabilities (can_donate / can_request)
      await authenticatedApi<{ profile: unknown }>('/api/auth/complete-verification', { intent: selectedIntent });
      onIntentSelected(selectedIntent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save intent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitting = loading || externalLoading;

  return (
    <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/40 shadow-xl p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blood-50 text-blood-600 border border-blood-200/60 shadow-sm">
          <Heart className="h-6 w-6 text-blood-600 fill-blood-600/20" />
        </div>
        <h2 className="text-xl font-bold text-ink-900">I want to use FindMyDonor as:</h2>
        <p className="mt-1 text-xs text-ink-500">Select how you will participate in the network</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <button
          type="button"
          onClick={() => setSelectedIntent('donor')}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
            selectedIntent === 'donor'
              ? 'border-blood-600 bg-blood-50/60 text-blood-900 shadow-md ring-2 ring-blood-500/20'
              : 'border-ink-100 bg-white hover:border-ink-200 text-ink-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${selectedIntent === 'donor' ? 'bg-blood-600 text-white' : 'bg-slate-100 text-ink-600'}`}>
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Blood Donor</div>
              <div className="text-xs text-ink-500">Ready to donate and save lives in emergency</div>
            </div>
          </div>
          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedIntent === 'donor' ? 'border-blood-600 bg-blood-600 text-white' : 'border-slate-300'}`}>
            {selectedIntent === 'donor' && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedIntent('requester')}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
            selectedIntent === 'requester'
              ? 'border-blood-600 bg-blood-50/60 text-blood-900 shadow-md ring-2 ring-blood-500/20'
              : 'border-ink-100 bg-white hover:border-ink-200 text-ink-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${selectedIntent === 'requester' ? 'bg-blood-600 text-white' : 'bg-slate-100 text-ink-600'}`}>
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Blood Requester</div>
              <div className="text-xs text-ink-500">Request emergency blood for patient or family</div>
            </div>
          </div>
          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedIntent === 'requester' ? 'border-blood-600 bg-blood-600 text-white' : 'border-slate-300'}`}>
            {selectedIntent === 'requester' && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedIntent('both')}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
            selectedIntent === 'both'
              ? 'border-blood-600 bg-blood-50/60 text-blood-900 shadow-md ring-2 ring-blood-500/20'
              : 'border-ink-100 bg-white hover:border-ink-200 text-ink-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${selectedIntent === 'both' ? 'bg-blood-600 text-white' : 'bg-slate-100 text-ink-600'}`}>
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Both (Donor & Requester)</div>
              <div className="text-xs text-ink-500">Donate blood and request emergency blood when needed</div>
            </div>
          </div>
          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedIntent === 'both' ? 'border-blood-600 bg-blood-600 text-white' : 'border-slate-300'}`}>
            {selectedIntent === 'both' && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>
        </button>

        <button
          type="submit"
          disabled={!selectedIntent || isSubmitting}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white shadow-lg shadow-blood-600/25 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? 'Saving...' : <>Continue to Dashboard <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </div>
  );
}
