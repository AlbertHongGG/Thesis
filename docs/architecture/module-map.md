# Thesis Editor Module Map

## Runtime Ownership

- Root layout owns providers only.
- Shared shell owns navigation and page framing.
- Workbench screen owns file orchestration UI, restore flows, and process visualization.
- Settings screen owns knowledge-base CRUD and maintenance commands.
- Graph screen owns projection visualization and delete commands.

## Persistence-State Semantics

- `processing`: file is being analyzed and has not yet completed its application workflow.
- `committed`: graph data is persisted successfully.
- `commit-failed`: semantic analysis finished, but the graph was not committed.
- `pending-path-sync`: source path changed in the client tree and has not yet synced back to the knowledge base.
- `syncing-path`: path synchronization is in progress.
- `sync-error`: path synchronization failed.

## Legacy to Target Mapping

- `src/app/page.tsx` -> thin workbench page wrapper + `src/modules/workspace/ui/WorkbenchScreen.tsx`
- `src/app/graph/page.tsx` -> thin graph page wrapper + `src/modules/workspace/ui/GraphWorkspaceScreen.tsx`
- `src/app/settings/page.tsx` -> settings surface for knowledge-base management
- `src/composition/server/createServerApp.ts` -> `src/modules/shared/server/createAppRuntime.ts`
- `src/infrastructure/persistence/supabase/SupabaseRepositories.ts` -> split adapters under `src/modules/knowledge/server/persistence/supabase`
