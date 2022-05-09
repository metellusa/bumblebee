import { Body, JsonController, OnUndefined, Post } from "routing-controllers";
import { SubmitSwaggerRequest } from "../models/api/submit-swagger-request";
import { SubmitSwaggerResponse } from "../models/api/submit-swagger-response";
import { Swagger } from "../models/domain/swagger";
import ActionsService from "./actions.service";
import SourceCodeService from "./source-code.service";
import UnitTestService from "./unit-test.service";

@JsonController()
export default class ActionsController {
    /**
     * @description Submit the swagger for which files are to be generated
     * @param requestBody the request body
     * @returns { SubmitSwaggerRequest } returns the swagger data
     */
    @Post("/submit-swagger")
    @OnUndefined(200)
    public async submitSwagger(
        @Body({ required: true }) requestBody: SubmitSwaggerRequest
    ): Promise<SubmitSwaggerResponse> {
        const operationId = "ActionsController.SubmitSwagger";

        return ActionsService.submitSwagger(requestBody);
    }

    /**
     * @description Generate unit test files for a given swagger
     * @param requestBody the request body
     * @returns { void } returns nothing
     */
    @Post("/generate-unit-tests")
    @OnUndefined(200)
    public async generateUnitTestFiles(
        @Body({ required: true }) requestBody: Swagger
    ): Promise<void> {
        const operationId = "ActionsController.generateUnitTestFiles";

        UnitTestService.generateUnitTestFiles(requestBody);
    }

    /**
     * @description Generate source code template files for a given swagger
     * @param requestBody the request body
     * @returns { void } returns nothing
     */
    @Post("/generate-code-files")
    @OnUndefined(200)
    public async generateCodeFiles(
        @Body({ required: true }) requestBody: Swagger
    ): Promise<void> {
        const operationId = "ActionsController.generateCodeFiles";

        SourceCodeService.generateCodeFiles(requestBody);
    }
}
