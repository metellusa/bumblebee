import { VerbBodyType } from "../../enums/verb-body-type.enum";
import { Property } from "./property";
import { VerbElement } from "./verb-element";

export class VerbBody extends VerbElement {
    public type: VerbBodyType;
    public properties: Property[];
}
