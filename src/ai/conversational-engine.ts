/**
 * Advanced Conversational AI Engine for Hostie
 * Provides ChatGPT-level conversational abilities with HostelHQ expertise
 */

import { HOSTELHQ_KNOWLEDGE, HOSTIE_PERSONALITY } from './knowledge-base';

export interface ConversationContext {
  userId?: string;
  currentPage?: string;
  hostelId?: string;
  roomId?: string;
  userProfile?: {
    isLoggedIn: boolean;
    role?: string;
    institution?: string;
    preferences?: any;
  };
  conversationHistory: ConversationMessage[];
  sessionData: Record<string, any>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  response: string;
  suggestedActions?: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
  followUpQuestions?: string[];
  context?: Record<string, any>;
}

export class HostieConversationalEngine {
  private knowledge = HOSTELHQ_KNOWLEDGE;
  private personality = HOSTIE_PERSONALITY;

  async generateResponse(
    message: string,
    context: ConversationContext
  ): Promise<AIResponse> {
    // Analyze user intent and context
    const intent = this.analyzeIntent(message, context);
    const entities = this.extractEntities(message);
    
    // Generate contextual response
    const response = await this.generateContextualResponse(message, intent, entities, context);
    
    // Add suggested actions and follow-ups
    const suggestedActions = this.generateSuggestedActions(intent, entities, context);
    const followUpQuestions = this.generateFollowUpQuestions(intent, context);

    return {
      response,
      suggestedActions,
      followUpQuestions,
      context: this.updateContext(intent, entities, context)
    };
  }

  private analyzeIntent(message: string, context: ConversationContext): string {
    const lowerMessage = message.toLowerCase();
    
    // Search and discovery intents (check first - higher priority than greetings)
    if (this.matchesPatterns(lowerMessage, ['find', 'search', 'look for', 'looking for', 'show me', 'recommend', 'need accommodation', 'need a room', 'want accommodation', 'accommodation in', 'hostel in'])) {
      return 'search';
    }

    // Booking related intents
    if (this.matchesPatterns(lowerMessage, ['book', 'reserve', 'secure', 'visit', 'schedule'])) {
      return 'booking';
    }

    // Greeting intents - lower priority
    if (this.matchesPatterns(lowerMessage, ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'whats up', 'greetings', 'hola', 'howdy']) || 
        lowerMessage.startsWith('hi ') || lowerMessage.startsWith('hello ')) {
      return 'greeting';
    }

    // Payment intents
    if (this.matchesPatterns(lowerMessage, ['pay', 'payment', 'cost', 'price', 'fee', 'money', 'budget', 'afford', 'expensive', 'cheap'])) {
      return 'payment';
    }

    // Roommate intents
    if (this.matchesPatterns(lowerMessage, ['roommate', 'sharing', 'partner', 'match'])) {
      return 'roommate';
    }

    // Location intents
    if (this.matchesPatterns(lowerMessage, ['where', 'location', 'near', 'close to', 'distance'])) {
      return 'location';
    }

    // Amenities intents
    if (this.matchesPatterns(lowerMessage, ['amenities', 'facilities', 'features', 'included', 'wifi', 'security'])) {
      return 'amenities';
    }

    // Support intents
    if (this.matchesPatterns(lowerMessage, ['help', 'support', 'problem', 'issue', 'complaint'])) {
      return 'support';
    }

    // Information intents
    if (this.matchesPatterns(lowerMessage, ['what', 'how', 'why', 'when', 'explain', 'tell me'])) {
      return 'information';
    }

    // Personal intents
    if (this.matchesPatterns(lowerMessage, ['your name', 'who are you', 'about you'])) {
      return 'personal';
    }

