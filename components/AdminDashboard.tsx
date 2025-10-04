import { useState } from 'react'
import { supabase } from '@/utils/supabase'
import type { AIRestriction } from '@/utils/aiConfig'

export default function AdminDashboard() {
  const [config, setConfig] = useState<AIRestriction>({
    maxTokens: 500,
    temperature: 0.7,
    allowedModels: ['gpt-3.5-turbo', 'gpt-4'],
    blockedTopics: [],
    requiresCitation: true,
    maxRequestsPerDay: 50,
  })

  const [newBlockedTopic, setNewBlockedTopic] = useState('')
  const [message, setMessage] = useState('')

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('ai_config')
        .upsert({ id: 1, ...config })

      if (error) throw error
      setMessage('Configuration saved successfully!')
    } catch (error: any) {
      setMessage('Error saving configuration: ' + error.message)
    }
  }

  const addBlockedTopic = () => {
    if (newBlockedTopic && !config.blockedTopics.includes(newBlockedTopic)) {
      setConfig({
        ...config,
        blockedTopics: [...config.blockedTopics, newBlockedTopic],
      })
      setNewBlockedTopic('')
    }
  }

  const removeBlockedTopic = (topic: string) => {
    setConfig({
      ...config,
      blockedTopics: config.blockedTopics.filter((t) => t !== topic),
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">AI Configuration Dashboard</h1>

      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Max Tokens
          </label>
          <input
            type="number"
            value={config.maxTokens}
            onChange={(e) =>
              setConfig({ ...config, maxTokens: parseInt(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Temperature
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={config.temperature}
            onChange={(e) =>
              setConfig({ ...config, temperature: parseFloat(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Max Requests Per Day
          </label>
          <input
            type="number"
            value={config.maxRequestsPerDay}
            onChange={(e) =>
              setConfig({
                ...config,
                maxRequestsPerDay: parseInt(e.target.value),
              })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Blocked Topics
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={newBlockedTopic}
              onChange={(e) => setNewBlockedTopic(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
              placeholder="Enter a topic to block"
            />
            <button
              onClick={addBlockedTopic}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {config.blockedTopics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
              >
                {topic}
                <button
                  onClick={() => removeBlockedTopic(topic)}
                  className="ml-1 text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Require Citations
          </label>
          <input
            type="checkbox"
            checked={config.requiresCitation}
            onChange={(e) =>
              setConfig({ ...config, requiresCitation: e.target.checked })
            }
            className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
          />
        </div>

        {message && (
          <div
            className={`mt-4 p-4 rounded-md ${
              message.includes('Error')
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleSave}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}
