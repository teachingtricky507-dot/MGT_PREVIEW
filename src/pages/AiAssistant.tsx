import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectService, issueService } from '../services/firebaseService';
import { aiService } from '../services/aiService';
import { Project, Issue } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Sparkles, Send, Loader2, MessageSquare, HelpCircle, Bot } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// Simple inline parser for **bold** and `code`
const parseInlineMarkdown = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  const regex = /(\*\*|`)(.*?)\1/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const delimiter = match[1];
    const content = match[2];
    
    if (matchIndex > currentIndex) {
      parts.push(text.substring(currentIndex, matchIndex));
    }
    
    if (delimiter === '**') {
      parts.push(<strong key={matchIndex} className="font-extrabold text-[#172B4D]">{content}</strong>);
    } else {
      parts.push(<code key={matchIndex} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-xs text-red-600">{content}</code>);
    }
    
    currentIndex = regex.lastIndex;
  }
  
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }
  
  return parts.length > 0 ? parts : [text];
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 font-sans leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Flex layout for bullets (starts with * or -)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const listText = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="text-blue-600 font-extrabold select-none shrink-0">•</span>
              <span className="text-gray-700 dark:text-gray-300 flex-1">
                {parseInlineMarkdown(listText)}
              </span>
            </div>
          );
        }

        // Numbered lists
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const listText = numMatch[2];
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="text-blue-600 font-bold select-none shrink-0">{num}.</span>
              <span className="text-gray-700 dark:text-gray-300 flex-1">
                {parseInlineMarkdown(listText)}
              </span>
            </div>
          );
        }

        // Headers
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const headerText = headerMatch[2];
          const parsedText = parseInlineMarkdown(headerText);
          if (level === 1) return <h1 key={idx} className="text-xl font-bold mt-3 mb-1 text-gray-900">{parsedText}</h1>;
          if (level === 2) return <h2 key={idx} className="text-lg font-bold mt-3 mb-1 text-gray-900">{parsedText}</h2>;
          return <h3 key={idx} className="text-md font-bold mt-2 mb-1 text-gray-900">{parsedText}</h3>;
        }

        // Line break
        if (trimmed === '') {
          return <div key={idx} className="h-1" />;
        }

        return (
          <p key={idx} className="text-gray-800 dark:text-gray-200">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
};

export const AiAssistant: React.FC = () => {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I am your AI Project Co-pilot. I have loaded your current projects, active issues, and member workloads. Ask me anything about your team's status, project timelines, or ask me to draft checklists!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProfile) {
      const unsub = projectService.subscribeToProjects(userProfile.uid, (projs) => {
        setProjects(projs);
        const allFetchedIssues: Issue[] = [];
        let completedFetches = 0;
        
        if (projs.length === 0) return;
        
        projs.forEach((proj) => {
          const unsubIssues = issueService.subscribeToIssues(proj.id, (projectIssues) => {
            allFetchedIssues.push(...projectIssues);
            completedFetches++;
            if (completedFetches === projs.length) {
              // De-duplicate issues by ID just in case
              const uniqueIssues = Array.from(new Map(allFetchedIssues.map(item => [item.id, item])).values());
              setAllIssues(uniqueIssues);
            }
          });
        });
      });
      return unsub;
    }
  }, [userProfile]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    if (!textToSend) setInput('');
    
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      sender: 'user',
      text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Prepare context
    const context = {
      user: userProfile?.displayName,
      totalProjects: projects.length,
      projects: projects.map(p => ({ id: p.id, name: p.name, key: p.key, membersCount: p.members.length })),
      totalIssues: allIssues.length,
      issues: allIssues.map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        priority: i.priority,
        type: i.type || 'TASK',
        assigneeId: i.assigneeId,
        estimatedTime: i.estimatedTime,
        timeSpent: i.timeSpent,
        dueDate: i.dueDate
      }))
    };

    try {
      const response = await aiService.askProjectAssistant(text, context);
      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        sender: 'ai',
        text: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        sender: 'ai',
        text: "I encountered an error trying to process that request. Please verify your GEMINI_API_KEY is configured correctly.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "Summarize my workload and prioritize my urgent tasks",
    "List all features vs bugs in our current board",
    "Who is working on what, and who might be overloaded?",
    "Suggest a checklist to design a secure signup flow",
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600 animate-pulse" />
          <div className="h-[1px] w-4 bg-gray-300" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-[#0052CC]">MGT Chatti</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[#172B4D]">MGT Chatti</h1>
        <p className="text-gray-500 font-medium">Your context-aware AI assistant with a full overview of issues, priorities, and workloads.</p>
      </div>

      {/* Main Panel */}
      <Card className="flex-1 flex flex-col border-none shadow-sm bg-white overflow-hidden rounded-2xl">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 flex-shrink-0">
                    <Bot size={16} className="text-blue-600" />
                  </div>
                )}
                
                <div className={`p-4 rounded-2xl max-w-[80%] text-sm ${
                  msg.sender === 'user'
                    ? 'bg-[#0052CC] text-white rounded-tr-none'
                    : 'bg-gray-50 text-[#172B4D] border border-gray-100 rounded-tl-none leading-relaxed'
                }`}>
                  {msg.sender === 'ai' ? (
                    <MarkdownRenderer content={msg.text} />
                  ) : (
                    <p className="whitespace-pre-wrap font-sans font-medium">{msg.text}</p>
                  )}
                  <span className={`block text-[9px] mt-1 text-right font-bold ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={userProfile?.photoURL} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold">
                      {userProfile?.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                  <Bot size={16} className="text-blue-600 animate-spin" />
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 text-gray-500 border border-gray-100 rounded-tl-none flex items-center gap-2 text-xs font-semibold">
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                  Gemini is thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Suggestions Bar */}
        {messages.length === 1 && !isLoading && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <HelpCircle size={14} />
              <span>Suggested Prompts</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(suggestion)}
                  className="p-3 text-left text-xs font-medium text-gray-700 bg-white border hover:border-blue-400 hover:text-[#0052CC] rounded-xl transition-all shadow-sm flex items-center justify-between group"
                >
                  <span>{suggestion}</span>
                  <Sparkles size={12} className="text-gray-400 group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-gray-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 max-w-4xl mx-auto items-center"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask MGT Chatti about tasks, estimates, standup status, or roadmaps..."
              className="flex-1 h-12 bg-gray-50 border-none shadow-inner rounded-xl text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 rounded-xl bg-[#0052CC] hover:bg-[#0747A6] shadow-lg shadow-blue-500/20"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
