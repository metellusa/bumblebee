
export class SourceFile {
    public folder: string;
    public file: string;
    public method: string;
    public methodName: string;
    public decoratorImports?: Map<string, Set<string>>;
    public classImports: string[];
    public className: string;
    public classDescription: string;
    public classDecorators?: string[];
}
