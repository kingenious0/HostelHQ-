"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Minimize2,
  Maximize2,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
// Removed direct import of AI function - using API route instead

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedActions?: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
  followUpQuestions?: string[];
}

interface AIAssistantProps {
  userContext?: {
    isLoggedIn?: boolean;
    hostelId?: string;
    roomId?: string;
  };
  openByDefault?: boolean;
}

export function AIAssistant({ userContext, openByDefault = false }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Hostie, your friendly HostelHQ assistant! 🏠✨ I'm here to help you find the perfect student accommodation in Ghana. What can I help you with today?",
      timestamp: new Date(),
      suggestedActions: [
        { label: "Find Hostels", action: "browse", url: "/" },
        { label: "How to Book", action: "help", url: "/faq" },
        { label: "Contact Support", action: "contact", url: "/contact" }
      ]
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener('openHostie', handleOpen);
    return () => window.removeEventListener('openHostie', handleOpen);
  }, []);

  // Simple content cleaner
  const cleanContent = (content: string) => {
    if (!content) return '';
    // Strip out <function> tags and JSON blocks that sometimes leak from models
    let cleaned = content
      .replace(/<function[\s\S]*?<\/function>/gi, '')
      .replace(/```json[\s\S]*?```/gi, '')
      .replace(/\{"response":[\s\S]*?\}/gi, '') // Strip raw JSON objects if they leak
      .trim();

    return cleaned;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const requestBody = {
        message: userMessage.content,
        conversationHistory,
        userContext: {
          ...userContext,
          currentPage: pathname,
        },
        sessionData,
      };

      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!apiResponse.ok) {
        throw new Error(`API request failed: ${apiResponse.status}`);
      }

      const response = await apiResponse.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        suggestedActions: response.suggestedActions,
        followUpQuestions: response.followUpQuestions,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.sessionData) {
        setSessionData(response.sessionData);
      }
    } catch (error) {
      console.error('Error sending message to AI assistant:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble responding right now. Please try again or contact our support team for assistance.",
        timestamp: new Date(),
        suggestedActions: [
          { label: "Contact Support", action: "contact", url: "/contact" },
          { label: "Try Again", action: "retry" }
        ]
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestedAction = (action: { label: string; action: string; url?: string }) => {
    if (action.url) {
      window.open(action.url, '_blank');
    } else if (action.action === 'retry') {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        setInputMessage(lastUserMessage.content);
      }
    }
  };

  const quickQuestions = [
    "How do I book a hostel visit?",
    "What amenities are included?",
    "How does payment work?",
    "Can I find hostels in Kumasi?",
    "What documents do I need?"
  ];

  if (!isOpen) {
    if (!openByDefault) return null;
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 z-[9999] bg-gradient-to-tr from-primary to-primary/80 border-none"
        size="icon"
      >
        <MessageCircle className="h-6 w-6 text-white animate-pulse" />
        <span className="sr-only">Open Hostie</span>
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "fixed bottom-6 right-6 w-[calc(100vw-3rem)] sm:w-[380px] overflow-hidden shadow-2xl border-0 z-[9999] transition-all duration-500 bg-background/95 backdrop-blur-xl",
        isMinimized ? "h-16" : "h-[75vh] sm:h-[580px]"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 bg-primary text-white select-none">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-sm font-bold tracking-tight leading-none mb-1">Hostie</CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] text-white/70 font-medium">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/80 hover:text-white"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/80 hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex flex-col h-[calc(75vh-4rem)] sm:h-[516px] p-0 bg-slate-50/50">
          <ScrollArea className="flex-1 px-4">
            <div className="py-6 space-y-6">
              {messages.map((message, idx) => {
                const cleaned = cleanContent(message.content);
                if (!cleaned && message.role === 'assistant' && !message.suggestedActions) return null;

                const isError = cleaned.toLowerCase().includes('error') || cleaned.toLowerCase().includes('trouble');

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col gap-1.5 animate-in slide-in-from-bottom-2 duration-300",
                      message.role === 'user' ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[85%] rounded-[20px] px-4 py-2.5 text-sm shadow-sm",
                      message.role === 'user'
                        ? "bg-primary text-white rounded-br-none"
                        : "bg-white text-foreground rounded-bl-none border border-border"
                    )}>
                      <p className={cn(
                        "whitespace-pre-wrap leading-relaxed",
                        isError ? "text-xs text-red-600 italic" : ""
                      )}>
                        {cleaned}
                      </p>

                      {message.suggestedActions && message.suggestedActions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Suggested actions</p>
                          <div className="flex flex-wrap gap-1.5">
                            {message.suggestedActions.map((action, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] font-medium bg-white hover:bg-slate-50 rounded-full border-border/80"
                                onClick={() => handleSuggestedAction(action)}
                              >
                                {action.label}
                                {action.url && <Maximize2 className="ml-1 h-3 w-3 opacity-30" />}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex flex-col gap-2 items-start animate-in fade-in duration-300">
                  <div className="bg-white px-4 py-3 rounded-[18px] rounded-bl-none border border-border shadow-sm">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="h-1.5 w-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="h-1.5 w-1.5 bg-primary/40 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-2" />
            </div>
          </ScrollArea>

          {/* Quick Questions */}
          {messages.length === 1 && !isLoading && (
            <div className="px-5 py-3.5 bg-white/60 border-t border-slate-200/60">
              <div className="flex items-center gap-2 mb-2.5">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">Quick help</p>
              </div>
              <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar scrollbar-hide">
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    className="whitespace-nowrap h-8 px-4 text-xs font-medium rounded-full bg-white border border-slate-200 shadow-sm hover:border-primary hover:text-primary transition-all active:scale-95"
                    onClick={() => setInputMessage(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200/60 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
            <div className="flex gap-2 items-center bg-slate-50 p-1 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-300">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Hostie..."
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-sm h-10 px-4 placeholder:text-muted-foreground/50 font-medium"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full transition-all duration-500",
                  inputMessage.trim() ? "bg-primary shadow-lg shadow-primary/20 scale-100" : "bg-slate-200 scale-95 opacity-50 shadow-none border-none"
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-2.5 flex justify-center">
              <p className="text-[8px] text-muted-foreground/30 font-bold uppercase tracking-[0.2em] font-mono">
                Powered by Groq Intelligence
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

