# Thesis Editor Architecture Charter

## Goal

The system is rebuilt as a modular monolith with a single source of truth for knowledge-base selection, staged ingestion workflows, explicit persistence-state semantics, and thin App Router pages and route handlers.

## Modules

- `src/modules/ingest`: Source intake, parsing, context retrieval, semantic analysis, relation construction, and commit orchestration.
- `src/modules/knowledge-base`: Knowledge-base lifecycle, profile maintenance, reindexing, and path updates.
- `src/modules/graph`: Graph projections and graph mutation commands.
- `src/modules/search`: Retrieval-oriented query workflows.
- `src/modules/workspace`: Client orchestration for file queue, restore flow, path sync, preview state, and screen composition.
- `src/modules/shared`: Shared client/server runtime, shell state, errors, and boundary helpers.
- `src/modules/knowledge/server/persistence`: Persistence adapters, mappers, and transactional writers.

## Dependency Rules

- UI screens depend on module client controllers and view models, not raw route handlers.
- App Router pages depend on shell components and screen components only.
- Route handlers depend on the server composition root only.
- Server composition may wire modules together, but modules may not import page, route, or component code.
- Persistence adapters may depend on domain/application contracts, but application modules may not depend on SQL or Supabase implementation details.

## Cross-Cutting Rules

- Knowledge-base selection is owned by a shared workspace provider, not duplicated per page.
- Knowledge-base management has its own surface and is not embedded as a modal inside the workbench.
- Ingest UI must distinguish analysis progress from persistence commit state.
- Derived cross-source graph links are read-time projections, not durable domain facts.
- Temporary migration shims are allowed only while code is being moved and must be deleted before completion.

## Cutover Rules

- `src/application/services/*` is a legacy area to be deleted after feature parity is reached in `src/modules/*`.
- `src/composition/server/createServerApp.ts` is replaced by the new composition root.
- `src/infrastructure/persistence/supabase/SupabaseRepositories.ts` is replaced by split adapters.
- `src/lib/workbench/ingestQueue.ts` may stay temporarily during the client refactor, but the duplicated serialization logic must be removed and the page layer must stop owning KB lifecycle.
