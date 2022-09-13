"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApolloNextSSRVisitor = void 0;
const visitor_plugin_common_1 = require("@graphql-codegen/visitor-plugin-common");
const auto_bind_1 = __importDefault(require("auto-bind"));
class ApolloNextSSRVisitor extends visitor_plugin_common_1.ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, rawConfig, {
            apolloReactCommonImportFrom: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.apolloReactCommonImportFrom, rawConfig.reactApolloVersion === 3
                ? "@apollo/client/core"
                : "@apollo/react-common"),
            apolloReactHooksImportFrom: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.apolloReactHooksImportFrom, rawConfig.reactApolloVersion === 3
                ? "@apollo/client/core"
                : "@apollo/react-hooks"),
            apolloImportFrom: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.apolloImportFrom, rawConfig.reactApolloVersion === 3
                ? "@apollo/client/core"
                : "apollo-client"),
            reactApolloVersion: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.reactApolloVersion, 2),
            // @ts-ignore
            excludePatterns: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.excludePatterns, null),
            excludePatternsOptions: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.excludePatternsOptions, ""),
            replacePage: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.replacePage, true),
            replaceQuery: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.replaceQuery, true),
            pre: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.pre, ""),
            post: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.post, ""),
            // @ts-ignore
            customImports: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.customImports, null),
            apolloClientInstanceImport: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.apolloClientInstanceImport, ""),
            contextType: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.contextType, "any"),
            contextTypeRequired: (0, visitor_plugin_common_1.getConfigValue)(!!rawConfig.contextTypeRequired, false),
            apolloCacheImportFrom: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.apolloCacheImportFrom, rawConfig.reactApolloVersion === 3
                ? "@apollo/client/core"
                : "apollo-cache-inmemory"),
            apolloStateKey: (0, visitor_plugin_common_1.getConfigValue)(rawConfig.apolloStateKey, "apolloState"),
        });
        this.imports = new Set();
        this._externalImportPrefix = this.config.importOperationTypesFrom
            ? `${this.config.importOperationTypesFrom}.`
            : "";
        this._documents = documents;
        (0, auto_bind_1.default)(this);
    }
    getImports() {
        this.imports.add(`import * as Apollo from '${this.config.apolloImportFrom}';`);
        // @ts-ignore
        this.imports.add(this.config.reactImport);
        if (this.config.apolloClientInstanceImport) {
            this.imports.add(`import { getApolloClient ${this.config.contextType !== "any"
                ? ", " + this.config.contextType
                : ""}} from '${this.config.apolloClientInstanceImport}';`);
        }
        if (!this.config.apolloClientInstanceImport) {
            this.imports.add(`import type { NormalizedCacheObject } from '${this.config.apolloCacheImportFrom}';`);
        }
        if (this.config.customImports) {
            this.imports.add(this.config.customImports);
        }
        let baseImports = super.getImports();
        if (this.config.importDocumentNodeExternallyFrom === "same-file") {
            baseImports = baseImports.filter((importStr) => !importStr.startsWith("import * as Operations from "));
        }
        this.imports.add(`
type ServerGraphQLContext = { client?: Apollo.ApolloClient<NormalizedCacheObject>}
var context: ServerGraphQLContext = { client: undefined };
export const setGraphQLContext = (newContext: { client: Apollo.ApolloClient<NormalizedCacheObject>}) => { context = newContext }
    `);
        const hasOperations = this._collectedOperations.length > 0;
        if (!hasOperations) {
            return baseImports;
        }
        return [...baseImports, ...Array.from(this.imports)];
    }
    getDocumentNodeVariable(documentVariableName) {
        return this.config.documentMode === visitor_plugin_common_1.DocumentMode.external &&
            this.config.importDocumentNodeExternallyFrom !== "same-file"
            ? `Operations.${documentVariableName}`
            : documentVariableName;
    }
    _buildOperationPageQuery(node, documentVariableName, operationResultType, operationVariablesTypes) {
        const operationName = this.convertName(node, {
            useTypesPrefix: false,
        });
        let pageOperation = operationName;
        if (this.config.replacePage) {
            pageOperation = pageOperation.replace(/page/i, "");
        }
        if (this.config.replaceQuery) {
            pageOperation = pageOperation.replace(/query/i, "");
        }
        if (node.operation === "mutation" ||
            (this.config.excludePatterns &&
                new RegExp(this.config.excludePatterns, this.config.excludePatternsOptions).test(operationName))) {
            const getSSP = `export async function set${pageOperation}
    (options: Omit<Apollo.MutationOptions<${operationResultType}, ${operationVariablesTypes}>, 'mutation'>, ${this.config.apolloClientInstanceImport
                ? `ctx${this.config.contextTypeRequired ? "" : "?"}: ${this.config.contextType}`
                : "apolloClient?: Apollo.ApolloClient<NormalizedCacheObject>"} ){
        ${this.config.apolloClientInstanceImport
                ? "const apolloClient = getApolloClient(ctx);"
                : ""}

        const client  = apolloClient || context.client;

        if (!client) {
          throw new Error('No client instance found. Pass an Apollo.ApolloClient instance to get${pageOperation} or add a client to the context with setGraphQLContext.');
        }
        
        const data = await client.mutate<${operationResultType}>({ ...options, mutation: ${this.getDocumentNodeVariable(documentVariableName)} });

        return {
            data: data?.data,
            error: data?.errors ?? null,
        };
      }`;
            return [getSSP].filter((a) => a).join("\n");
        }
        if (node.operation === "subscription" ||
            (this.config.excludePatterns &&
                new RegExp(this.config.excludePatterns, this.config.excludePatternsOptions).test(operationName))) {
            const getSSP = `export function get${pageOperation}
    (options: Omit<Apollo.SubscriptionOptions<${operationVariablesTypes}, ${operationResultType}>, 'query'>, ${this.config.apolloClientInstanceImport
                ? `ctx${this.config.contextTypeRequired ? "" : "?"}: ${this.config.contextType}`
                : "apolloClient?: Apollo.ApolloClient<NormalizedCacheObject>"} ){
        ${this.config.apolloClientInstanceImport
                ? "const apolloClient = getApolloClient(ctx);"
                : ""}

        const client  = apolloClient || context.client;

        if (!client) {
          throw new Error('No client instance found. Pass an Apollo.ApolloClient instance to get${pageOperation} or add a client to the context with setGraphQLContext.');
        }
        
        const observable = client.subscribe<${operationResultType}>({ ...options, query: ${this.getDocumentNodeVariable(documentVariableName)} });

        return {
            observable
        };
      }`;
            return [getSSP].filter((a) => a).join("\n");
        }
        const getSSP = `export async function get${pageOperation}
    (options: Omit<Apollo.QueryOptions<${operationVariablesTypes}, ${operationResultType}>, 'query'>, ${this.config.apolloClientInstanceImport
            ? `ctx${this.config.contextTypeRequired ? "" : "?"}: ${this.config.contextType}`
            : "apolloClient?: Apollo.ApolloClient<NormalizedCacheObject>"} ){
        ${this.config.apolloClientInstanceImport
            ? "const apolloClient = getApolloClient(ctx);"
            : ""}

        const client  = apolloClient || context.client;

        if (!client) {
          throw new Error('No client instance found. Pass an Apollo.ApolloClient instance to get${pageOperation} or add a client to the context with setGraphQLContext.');
        }
        
        const data = await client.query<${operationResultType}>({ ...options, query: ${this.getDocumentNodeVariable(documentVariableName)} });

        return {
            data: data?.data,
            error: data?.error ?? data?.errors ?? null,
        };
      }`;
        return [getSSP].filter((a) => a).join("\n");
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        operationResultType = this._externalImportPrefix + operationResultType;
        operationVariablesTypes =
            this._externalImportPrefix + operationVariablesTypes;
        const pageOperation = this._buildOperationPageQuery(node, documentVariableName, operationResultType, operationVariablesTypes);
        return [pageOperation].join("\n");
    }
}
exports.ApolloNextSSRVisitor = ApolloNextSSRVisitor;
