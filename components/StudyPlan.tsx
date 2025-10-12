'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';

export default function StudyPlan() {
  const [plan, setPlan] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const generatePlan = async () => {
    try {
      setLoading(true);
      setError('');
      setPlan('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to generate a study plan');
        return;
      }

      const response = await fetch('/api/calendar/study-plan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate study plan');
      }

      const data = await response.json();
      setPlan(data.plan);
    } catch (err: any) {
      console.error('Error generating study plan:', err);
      setError(err.message || 'Failed to generate study plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            AI Study Planner
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            Get an optimal study plan based on your assignments and deadlines
          </p>
        </div>
        <button
          onClick={generatePlan}
          disabled={loading}
          className="rounded-md bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-orange-700 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Generating...</span>
            </div>
          ) : (
            '✨ Generate Plan'
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {plan && (
        <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {plan.split('\n').map((line, index) => {
            const trimmedLine = line.trim();

            // Skip empty lines
            if (!trimmedLine) return null;

            // Check different line types
            const isMainHeading = trimmedLine.startsWith('##') || trimmedLine.startsWith('# ') ||
                                  (trimmedLine.startsWith('**') && trimmedLine.endsWith('**'));
            const isDayHeading = trimmedLine.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Day \d+)/i) ||
                                 trimmedLine.startsWith('📅');
            const isBulletPoint = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') ||
                                  trimmedLine.match(/^\d+\.\s/);
            const isSubPoint = line.startsWith('  ') && (trimmedLine.startsWith('-') || trimmedLine.startsWith('•'));

            // Clean the line - remove markdown symbols but keep the text
            let cleanLine = trimmedLine
              .replace(/^#+\s*/, '')
              .replace(/^\*\*(.+)\*\*$/, '$1')
              .replace(/^[-•]\s*/, '')
              .replace(/^\d+\.\s*/, '');

            if (isMainHeading) {
              return (
                <div key={index} className="rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 p-3 mt-2">
                  <h4 className="font-bold text-white text-sm">
                    {cleanLine}
                  </h4>
                </div>
              );
            }

            if (isDayHeading) {
              return (
                <div key={index} className="mt-3 rounded-lg bg-blue-50 p-3 border-l-4 border-blue-500">
                  <h5 className="font-semibold text-blue-900 text-sm">
                    {cleanLine}
                  </h5>
                </div>
              );
            }

            if (isSubPoint) {
              return (
                <div key={index} className="ml-8 flex items-start gap-2 text-xs text-gray-600 py-1">
                  <span className="mt-0.5 flex-shrink-0">└─</span>
                  <span className="flex-1">{cleanLine}</span>
                </div>
              );
            }

            if (isBulletPoint) {
              return (
                <div key={index} className="ml-4 flex items-start gap-2 rounded-lg bg-white p-3 text-sm border border-gray-200">
                  <span className="mt-0.5 text-orange-500 flex-shrink-0">▪</span>
                  <span className="text-gray-700 flex-1">{cleanLine}</span>
                </div>
              );
            }

            // Regular paragraph text - preserve full content
            return (
              <p key={index} className="text-sm text-gray-700 leading-relaxed pl-2">
                {trimmedLine}
              </p>
            );
          })}
        </div>
      )}

      {!plan && !loading && !error && (
        <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">
            Click &quot;Generate Plan&quot; to create an AI-powered study schedule
          </p>
          <p className="mt-2 text-xs text-gray-500">
            The AI will analyze your calendar events and create an optimal plan
          </p>
        </div>
      )}
    </div>
  );
}
