declare module 'word-extractor' {
  interface WordDocument {
    getBody(): string;
    getFootnotes(): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
    getAnnotations(): string;
    getTextboxes(options?: { includeHeadersAndFooters?: boolean }): string;
  }

  class WordExtractor {
    extract(input: Buffer | string): Promise<WordDocument>;
  }

  export = WordExtractor;
}
