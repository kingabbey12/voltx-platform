import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LaunchExperience } from "@/components/launch/launch-experience";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LaunchExperience />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
