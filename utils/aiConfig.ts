export interface ResponseTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  isActive: boolean;
}

export interface AIRestriction {
  maxTokens: number;
  temperature: number;
  allowedModels: string[];
  blockedTopics: string[];
  requiresCitation: boolean;
  maxRequestsPerDay: number;
  responseTemplates?: ResponseTemplate[];
}

export const defaultAIConfig: AIRestriction = {
  maxTokens: 500,
  temperature: 0.7,
  allowedModels: ['gpt-3.5-turbo', 'gpt-4'],
  blockedTopics: [],
  requiresCitation: true,
  maxRequestsPerDay: 50,
  responseTemplates: [
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
  ]
}

export function validateAIRequest(
  userInput: string,
  config: AIRestriction = defaultAIConfig
): { isValid: boolean; error?: string } {
  // Check for blocked topics
  const containsBlockedTopic = config.blockedTopics.some(topic => 
    userInput.toLowerCase().includes(topic.toLowerCase())
  )
  
  if (containsBlockedTopic) {
    return {
      isValid: false,
      error: 'Your request contains restricted topics'
    }
  }

  return { isValid: true }
}