"use client";

import { useState } from "react";
import {
  Activity,
  Brain,
  Database,
  Puzzle,
  Settings2,
  Shield,
  Sliders,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProvidersSection } from "./_sections/providers";
import { ModelsSection } from "./_sections/models";
import { AgentDefaultsSection } from "./_sections/agent-defaults";
import { KnowledgeDefaultsSection } from "./_sections/knowledge-defaults";
import { WorkflowDefaultsSection } from "./_sections/workflow-defaults";
import { UsageLimitsSection } from "./_sections/usage-limits";
import { SecuritySection } from "./_sections/security";
import { SystemSection } from "./_sections/system";

const SECTIONS = [
  { key: "providers", label: "Providers", icon: Puzzle },
  { key: "models", label: "Models", icon: Brain },
  { key: "agent-defaults", label: "Agent Defaults", icon: Bot },
  { key: "knowledge-defaults", label: "Knowledge Defaults", icon: Database },
  { key: "workflow-defaults", label: "Workflow Defaults", icon: Activity },
  { key: "usage-limits", label: "Usage & Limits", icon: Sliders },
  { key: "security", label: "Security", icon: Shield },
  { key: "system", label: "System", icon: Settings2 },
];

export default function AiSettingsPage() {
  const [activeSection, setActiveSection] = useState("providers");

  function renderSection() {
    switch (activeSection) {
      case "providers":
        return <ProvidersSection />;
      case "models":
        return <ModelsSection />;
      case "agent-defaults":
        return <AgentDefaultsSection />;
      case "knowledge-defaults":
        return <KnowledgeDefaultsSection />;
      case "workflow-defaults":
        return <WorkflowDefaultsSection />;
      case "usage-limits":
        return <UsageLimitsSection />;
      case "security":
        return <SecuritySection />;
      case "system":
        return <SystemSection />;
      default:
        return <ProvidersSection />;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="AI Settings"
        description="Configure AI providers, models, defaults, limits, and system preferences."
        className="mb-6"
      />

      <div className="flex gap-8">
        {/* Sidebar nav */}
        <nav className="hidden w-52 shrink-0 lg:block">
          <div className="flex flex-col gap-1">
            {SECTIONS.map((section) => {
              const active = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-2 lg:hidden">
          {SECTIONS.map((section) => {
            const active = activeSection === section.key;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">{renderSection()}</div>
      </div>
    </div>
  );
}

function Bot({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="14" x="3" y="4" rx="2" ry="2" />
      <circle cx="9" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
      <path d="M9 15c0 .5 1 1 3 1s3-.5 3-1" />
      <path d="M12 2v2" />
      <path d="M12 18v4" />
    </svg>
  );
}
