declare module 'pdf-parse-fork' {
  function pdf(dataBuffer: Buffer): Promise<{
    numpages: number;
    text: string;
    info: any;
    metadata: any;
    version: string;
  }>;
  export = pdf;
}

