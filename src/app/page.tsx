import { AppShell } from '@/modules/workspace/ui/AppShell';
import { WorkbenchScreen } from '@/modules/workspace/ui/WorkbenchScreen';

export default function Page() {
  return (
    <AppShell section="workbench">
      <WorkbenchScreen />
    </AppShell>
  );
}
