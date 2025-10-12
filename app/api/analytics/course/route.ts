import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QueryAnalysis {
  topic: string;
  frequency: number;
  avgResponseLength: number;
  studentCount: number;
  recentQueries: string[];
}

interface CourseAnalytics {
  courseId: string;
  courseName: string;
  totalSessions: number;
  totalMessages: number;
  uniqueStudents: number;
  topTopics: QueryAnalysis[];
  difficultTopics: string[];
  commonQuestions: Array<{ question: string; count: number }>;
  timeRange: { start: string; end: string };
  insights: string[];
}

// Helper function to extract topics from messages using simple keyword analysis
function extractTopics(messages: string[]): Map<string, number> {
  const topicMap = new Map<string, number>();

  // Common educational keywords and phrases
  const educationalTerms = [
    'how', 'what', 'why', 'when', 'where', 'explain', 'understand', 'help',
    'calculate', 'solve', 'prove', 'define', 'describe', 'compare',
    'formula', 'equation', 'theorem', 'concept', 'theory', 'practice'
  ];

  messages.forEach(message => {
    const words = message.toLowerCase().split(/\s+/);
    words.forEach(word => {
      // Remove punctuation
      word = word.replace(/[.,!?;:'"()\[\]{}]/g, '');
      if (word.length > 4 && !educationalTerms.includes(word)) {
        topicMap.set(word, (topicMap.get(word) || 0) + 1);
      }
    });
  });

  return topicMap;
}

// Analyze which topics are difficult based on repeated queries
function identifyDifficultTopics(messages: Array<{ content: string; session_id: string }>): string[] {
  const sessionTopics = new Map<string, Set<string>>();

  messages.forEach(msg => {
    const topics = extractTopics([msg.content]);
    if (!sessionTopics.has(msg.session_id)) {
      sessionTopics.set(msg.session_id, new Set());
    }
    topics.forEach((count, topic) => {
      sessionTopics.get(msg.session_id)!.add(topic);
    });
  });

  // Find topics that appear in multiple sessions (repeated questions)
  const topicSessions = new Map<string, number>();
  sessionTopics.forEach(topics => {
    topics.forEach(topic => {
      topicSessions.set(topic, (topicSessions.get(topic) || 0) + 1);
    });
  });

  // Topics appearing in 3+ sessions are considered difficult
  return Array.from(topicSessions.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}

// Find common questions
function findCommonQuestions(messages: string[]): Array<{ question: string; count: number }> {
  const questionMap = new Map<string, number>();

  messages.forEach(message => {
    // Consider it a question if it contains question marks or starts with question words
    if (message.includes('?') || /^(how|what|why|when|where|can|could|would|is|are|do|does)/i.test(message.trim())) {
      // Normalize the question
      const normalized = message.toLowerCase().trim().slice(0, 100);
      questionMap.set(normalized, (questionMap.get(normalized) || 0) + 1);
    }
  });

  return Array.from(questionMap.entries())
    .filter(([_, count]) => count > 1) // Only repeated questions
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));
}

// Generate insights based on analytics
function generateInsights(analytics: Partial<CourseAnalytics>): string[] {
  const insights: string[] = [];

  if (analytics.uniqueStudents && analytics.totalSessions) {
    const avgSessionsPerStudent = analytics.totalSessions / analytics.uniqueStudents;
    if (avgSessionsPerStudent > 5) {
      insights.push(`High engagement: Students average ${avgSessionsPerStudent.toFixed(1)} sessions each`);
    } else if (avgSessionsPerStudent < 2) {
      insights.push(`Low engagement: Consider reviewing course materials or difficulty level`);
    }
  }

  if (analytics.difficultTopics && analytics.difficultTopics.length > 0) {
    insights.push(`Students struggle with: ${analytics.difficultTopics.slice(0, 3).join(', ')}`);
    insights.push(`Recommendation: Create supplementary materials or tutorial videos for these topics`);
  }

  if (analytics.commonQuestions && analytics.commonQuestions.length > 0) {
    insights.push(`${analytics.commonQuestions.length} frequently asked questions identified - consider adding them to an FAQ`);
  }

  if (analytics.totalMessages && analytics.totalSessions) {
    const avgMessagesPerSession = analytics.totalMessages / analytics.totalSessions;
    if (avgMessagesPerSession > 20) {
      insights.push(`Long conversations (avg ${avgMessagesPerSession.toFixed(0)} messages) suggest students need extensive help`);
    }
  }

  if (insights.length === 0) {
    insights.push('Collect more data for detailed insights');
  }

  return insights;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or instructor
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !['admin', 'instructor'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbot_id');

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbot_id is required' },
        { status: 400 }
      );
    }

    // If instructor, verify they're assigned to this course
    if (userData.role === 'instructor') {
      const { data: assignment, error: assignmentError } = await supabase
        .from('course_instructors')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .eq('instructor_id', userId)
        .single();

      if (assignmentError || !assignment) {
        return NextResponse.json(
          { error: 'Not assigned to this course' },
          { status: 403 }
        );
      }
    }

    // Get course info
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('name, subject')
      .eq('id', chatbotId)
      .single();

    if (chatbotError) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get time range (last 30 days by default)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Get all sessions for this course
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('id, user_id, created_at')
      .eq('chatbot_id', chatbotId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    // Get unique students
    const uniqueStudents = new Set(sessions?.map(s => s.user_id) || []).size;

    // Get all messages from these sessions
    const sessionIds = sessions?.map(s => s.id) || [];

    let userMessages: any[] = [];
    let allMessages: any[] = [];

    if (sessionIds.length > 0) {
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('content, role, session_id, created_at')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      } else {
        allMessages = messages || [];
        userMessages = allMessages.filter(m => m.role === 'user');
      }
    }

    // Extract topics
    const topics = extractTopics(userMessages.map(m => m.content));
    const topTopics = Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, frequency]) => ({
        topic,
        frequency,
        avgResponseLength: 0,
        studentCount: 0,
        recentQueries: []
      }));

    // Identify difficult topics
    const difficultTopics = identifyDifficultTopics(
      userMessages.map(m => ({ content: m.content, session_id: m.session_id }))
    );

    // Find common questions
    const commonQuestions = findCommonQuestions(userMessages.map(m => m.content));

    const analytics: CourseAnalytics = {
      courseId: chatbotId,
      courseName: `${chatbot.name} - ${chatbot.subject}`,
      totalSessions: sessions?.length || 0,
      totalMessages: allMessages.length,
      uniqueStudents,
      topTopics,
      difficultTopics,
      commonQuestions,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      insights: []
    };

    // Generate insights
    analytics.insights = generateInsights(analytics);

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error in GET /api/analytics/course:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
