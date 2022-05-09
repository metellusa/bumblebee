import { IsDefined, IsString } from "class-validator";

export class SubmitSwaggerRequest {
    
    @IsDefined()
    @IsString()
    public filePath: string;
}
