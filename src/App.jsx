import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are a helpful AI assistant with expertise in prompt engineering.
When the user asks to "improve", "enhance", or "refine" a prompt, transform their brief idea into a comprehensive professional prompt with clear role, context, objectives, format, and topic-specific terminology.
Otherwise, respond as a knowledgeable, friendly AI assistant.`;

const IMPROVE_SYSTEM = `You are an expert Prompt Engineering AI. Transform the user's brief idea into a comprehensive, professional prompt.
Rules:
1. ADAPT TO THE SPECIFIC TOPIC — unique to that subject
2. Include topic-specific terminology and context
3. Add role, context, objectives, format, and specific questions
4. Make it 200-300 words, educational and detailed
5. Return ONLY the improved prompt — no explanations`;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  return first.content.slice(0, 36) + (first.content.length > 36 ? "…" : "");
}

const WELCOME = [{ role: "assistant", content: "Hi! I'm your AI assistant with built-in **Prompt Engineering** powers.\n\nChat with me normally, or switch to **⚡ Improve Mode** to transform any short idea into a professional prompt.", id: "welcome" }];

export default function ChatBot() {
  const [sessions, setSessions] = useState(() => {
    try {
      const raw = localStorage.getItem("chat_sessions");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState(WELCOME);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist sessions
  useEffect(() => {
    try { localStorage.setItem("chat_sessions", JSON.stringify(sessions)); } catch {}
  }, [sessions]);

  const saveSession = (msgs, id) => {
    if (msgs.length <= 1) return;
    const realId = id || generateId();
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === realId);
      if (exists) {
        return prev.map((s) => s.id === realId ? { ...s, messages: msgs, title: getTitle(msgs), updatedAt: Date.now() } : s);
      }
      return [{ id: realId, title: getTitle(msgs), messages: msgs, updatedAt: Date.now() }, ...prev];
    });
    return realId;
  };

  const loadSession = (session) => {
    setActiveId(session.id);
    setMessages(session.messages);
    inputRef.current?.focus();
  };

  const newChat = () => {
    if (messages.length > 1) saveSession(messages, activeId);
    setActiveId(null);
    setMessages(WELCOME);
    setInput("");
    inputRef.current?.focus();
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) { setActiveId(null); setMessages(WELCOME); }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, id: generateId() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const sysPrompt = mode === "improve" ? IMPROVE_SYSTEM : SYSTEM_PROMPT;
    const userContent = mode === "improve" ? `Transform this into a detailed, professional prompt: "${text}"` : text;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: sysPrompt,
          messages: [
            ...messages.filter(m => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const reply = data.content?.[0]?.text || "No response received.";
      const assistantMsg = { role: "assistant", content: reply, id: generateId(), isImproved: mode === "improve" };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      const sid = saveSession(finalMessages, activeId);
      if (!activeId) setActiveId(sid);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}`, id: generateId(), isError: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const renderContent = (text) =>
    text.split("\n").map((line, i, arr) => (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
        {i < arr.length - 1 && <br />}
      </span>
    ));

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const groupSessions = () => {
    const now = Date.now();
    const day = 86400000;
    const today = [], yesterday = [], older = [];
    filteredSessions.forEach((s) => {
      const diff = now - s.updatedAt;
      if (diff < day) today.push(s);
      else if (diff < 2 * day) yesterday.push(s);
      else older.push(s);
    });
    return { today, yesterday, older };
  };

  const { today, yesterday, older } = groupSessions();

  const SectionLabel = ({ label }) => label ? (
    <div style={{ fontSize: "9px", color: "#2d3f55", letterSpacing: "0.1em", padding: "10px 12px 4px", textTransform: "uppercase" }}>{label}</div>
  ) : null;

  const SessionItem = ({ s }) => (
    <div
      onClick={() => loadSession(s)}
      style={{
        padding: "9px 12px", cursor: "pointer", borderRadius: "7px", margin: "1px 6px",
        background: activeId === s.id ? "#161f2e" : "transparent",
        border: activeId === s.id ? "1px solid #1e3a5f" : "1px solid transparent",
        display: "flex", alignItems: "center", gap: "8px", transition: "all 0.15s",
        position: "relative",
      }}
      onMouseEnter={e => { if (activeId !== s.id) e.currentTarget.style.background = "#0f1923"; }}
      onMouseLeave={e => { if (activeId !== s.id) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: "12px", flexShrink: 0 }}>💬</span>
      <span style={{ fontSize: "11.5px", color: activeId === s.id ? "#93c5fd" : "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
      <button
        onClick={(e) => deleteSession(s.id, e)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#2d3f55", fontSize: "13px", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
        title="Delete"
      >×</button>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0f", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#e2e8f0", overflow: "hidden" }}>

      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? "240px" : "0px",
        minWidth: sidebarOpen ? "240px" : "0px",
        transition: "all 0.25s ease",
        overflow: "hidden",
        background: "#0d1117",
        borderRight: "1px solid #1e2a3a",
        display: "flex", flexDirection: "column",
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid #1a2433" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "6px", background: "linear-gradient(135deg, #0ea5e9, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>🧠</div>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#f0f6ff", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>Prompt AI</span>
          </div>
          <button
            onClick={newChat}
            style={{
              width: "100%", padding: "8px", background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
              border: "none", borderRadius: "7px", color: "#fff", fontFamily: "inherit",
              fontSize: "11px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.05em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
          >
            + NEW CHAT
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "8px 10px", borderBottom: "1px solid #1a2433" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            style={{
              width: "100%", padding: "6px 10px", background: "#161b22",
              border: "1px solid #1e2a3a", borderRadius: "6px", color: "#94a3b8",
              fontSize: "11px", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: "8px" }}>
          {sessions.length === 0 ? (
            <div style={{ padding: "20px 14px", fontSize: "11px", color: "#2d3f55", textAlign: "center", lineHeight: "1.6" }}>
              No chat history yet.<br />Start a conversation!
            </div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ padding: "20px 14px", fontSize: "11px", color: "#2d3f55", textAlign: "center" }}>No results found</div>
          ) : (
            <>
              {today.length > 0 && <><SectionLabel label="Today" />{today.map(s => <SessionItem key={s.id} s={s} />)}</>}
              {yesterday.length > 0 && <><SectionLabel label="Yesterday" />{yesterday.map(s => <SessionItem key={s.id} s={s} />)}</>}
              {older.length > 0 && <><SectionLabel label="Older" />{older.map(s => <SessionItem key={s.id} s={s} />)}</>}
            </>
          )}
        </div>

        {/* Sidebar Footer */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid #1a2433" }}>
          <div style={{ fontSize: "10px", color: "#2d3f55", letterSpacing: "0.05em" }}>
            {sessions.length} chat{sessions.length !== 1 ? "s" : ""} saved
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top Bar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e2a3a", display: "flex", alignItems: "center", gap: "10px", background: "#0d1117" }}>
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "6px", color: "#4a6080", fontSize: "16px", lineHeight: 1, display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", justifyContent: "center" }}
            title="Toggle sidebar"
          >
            <div style={{ width: "18px", height: "2px", background: sidebarOpen ? "#0ea5e9" : "#4a6080", borderRadius: "2px", transition: "background 0.2s" }} />
            <div style={{ width: "18px", height: "2px", background: sidebarOpen ? "#0ea5e9" : "#4a6080", borderRadius: "2px", transition: "background 0.2s" }} />
            <div style={{ width: "18px", height: "2px", background: sidebarOpen ? "#0ea5e9" : "#4a6080", borderRadius: "2px", transition: "background 0.2s" }} />
          </button>

          <div style={{ flex: 1, fontSize: "12px", color: "#4a6080", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeId ? getTitle(messages) : "New Chat"}
          </div>

          {/* Mode toggle */}
          <button
            onClick={() => setMode(mode === "chat" ? "improve" : "chat")}
            style={{
              padding: "5px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
              fontSize: "10px", fontFamily: "inherit", fontWeight: "700",
              background: mode === "improve" ? "linear-gradient(135deg, #f59e0b, #ef4444)" : "#1e2a3a",
              color: mode === "improve" ? "#fff" : "#64748b",
              letterSpacing: "0.04em", transition: "all 0.2s", whiteSpace: "nowrap",
            }}
          >
            {mode === "improve" ? "⚡ IMPROVE" : "💬 CHAT"}
          </button>

          {/* New chat shortcut */}
          <button
            onClick={newChat}
            style={{ background: "#161b22", border: "1px solid #1e2a3a", borderRadius: "7px", cursor: "pointer", padding: "5px 10px", color: "#4a6080", fontSize: "11px", fontFamily: "inherit", whiteSpace: "nowrap" }}
            title="New chat"
          >
            + New
          </button>
        </div>

        {/* Improve mode banner */}
        {mode === "improve" && (
          <div style={{ padding: "6px 16px", background: "rgba(245,158,11,0.07)", borderBottom: "1px solid rgba(245,158,11,0.18)", fontSize: "10px", color: "#f59e0b", letterSpacing: "0.06em" }}>
            ⚡ IMPROVE MODE — Type a short idea, I'll turn it into a professional prompt
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "9px", alignItems: "flex-start" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                background: msg.role === "user" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "linear-gradient(135deg,#0ea5e9,#06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: "700", color: "#fff",
              }}>
                {msg.role === "user" ? "U" : "AI"}
              </div>
              <div style={{ maxWidth: "76%" }}>
                <div style={{
                  padding: "11px 15px",
                  borderRadius: msg.role === "user" ? "14px 3px 14px 14px" : "3px 14px 14px 14px",
                  background: msg.role === "user" ? "linear-gradient(135deg,#1e1b4b,#312e81)" : msg.isError ? "#1a0808" : msg.isImproved ? "#0b1f10" : "#0d1117",
                  border: `1px solid ${msg.isError ? "#3f1010" : msg.isImproved ? "#14532d" : msg.role === "user" ? "#3730a3" : "#1e2a3a"}`,
                  fontSize: "13px", lineHeight: "1.75", color: msg.isError ? "#f87171" : "#d1d5db",
                }}>
                  {msg.isImproved && <div style={{ fontSize: "9px", color: "#22c55e", marginBottom: "8px", letterSpacing: "0.12em" }}>✨ IMPROVED PROMPT</div>}
                  {renderContent(msg.content)}
                </div>
                {msg.isImproved && (
                  <button onClick={() => navigator.clipboard.writeText(msg.content)}
                    style={{ marginTop: "5px", padding: "4px 10px", background: "transparent", border: "1px solid #14532d", borderRadius: "4px", color: "#22c55e", fontSize: "10px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
                    📋 COPY PROMPT
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: "9px", alignItems: "flex-start" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "#fff", flexShrink: 0 }}>AI</div>
              <div style={{ padding: "13px 18px", background: "#0d1117", borderRadius: "3px 14px 14px 14px", border: "1px solid #1e2a3a", display: "flex", gap: "5px", alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0ea5e9", animation: `dp 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ padding: "0 18px 10px", display: "flex", gap: "7px", flexWrap: "wrap" }}>
            {(mode === "improve"
              ? ["data analyst roadmap", "machine learning basics", "marketing strategy", "python for beginners"]
              : ["What can you help me with?", "Explain prompt engineering", "Write a Python script", "Help me brainstorm ideas"]
            ).map((s) => (
              <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                style={{ padding: "5px 11px", background: "transparent", border: "1px solid #1e2a3a", borderRadius: "20px", color: "#4a6080", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e2a3a", background: "#0d1117" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={mode === "improve" ? "Enter a short idea... (e.g. 'data analyst roadmap')" : "Message AI... (Enter to send, Shift+Enter for new line)"}
              rows={2}
              style={{
                flex: 1, padding: "11px 14px", background: "#161b22",
                border: "1px solid #1e2a3a", borderRadius: "10px",
                color: "#e2e8f0", fontSize: "13px", fontFamily: "inherit",
                resize: "none", outline: "none", lineHeight: "1.6",
              }}
              onFocus={e => e.target.style.borderColor = "#0ea5e9"}
              onBlur={e => e.target.style.borderColor = "#1e2a3a"}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                padding: "11px 18px", borderRadius: "10px", border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                background: loading || !input.trim() ? "#1a2030"
                  : mode === "improve" ? "linear-gradient(135deg,#f59e0b,#ef4444)"
                  : "linear-gradient(135deg,#0ea5e9,#6366f1)",
                color: loading || !input.trim() ? "#2d3f55" : "#fff",
                fontFamily: "inherit", fontWeight: "700", fontSize: "12px",
                letterSpacing: "0.04em", transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              {loading ? "···" : mode === "improve" ? "⚡" : "SEND →"}
            </button>
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: "#2d3f55", textAlign: "center", letterSpacing: "0.04em" }}>
            SHIFT+ENTER for new line · ENTER to send
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dp{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e2a3a;border-radius:2px}
        input::placeholder{color:#2d3f55}
      `}</style>
    </div>
  );
}
