import { AppShell } from "@/components/layout/AppShell";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";

export default function HomePage() {
  return (
    <AppShell>
      <DashboardScreen />
    </AppShell>
  );
}
