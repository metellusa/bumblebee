/** Template file paths */
export const CLASS_TEMPLATE = "./templates/source-files/class.txt";
export const DECORATED_CLASS_TEMPLATE = "./templates/source-files/decorated-class.txt";
export const METHOD_TEMPLATE = "./templates/source-files/method.txt";
export const DECORATED_METHOD_TEMPLATE = "./templates/source-files/decorated-method.txt";
export const APP_TS_FILE_TEMPLATE = "./templates/source-files/app-ts.txt";
export const FIELD_DESCRIPTION_TEMPLATE = "./templates/source-files/field-description.txt";
export const DESCRIBE_BLOCK_TEMPLATE = "./templates/tests/describe-block.txt";
export const SPEC_FILE_TEMPLATE = "./templates/tests/spec-file.txt";

/** Project file paths, prefixes and suffixes */
export const ADAPTER_TESTS_DIR = "src/adapters/database/tests";
export const APP_FILE_PATH = "src/app";
export const APIS_DIR = "src/api";
export const ADAPTERS_DIR = "src/adapters/database";
export const CONNECTORS_DIR = "src/adapters/connectors";
export const API_MODELS_DIR = "src/models/api";
export const ADAPTER_MODELS_DIR = "src/models/adapter";
export const CONNECTORS_MODELS_DIR = "src/models/adapters/connectors";
export const ENTITY_MODELS_DIR = "src/models/entity";
export const VALIDATION_MESSAGES_FILE_DIR = "src/models/api/shared";
export const API_TESTS_PATH_SUFFIX = "/tests";
export const CONTROLLER_TEST_FILE_SUFFIX = "controller.spec.ts";
export const SERVICE_TEST_FILE_SUFFIX = "service.spec.ts";
export const ADAPTER_TEST_FILE_SUFFIX = "adapter.spec.ts";
export const CONTROLLER_FILE_SUFFIX = "controller.ts";
export const SERVICE_FILE_SUFFIX = "service.ts";
export const DATABASE_ADAPTER_FILE_SUFFIX = "database.adapter.ts";
export const VALIDATION_MESSAGES_FILE = "validation-messages.const";

/** Libraries used in UO microservices repos */
export const CLASS_VALIDATOR_LIB = "class-validator";
export const CLASS_TRANSFORMER_LIB = "class-transformer";
export const ROUTING_CONTROLLERS_LIB = "routing-controllers";
export const UO_STATUS_CODE_LIB = "@uo/status-codes";
export const UO_TRANSFORM_DECORATORS_LIB = "@uo/transform-decorators";
export const UO_DATABASE_CONNECTORS_LIB = "@uo/database-connectors";
export const NANO = "nano";
export const CHAI = "chai";
export const MOCHA = "mocha";
export const SINON = "sinon";

/** Decorator constants */
export const IS_DEFINED = "IsDefined";
export const IS_OPTIONAL = "IsOptional";
export const IS_NOT_EMPTY = "IsNotEmpty";
export const IS_STRING = "IsString";
export const IS_NUMBER = "IsNumber";
export const IS_BOOLEAN = "IsBoolean";
export const IS_OBJECT = "IsObject"
export const IS_ARRAY = "IsArray";
export const IS_EMAIL = "IsEmail";
export const IS_PHONE_NUMBER = "IsPhoneNumber";
export const EXCLUDE = "Exclude";
export const EXPOSE = "Expose";
export const TYPE = "Type";
export const TRANSFORM_STRING = "TransformString";
export const TRANSFORM_NUMBER = "TransformNumber";
export const TRANSFORM_BOOLEAN = "TransformBoolean";
export const TRANSFORM_OBJECT = "TransformObject";
export const TRANSFORM_OBJECT_ARRAY = "TransformObjectArray";
export const TRANSFORM_STRING_STRIP_PREFIX = "TransformStringStripPrefix";
export const POST = "Post";
export const GET = "Get";
export const PUT = "Put";
export const DELETE = "Delete";
export const BODY = "Body";
export const PARAM = "Param";
export const HEADER_PARAM = "HeaderParam";
export const ON_UNDEFINED = "OnUndefined";
export const HTTP_CODE = "HttpCode";
export const JSON_CONTROLLER = "JsonController";
export const CATCH_ALL = "CatchAll";

/** Import constants */
export const CONFIGURE_DATABASE = "ConfigureDatabase";
export const DATABASE_ADAPTER = "DatabaseAdapter";
export const DOCUMENT_INSERT_RESPONSE = "DocumentInsertResponse";
export const LOGGER_VAR_NAME = "logger";
export const EXPECT = "expect";

/** Others */
export const PERSISTENT_MODEL_LABEL = "crud";
export const SWAGGER_SCHEMA_PREFIX = "components.schemas.";
export const SWAGGER_PARAMETER_PREFIX = "components.parameters.";
export const CORRELATION_ID_PARAM_DESCR = "correlationId the id used for tracking the flow of a request";
export const DATABASE_FIELDS = [{
    isRequired: true,
    name: "_id",
    type: "string",
    description: "The field that will be used to create the db _id"
}, {
    isRequired: true,
    name: "_rev",
    type: "string",
    description: "The document revision"
}, {
    isRequired: true,
    name: "model_id",
    type: "string",
    description: "This field is purposely not exposed so that it doesn't show up in the database"
}];
