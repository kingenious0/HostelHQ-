import { NextRequest, NextResponse } from 'next/server';
import { HostieConversationalEngine, type ConversationContext } from '@/ai/conversational-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Use advanced conversational AI engine
    const hostieEngine = new HostieConversationalEngine();
    
    // Build conversation context
    const context: ConversationContext = {
      currentPage: body.userContext?.currentPage,
      hostelId: body.userContext?.hostelId,
      roomId: body.userContext?.roomId,
      userProfile: {
        isLoggedIn: body.userContext?.isLoggedIn || false,
        role: body.userContext?.role,
        institution: body.userContext?.institution,
      },
      conversationHistory: body.conversationHistory || [],
      sessionData: body.sessionData || {}
    };

    // Generate intelligent response
    const aiResponse = await hostieEngine.generateResponse(body.message, context);
    
    return NextResponse.json({
      response: aiResponse.response,
      suggestedActions: aiResponse.suggestedActions || [],
      followUpQuestions: aiResponse.followUpQuestions || [],
      sessionData: aiResponse.context || {}
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    
    // Provide helpful fallback responses based on common questions
    const fallbackResponse = getFallbackResponse("help");
    
    return NextResponse.json(
      { 
        response: fallbackResponse.message,
        suggestedActions: fallbackResponse.actions
      },
      { status: 200 } // Return 200 with fallback instead of 500 error
    );
  }
}

// Fallback responses for common questions when AI is unavailable
function getFallbackResponse(message: string) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('book') || lowerMessage.includes('visit')) {
    return {
      message: "Great question! Here's how to book with HostelHQ: 1) Browse our verified hostels, 2) Select a room you love, 3) Click 'Book a Visit', 4) Choose your preferred date and time. After your visit, you can secure the room if you're satisfied! 🏠✨",
      actions: [
        { label: "Browse Hostels", action: "browse", url: "/" },
        { label: "How it Works", action: "help", url: "/faq" }
      ]
    };
  }
  
  if (lowerMessage.includes('payment') || lowerMessage.includes('pay') || lowerMessage.includes('cost')) {
    return {
      message: "HostelHQ offers transparent pricing with no hidden fees. You can pay using mobile money, bank transfer, or card payments. Payment is only required after you've visited and decided to secure a room.",
      actions: [
        { label: "Payment Info", action: "payments", url: "/payments" },
        { label: "Contact Support", action: "contact", url: "/contact" }
      ]
    };
  }
  
  if (lowerMessage.includes('amenities') || lowerMessage.includes('facilities')) {
    return {
      message: "Our hostels offer various amenities including furnished rooms, electricity, water, security, study areas, and more. Each hostel listing shows detailed amenities and room features to help you choose the best fit.",
      actions: [
        { label: "View Hostels", action: "browse", url: "/" },
        { label: "Room Features", action: "help", url: "/faq" }
      ]
    };
  }
  
  if (lowerMessage.includes('roommate') || lowerMessage.includes('sharing')) {
    return {
      message: "Yes! HostelHQ offers roommate matching services. You can specify preferences for roommates and we'll help connect you with compatible students. Many rooms are shared (2-4 students per room).",
      actions: [
        { label: "Find Roommates", action: "roommates", url: "/my-roommates" },
        { label: "Browse Rooms", action: "browse", url: "/" }
      ]
    };
  }
  
  // Default fallback
  return {
    message: "Hi there! I'm Hostie, your friendly HostelHQ assistant! 🏠 I'm here to help you find the perfect student accommodation in Ghana. You can browse our verified hostels, book visits, and secure rooms easily. What would you like to know?",
    actions: [
      { label: "Browse Hostels", action: "browse", url: "/" },
      { label: "Contact Support", action: "contact", url: "/contact" },
      { label: "FAQ", action: "help", url: "/faq" }
    ]
  };
}

export async function GET() {
  return NextResponse.json(
    { message: 'HostelHQ AI Assistant API is running' },
    { status: 200 }
  );
}
