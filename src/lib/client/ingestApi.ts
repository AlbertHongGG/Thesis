import { requestResponse } from './http';

export async function startIngestRequest(input: {
  file: File;
  knowledgeBaseId: string;
  filePath: string;
}) {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('knowledgeBaseId', input.knowledgeBaseId);
  formData.append('filePath', input.filePath);

  return requestResponse('/api/ingest', {
    method: 'POST',
    body: formData,
  });
}