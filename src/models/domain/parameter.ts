import { VerbElement } from "./verb-element";

export class Parameter extends VerbElement {
    public description: string;
    public in: string;
    public required: string;
}
