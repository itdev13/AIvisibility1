import { ImageResponse } from "next/og";

export const alt = "Mentiq AI — When buyers ask AI, be the answer.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share card: newsprint paper, a sample AI answer, the client's name under the highlighter. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#F5F2EB", padding: "56px 72px", color: "#12100D" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #12100D", paddingBottom: 18, fontSize: 22, letterSpacing: 4 }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            Ment<span style={{ background: "#E4FF3C", padding: "0 4px" }}>iq</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "#4A453D" }}>AI VISIBILITY, DONE FOR YOU</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 54, fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
          <div style={{ display: "flex" }}>When buyers ask AI,</div>
          <div style={{ display: "flex", marginTop: 8 }}>
            <span style={{ background: "#E4FF3C", padding: "0 14px", fontStyle: "italic" }}>be the answer.</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26, color: "#38342D" }}>
          <div style={{ display: "flex", maxWidth: 720 }}>Get recommended in Claude, ChatGPT, Gemini, Perplexity and Google AI Overviews.</div>
          <div style={{ display: "flex", background: "#12100D", color: "#F5F2EB", padding: "12px 20px", fontSize: 24 }}>Free check →</div>
        </div>
      </div>
    ),
    size,
  );
}
