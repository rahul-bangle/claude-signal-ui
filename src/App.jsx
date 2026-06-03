import { useState, useEffect, useRef } from 'react';
import { 
  Menu, User, Plus, Mic, ArrowUp, Copy, Sparkles, Loader2, X
} from 'lucide-react';

const ClaudeStar = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1.5C12 7.5 16.5 12 22.5 12C16.5 12 12 16.5 12 22.5C12 16.5 7.5 12 1.5 12C7.5 12 12 7.5 12 1.5Z" fill="#D97A53" />
  </svg>
);

export default function App() {
  const [inputText, setInputText] = useState("");
  const [signalEnabled, setSignalEnabled] = useState(true);
  const [chatActive, setChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  
  // Sidebar Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dynamic Stream states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  
  // Signal State flags
  const [verifiedMap, setVerifiedMap] = useState({});
  const [activeTooltipIdx, setActiveTooltipIdx] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // TTV measurement
  const [ttvStart, setTtvStart] = useState(null);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState(null);
  const [randomGreeting, setRandomGreeting] = useState("Evening");

  const greetings = [
    "Evening",
    "How can I help you today?",
    "Welcome back",
    "Let's build something",
    "What's on your mind?",
    "Hello",
    "Start a new conversation",
    "Ask me anything",
    "Ready when you are",
    "Good to see you"
  ];

  useEffect(() => {
    // Pick random greeting on mount
    const randomIndex = Math.floor(Math.random() * greetings.length);
    setRandomGreeting(greetings[randomIndex]);
    // Check if the device is a touch device
    if (typeof window !== 'undefined') {
      setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
    }
  }, []);

  // References
  const messageEndRef = useRef(null);
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || "";

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, streamingText]);

  // Toast helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const getCleanText = (rawStr) => {
    return rawStr.replace(/<signal[^>]*>([\s\S]*?)<\/signal>/g, '$1');
  };

  const handleCopy = (rawText) => {
    const cleanText = getCleanText(rawText);
    try {
      navigator.clipboard.writeText(cleanText).catch(() => {});
    } catch (e) {
      console.warn("Clipboard blocked, falling back");
    }
    const elapsedSeconds = Math.round((Date.now() - ttvStart) / 1000);
    triggerToast(`✅ Copied! TTV Measured: ${elapsedSeconds} seconds`);
  };

  const parseSignalTags = (text, messageId) => {
    const regex = /(<signal\s+level="([^"]+)"(?:\s+confidence="([^"]+)")?>([\s\S]*?)<\/signal>)/g;
    let parts = [];
    let lastIndex = 0;
    let match;
    let indexCount = 0;

    const clean = text;

    while ((match = regex.exec(clean)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: clean.substring(lastIndex, match.index)
        });
      }

      const level = match[2];
      const confidence = match[3] || "68%";
      const content = match[4];
      const segmentKey = `${messageId}-${indexCount}`;

      parts.push({
        type: 'signal',
        level,
        confidence,
        content,
        key: segmentKey
      });

      lastIndex = regex.lastIndex;
      indexCount++;
    }

    if (lastIndex < clean.length) {
      parts.push({
        type: 'text',
        content: clean.substring(lastIndex)
      });
    }

    if (parts.length === 0) {
      return [{ type: 'text', content: text }];
    }

    return parts;
  };

  const handleNewChat = () => {
    setChatActive(false);
    setChatMessages([]);
    setStreamingText("");
    setIsStreaming(false);
    setVerifiedMap({});
    setIsSidebarOpen(false);
    setInputText("");
    const randomIndex = Math.floor(Math.random() * greetings.length);
    setRandomGreeting(greetings[randomIndex]);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;

    const userQuery = inputText;
    const currentSignalState = signalEnabled; // Capture switch state at send time
    setInputText("");
    setChatActive(true);
    setStreamingText("");
    setIsStreaming(true);
    setActiveTooltipIdx(null);
    setVerifiedMap({});

    const userMsgId = Date.now();
    setChatMessages(prev => [...prev, { 
      id: userMsgId, 
      role: "user", 
      text: userQuery, 
      wasSignalEnabled: currentSignalState 
    }]);

    const startTime = Date.now();
    setTtvStart(startTime);

    const systemInstruction = currentSignalState 
      ? `You are Claude. You must respond in a friendly conversational style.
Whenever you output factual claims, estimates, statistics, code blocks, or logic, you MUST wrap those specific sentences in custom XML <signal level="green|yellow|red" confidence="X%">...</signal> tags.

Here is the strict mapping rules:
- High confidence verified facts, clear code logic, or exact figures: wrap in <signal level="green">Fact/Sentence</signal>
- Medium confidence statements, estimates, or general documentation claims: wrap in <signal level="yellow">Fact/Sentence</signal>
- Low confidence, unverified figures, or legacy/deprecated code usages: wrap in <signal level="red" confidence="XX%">Fact/Sentence</signal>

CRITICAL SPECIFIC RULES:
1. ONLY output the Q3 financial summary sentences IF the user's query is related to business performance, financial summaries, company stats, or Q3 reports:
   - "Q3 revenue grew by 12% YoY." (You MUST tag this as level="green")
   - "Customer retention in the enterprise segment held steady at 92%." (You MUST tag this as level="yellow")
   - "The total addressable market size is currently estimated at $4.2 Billion." (You MUST tag this as level="red" confidence="68%")
2. For all other general topics (programming, history, legal, science, everyday questions), answer the user's query directly and apply the <signal> tags dynamically to the factual claims, instructions, or estimates in YOUR ACTUAL response. Do not inject Q3 financials into unrelated answers.
3. Ensure no other content is inside the tag attributes, only valid XML. Do not include spaces inside tag boundaries.`
      : `You are Claude. Respond to the user's query in plain text. Do not output any XML tags or <signal> highlights. Keep all statements simple and plain.`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userQuery }
          ],
          temperature: 0.3,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine === "data: [DONE]") continue;
          if (cleanLine.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(cleanLine.substring(6));
              const delta = parsed.choices[0]?.delta?.content || "";
              accumText += delta;
              setStreamingText(accumText);
            } catch (err) {
              // ignore
            }
          }
        }
      }

      const responseId = Date.now() + 1;
      setChatMessages(prev => [...prev, {
        id: responseId,
        role: "assistant",
        text: accumText,
        wasSignalEnabled: currentSignalState // Store state with message
      }]);
      setStreamingText("");
      setIsStreaming(false);

    } catch (error) {
      console.error(error);
      triggerToast("❌ Error calling Groq API. Please check network/key.");
      setIsStreaming(false);
    }
  };
  const renderMessageContent = (msg) => {
    // Determine signal state for this message:
    // For normal chat history, use its historical state.
    // For real-time streaming, fallback to current global switch state.
    const isSignalActive = msg.wasSignalEnabled !== undefined 
      ? msg.wasSignalEnabled 
      : signalEnabled;

    if (!isSignalActive) {
      return <span>{getCleanText(msg.text)}</span>;
    }

    const segments = parseSignalTags(msg.text, msg.id);

    return segments.map((seg, idx) => {
      if (seg.type === 'text') {
        return <span key={idx}>{seg.content}</span>;
      }

      const isVerified = verifiedMap[seg.key];
      const isTooltipOpen = activeTooltipIdx === seg.key;

      if (seg.level === 'green') {
        return (
          <span 
            key={idx} 
            className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 px-1 py-0.5 rounded transition-all font-medium"
          >
            {seg.content}
          </span>
        );
      }

      if (seg.level === 'yellow') {
        return (
          <span 
            key={idx} 
            className="bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 px-1 py-0.5 rounded transition-all font-medium"
          >
            {seg.content}
          </span>
        );
      }

      if (seg.level === 'red') {
        if (isVerified) {
          return (
            <span 
              key={idx} 
              className="inline-flex items-center text-slate-800 dark:text-slate-200 transition-all font-medium bg-emerald-50/50 dark:bg-emerald-950/10 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900"
            >
              <span className="inline-flex items-center justify-center w-4 h-4 mr-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">✓</span>
              {seg.content}
            </span>
          );
        }

        return (
          <span 
            key={idx}
            onClick={() => {
              if (isTouchDevice) {
                setActiveTooltipIdx(isTooltipOpen ? null : seg.key);
              }
            }}
            onMouseEnter={() => {
              if (!isTouchDevice) {
                setActiveTooltipIdx(seg.key);
              }
            }}
            onMouseLeave={() => {
              if (!isTouchDevice) {
                setActiveTooltipIdx(null);
              }
            }}
            className="bg-red-100 dark:bg-red-950/40 text-red-950 dark:text-red-300 px-1 py-0.5 rounded cursor-pointer relative border-b border-red-400 border-dashed hover:bg-red-200 transition-all inline-block select-none"
          >
            {seg.content}
            {isTooltipOpen && (
              <span 
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  if (!isTouchDevice) {
                    setActiveTooltipIdx(seg.key);
                  }
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  if (!isTouchDevice) {
                    setActiveTooltipIdx(null);
                  }
                }}
                className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-60 p-3 bg-[#252423] text-white border border-neutral-800 rounded-xl shadow-2xl z-50 text-[12px] font-normal leading-relaxed pointer-events-auto block"
              >
                <span className="block mb-2 text-neutral-200">
                  Claude is {seg.confidence} confident in this figure. Suggest verifying before sharing.
                </span>
                <span className="flex items-center gap-1.5 justify-end">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setVerifiedMap(prev => ({ ...prev, [seg.key]: true }));
                      setActiveTooltipIdx(null);
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold transition-colors"
                  >
                    Verify
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTooltipIdx(null);
                    }}
                    className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded text-[10px] font-semibold transition-colors"
                  >
                    Dismiss
                  </button>
                </span>
                <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-6 border-transparent border-t-[#252423]"></span>
              </span>
            )}
          </span>
        );
      }

      return <span key={idx}>{seg.content}</span>;
    });
  };

  return (
    <div className="w-full flex items-center justify-center min-h-screen bg-[#FAF9F5] sm:bg-[#121212] p-0 sm:py-8 sm:px-4">
      {/* Viewport Frame with clean mobile layout constraints */}
      <div className="relative w-full sm:max-w-[390px] h-[100dvh] sm:h-[844px] bg-[#FAF9F5] text-[#252423] font-sans flex flex-col overflow-hidden shadow-2xl rounded-none sm:rounded-[36px] border-0 sm:border-8 border-neutral-900">
        
        {/* Sidebar Drawer */}
        {isSidebarOpen && (
          <div className="absolute inset-0 z-40 flex">
            {/* Backdrop overlay */}
            <div 
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            />
            {/* Sidebar content panel */}
            <div className="relative w-[280px] h-full bg-[#FAF9F5] border-r border-[#EAE9E6] p-4 flex flex-col justify-between shadow-2xl z-50 animate-slide-in">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#EAE9E6]">
                  <span className="font-serif font-bold text-lg text-black flex items-center gap-1.5">
                    <ClaudeStar /> Menu
                  </span>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 rounded-full hover:bg-black/5 text-[#454341] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                {/* Actions */}
                <button
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white border border-[#EAE9E6] hover:bg-[#F3F2EE] text-[#454341] rounded-xl text-sm font-semibold transition-all shadow-sm"
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Start New Chat
                </button>
              </div>

              {/* Footer inside sidebar */}
              <div className="pt-3 border-t border-[#EAE9E6]">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-[#F3F2EE] flex items-center justify-center font-bold text-xs text-[#454341]">
                    S
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#454341]">Sonu</div>
                    <div className="text-[10px] text-[#A3A19E]">Free Account</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-[#FAF9F5]/90 backdrop-blur border-b border-[#EAE9E6] z-25">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-[#454341] hover:bg-black/5 rounded-full transition-colors"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
          <div className="flex-1" /> {/* Empty spacing to replace model name label */}
          <button className="p-1 -mr-1 text-[#454341] hover:bg-black/5 rounded-full transition-colors">
            <User size={20} strokeWidth={2} />
          </button>
        </header>

        {/* Dynamic Chat & Main Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col space-y-4">
          {!chatActive ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center mt-24">
              <div>
                <ClaudeStar />
              </div>
              <h1 className="mt-5 text-[26px] font-serif font-semibold tracking-tight text-black px-4">
                {randomGreeting}
              </h1>
            </div>
          ) : (
            <div className="space-y-5">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col space-y-1">
                  {msg.role === "user" ? (
                    <div className="self-end bg-[#F3F2EE] text-[#252423] px-3.5 py-2 rounded-2xl max-w-[85%] text-[14px] border border-[#EAE9E6] shadow-sm">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-start gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#FAF9F5] border border-[#EAE9E6] flex items-center justify-center mt-0.5">
                          <ClaudeStar />
                        </div>
                        <div className="flex-1 text-[14px] leading-relaxed text-[#252423] bg-white p-3 rounded-2xl border border-[#EAE9E6] shadow-sm">
                          {renderMessageContent(msg)}
                          
                          <div className="flex items-center justify-end mt-3 pt-2.5 border-t border-[#F3F2EE]">
                            <button 
                              onClick={() => handleCopy(msg.text)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-[#F3F2EE] hover:bg-[#EAE9E6] text-[#454341] rounded-full text-[10px] font-semibold transition-colors"
                            >
                              <Copy size={11} />
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Real-time Streaming message */}
              {(isStreaming || streamingText) && (
                <div className="flex flex-col space-y-1 animate-pulse">
                  <div className="flex items-start gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#FAF9F5] border border-[#EAE9E6] flex items-center justify-center mt-0.5">
                      <ClaudeStar />
                    </div>
                    <div className="flex-1 text-[14px] leading-relaxed text-[#252423] bg-white p-3 rounded-2xl border border-[#EAE9E6] shadow-sm">
                      {renderMessageContent({ id: 'stream-msg', text: streamingText })}
                      {isStreaming && !streamingText && (
                        <div className="flex items-center gap-1.5 text-xs text-[#A3A19E]">
                          <Loader2 size={12} className="animate-spin" />
                          Thinking...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messageEndRef} />
            </div>
          )}
        </div>

        {/* Custom Toast Notification Popup */}
        {toastMessage && (
          <div className="absolute top-16 left-4 right-4 z-50 bg-[#252423] text-white py-2 px-3 rounded-xl shadow-xl flex items-center gap-1.5 text-[11px] font-medium border border-neutral-800 animate-bounce">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Bottom Input Area & Toggle Switch Panel */}
        <div className="p-3 bg-[#FAF9F5] border-t border-[#EAE9E6] z-20">
          {/* Claude Signal Switch */}
          <div className="flex items-center justify-between mb-2 px-2.5 py-1 bg-white border border-[#EAE9E6] rounded-xl shadow-sm">
            <div className="flex items-center gap-1">
              <Sparkles size={14} className={signalEnabled ? "text-[#D97A53] animate-spin" : "text-[#A3A19E]"} />
              <span className="text-[11px] font-semibold text-[#454341]">⚡ Claude Signal</span>
            </div>
            <button 
              onClick={() => setSignalEnabled(!signalEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${signalEnabled ? 'bg-[#D97A53]' : 'bg-neutral-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${signalEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
            </button>
          </div>

          <div className="bg-white border border-[#EAE9E6] shadow-sm rounded-2xl p-2 flex flex-col">
            <textarea 
              placeholder="Chat with Claude..." 
              className="w-full bg-transparent border-none text-[14px] placeholder:text-[#A3A19E] resize-none focus:outline-none px-1 pb-1 min-h-[32px]"
              rows="1"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            ></textarea>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="w-6 h-6 rounded-full bg-[#F3F2EE] flex items-center justify-center text-[#454341] hover:bg-[#EAE9E6] transition-colors">
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="text-[#A3A19E] hover:text-[#454341] transition-colors p-1">
                  <Mic size={16} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={handleSend}
                  disabled={isStreaming}
                  className="w-7 h-7 rounded-full bg-[#252423] flex items-center justify-center text-white hover:bg-black transition-colors shadow-sm disabled:opacity-50"
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
