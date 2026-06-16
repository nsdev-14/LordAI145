/**
 * Triple-dot pulsing typing wave — flashing purple, teal, and pink.
 * Used while LORD is generating a response.
 */
export function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1.5 px-1">
      <span
        className="h-2 w-2 rounded-full animate-bounce"
        style={{
          background: "#a855f7",
          boxShadow: "0 0 10px #a855f7",
          animationDelay: "0ms",
          animationDuration: "900ms",
        }}
      />
      <span
        className="h-2 w-2 rounded-full animate-bounce"
        style={{
          background: "#14b8a6",
          boxShadow: "0 0 10px #14b8a6",
          animationDelay: "150ms",
          animationDuration: "900ms",
        }}
      />
      <span
        className="h-2 w-2 rounded-full animate-bounce"
        style={{
          background: "#ec4899",
          boxShadow: "0 0 10px #ec4899",
          animationDelay: "300ms",
          animationDuration: "900ms",
        }}
      />
    </div>
  );
}
