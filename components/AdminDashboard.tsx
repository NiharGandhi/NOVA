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
  const [activeTab, setActiveTab] = useState('general') // 'general', 'templates', 'chatbots', 'materials', or 'instructors'

  // Chatbot management state
  const [chatbots, setChatbots] = useState<any[]>([])

  // Instructor management state
  const [instructors, setInstructors] = useState<any[]>([])
  const [courseInstructors, setCourseInstructors] = useState<any[]>([])
  const [selectedInstructorCourse, setSelectedInstructorCourse] = useState<string>('')
  const [selectedChatbot, setSelectedChatbot] = useState<any>(null)
  const [newChatbot, setNewChatbot] = useState({
    name: '',
    subject: '',
    description: '',
    system_prompt: '',
    use_web_search: true,
    use_course_materials: false,
    age_group: 'Middle School',
    is_active: true
  })

  // Course materials state
  const [courseMaterials, setCourseMaterials] = useState<any[]>([])
  const [editingChatbot, setEditingChatbot] = useState<any>(null)
  const [editingMaterial, setEditingMaterial] = useState<any>(null)
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    content: '',
    file_name: '',
    file_type: 'text',
    order_index: 0
  })

  // Load instructors
  const loadInstructors = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/instructors', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInstructors(data);
      }
    } catch (error) {
      console.error('Error loading instructors:', error);
    }
  };

  // Load instructors for a specific course
  const loadCourseInstructors = async (chatbotId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/instructors?chatbot_id=${chatbotId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCourseInstructors(data);
      }
    } catch (error) {
      console.error('Error loading course instructors:', error);
    }
  };

  // Assign instructor to course
  const assignInstructor = async (chatbotId: string, instructorId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/instructors', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chatbot_id: chatbotId, instructor_id: instructorId, action: 'assign' })
      });

      if (response.ok) {
        setMessage('Instructor assigned successfully!');
        loadCourseInstructors(chatbotId);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error assigning instructor:', error);
      setMessage('Error assigning instructor');
    }
  };

  // Remove instructor from course
  const removeInstructor = async (assignmentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/instructors?assignment_id=${assignmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setMessage('Instructor removed successfully!');
        if (selectedInstructorCourse) {
          loadCourseInstructors(selectedInstructorCourse);
        }
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error removing instructor:', error);
      setMessage('Error removing instructor');
    }
  };

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
    loadChatbots();
    loadInstructors();
  }, []);

  useEffect(() => {
    if (selectedChatbot && activeTab === 'materials') {
      loadCourseMaterials(selectedChatbot.id);
    }
  }, [selectedChatbot, activeTab]);

  const loadChatbots = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/chatbots', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChatbots(data);
      }
    } catch (error) {
      console.error('Error loading chatbots:', error);
    }
  };

  const loadCourseMaterials = async (chatbotId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/course-materials?chatbot_id=${chatbotId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCourseMaterials(data);
      }
    } catch (error) {
      console.error('Error loading course materials:', error);
    }
  };

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

  const handleCreateChatbot = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/chatbots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(newChatbot)
      });

      if (response.ok) {
        setMessage('Chatbot created successfully!');
        setNewChatbot({
          name: '',
          subject: '',
          description: '',
          system_prompt: '',
          use_web_search: true,
          use_course_materials: false,
          age_group: 'Middle School',
          is_active: true
        });
        loadChatbots();
      } else {
        const error = await response.json();
        setMessage('Error creating chatbot: ' + error.error);
      }
    } catch (error) {
      console.error('Error creating chatbot:', error);
      setMessage('Error creating chatbot');
    }
  };

  const handleUpdateChatbot = async (id: string, updates: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/chatbots/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        setMessage('Chatbot updated successfully!');
        loadChatbots();
      } else {
        const error = await response.json();
        setMessage('Error updating chatbot: ' + error.error);
      }
    } catch (error) {
      console.error('Error updating chatbot:', error);
      setMessage('Error updating chatbot');
    }
  };

  const handleDeleteChatbot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chatbot?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/chatbots/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setMessage('Chatbot deleted successfully!');
        loadChatbots();
        if (selectedChatbot?.id === id) {
          setSelectedChatbot(null);
        }
      } else {
        const error = await response.json();
        setMessage('Error deleting chatbot: ' + error.error);
      }
    } catch (error) {
      console.error('Error deleting chatbot:', error);
      setMessage('Error deleting chatbot');
    }
  };

  const handleCreateMaterial = async () => {
    if (!selectedChatbot || !selectedChatbot.id) {
      setMessage('Please select a chatbot first');
      return;
    }

    if (!newMaterial.title || !newMaterial.content) {
      setMessage('Please provide both title and content');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/course-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ...newMaterial,
          chatbot_id: selectedChatbot.id
        })
      });

      if (response.ok) {
        setMessage('Course material added successfully!');
        setNewMaterial({
          title: '',
          content: '',
          file_name: '',
          file_type: 'text',
          order_index: 0
        });
        loadCourseMaterials(selectedChatbot.id);
      } else {
        const error = await response.json();
        setMessage('Error adding course material: ' + error.error);
      }
    } catch (error) {
      console.error('Error creating course material:', error);
      setMessage('Error adding course material');
    }
  };

  const handleUpdateMaterial = async (id: string, updates: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/course-materials/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        setMessage('Course material updated successfully!');
        if (selectedChatbot) {
          loadCourseMaterials(selectedChatbot.id);
        }
      } else {
        const error = await response.json();
        setMessage('Error updating course material: ' + error.error);
      }
    } catch (error) {
      console.error('Error updating course material:', error);
      setMessage('Error updating course material');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/course-materials/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setMessage('Course material deleted successfully!');
        if (selectedChatbot) {
          loadCourseMaterials(selectedChatbot.id);
        }
      } else {
        const error = await response.json();
        setMessage('Error deleting course material: ' + error.error);
      }
    } catch (error) {
      console.error('Error deleting course material:', error);
      setMessage('Error deleting course material');
    }
  };

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
          <button
            onClick={() => setActiveTab('chatbots')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'chatbots'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Chatbots
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'materials'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Course Materials
          </button>
          <button
            onClick={() => setActiveTab('instructors')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'instructors'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Instructors
          </button>
        </nav>
      </div>

      <div className="space-y-6 max-w-4xl">
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
        ) : activeTab === 'templates' ? (
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
        ) : activeTab === 'chatbots' ? (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {chatbots.map((chatbot) => (
                  <li key={chatbot.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900">
                            {chatbot.name}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {chatbot.subject}
                            </span>
                            <button
                              onClick={() => handleUpdateChatbot(chatbot.id, { is_active: !chatbot.is_active })}
                              className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${
                                chatbot.is_active ? 'bg-orange-600' : 'bg-gray-200'
                              }`}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                                chatbot.is_active ? 'translate-x-5' : 'translate-x-0'
                              }`} />
                            </button>
                            <button
                              onClick={() => setEditingChatbot(chatbot)}
                              className="text-blue-400 hover:text-blue-500 mr-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteChatbot(chatbot.id)}
                              className="text-red-400 hover:text-red-500"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {chatbot.description}
                        </p>
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                          <span>Age Group: {chatbot.age_group}</span>
                          <span>Web Search: {chatbot.use_web_search ? 'Yes' : 'No'}</span>
                          <span>Course Materials: {chatbot.use_course_materials ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 bg-white shadow sm:rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create New Chatbot
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newChatbot.name}
                      onChange={(e) => setNewChatbot({ ...newChatbot, name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      placeholder="e.g., Math Tutor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={newChatbot.subject}
                      onChange={(e) => setNewChatbot({ ...newChatbot, subject: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      placeholder="e.g., Mathematics"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={newChatbot.description}
                    onChange={(e) => setNewChatbot({ ...newChatbot, description: e.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="Brief description of what this chatbot teaches"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    System Prompt
                  </label>
                  <textarea
                    value={newChatbot.system_prompt}
                    onChange={(e) => setNewChatbot({ ...newChatbot, system_prompt: e.target.value })}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="Instructions for how the AI should behave as this chatbot..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Age Group
                    </label>
                    <select
                      value={newChatbot.age_group}
                      onChange={(e) => setNewChatbot({ ...newChatbot, age_group: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    >
                      <option>Elementary School</option>
                      <option>Middle School</option>
                      <option>High School</option>
                      <option>College</option>
                      <option>Professional</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newChatbot.use_web_search}
                      onChange={(e) => setNewChatbot({ ...newChatbot, use_web_search: e.target.checked })}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700">
                      Use Web Search
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newChatbot.use_course_materials}
                      onChange={(e) => setNewChatbot({ ...newChatbot, use_course_materials: e.target.checked })}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700">
                      Use Course Materials
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleCreateChatbot}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                >
                  Create Chatbot
                </button>
              </div>
            </div>

            {/* Edit Chatbot Modal */}
            {editingChatbot && (
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Edit Chatbot: {editingChatbot.name}
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input
                          type="text"
                          value={editingChatbot.name}
                          onChange={(e) => setEditingChatbot({ ...editingChatbot, name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Subject</label>
                        <input
                          type="text"
                          value={editingChatbot.subject}
                          onChange={(e) => setEditingChatbot({ ...editingChatbot, subject: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        value={editingChatbot.description}
                        onChange={(e) => setEditingChatbot({ ...editingChatbot, description: e.target.value })}
                        rows={2}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">System Prompt</label>
                      <textarea
                        value={editingChatbot.system_prompt}
                        onChange={(e) => setEditingChatbot({ ...editingChatbot, system_prompt: e.target.value })}
                        rows={4}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Age Group</label>
                        <select
                          value={editingChatbot.age_group}
                          onChange={(e) => setEditingChatbot({ ...editingChatbot, age_group: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        >
                          <option>Elementary School</option>
                          <option>Middle School</option>
                          <option>High School</option>
                          <option>College</option>
                          <option>Professional</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editingChatbot.use_web_search}
                          onChange={(e) => setEditingChatbot({ ...editingChatbot, use_web_search: e.target.checked })}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-700">Use Web Search</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editingChatbot.use_course_materials}
                          onChange={(e) => setEditingChatbot({ ...editingChatbot, use_course_materials: e.target.checked })}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-700">Use Course Materials</label>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        onClick={() => setEditingChatbot(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await handleUpdateChatbot(editingChatbot.id, editingChatbot);
                          setEditingChatbot(null);
                        }}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'materials' ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Chatbot
              </label>
              <select
                value={selectedChatbot?.id || ''}
                onChange={(e) => {
                  const chatbot = chatbots.find(c => c.id === e.target.value);
                  setSelectedChatbot(chatbot);
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
              >
                <option value="">-- Select a chatbot --</option>
                {chatbots.map((chatbot) => (
                  <option key={chatbot.id} value={chatbot.id}>
                    {chatbot.name} ({chatbot.subject})
                  </option>
                ))}
              </select>
            </div>

            {selectedChatbot && (
              <>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {courseMaterials.map((material) => (
                      <li key={material.id} className="px-4 py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-md font-medium text-gray-900">
                              {material.title}
                            </h4>
                            {material.file_name && (
                              <p className="text-sm text-gray-500 mt-1">
                                File: {material.file_name}
                              </p>
                            )}
                            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                              {material.content.substring(0, 200)}...
                            </p>
                          </div>
                          <div className="ml-4 flex space-x-2">
                            <button
                              onClick={() => setEditingMaterial(material)}
                              className="text-blue-400 hover:text-blue-500"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(material.id)}
                              className="text-red-400 hover:text-red-500"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                    {courseMaterials.length === 0 && (
                      <li className="px-4 py-8 text-center text-gray-500">
                        No course materials yet. Add one below.
                      </li>
                    )}
                  </ul>
                </div>

                <div className="mt-6 bg-white shadow sm:rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Add Course Material
                  </h3>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="mt-4 flex text-sm text-gray-600 justify-center">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer rounded-md bg-white font-medium text-orange-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 hover:text-orange-500"
                          >
                            <span>Upload a file</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept=".pdf,.docx,.txt,.md"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (!selectedChatbot) {
                                    setMessage('Please select a chatbot first');
                                    return;
                                  }

                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) {
                                      setMessage('Please log in to upload files');
                                      return;
                                    }

                                    setMessage('Processing document... This may take a moment.');

                                    const formData = new FormData();
                                    formData.append('file', file);
                                    formData.append('chatbot_id', selectedChatbot.id);
                                    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

                                    const response = await fetch('/api/course-materials/upload', {
                                      method: 'POST',
                                      headers: {
                                        'Authorization': `Bearer ${session.access_token}`
                                      },
                                      body: formData
                                    });

                                    if (response.ok) {
                                      const result = await response.json();
                                      setMessage(`✓ Document uploaded successfully! Created ${result.chunks} chunks${result.pages ? ` from ${result.pages} pages` : ''}.`);
                                      loadCourseMaterials(selectedChatbot.id);
                                      // Clear the form
                                      setNewMaterial({
                                        title: '',
                                        content: '',
                                        file_name: '',
                                        file_type: 'text',
                                        order_index: 0
                                      });
                                    } else {
                                      const error = await response.json();
                                      setMessage('Error: ' + error.error);
                                    }
                                  } catch (error) {
                                    console.error('Error uploading document:', error);
                                    setMessage('Error uploading document. Please try again.');
                                  }
                                }
                              }}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          PDF, DOCX, TXT, MD up to 10MB
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-gray-500">Or enter manually</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Title
                      </label>
                      <input
                        type="text"
                        value={newMaterial.title}
                        onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        placeholder="e.g., Chapter 1: Introduction"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Content
                      </label>
                      <textarea
                        value={newMaterial.content}
                        onChange={(e) => setNewMaterial({ ...newMaterial, content: e.target.value })}
                        rows={8}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        placeholder="Paste your course material content here..."
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          File Name (optional)
                        </label>
                        <input
                          type="text"
                          value={newMaterial.file_name}
                          onChange={(e) => setNewMaterial({ ...newMaterial, file_name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                          placeholder="e.g., chapter1.pdf"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          File Type
                        </label>
                        <select
                          value={newMaterial.file_type}
                          onChange={(e) => setNewMaterial({ ...newMaterial, file_type: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        >
                          <option>text</option>
                          <option>pdf</option>
                          <option>markdown</option>
                          <option>html</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Order Index
                        </label>
                        <input
                          type="number"
                          value={newMaterial.order_index}
                          onChange={(e) => setNewMaterial({ ...newMaterial, order_index: parseInt(e.target.value) })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCreateMaterial}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      Add Material
                    </button>
                  </div>
                </div>

                {/* Edit Material Modal */}
                {editingMaterial && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Edit Material: {editingMaterial.title}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Title</label>
                          <input
                            type="text"
                            value={editingMaterial.title}
                            onChange={(e) => setEditingMaterial({ ...editingMaterial, title: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Content</label>
                          <textarea
                            value={editingMaterial.content}
                            onChange={(e) => setEditingMaterial({ ...editingMaterial, content: e.target.value })}
                            rows={12}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">File Name</label>
                            <input
                              type="text"
                              value={editingMaterial.file_name || ''}
                              onChange={(e) => setEditingMaterial({ ...editingMaterial, file_name: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Order Index</label>
                            <input
                              type="number"
                              value={editingMaterial.order_index || 0}
                              onChange={(e) => setEditingMaterial({ ...editingMaterial, order_index: parseInt(e.target.value) })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                          <button
                            onClick={() => setEditingMaterial(null)}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              await handleUpdateMaterial(editingMaterial.id, {
                                title: editingMaterial.title,
                                content: editingMaterial.content,
                                file_name: editingMaterial.file_name,
                                order_index: editingMaterial.order_index
                              });
                              setEditingMaterial(null);
                            }}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : activeTab === 'instructors' ? (
          <>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Course Instructors</h3>
              <p className="text-sm text-gray-600 mb-6">
                Assign instructors to courses. Instructors can view analytics for their assigned courses.
              </p>

              {/* Select Course */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Course
                </label>
                <select
                  value={selectedInstructorCourse}
                  onChange={(e) => {
                    setSelectedInstructorCourse(e.target.value);
                    if (e.target.value) {
                      loadCourseInstructors(e.target.value);
                    } else {
                      setCourseInstructors([]);
                    }
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="">-- Select a course --</option>
                  {chatbots.map(chatbot => (
                    <option key={chatbot.id} value={chatbot.id}>
                      {chatbot.name} - {chatbot.subject}
                    </option>
                  ))}
                </select>
              </div>

              {selectedInstructorCourse && (
                <>
                  {/* Assign New Instructor */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Assign Instructor</h4>
                    <div className="flex gap-3">
                      <select
                        id="instructor-select"
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">-- Select an instructor --</option>
                        {instructors.map(instructor => (
                          <option key={instructor.id} value={instructor.id}>
                            {instructor.email}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const select = document.getElementById('instructor-select') as HTMLSelectElement;
                          if (select.value) {
                            assignInstructor(selectedInstructorCourse, select.value);
                            select.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium"
                      >
                        Assign
                      </button>
                    </div>
                  </div>

                  {/* Current Instructors */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Current Instructors ({courseInstructors.length})
                    </h4>
                    {courseInstructors.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No instructors assigned to this course yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {courseInstructors.map((assignment: any) => (
                          <div
                            key={assignment.id}
                            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {assignment.instructor?.email}
                              </p>
                              <p className="text-xs text-gray-500">
                                Assigned on {new Date(assignment.assigned_at).toLocaleDateString()}
                                {assignment.assigned_by_user && ` by ${assignment.assigned_by_user.email}`}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                if (confirm('Remove this instructor from the course?')) {
                                  removeInstructor(assignment.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* All Instructors List */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  All Instructors ({instructors.length})
                </h4>
                {instructors.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      No instructors found. To create an instructor, change a user&apos;s role to &apos;instructor&apos; in the Supabase database.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {instructors.map((instructor: any) => (
                      <div
                        key={instructor.id}
                        className="bg-white border border-gray-200 rounded-lg p-3"
                      >
                        <p className="text-sm font-medium text-gray-900">{instructor.email}</p>
                        <p className="text-xs text-gray-500">
                          Joined {new Date(instructor.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}

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

        {activeTab === 'general' || activeTab === 'templates' ? (
          <div className="mt-6">
            <button
              onClick={handleSave}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              Save Configuration
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}