import { AppShell } from '@/modules/workspace/ui/AppShell';
import { GraphWorkspaceScreen } from '@/modules/workspace/ui/GraphWorkspaceScreen';

export default function GraphPage() {
  return (
    <AppShell section="graph">
      <GraphWorkspaceScreen />
    </AppShell>
  );
}
