export interface AIRestriction {
  maxTokens: number;
  temperature: number;
  allowedModels: string[];
  blockedTopics: string[];
  requiresCitation: boolean;
  maxRequestsPerDay: number;
}

export const defaultAIConfig: AIRestriction = {
  maxTokens: 500,
  temperature: 0.7,
  allowedModels: ['gpt-3.5-turbo', 'gpt-4'],
  blockedTopics: [],
  requiresCitation: true,
  maxRequestsPerDay: 50,
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
