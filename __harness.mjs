// Real React harness using the ACTUAL @ai-sdk/react useChat + react-dom/client
// in happy-dom. Replicates the EXACT chat.tsx state logic (sync effect,
// loadConversation, messages query semantics) to find the first localhost<->prod
// divergence. We control fetch latency to simulate localhost (fast) vs Vercel.

import { Window } from "happy-dom";
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
try { globalThis.navigator = window.navigator; } catch {}
globalThis.HTMLElement = window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { useState, useRef, useEffect, useMemo } = React;
const ReactDOMClient = await import("react-dom/client");
const { act } = await import("react-dom/test-utils").catch(() => ({}));
const { useChat } = await import("@ai-sdk/react");
const { DefaultChatTransport } = await import("ai");

const messagesEqual = (a, b) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].role !== b[i].role) return false;
    if (JSON.stringify(a[i].parts) !== JSON.stringify(b[i].parts)) return false;
  }
  return true;
};

// fake transport that does nothing (we only test message LOADING, not sending)
function makeTransport() {
  return new DefaultChatTransport({ api: "/x", body: () => ({}) });
}

// controllable async messages "query"
function makeQueryController() {
  let resolvers = [];
  const controller = {
    fetchMs: 5,
    pending: false,
    trigger() {
      this.pending = true;
      setTimeout(() => {
        this.pending = false;
        const r = resolvers;
        resolvers = [];
        r.forEach((res) => res());
      }, this.fetchMs);
    },
    awaitFetch: () => new Promise((res) => resolvers.push(res)),
  };
  return controller;
}

function Harness({ fetchMs, onResult }) {
  const qc = makeQueryController();
  qc.fetchMs = fetchMs;

  const [conversationId, setConversationId] = useState(null);
  const [pendingInitialSend, setPendingInitialSend] = useState(null);
  const justLoadedRef = useRef(false);

  // messages query semantics
  const [storedMessagesData, setStored] = useState(undefined);
  const [messagesFetching, setFetching] = useState(false);
  useEffect(() => {
    if (!conversationId) return;
    setFetching(true);
    qc.trigger();
    let cancelled = false;
    qc.awaitFetch().then(() => {
      if (cancelled) return;
      const DB = [
        { id: "m1", role: "user", content: "Hello" },
        { id: "m2", role: "assistant", content: "Hi there" },
      ];
      setStored(DB);
      setFetching(false);
    });
    return () => { cancelled = true; };
  }, [conversationId]);

  const storedMessages = storedMessagesData ?? [];
  const initialMessages = useMemo(
    () =>
      storedMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text", text: m.content }] })),
    [storedMessages]
  );
  const initialMessagesRef = useRef(initialMessages);
  initialMessagesRef.current = initialMessages;

  const transport = useMemo(() => makeTransport(), []);
  const { messages, setMessages } = useChat({
    id: conversationId ?? "draft",
    messages: initialMessages,
    transport,
  });

  // EXACT original sync effect
  useEffect(() => {
    if (!justLoadedRef.current) return;
    if (messagesFetching) return;
    if (storedMessagesData === undefined) return;
    if (pendingInitialSend) return;
    justLoadedRef.current = false;
    const next = initialMessagesRef.current;
    setMessages((prev) => (messagesEqual(prev, next) ? prev : next));
  }, [storedMessagesData, messagesFetching, pendingInitialSend, setMessages]);

  // expose a global "click"
  useEffect(() => {
    globalThis.__load = (id) => {
      justLoadedRef.current = true;
      setConversationId(id);
      setMessages([]);
    };
  });

  // report
  useEffect(() => {
    globalThis.__lastRender = { id: conversationId, chatMsgs: messages.length, fetching: messagesFetching, stored: storedMessagesData?.length };
  });

  return React.createElement("div", null, "chat:" + messages.length);
}

async function run(label, fetchMs) {
  console.log(`\n===== ${label} (fetchMs=${fetchMs}) =====`);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  await act(async () => { root.render(React.createElement(Harness, { fetchMs, onResult: () => {} })); });
  console.log("  mount:", JSON.stringify(globalThis.__lastRender));
  await act(async () => { globalThis.__load("conv-1"); });
  // allow the fake fetch to resolve
  await act(async () => { await new Promise((r) => setTimeout(r, fetchMs + 50)); });
  console.log("  after load + fetch:", JSON.stringify(globalThis.__lastRender));
  const ok = globalThis.__lastRender.chatMsgs === 2;
  console.log(`  >>> RESULT: ${globalThis.__lastRender.chatMsgs} msgs => ${ok ? "RENDERS OK" : "STUCK EMPTY"}`);
  await act(async () => { root.unmount(); });
  return ok;
}

const fast = await run("LOCALHOST", 5);
const slow = await run("VERCEL", 800);
console.log("\n=========== DIVERGENCE ===========");
console.log({ fast, slow });
