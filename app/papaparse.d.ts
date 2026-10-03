declare module "papaparse" {
  const Papa: {
    parse: (text: string, options: { header: boolean; skipEmptyLines: boolean }) => { data: Record<string, string>[]; errors: { message: string }[]; meta: { fields?: string[] } };
    unparse: (data: Record<string, unknown>[], options?: { escapeFormulae: boolean }) => string;
  };
  export default Papa;
}
