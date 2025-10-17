'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { LTI_PLATFORM_PRESETS } from '@/utils/lti';

interface Platform {
  id: string;
  name: string;
  platform_type: string;
  issuer: string;
  client_id: string;
  is_active: boolean;
  auto_provision_users: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
}

interface Context {
  id: string;
  context_label: string;
  context_title: string;
  chatbot_id: string | null;
  sync_status: string;
  last_synced_at: string | null;
  platform: {
    name: string;
  };
}

export default function LMSIntegration() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Form state for new platform
  const [platformType, setPlatformType] = useState('canvas');
  const [platformName, setPlatformName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [authEndpoint, setAuthEndpoint] = useState('');
  const [tokenEndpoint, setTokenEndpoint] = useState('');
  const [jwksEndpoint, setJwksEndpoint] = useState('');
  const [deploymentId, setDeploymentId] = useState('');
  const [nrpsEndpoint, setNrpsEndpoint] = useState('');
  const [autoProvision, setAutoProvision] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Auto-fill endpoints based on platform type and issuer
    if (issuer && platformType) {
      const preset = LTI_PLATFORM_PRESETS[platformType as keyof typeof LTI_PLATFORM_PRESETS];
      if (preset) {
        const baseUrl = issuer.replace(/\/$/, '');
        setAuthEndpoint(baseUrl + preset.auth_endpoint_suffix);
        setTokenEndpoint(baseUrl + preset.token_endpoint_suffix);
        setJwksEndpoint(baseUrl + preset.jwks_endpoint_suffix);
      }
    }
  }, [issuer, platformType]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load platforms via API
      const platformsResponse = await fetch('/api/lti/platforms', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (platformsResponse.ok) {
        const platformsData = await platformsResponse.json();
        setPlatforms(platformsData || []);
      } else {
        console.error('Failed to load platforms:', await platformsResponse.text());
      }

      // Load contexts via API
      const contextsResponse = await fetch('/api/lti/contexts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (contextsResponse.ok) {
        const contextsData = await contextsResponse.json();
        setContexts(contextsData || []);
      } else {
        console.error('Failed to load contexts:', await contextsResponse.text());
      }
    } catch (error) {
      console.error('Error loading LMS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlatform = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Create the platform via API
      const response = await fetch('/api/lti/platforms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: platformName,
          platform_type: platformType,
          issuer,
          client_id: clientId,
          auth_endpoint: authEndpoint,
          token_endpoint: tokenEndpoint,
          jwks_endpoint: jwksEndpoint,
          deployment_id: deploymentId || null,
          nrps_endpoint: nrpsEndpoint || null,
          auto_provision_users: autoProvision,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add platform');
      }

      alert('Platform added successfully! Make sure to configure your LMS with the NOVA LTI credentials.');

      // Reset form
      setShowAddPlatform(false);
      setPlatformName('');
      setIssuer('');
      setClientId('');
      setAuthEndpoint('');
      setTokenEndpoint('');
      setJwksEndpoint('');
      setDeploymentId('');
      setNrpsEndpoint('');

      loadData();
    } catch (error) {
      console.error('Error adding platform:', error);
      alert('Failed to add platform: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSyncContext = async (contextId: string) => {
    try {
      setSyncing(contextId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const context = contexts.find(c => c.id === contextId);
      if (!context) return;

      const response = await fetch('/api/lti/sync/nrps', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextId: context.id,
          platformId: (context as any).platform_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      alert(`Sync completed!\nCreated: ${result.stats.created}\nUpdated: ${result.stats.updated}\nFailed: ${result.stats.failed}`);

      loadData();
    } catch (error) {
      console.error('Error syncing context:', error);
      alert('Failed to sync context. Check console for details.');
    } finally {
      setSyncing(null);
    }
  };

  const handleTogglePlatform = async (platformId: string, isActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/lti/platforms', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: platformId,
          is_active: !isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle platform');
      }

      loadData();
    } catch (error) {
      console.error('Error toggling platform:', error);
      alert('Failed to toggle platform status');
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading LMS integration...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">LMS Integration</h2>
            <p className="mt-1 text-sm text-gray-600">
              Connect to Canvas, Moodle, D2L, and other LMS platforms via LTI 1.3
            </p>
          </div>
          <button
            onClick={() => setShowAddPlatform(!showAddPlatform)}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            {showAddPlatform ? 'Cancel' : 'Add LMS Platform'}
          </button>
        </div>

        {/* Add Platform Form */}
        {showAddPlatform && (
          <form onSubmit={handleAddPlatform} className="mb-8 rounded-lg border-2 border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Add New LMS Platform</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Platform Type</label>
                <select
                  value={platformType}
                  onChange={(e) => setPlatformType(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  required
                >
                  <option value="canvas">Canvas</option>
                  <option value="moodle">Moodle</option>
                  <option value="d2l">D2L Brightspace</option>
                  <option value="blackboard">Blackboard Learn</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Platform Name</label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="e.g., Canvas Production"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Issuer URL</label>
                <input
                  type="url"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="https://your-lms.edu"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="From your LMS LTI configuration"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Authorization Endpoint</label>
                <input
                  type="url"
                  value={authEndpoint}
                  onChange={(e) => setAuthEndpoint(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Token Endpoint</label>
                <input
                  type="url"
                  value={tokenEndpoint}
                  onChange={(e) => setTokenEndpoint(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">JWKS Endpoint</label>
                <input
                  type="url"
                  value={jwksEndpoint}
                  onChange={(e) => setJwksEndpoint(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Deployment ID (Optional)</label>
                <input
                  type="text"
                  value={deploymentId}
                  onChange={(e) => setDeploymentId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">NRPS Endpoint (Optional)</label>
                <input
                  type="url"
                  value={nrpsEndpoint}
                  onChange={(e) => setNrpsEndpoint(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoProvision}
                    onChange={(e) => setAutoProvision(e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Automatically create NOVA accounts for LMS users on first launch
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddPlatform(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                Add Platform
              </button>
            </div>
          </form>
        )}

        {/* Platforms List */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Connected Platforms</h3>
          {platforms.length === 0 ? (
            <p className="text-sm text-gray-600">No LMS platforms connected yet.</p>
          ) : (
            <div className="space-y-3">
              {platforms.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-gray-900">{platform.name}</h4>
                      <span className="text-xs rounded-full bg-gray-100 px-2 py-1 capitalize">
                        {platform.platform_type}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-1 ${
                          platform.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {platform.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{platform.issuer}</p>
                    <p className="mt-1 text-xs text-gray-500">Client ID: {platform.client_id}</p>
                  </div>
                  <button
                    onClick={() => handleTogglePlatform(platform.id, platform.is_active)}
                    className="text-sm text-orange-600 hover:text-orange-700"
                  >
                    {platform.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Synced Courses */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Synced Courses</h3>
          {contexts.length === 0 ? (
            <p className="text-sm text-gray-600">No courses synced yet. Courses will appear here when users launch NOVA from their LMS.</p>
          ) : (
            <div className="space-y-3">
              {contexts.map((context) => (
                <div
                  key={context.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-gray-900">{context.context_title}</h4>
                      <span className="text-xs rounded-full bg-gray-100 px-2 py-1">
                        {context.context_label}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-1 ${
                          context.sync_status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : context.sync_status === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {context.sync_status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">Platform: {context.platform.name}</p>
                    {context.last_synced_at && (
                      <p className="mt-1 text-xs text-gray-500">
                        Last synced: {new Date(context.last_synced_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSyncContext(context.id)}
                    disabled={syncing === context.id}
                    className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {syncing === context.id ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="rounded-lg border border-gray-200 bg-orange-50 p-6">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">LTI Setup Instructions</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>Add a platform above with your LMS details</li>
          <li>Configure your LMS with these NOVA LTI credentials:
            <ul className="mt-2 list-disc pl-5 text-xs">
              <li>Login URL: <code className="rounded bg-white px-1">{process.env.NEXT_PUBLIC_APP_URL}/api/lti/login</code></li>
              <li>Launch URL: <code className="rounded bg-white px-1">{process.env.NEXT_PUBLIC_APP_URL}/api/lti/launch</code></li>
              <li>JWKS URL: <code className="rounded bg-white px-1">{process.env.NEXT_PUBLIC_APP_URL}/api/lti/jwks</code></li>
            </ul>
          </li>
          <li>Enable Names and Role Provisioning Service (NRPS) in your LMS</li>
          <li>Launch NOVA from your LMS course to establish the connection</li>
          <li>Use &quot;Sync Now&quot; to pull student roster and enrollments</li>
        </ol>
      </div>
    </div>
  );
}
