import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIProviderConfig, AiDigest, ChatMessage, RepoSnapshot } from '../types';
import { streamAIChat } from '../services/aiService';

interface CommunityChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: RepoSnapshot;
  digest: AiDigest | null;
  aiConfig: AIProviderConfig | null;
  pendingPrompt: { text: string; contextLabel: string; seq: number } | null;
  onOpenAIConfig?: () => void;
}

const STARTER_QUESTIONS = [
  "What's the biggest win in this repo recently?",
  'Explain the latest release like I am brand new to tech',
  'What are contributors working hardest on right now?',
  'Is this project healthy and moving fast?',
];

function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown text-sm text-slate-700 leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-[#0F172A] mt-2 mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-[#0F172A] mt-2 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-[#0F172A] mt-1.5 mb-0.5">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-1.5 pl-4 space-y-1 list-disc marker:text-[#0D9488]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 pl-4 space-y-1 list-decimal marker:text-slate-400">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[#0F172A]">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[#0D9488] pl-3 italic text-slate-600 bg-slate-50/70 py-1 rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock =
              Boolean(match) || (typeof children === 'string' && children.includes('\n'));
            if (isBlock) {
              return (
                <div className="my-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xs">
                  {match && (
                    <div className="bg-slate-800/80 px-3 py-1 font-mono text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      {match[1]}
                    </div>
                  )}
                  <pre className="overflow-x-auto p-3 font-mono text-xs text-slate-100 leading-relaxed">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code
                className="rounded-md border border-slate-200/80 bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-medium text-[#0F172A]"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#0D9488] underline decoration-[#0D9488]/40 underline-offset-2 hover:text-[#0b7c72] transition-colors"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-700">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-2.5 py-1.5 border-t border-slate-100">{children}</td>
          ),
          hr: () => <hr className="my-3 border-slate-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function CommunityChatDrawer({
  isOpen,
  onClose,
  snapshot,
  digest,
  aiConfig,
  pendingPrompt,
  onOpenAIConfig,
}: CommunityChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const lastHandledSeqRef = useRef<number>(0);

  // Reset chat cleanly when switching to a different repository
  useEffect(() => {
    setMessages([
      {
        id: `welcome-${snapshot.repo.fullName}`,
        role: 'assistant',
        content: `Hey there! 👋 I'm your GitStory tour guide for **${snapshot.repo.fullName}**. Ask me anything about recent commits, merged pull requests, release highlights, or how this project's development cycle works—no tech jargon required!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatError(null);
  }, [snapshot.repo.fullName]);

  // Auto-scroll on new tokens
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const sendMessage = async (text: string, contextLabel?: string) => {
    const clean = text.trim();
    if (!clean || isStreaming) return;

    setChatError(null);
    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: clean,
      timestamp: nowLabel,
      contextLabel,
    };
    const assistantId = `assistant-${Date.now() + 1}`;
    const placeholderAssistant: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: nowLabel,
    };

    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, placeholderAssistant]);
    setInput('');
    setIsStreaming(true);

    try {
      if (!aiConfig || (!aiConfig.apiKey && aiConfig.provider !== 'local')) {
        throw new Error('Please configure your AI Provider API key to start chatting.');
      }

      await streamAIChat(
        snapshot,
        digest,
        nextHistory,
        aiConfig,
        (chunkText) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunkText } : m
            )
          );
        }
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong while chatting.';
      setChatError(errMsg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content.length > 0));
    } finally {
      setIsStreaming(false);
    }
  };

  // Handle "Explain with AI" triggers from commits, releases, or 3D landmarks
  useEffect(() => {
    if (
      isOpen &&
      pendingPrompt &&
      pendingPrompt.seq > lastHandledSeqRef.current &&
      !isStreaming
    ) {
      lastHandledSeqRef.current = pendingPrompt.seq;
      void sendMessage(pendingPrompt.text, pendingPrompt.contextLabel);
    }
  }, [isOpen, pendingPrompt, isStreaming]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleReset = () => {
    setMessages([
      {
        id: `reset-${Date.now()}`,
        role: 'assistant',
        content: `Fresh chat started for **${snapshot.repo.fullName}**! 🌟 What part of the project journey would you like explained?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle backdrop on mobile & desktop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/25"
          />

          <motion.aside
            role="dialog"
            aria-label="Community AI Chat Guide"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF5A5F]/12 text-[#FF5A5F]">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-[#0F172A] truncate">
                    GitStory AI Guide
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    Grounded in {snapshot.repo.fullName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  title="Start fresh conversation"
                  aria-label="Reset chat"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close AI chat"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-[#F8FAFC]">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {msg.contextLabel && (
                      <span className="mb-1 text-[11px] font-medium text-[#0D9488]">
                        Asking about: {msg.contextLabel}
                      </span>
                    )}
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                        isUser
                          ? 'bg-[#0F172A] text-white'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {msg.content ? (
                        isUser ? (
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <ChatMarkdown content={msg.content} />
                        )
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Sparkles className="h-3.5 w-3.5 text-[#FF5A5F]" />
                          <span>Reading repo activity...</span>
                        </div>
                      )}
                    </div>
                    <span className="mt-1 px-1 text-[10px] font-mono text-slate-400">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {chatError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                >
                  <p className="font-semibold">Couldn&apos;t reach the AI guide</p>
                  <p className="mt-0.5">{chatError}</p>
                </div>
              )}

              {/* Quick Starter Question Buttons */}
              {messages.length <= 2 && !isStreaming && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    Try asking one of these:
                  </p>
                  <div className="flex flex-col gap-2">
                    {STARTER_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void sendMessage(q)}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:border-[#0D9488] hover:text-[#0F172A] transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-1.5 focus-within:border-[#FF5A5F] focus-within:bg-white transition-colors">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about commits, releases, or dev terms..."
                  aria-label="Ask GitStory AI a question"
                  disabled={isStreaming}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim()}
                  aria-label="Send question"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A5F] text-white hover:bg-[#E0484D] disabled:opacity-45 transition-colors cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
