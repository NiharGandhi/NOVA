'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import type { AIRestriction } from '@/utils/aiConfig'

interface ResponseTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  isActive: boolean;
}

export default function AdminDashboard() {
  const [config, setConfig] = useState<AIRestriction>({
    maxTokens: 500,
    temperature: 0.7,
    allowedModels: ['gpt-3.5-turbo', 'gpt-4'],
    blockedTopics: [],
    requiresCitation: true,
    maxRequestsPerDay: 50,
  })

  const [responseTemplates, setResponseTemplates] = useState<ResponseTemplate[]>([
    {
      id: 'step-by-step',
      name: 'Step by Step',
      description: 'Break down explanations into numbered steps',
      template: 'Please explain this in clear, numbered steps. Each step should be concise and build upon the previous one.',
      isActive: true
    },
    {
      id: 'socratic',
      name: 'Socratic Method',
      description: 'Guide through questions and discovery',
      template: 'Use the Socratic method to guide the student. Ask thought-provoking questions and help them discover the answers.',
      isActive: false
    },
    {
      id: 'analogy',
      name: 'Analogies & Examples',
      description: 'Explain using real-world analogies',
      template: 'Explain concepts using relatable real-world analogies and practical examples.',
      isActive: false
    }
  ])

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    template: ''
  })

  const [newBlockedTopic, setNewBlockedTopic] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('general') // 'general' or 'templates'

  useEffect(() => {
    // Load existing config when component mounts
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_config')
          .select('*')
          .eq('id', 1)
          .single();

        if (error) throw error;

        if (data) {
          setConfig({
            maxTokens: data.max_tokens || 500,
            temperature: data.temperature || 0.7,
            allowedModels: data.allowed_models || ['gpt-3.5-turbo', 'gpt-4'],
            blockedTopics: data.blocked_topics || [],
            requiresCitation: data.requires_citation ?? true,
            maxRequestsPerDay: data.max_requests_per_day || 50,
          });

          if (data.response_templates && Array.isArray(data.response_templates)) {
            setResponseTemplates(data.response_templates);
          }
        }
      } catch (error) {
        console.error('Error loading config:', error);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      // Save general config
      const { error: configError } = await supabase
        .from('ai_config')
        .upsert({ 
          id: 1,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          allowed_models: config.allowedModels,
          blocked_topics: config.blockedTopics,
          requires_citation: config.requiresCitation,
          max_requests_per_day: config.maxRequestsPerDay,
          response_templates: responseTemplates 
        })

      if (configError) throw configError
      setMessage('Configuration saved successfully!')
    } catch (error: any) {
      console.error('Save error:', error);
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

  const addResponseTemplate = () => {
    if (newTemplate.name && newTemplate.template) {
      setResponseTemplates([
        ...responseTemplates,
        {
          id: newTemplate.name.toLowerCase().replace(/\s+/g, '-'),
          ...newTemplate,
          isActive: false
        }
      ])
      setNewTemplate({ name: '', description: '', template: '' })
    }
  }

  const toggleTemplate = (id: string) => {
    setResponseTemplates(templates =>
      templates.map(t => ({
        ...t,
        isActive: t.id === id ? !t.isActive : t.isActive
      }))
    )
  }

  const removeTemplate = (id: string) => {
    setResponseTemplates(templates =>
      templates.filter(t => t.id !== id)
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">AI Configuration Dashboard</h1>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            General Settings
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Response Templates
          </button>
        </nav>
      </div>

      <div className="space-y-6 max-w-2xl">
        {activeTab === 'general' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {responseTemplates.map((template) => (
                  <li key={template.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900">
                            {template.name}
                          </h3>
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleTemplate(template.id)}
                              className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${
                                template.isActive ? 'bg-orange-600' : 'bg-gray-200'
                              }`}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                                template.isActive ? 'translate-x-5' : 'translate-x-0'
                              }`} />
                            </button>
                            <button
                              onClick={() => removeTemplate(template.id)}
                              className="ml-3 text-gray-400 hover:text-gray-500"
                            >
                              <span className="sr-only">Remove template</span>
                              ×
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {template.description}
                        </p>
                        <pre className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">
                          {template.template}
                        </pre>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 bg-white shadow sm:rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add New Template
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      name: e.target.value
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="e.g., Visual Learning"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      description: e.target.value
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="Brief description of how this template works"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Template Instructions
                  </label>
                  <textarea
                    value={newTemplate.template}
                    onChange={(e) => setNewTemplate({
                      ...newTemplate,
                      template: e.target.value
                    })}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="Instructions for how the AI should format its response..."
                  />
                </div>
                <button
                  onClick={addResponseTemplate}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                >
                  Add Template
                </button>
              </div>
            </div>
          </>
        )}

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