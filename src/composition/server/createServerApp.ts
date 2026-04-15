import { ConfigurationError } from '@/domain/knowledge/errors';
import { supabaseAdmin } from '@/lib/supabase';
import { createIngestAiProvider } from '@/infrastructure/ai/IngestAiProvider';
import { SemanticTextChunker } from '@/infrastructure/chunking/SemanticTextChunker';
import { DocumentContentParser } from '@/infrastructure/parsing/DocumentContentParser';
import { createIngestModuleConfig } from '@/infrastructure/prompts/IngestPromptCatalog';
import {
  SupabaseKnowledgeBaseRepository,
  SupabaseKnowledgeOperationRepository,
  SupabaseKnowledgeProfileRepository,
  SupabaseKnowledgeRelationRepository,
  SupabaseKnowledgeSourceRepository,
  SupabaseKnowledgeUnitRepository,
} from '@/infrastructure/persistence/supabase/SupabaseRepositories';
import { GraphApplicationService } from '@/application/services/GraphApplicationService';
import { IngestApplicationService } from '@/application/services/IngestApplicationService';
import { KnowledgeBaseApplicationService } from '@/application/services/KnowledgeBaseApplicationService';
import { KnowledgeProfileRefreshService } from '@/application/services/KnowledgeProfileRefreshService';
import { ProfileSummarizationService } from '@/application/services/ProfileSummarizationService';
import { SearchApplicationService } from '@/application/services/SearchApplicationService';

function assertDatabaseConfigured(env: NodeJS.ProcessEnv = process.env) {
  if (!(env.SUPABASE_URL ?? '').trim() || !(env.SUPABASE_SERVICE_ROLE ?? '').trim()) {
    throw new ConfigurationError('Supabase credentials are required.');
  }
}

export function assertDatabaseWriteEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.ENABLE_DB_WRITE !== 'true') {
    throw new ConfigurationError('This operation requires ENABLE_DB_WRITE=true.');
  }
}

export function createServerApp(env: NodeJS.ProcessEnv = process.env) {
  assertDatabaseConfigured(env);

  const aiProvider = createIngestAiProvider(env);
  const moduleConfig = createIngestModuleConfig();
  const knowledgeBaseRepository = new SupabaseKnowledgeBaseRepository(supabaseAdmin);
  const sourceRepository = new SupabaseKnowledgeSourceRepository(supabaseAdmin);
  const unitRepository = new SupabaseKnowledgeUnitRepository(supabaseAdmin);
  const relationRepository = new SupabaseKnowledgeRelationRepository(supabaseAdmin);
  const operationRepository = new SupabaseKnowledgeOperationRepository(supabaseAdmin);
  const profileRepository = new SupabaseKnowledgeProfileRepository(supabaseAdmin);
  const profileSummarizationService = new ProfileSummarizationService(aiProvider, moduleConfig.prompts.knowledgeProfile);
  const profileRefreshService = new KnowledgeProfileRefreshService(profileRepository, sourceRepository, profileSummarizationService);

  return {
    knowledgeBaseService: new KnowledgeBaseApplicationService(
      knowledgeBaseRepository,
      sourceRepository,
      unitRepository,
      relationRepository,
      operationRepository,
      aiProvider,
      profileRefreshService,
    ),
    ingestService: new IngestApplicationService(
      aiProvider,
      moduleConfig.prompts,
      new DocumentContentParser(),
      new SemanticTextChunker(),
      sourceRepository,
      profileRepository,
      unitRepository,
      relationRepository,
      operationRepository,
      profileRefreshService,
    ),
    searchService: new SearchApplicationService(aiProvider, unitRepository),
    graphService: new GraphApplicationService(sourceRepository, unitRepository, relationRepository),
  };
}
