import { IsArray, IsDefined, IsOptional, IsString } from "class-validator";
import { Path } from "./path";
import { VerbElement } from "./verb-element";

export class Swagger {
    @IsDefined()
    @IsString()
    public targetLocation: string;

    @IsDefined()
    @IsArray()
    public tags: string[];

    @IsDefined()
    @IsArray()
    public paths: Path[];

    @IsDefined()
    @IsArray()
    public components: Map<string, VerbElement>;

    @IsOptional()
    @IsArray()
    public connectors: string[];
}
