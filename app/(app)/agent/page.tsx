import { AgentPanel } from "@/components/agent/agent-panel";

export const metadata = { title: "Agent — fobs" };

export default function AgentPage() {
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <AgentPanel />
      <div className="card">
        <p className="muted" style={{ fontSize: 11 }}>
          The same agent is being packaged for BNB Agent Studio (commands like <span className="chip">/fobs market NVDA</span> and{" "}
          <span className="chip">/fobs analyze</span>), so it can run as a first-class agent outside the app. Its wallet-confirmation
          boundary is identical there — it prepares, your wallet authorizes.
        </p>
      </div>
    </div>
  );
}
