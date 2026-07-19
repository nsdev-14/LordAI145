// Real React + REAL @tanstack/react-query useQuery + REAL @ai-sdk/react useChat,
// with a MOCK supabase client. This tests the actual query semantics the sync
// effect depends on (isFetching/data/notify timing), which my fake couldn't.

import { Window } from "happy-dom";
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
try { globalThis.navigator = window.navigator; } catch {}
globalThis.HTMLElement = window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ReactNS = await import("react");
const React = ReactNS.default || ReactNS;
const ReactDOMClient = await import("react-dom/client");
let act;
try { act = (await import("react-dom/test-utils")).act; } catch {}
if (!act) act = React.act || ReactNS.act || (async (cb) => { await cb(); });
const { useState, useRef, useEffect, useMemo } = React;
const { useChat } = await import("@ai-sdk/react");
const { DefaultChatTransport } = await import("ai");
const { QueryClient, QueryClientProvider, useQuery } = await import("@tanstack/react-query");

const messagesEqual = (a, b) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].role !== b[i].role) return false;
    if (JSON.stringify(a[i].parts) !== JSON.stringify(b[i].parts)) return false;
  }
  return true;
};
const makeTransport = () => new DefaultChatTransport({ api: "/x", body: () => ({}) });

// Mock supabase whose .from().select() resolves after `delayMs`
function makeSupabase(delayMs) {
  const DB = {
    conv1: [
      { id: "m1", conversation_id: "conv1", role: "user", content: "Hello", created_at: "1" },
      { id: "m2", conversation_id: "conv1", role: "assistant", content: "Hi there", created_at: "2" },
    ],
  };
  const select = () => ({
    eq: () => ({
      order: () =>
        new Promise((res) => {
          setTimeout(() => res({ data: DB.conv1, error: null }), delayMs);
        }),
    }),
  });
  return { from: () => ({ select }) };
}

function Harness({ supabase, onSettle }) {
  const [conversationId, setConversationId] = useState(null);
  const [pendingInitialSend, setPendingInitialSend] = useState(null);
  const justLoadedRef = useRef(false);

  const { data: storedMessagesData, isFetching: messagesFetching } = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const storedMessages = storedMessagesData ?? [];
  const initialMessages = useMemo(
    () => storedMessages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text", text: m.content }] })),
    [storedMessages]
  );
  const initialMessagesRef = useRef(initialMessages);
  initialMessagesRef.current = initialMessages;

  const transport = useMemo(() => makeTransport(), []);
  const { messages, setMessages } = useChat({ id: conversationId ?? "draft", messages: initialMessages, transport });

  useEffect(() => {
    if (!justLoadedRef.current) return;
    if (messagesFetching) return;
    if (storedMessagesData === undefined) return;
    if (pendingInitialSend) return;
    justLoadedRef.current = false;
    const next = initialMessagesRef.current;
    setMessages((prev) => (messagesEqual(prev, next) ? prev : next));
  }, [storedMessagesData, messagesFetching, pendingInitialSend, setMessages]);

  useEffect(() => {
    globalThis.__load = (id) => { justLoadedRef.current = true; setConversationId(id); setMessages([]); };
  });
  useEffect(() => {
    globalThis.__lastRender = { id: conversationId, chatMsgs: messages.length, fetching: messagesFetching, stored: storedMessagesData ? storedMessagesData.length : undefined };
    if (conversationId && !messagesFetching && storedMessagesData && onSettle) onSettle(globalThis.__lastRender);
  });

  return React.createElement("div", null, "chat:" + messages.length);
}

async function run(label, delayMs) {
  console.log(`\n===== ${label} (supabase delay=${delayMs}ms) =====`, { flush: true });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const supabase = makeSupabase(delayMs);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  await act(async () => {
    root.render(React.createElement(QueryClientProvider, { client: qc }, React.createElement(Harness, { supabase })));
  });
  await act(async () => { globalThis.__load("conv1"); });
  await act(async () => { await new Promise((r) => setTimeout(r, delayMs + 100)); });
  console.log("  after load + fetch:", JSON.stringify(globalThis.__lastRender));
  const ok = globalThis.__lastRender.chatMsgs === 2;
  console.log(`  >>> RESULT: ${globalThis.__lastRender.chatMsgs} msgs => ${ok ? "RENDERS OK" : "STUCK EMPTY"}`);
  await act(async () => { root.unmount(); });
  return ok;
}

const fast = await run("LOCALHOST", 5);
const slow = await run("VERCEL", 800);
console.log("\n=========== DIVERGENCE ===========", { fast, slow });
