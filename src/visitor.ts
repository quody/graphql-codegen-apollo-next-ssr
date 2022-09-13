import { Types } from "@graphql-codegen/plugin-helpers";
import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  getConfigValue,
  LoadedFragment,
  DocumentMode,
} from "@graphql-codegen/visitor-plugin-common";

import autoBind from "auto-bind";
import { GraphQLSchema, OperationDefinitionNode } from "graphql";
import { ApolloNextSSRRawPluginConfig, Config } from "./config";

export type ApolloNextSSRPluginConfig = ClientSideBasePluginConfig & Config;

export class ApolloNextSSRVisitor extends ClientSideBaseVisitor<
  ApolloNextSSRRawPluginConfig,
  ApolloNextSSRPluginConfig
> {
  private _externalImportPrefix: string;
  private imports = new Set<string>();

  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: ApolloNextSSRRawPluginConfig,
    documents: Types.DocumentFile[]
  ) {
    super(schema, fragments, rawConfig, {
      apolloReactCommonImportFrom: getConfigValue(
        rawConfig.apolloReactCommonImportFrom,
        rawConfig.reactApolloVersion === 3
          ? "@apollo/client/core"
          : "@apollo/react-common"
      ),

      apolloReactHooksImportFrom: getConfigValue(
        rawConfig.apolloReactHooksImportFrom,
        rawConfig.reactApolloVersion === 3
          ? "@apollo/client/core"
          : "@apollo/react-hooks"
      ),
      apolloImportFrom: getConfigValue(
        rawConfig.apolloImportFrom,
        rawConfig.reactApolloVersion === 3
          ? "@apollo/client/core"
          : "apollo-client"
      ),

      reactApolloVersion: getConfigValue(rawConfig.reactApolloVersion, 2),
      // @ts-ignore
      excludePatterns: getConfigValue(rawConfig.excludePatterns, null),
      excludePatternsOptions: getConfigValue(
        rawConfig.excludePatternsOptions,
        ""
      ),

      replacePage: getConfigValue(rawConfig.replacePage, true),
      replaceQuery: getConfigValue(rawConfig.replaceQuery, true),
      pre: getConfigValue(rawConfig.pre, ""),
      post: getConfigValue(rawConfig.post, ""),
      // @ts-ignore
      customImports: getConfigValue(rawConfig.customImports, null),

      apolloClientInstanceImport: getConfigValue(
        rawConfig.apolloClientInstanceImport,
        ""
      ),
      contextType: getConfigValue(rawConfig.contextType, "any"),
      contextTypeRequired: getConfigValue(
        !!rawConfig.contextTypeRequired,
        false
      ),
      apolloCacheImportFrom: getConfigValue(
        rawConfig.apolloCacheImportFrom,
        rawConfig.reactApolloVersion === 3
          ? "@apollo/client/core"
          : "apollo-cache-inmemory"
      ),
      apolloStateKey: getConfigValue(rawConfig.apolloStateKey, "apolloState"),
    });

    this._externalImportPrefix = this.config.importOperationTypesFrom
      ? `${this.config.importOperationTypesFrom}.`
      : "";
    this._documents = documents;

    autoBind(this);
  }

  public getImports(): string[] {
    this.imports.add(
      `import * as Apollo from '${this.config.apolloImportFrom}';`
    );
    // @ts-ignore
    this.imports.add(this.config.reactImport);

    if (this.config.apolloClientInstanceImport) {
      this.imports.add(
        `import { getApolloClient ${
          this.config.contextType !== "any"
            ? ", " + this.config.contextType
            : ""
        }} from '${this.config.apolloClientInstanceImport}';`
      );
    }
    if (!this.config.apolloClientInstanceImport) {
      this.imports.add(
        `import type { NormalizedCacheObject } from '${this.config.apolloCacheImportFrom}';`
      );
    }
    if (this.config.customImports) {
      this.imports.add(this.config.customImports);
    }

    let baseImports = super.getImports();
    if (this.config.importDocumentNodeExternallyFrom === "same-file") {
      baseImports = baseImports.filter(
        (importStr) => !importStr.startsWith("import * as Operations from ")
      );
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

  private getDocumentNodeVariable(documentVariableName: string): string {
    return this.config.documentMode === DocumentMode.external &&
      this.config.importDocumentNodeExternallyFrom !== "same-file"
      ? `Operations.${documentVariableName}`
      : documentVariableName;
  }

  private _buildOperationPageQuery(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    const operationName: string = this.convertName(node, {
      useTypesPrefix: false,
    });

    let pageOperation = operationName;
    if (this.config.replacePage) {
      pageOperation = pageOperation.replace(/page/i, "");
    }
    if (this.config.replaceQuery) {
      pageOperation = pageOperation.replace(/query/i, "");
    }

    if (
      node.operation === "mutation" ||
      (this.config.excludePatterns &&
        new RegExp(
          this.config.excludePatterns,
          this.config.excludePatternsOptions
        ).test(operationName))
    ) {
      const getSSP = `export async function set${pageOperation}
    (options: Omit<Apollo.QueryOptions<${operationVariablesTypes}>, 'mutation'>, ${
        this.config.apolloClientInstanceImport
          ? `ctx${this.config.contextTypeRequired ? "" : "?"}: ${
              this.config.contextType
            }`
          : "apolloClient?: Apollo.ApolloClient<NormalizedCacheObject>"
      } ){
        ${
          this.config.apolloClientInstanceImport
            ? "const apolloClient = getApolloClient(ctx);"
            : ""
        }

        const client  = apolloClient || context.client;

        if (!client) {
          throw new Error('No client instance found. Pass an Apollo.ApolloClient instance to get${pageOperation} or add a client to the context with setGraphQLContext.');
        }
        
        const data = await client.mutate<${operationResultType}>({ ...options, mutation: ${this.getDocumentNodeVariable(
        documentVariableName
      )} });

        return {
            data: data?.data,
            error: data?.error ?? data?.errors ?? null,
        };
      }`;
      return [getSSP].filter((a) => a).join("\n");
    }

    if (
      node.operation === "subscription" ||
      (this.config.excludePatterns &&
        new RegExp(
          this.config.excludePatterns,
          this.config.excludePatternsOptions
        ).test(operationName))
    ) {
      const getSSP = `export async function get${pageOperation}
    (options: Omit<Apollo.QueryOptions<${operationVariablesTypes}>, 'subscription'>, ${
        this.config.apolloClientInstanceImport
          ? `ctx${this.config.contextTypeRequired ? "" : "?"}: ${
              this.config.contextType
            }`
          : "apolloClient?: Apollo.ApolloClient<NormalizedCacheObject>"
      } ){
        ${
          this.config.apolloClientInstanceImport
            ? "const apolloClient = getApolloClient(ctx);"
            : ""
        }

        const client  = apolloClient || context.client;

        if (!client) {
          throw new Error('No client instance found. Pass an Apollo.ApolloClient instance to get${pageOperation} or add a client to the context with setGraphQLContext.');
        }
        
        const observable = client.subscribe<${operationResultType}>({ ...options, query: ${this.getDocumentNodeVariable(
        documentVariableName
      )} });

        return {
            obervable
        };
      }`;
      return [getSSP].filter((a) => a).join("\n");
    }

    const getSSP = `export async function get${pageOperation}
    (options: Omit<Apollo.QueryOptions<${operationVariablesTypes}>, 'query'>, ${
      this.config.apolloClientInstanceImport
        ? `ctx${this.config.contextTypeRequired ? "" : "?"}: ${
            this.config.contextType
          }`
        : "apolloClient?: Apollo.ApolloClient<NormalizedCacheObject>"
    } ){
        ${
          this.config.apolloClientInstanceImport
            ? "const apolloClient = getApolloClient(ctx);"
            : ""
        }

        const client  = apolloClient || context.client;

        if (!client) {
          throw new Error('No client instance found. Pass an Apollo.ApolloClient instance to get${pageOperation} or add a client to the context with setGraphQLContext.');
        }
        
        const data = await client.query<${operationResultType}>({ ...options, query: ${this.getDocumentNodeVariable(
      documentVariableName
    )} });

        return {
            data: data?.data,
            error: data?.error ?? data?.errors ?? null,
        };
      }`;
    return [getSSP].filter((a) => a).join("\n");
  }

  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    operationResultType = this._externalImportPrefix + operationResultType;
    operationVariablesTypes =
      this._externalImportPrefix + operationVariablesTypes;

    const pageOperation = this._buildOperationPageQuery(
      node,
      documentVariableName,
      operationResultType,
      operationVariablesTypes
    );
    return [pageOperation].join("\n");
  }
}
