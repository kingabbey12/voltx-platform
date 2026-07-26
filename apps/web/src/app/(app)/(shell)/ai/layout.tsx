import { ConversationList } from "@/components/ai/conversation-list";

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-card md:block">
        <ConversationList />
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
