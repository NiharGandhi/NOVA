'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase'

interface CourseAnalytics {
  courseId: string;
  courseName: string;
  totalSessions: number;
  totalMessages: number;
  uniqueStudents: number;
  topTopics: Array<{
    topic: string;
    frequency: number;
  }>;
  difficultTopics: string[];
  commonQuestions: Array<{
    question: string;
    count: number;
  }>;
  timeRange: {
    start: string;
    end: string;
  };
  insights: string[];
}

export default function InstructorDashboard() {
  const [activeTab, setActiveTab] = useState('analytics')
  const [assignedCourses, setAssignedCourses] = useState<any[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedCourseData, setSelectedCourseData] = useState<any>(null)
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [courseMaterials, setCourseMaterials] = useState<any[]>([])
  const [documentChunks, setDocumentChunks] = useState<any[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  const [showChunks, setShowChunks] = useState(false)
  const [showFileViewer, setShowFileViewer] = useState(false)
  const [fileViewerUrl, setFileViewerUrl] = useState<string | null>(null)
  const [fileViewerType, setFileViewerType] = useState<string>('')
  const [editingCourse, setEditingCourse] = useState<any>(null)

  useEffect(() => {
    loadAssignedCourses()
  }, [])

  const loadAssignedCourses = async () => {
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
        setAssignedCourses(data);
        if (data.length > 0) {
          setSelectedCourse(data[0].id);
          setSelectedCourseData(data[0]);
          loadCourseAnalytics(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading assigned courses:', error);
      setMessage('Error loading courses');
    }
  };

  const loadCourseMaterials = async (courseId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load materials
      const materialsResponse = await fetch(`/api/course-materials?chatbot_id=${courseId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (materialsResponse.ok) {
        const materials = await materialsResponse.json();
        setCourseMaterials(materials);
      }

      // Load document chunks
      const chunksResponse = await fetch(`/api/document-chunks?chatbot_id=${courseId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (chunksResponse.ok) {
        const chunks = await chunksResponse.json();
        setDocumentChunks(chunks);
      }
    } catch (error) {
      console.error('Error loading course materials:', error);
    }
  };

  const loadMaterialChunks = async (materialId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/document-chunks?material_id=${materialId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const chunks = await response.json();
        return chunks;
      }
      return [];
    } catch (error) {
      console.error('Error loading material chunks:', error);
      return [];
    }
  };

  const handleViewFile = async (material: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch file from storage
      const response = await fetch(`/api/storage/download?material_id=${material.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setFileViewerUrl(url);
        setFileViewerType(material.mime_type || material.file_type || 'application/octet-stream');
        setShowFileViewer(true);
      } else {
        const error = await response.json();
        setMessage(`Error loading file: ${error.error}`);
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      setMessage('Error viewing file');
    }
  };

  const handleDownloadFile = async (material: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/storage/download?material_id=${material.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = material.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage('File downloaded successfully');
      } else {
        const error = await response.json();
        setMessage(`Error downloading file: ${error.error}`);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      setMessage('Error downloading file');
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Delete this material and all its chunks? This cannot be undone.')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Delete chunks first
      await fetch(`/api/document-chunks?material_id=${materialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      // Delete material
      const response = await fetch(`/api/course-materials/${materialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setMessage('Material deleted successfully');
        if (selectedCourse) {
          loadCourseMaterials(selectedCourse);
        }
        setSelectedMaterial(null);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting material:', error);
      setMessage('Error deleting material');
    }
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/chatbots/${editingCourse.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingCourse.name,
          subject: editingCourse.subject,
          description: editingCourse.description,
          system_prompt: editingCourse.system_prompt,
          use_web_search: editingCourse.use_web_search,
          use_course_materials: editingCourse.use_course_materials
        })
      });

      if (response.ok) {
        setMessage('Course updated successfully!');
        loadAssignedCourses();
        setEditingCourse(null);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating course:', error);
      setMessage('Error updating course');
    }
  };

  const loadCourseAnalytics = async (courseId: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/analytics/course?chatbot_id=${courseId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setMessage('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Instructor Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          View analytics and insights for your courses
        </p>
      </div>

      {/* Course Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Course
        </label>
        <select
          value={selectedCourse}
          onChange={(e) => {
            const courseId = e.target.value;
            const course = assignedCourses.find(c => c.id === courseId);
            setSelectedCourse(courseId);
            setSelectedCourseData(course);
            if (courseId) {
              loadCourseAnalytics(courseId);
              if (activeTab === 'materials') {
                loadCourseMaterials(courseId);
              }
            }
          }}
          className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
        >
          {assignedCourses.map(course => (
            <option key={course.id} value={course.id}>
              {course.name} - {course.subject}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Course Analytics
          </button>
          <button
            onClick={() => {
              setActiveTab('course');
              if (selectedCourse) {
                setEditingCourse(selectedCourseData);
              }
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'course'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Course Settings
          </button>
          <button
            onClick={() => {
              setActiveTab('materials');
              if (selectedCourse) {
                loadCourseMaterials(selectedCourse);
              }
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'materials'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Course Materials
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Loading analytics...</div>
        </div>
      ) : analytics && activeTab === 'analytics' ? (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalSessions}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalMessages}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Unique Students</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.uniqueStudents}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Avg Messages/Session</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.totalSessions > 0
                  ? Math.round(analytics.totalMessages / analytics.totalSessions)
                  : 0}
              </p>
            </div>
          </div>

          {/* Insights */}
          {analytics.insights.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">📊 Key Insights</h3>
              <ul className="space-y-2">
                {analytics.insights.map((insight, index) => (
                  <li key={index} className="text-sm text-blue-800">
                    • {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Difficult Topics */}
          {analytics.difficultTopics.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔴 Topics Students Find Difficult</h3>
              <p className="text-sm text-gray-600 mb-4">
                These topics appear frequently in multiple student sessions, indicating areas where students need extra help.
              </p>
              <div className="flex flex-wrap gap-2">
                {analytics.difficultTopics.map((topic, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium"
                  >
                    {topic}
                  </span>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  💡 <strong>Recommendation:</strong> Consider creating supplementary materials, tutorial videos,
                  or practice problems for these topics. You may also want to schedule review sessions.
                </p>
              </div>
            </div>
          )}

          {/* Top Topics */}
          {analytics.topTopics.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Most Discussed Topics</h3>
              <div className="space-y-3">
                {analytics.topTopics.slice(0, 10).map((topic, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">{topic.topic}</span>
                      <span className="text-sm text-gray-600">{topic.frequency} mentions</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{
                          width: `${(topic.frequency / analytics.topTopics[0].frequency) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Questions */}
          {analytics.commonQuestions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">❓ Frequently Asked Questions</h3>
              <p className="text-sm text-gray-600 mb-4">
                Questions that multiple students have asked. Consider adding these to your course FAQ.
              </p>
              <div className="space-y-3">
                {analytics.commonQuestions.map((question, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-gray-800 flex-1">{question.question}</p>
                      <span className="ml-3 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                        Asked {question.count}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time Range */}
          <div className="text-sm text-gray-500 text-center">
            Analytics for {new Date(analytics.timeRange.start).toLocaleDateString()} - {new Date(analytics.timeRange.end).toLocaleDateString()}
          </div>
        </div>
      ) : !loading && analytics === null && activeTab === 'analytics' ? (
        <div className="text-center py-12 text-gray-500">
          No analytics data available for this course yet.
        </div>
      ) : activeTab === 'course' && editingCourse ? (
        <div className="space-y-6 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900">Edit Course Settings</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
            <input
              type="text"
              value={editingCourse.name}
              onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={editingCourse.subject}
              onChange={(e) => setEditingCourse({ ...editingCourse, subject: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editingCourse.description || ''}
              onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea
              value={editingCourse.system_prompt}
              onChange={(e) => setEditingCourse({ ...editingCourse, system_prompt: e.target.value })}
              rows={6}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
              placeholder="Instructions for the AI tutor..."
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingCourse.use_web_search}
                onChange={(e) => setEditingCourse({ ...editingCourse, use_web_search: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="ml-2 text-sm text-gray-700">Use Web Search</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingCourse.use_course_materials}
                onChange={(e) => setEditingCourse({ ...editingCourse, use_course_materials: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="ml-2 text-sm text-gray-700">Use Course Materials</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setEditingCourse(null)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateCourse}
              className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      ) : activeTab === 'materials' ? (
        <div className="space-y-6">
          {/* Materials Overview */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Course Materials</h3>
              <div className="text-sm text-gray-600">
                {courseMaterials.length} files • {documentChunks.length} chunks
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              View and manage course materials. Each document is split into chunks and encoded for AI retrieval.
            </p>

            {courseMaterials.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No course materials uploaded yet.</p>
                <p className="text-sm mt-2">Materials can be uploaded via Admin Dashboard → Course Materials tab.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {courseMaterials.map((material) => {
                  const materialChunks = documentChunks.filter(c => c.material_id === material.id);
                  const isSelected = selectedMaterial?.id === material.id;

                  return (
                    <div
                      key={material.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div className="p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{material.title}</h4>
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                                {materialChunks.length} chunks
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">📄 {material.file_name}</p>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              <span>Type: {material.file_type || material.mime_type || 'Unknown'}</span>
                              <span>Order: {material.order_index}</span>
                              {material.file_size && (
                                <span>Size: {(material.file_size / 1024).toFixed(1)} KB</span>
                              )}
                              {material.storage_path && (
                                <span>📦 Storage: {material.storage_path}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewFile(material)}
                              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                              title="View file"
                            >
                              👁️ View
                            </button>
                            <button
                              onClick={() => handleDownloadFile(material)}
                              className="px-3 py-1 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                              title="Download file"
                            >
                              ⬇️ Download
                            </button>
                            <button
                              onClick={async () => {
                                if (isSelected) {
                                  setSelectedMaterial(null);
                                  setShowChunks(false);
                                } else {
                                  setSelectedMaterial(material);
                                  setShowChunks(true);
                                  const chunks = await loadMaterialChunks(material.id);
                                  setDocumentChunks(prev => {
                                    // Replace chunks for this material
                                    const filtered = prev.filter(c => c.material_id !== material.id);
                                    return [...filtered, ...chunks];
                                  });
                                }
                              }}
                              className="px-3 py-1 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                            >
                              {isSelected ? 'Hide' : 'View'} Chunks
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(material.id)}
                              className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Chunks View */}
                      {isSelected && showChunks && (
                        <div className="border-t border-gray-200 bg-gray-50 p-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3">
                            Document Chunks ({materialChunks.length})
                          </h5>
                          {materialChunks.length === 0 ? (
                            <p className="text-sm text-gray-500">No chunks found for this material.</p>
                          ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {materialChunks.map((chunk) => (
                                <div
                                  key={chunk.id}
                                  className="bg-white border border-gray-200 rounded p-3"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2 text-xs text-gray-500">
                                      <span className="font-medium">Chunk #{chunk.chunk_index}</span>
                                      {chunk.page_number && <span>Page {chunk.page_number}</span>}
                                      <span className="text-green-600">
                                        {chunk.embedding ? '✓ Encoded' : '✗ Not encoded'}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                      {chunk.chunk_text.length} chars
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 line-clamp-3">
                                    {chunk.chunk_text}
                                  </p>
                                  {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                                    <div className="mt-2 text-xs text-gray-500">
                                      <span className="font-medium">Metadata:</span> {JSON.stringify(chunk.metadata)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Encoding Summary */}
          {documentChunks.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">📊 Encoding Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Total Chunks:</span>
                  <span className="ml-2 font-semibold text-blue-900">{documentChunks.length}</span>
                </div>
                <div>
                  <span className="text-blue-700">Encoded:</span>
                  <span className="ml-2 font-semibold text-blue-900">
                    {documentChunks.filter(c => c.embedding).length}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Avg Chunk Size:</span>
                  <span className="ml-2 font-semibold text-blue-900">
                    {documentChunks.length > 0
                      ? Math.round(documentChunks.reduce((sum, c) => sum + c.chunk_text.length, 0) / documentChunks.length)
                      : 0} chars
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
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

      {/* File Viewer Modal */}
      {showFileViewer && fileViewerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">File Viewer</h3>
              <button
                onClick={() => {
                  setShowFileViewer(false);
                  if (fileViewerUrl) {
                    URL.revokeObjectURL(fileViewerUrl);
                  }
                  setFileViewerUrl(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4">
              {fileViewerType.includes('pdf') ? (
                <iframe
                  src={fileViewerUrl}
                  className="w-full h-full min-h-[600px]"
                  title="PDF Viewer"
                />
              ) : fileViewerType.includes('image') ? (
                <img
                  src={fileViewerUrl}
                  alt="File preview"
                  className="max-w-full h-auto mx-auto"
                />
              ) : fileViewerType.includes('text') || fileViewerType.includes('markdown') ? (
                <iframe
                  src={fileViewerUrl}
                  className="w-full h-full min-h-[600px] border border-gray-200 rounded"
                  title="Text Viewer"
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">
                    Preview not available for this file type ({fileViewerType})
                  </p>
                  <a
                    href={fileViewerUrl}
                    download
                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => {
                  setShowFileViewer(false);
                  if (fileViewerUrl) {
                    URL.revokeObjectURL(fileViewerUrl);
                  }
                  setFileViewerUrl(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
