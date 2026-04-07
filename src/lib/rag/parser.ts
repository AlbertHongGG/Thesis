import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function parseDocument(fileBuffer: Buffer, filename: string): Promise<string> {
   const ext = filename.split('.').pop()?.toLowerCase();
   
   if (ext === 'pdf') {
       try {
           const data = await pdfParse(fileBuffer);
           return data.text;
       } catch (error) {
           console.error(`Failed to parse PDF ${filename}`, error);
           throw new Error(`PDF Parsing failed: ${error}`);
       }
   }
   
   if (ext === 'docx') {
       try {
           const data = await mammoth.extractRawText({ buffer: fileBuffer });
           return data.value;
       } catch (error) {
           console.error(`Failed to parse DOCX ${filename}`, error);
           throw new Error(`DOCX Parsing failed: ${error}`);
       }
   }
   
   if (ext === 'txt' || ext === 'csv' || ext === 'md') {
       return fileBuffer.toString('utf-8');
   }
   
   throw new Error(`Unsupported document extension for text extraction: .${ext}`);
}
