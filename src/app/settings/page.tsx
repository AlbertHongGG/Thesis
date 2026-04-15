import { KnowledgeBaseManagementScreen } from '@/modules/knowledge-base/ui/KnowledgeBaseManagementScreen';
import { AppShell } from '@/modules/workspace/ui/AppShell';

export default function SettingsPage() {
  return (
    <AppShell section="settings">
      <KnowledgeBaseManagementScreen />
    </AppShell>
  );
}