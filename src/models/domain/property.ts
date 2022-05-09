export class Property {
    public isRequired: boolean;
    public name: string;
    public type: string;
    public example?: object;
    public description?: string;
    public isPrimary?: boolean;
    public properties?: Property[];
}