    return 'general';
  }

  private extractEntities(message: string): Record<string, any> {
    const entities: Record<string, any> = {};
    const lowerMessage = message.toLowerCase();

    // Extract locations
    const cities = this.knowledge.locations.cities.map(c => c.name.toLowerCase());
    const institutions = this.knowledge.locations.institutions.map(i => i.name.toLowerCase());
    
    cities.forEach(city => {
      if (lowerMessage.includes(city)) {
        entities.city = city;
      }
    });
    
    // Map institutions to their cities for all universities
    const institutionCityMap: Record<string, string> = {
      'knust': 'kumasi',
      'university of ghana': 'accra',
      'ug': 'accra',
      'legon': 'accra',
      'university of cape coast': 'cape coast',
      'ucc': 'cape coast',
      'university for development studies': 'tamale',
      'uds': 'tamale',
      'university of health and allied sciences': 'ho',
      'uhas': 'ho'
    };
    
    Object.entries(institutionCityMap).forEach(([institution, city]) => {
      if (lowerMessage.includes(institution)) {
        entities.city = city;
        entities.institution = institution;
      }
    });

    institutions.forEach(institution => {
      if (lowerMessage.includes(institution)) {
        entities.institution = institution;
      }
    });

    // Extract price ranges
    const priceMatch = lowerMessage.match(/(\d+)\s*(?:cedis?|ghc|gh₵|₵)/);
    if (priceMatch) {
      entities.priceRange = parseInt(priceMatch[1]);
    }

    // Extract room types
    if (lowerMessage.includes('single') || lowerMessage.includes('private')) {
      entities.roomType = 'single';
    } else if (lowerMessage.includes('shared') || lowerMessage.includes('double')) {
      entities.roomType = 'shared';
    }

    // Extract amenities
    const amenities = ['wifi', 'security', 'parking', 'kitchen', 'laundry', 'gym', 'study room'];
    amenities.forEach(amenity => {
      if (lowerMessage.includes(amenity)) {
        entities.amenities = entities.amenities || [];
        entities.amenities.push(amenity);
      }
    });

    return entities;
  }

  private async generateContextualResponse(
    message: string,
    intent: string,
    entities: Record<string, any>,
    context: ConversationContext
  ): Promise<string> {
    switch (intent) {
      case 'greeting':
        return this.generateGreeting(context);
      
      case 'personal':
        return this.generatePersonalResponse();
      
      case 'booking':
        return this.generateBookingResponse(entities, context);
      
      case 'search':
        return this.generateSearchResponse(entities, context);
      
      case 'payment':
        return this.generatePaymentResponse(entities);
      
      case 'roommate':
        return this.generateRoommateResponse();
      
      case 'location':
        return this.generateLocationResponse(entities);
      
      case 'amenities':
        return this.generateAmenitiesResponse(entities);
      
      case 'support':
        return this.generateSupportResponse();
      
      case 'information':
        return this.generateInformationResponse(message, entities);
      
      default:
        return this.generateGeneralResponse(message, context);
    }
  }

  private generateGreeting(context: ConversationContext): string {
    const timeOfDay = this.getTimeOfDay();
    const isReturning = context.conversationHistory.length > 1;
    
    if (isReturning) {
      return `${timeOfDay}! Great to see you back! 🏠 How can I help you with your accommodation search today?`;
    }
    
    return `${timeOfDay}! I'm Hostie, your friendly HostelHQ assistant! 🏠✨ I'm here to help ALL students find the perfect accommodation in Ghana - whether you're from UG, KNUST, UCC, UDS, UHAS, or any other institution! Looking for a cozy shared room or private space? I've got you covered! What can I help you with?`;
  }

  private generatePersonalResponse(): string {
    return `I'm Hostie, your dedicated AI assistant for HostelHQ! 🤖✨ I'm designed to help ALL students - local and international - find amazing accommodation in Ghana. I know everything about our ${this.knowledge.platform.statistics.hostels}+ verified hostels across ${this.knowledge.platform.statistics.cities} cities, and I'm here 24/7 to make your housing search as smooth as possible! Think of me as your personal accommodation advisor who never sleeps and welcomes everyone! 😊`;
  }

  private generateBookingResponse(entities: Record<string, any>, context: ConversationContext): string {
    let response = `Absolutely! I'd love to help you book accommodation! 🏠 Here's how our simple process works:\n\n`;
    
    response += `📋 **Quick Booking Steps:**\n`;
    this.knowledge.processes.booking.steps.slice(0, 4).forEach((step, index) => {
      response += `${index + 1}. ${step}\n`;
    });

    if (entities.city) {
      const cityInfo = this.knowledge.locations.cities.find(c => 
        c.name.toLowerCase() === entities.city
      );
      if (cityInfo) {
        response += `\n🌟 Great choice! We have ${cityInfo.hostels} verified hostels in ${cityInfo.name} with average prices around GH₵${cityInfo.averagePrice} per year.`;
      }
    }

    response += `\n\n💡 **Pro tip:** Book a visit first to see the place in person - it's free and helps you make the best choice!`;

    return response;
  }

  private generateSearchResponse(entities: Record<string, any>, context: ConversationContext): string {
    let response = `Perfect! I'll help you find the ideal accommodation! 🔍✨\n\n`;

    if (entities.city) {
      const cityInfo = this.knowledge.locations.cities.find(c => 
        c.name.toLowerCase() === entities.city
      );
      if (cityInfo) {
        response += `📍 **${cityInfo.name}**: ${cityInfo.hostels} hostels available\n`;
        response += `💰 **Average Price**: GH₵${cityInfo.averagePrice}/year\n`;
        response += `🏘️ **Popular Areas**: ${cityInfo.popularAreas.join(', ')}\n\n`;
      }
    }

    if (entities.priceRange) {
      const suitableRanges = this.knowledge.pricing.ranges.filter(range => 
        entities.priceRange >= range.min && entities.priceRange <= range.max
      );
      if (suitableRanges.length > 0) {
        response += `💡 Based on your budget of GH₵${entities.priceRange}, I recommend: **${suitableRanges[0].type}**\n`;
        response += `${suitableRanges[0].description}\n\n`;
      }
    }

    response += `🎯 **What I can help you find:**\n`;
    response += `• Hostels near your campus\n`;
    response += `• Rooms within your budget\n`;
    response += `• Accommodation with specific amenities\n`;
    response += `• Compatible roommates\n`;

    return response;
  }

  private generatePaymentResponse(entities: Record<string, any>): string {
    let response = `Great question about payments! 💳 HostelHQ makes paying super easy and secure:\n\n`;
    
    response += `📱 **Payment Methods:**\n`;
    this.knowledge.processes.payment.methods.forEach(method => {
      response += `• ${method}\n`;
    });

    response += `\n🔒 **Security Features:**\n`;
    this.knowledge.processes.payment.security.forEach(security => {
      response += `• ${security}\n`;
    });

    response += `\n💡 **Key Points:**\n`;
    response += `• ${this.knowledge.processes.payment.pricing}\n`;
    response += `• Payment only required AFTER you visit and decide\n`;
    response += `• ${this.knowledge.processes.payment.refunds}\n`;

    if (entities.priceRange) {
      response += `\n💰 For your budget of GH₵${entities.priceRange}, you have excellent options available!`;
    }

    return response;
  }

  private generateRoommateResponse(): string {
    let response = `Absolutely! Finding the right roommate is super important! 👥✨\n\n`;
    
    response += `🎯 **Our Smart Matching Process:**\n`;
    this.knowledge.processes.roommate.matching.forEach((step, index) => {
      response += `${index + 1}. ${step}\n`;
    });

    response += `\n🔍 **We match based on:**\n`;
    this.knowledge.processes.roommate.preferences.forEach(pref => {
      response += `• ${pref}\n`;
    });

    response += `\n💬 **Safe Communication:**\n`;
    this.knowledge.processes.roommate.communication.forEach(comm => {
      response += `• ${comm}\n`;
    });

    response += `\n🌟 **Why students love our matching:** It helps avoid conflicts and creates lasting friendships!`;

    return response;
  }

  private generateLocationResponse(entities: Record<string, any>): string {
    let response = `Let me help you with location information! 📍\n\n`;

    if (entities.city) {
      const cityInfo = this.knowledge.locations.cities.find(c => 
        c.name.toLowerCase() === entities.city
      );
      if (cityInfo) {
        response += `🏙️ **${cityInfo.name} Overview:**\n`;
        response += `• ${cityInfo.hostels} verified hostels\n`;
        response += `• Average price: GH₵${cityInfo.averagePrice}/year\n`;
        response += `• Popular student areas: ${cityInfo.popularAreas.join(', ')}\n\n`;
      }
    }

    if (entities.institution) {
      const instInfo = this.knowledge.locations.institutions.find(i => 
        i.name.toLowerCase().includes(entities.institution)
      );
      if (instInfo) {
        response += `🎓 **${instInfo.name}:**\n`;
        response += `• Location: ${instInfo.location}\n`;
        response += `• ${instInfo.nearbyHostels} nearby hostels\n`;
        response += `• ${instInfo.studentPopulation.toLocaleString()} students\n\n`;
      }
    }

    response += `🗺️ **We cover these major cities:**\n`;
    this.knowledge.locations.cities.forEach(city => {
      response += `• **${city.name}**: ${city.hostels} hostels\n`;
    });

    return response;
  }

  private generateAmenitiesResponse(entities: Record<string, any>): string {
    let response = `Great question about amenities! 🏠✨ Let me break down what's typically included:\n\n`;

    response += `✅ **Standard Inclusions:**\n`;
    this.knowledge.pricing.inclusions.forEach(inclusion => {
      response += `• ${inclusion}\n`;
    });

    response += `\n❌ **Usually Not Included:**\n`;
    this.knowledge.pricing.exclusions.forEach(exclusion => {
      response += `• ${exclusion}\n`;
    });

    if (entities.amenities && entities.amenities.length > 0) {
      response += `\n🎯 **About the amenities you asked for:**\n`;
      entities.amenities.forEach((amenity: string) => {
        response += `• **${amenity.charAt(0).toUpperCase() + amenity.slice(1)}**: Available in many of our premium hostels\n`;
      });
    }

    response += `\n💡 **Pro tip:** Each hostel page shows exactly what's included, so you know exactly what you're getting!`;

    return response;
  }

  private generateSupportResponse(): string {
    let response = `I'm here to help! 🤝 HostelHQ offers comprehensive support:\n\n`;

    response += `📞 **Support Channels:**\n`;
    this.knowledge.support.channels.forEach(channel => {
      response += `• ${channel}\n`;
    });

    response += `\n⏰ **Availability:**\n`;
    response += `• ${this.knowledge.support.hours}\n`;
    response += `• Response time: ${this.knowledge.support.responseTime}\n\n`;

    response += `🎯 **I can help you with:**\n`;
    response += `• Booking questions and guidance\n`;
    response += `• Payment and pricing information\n`;
    response += `• Hostel recommendations\n`;
    response += `• Technical issues\n`;
    response += `• General platform questions\n\n`;

    response += `💬 **For complex issues, I'll connect you with our human support team!**`;

    return response;
  }

  private generateInformationResponse(message: string, entities: Record<string, any>): string {
    const lowerMessage = message.toLowerCase();

    // Budget/pricing questions
    if (lowerMessage.includes('budget') || lowerMessage.includes('price range') || lowerMessage.includes('cost')) {
      return this.generatePaymentResponse(entities);
    }

    // How HostelHQ works
    if (lowerMessage.includes('how') && lowerMessage.includes('work')) {
      return `Here's how HostelHQ works! 🚀\n\n${this.knowledge.platform.description}\n\n**Our Process:**\n${this.knowledge.processes.booking.steps.slice(0, 5).map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\n**Why students choose us:**\n• ${this.knowledge.platform.statistics.hostels}+ verified hostels\n• Transparent pricing\n• Safe and secure platform\n• 24/7 support`;
    }

    // What is HostelHQ
    if (lowerMessage.includes('what') && (lowerMessage.includes('hostelhq') || lowerMessage.includes('platform'))) {
      return `HostelHQ is ${this.knowledge.platform.description}! 🏠\n\n**Our Mission:** ${this.knowledge.platform.mission}\n\n**By the Numbers:**\n• ${this.knowledge.platform.statistics.cities}+ cities covered\n• ${this.knowledge.platform.statistics.hostels}+ verified hostels\n• ${this.knowledge.platform.statistics.students.toLocaleString()}+ students served\n• ${this.knowledge.platform.statistics.institutions}+ partner institutions\n\n**What makes us special:**\n${this.knowledge.features.unique.slice(0, 4).map(feature => `• ${feature}`).join('\n')}`;
    }

    // Amenities questions
    if (lowerMessage.includes('what') && (lowerMessage.includes('amenities') || lowerMessage.includes('facilities') || lowerMessage.includes('included'))) {
      return this.generateAmenitiesResponse(entities);
    }

    // Location questions
    if (lowerMessage.includes('where') || lowerMessage.includes('location') || lowerMessage.includes('cities')) {
      return this.generateLocationResponse(entities);
    }

    // Roommate questions
    if (lowerMessage.includes('roommate') || lowerMessage.includes('sharing')) {
      return this.generateRoommateResponse();
    }

    // Booking questions
    if (lowerMessage.includes('how') && (lowerMessage.includes('book') || lowerMessage.includes('reserve'))) {
      return this.generateBookingResponse(entities, { conversationHistory: [], sessionData: {} });
    }

    return this.generateGeneralResponse(message, { conversationHistory: [], sessionData: {} });
  }

  private generateGeneralResponse(message: string, context: ConversationContext): string {
    return `I understand you're asking about "${message}". While I'm super knowledgeable about HostelHQ and student accommodation in Ghana, I might need a bit more context to give you the perfect answer! 🤔\n\nHere's what I'm great at helping with:\n• Finding and booking hostels\n• Payment and pricing questions\n• Roommate matching\n• Location and amenity information\n• Platform guidance\n\nCould you tell me more specifically what you'd like to know? I'm here to help make your accommodation search amazing! ✨`;
  }

  private generateSuggestedActions(
    intent: string,
    entities: Record<string, any>,
    context: ConversationContext
  ): Array<{ label: string; action: string; url?: string }> {
    const actions: Array<{ label: string; action: string; url?: string }> = [];

    switch (intent) {
      case 'greeting':
      case 'general':
        actions.push(
          { label: "Browse Hostels", action: "browse", url: "/" },
          { label: "How it Works", action: "help", url: "/faq" },
          { label: "Contact Support", action: "contact", url: "/contact" }
        );
        break;

      case 'booking':
        actions.push(
          { label: "Start Browsing", action: "browse", url: "/" },
          { label: "Booking Guide", action: "help", url: "/faq" }
        );
        break;

      case 'search':
        actions.push(
          { label: "Search Hostels", action: "browse", url: "/" },
          { label: "Filter Options", action: "filter", url: "/?filter=true" }
        );
        break;

      case 'payment':
        actions.push(
          { label: "Payment Info", action: "payments", url: "/payments" },
          { label: "Security Details", action: "security", url: "/faq#security" }
        );
        break;

      case 'roommate':
        actions.push(
          { label: "Find Roommates", action: "roommates", url: "/my-roommates" },
          { label: "Matching Guide", action: "guide", url: "/faq#roommates" }
        );
        break;

      default:
        actions.push(
          { label: "Browse Hostels", action: "browse", url: "/" },
          { label: "Get Help", action: "help", url: "/faq" }
        );
    }

    return actions.slice(0, 3); // Limit to 3 actions
  }

  private generateFollowUpQuestions(intent: string, context: ConversationContext): string[] {
    const questions: string[] = [];

    switch (intent) {
      case 'greeting':
        questions.push(
          "What city are you looking for accommodation in?",
          "What's your budget range for accommodation?",
          "Are you looking for a shared or private room?"
        );
        break;

      case 'search':
        questions.push(
          "What's your preferred budget range?",
          "Do you need any specific amenities?",
          "Would you like help finding compatible roommates?"
        );
        break;

      case 'booking':
        questions.push(
          "Have you found a hostel you're interested in?",
          "Would you like me to recommend some options?",
          "Do you have questions about the visit process?"
        );
        break;

      case 'payment':
        questions.push(
          "Do you have a preferred payment method?",
          "Would you like to know about our refund policy?",
          "Any questions about payment security?"
        );
        break;
    }

    return questions.slice(0, 2); // Limit to 2 follow-up questions
  }

  private updateContext(
    intent: string,
    entities: Record<string, any>,
    context: ConversationContext
  ): Record<string, any> {
    const updatedContext = { ...context.sessionData };

    // Store extracted entities for future reference
    if (entities.city) updatedContext.preferredCity = entities.city;
    if (entities.priceRange) updatedContext.budgetRange = entities.priceRange;
    if (entities.roomType) updatedContext.roomType = entities.roomType;
    if (entities.amenities) updatedContext.desiredAmenities = entities.amenities;

    // Track conversation flow
    updatedContext.lastIntent = intent;
    updatedContext.conversationStage = this.determineConversationStage(intent, context);

    return updatedContext;
  }

  private determineConversationStage(intent: string, context: ConversationContext): string {
    const history = context.conversationHistory;
    
    if (history.length <= 1) return 'introduction';
    if (intent === 'search' || intent === 'booking') return 'exploration';
    if (intent === 'payment') return 'decision';
    return 'ongoing';
  }

  private matchesPatterns(message: string, patterns: string[]): boolean {
    return patterns.some(pattern => message.includes(pattern));
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }
}
