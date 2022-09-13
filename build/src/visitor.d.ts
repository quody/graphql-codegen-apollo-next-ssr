import { Types } from "@graphql-codegen/plugin-helpers";
import { ClientSideBaseVisitor, ClientSideBasePluginConfig, LoadedFragment } from "@graphql-codegen/visitor-plugin-common";
import { GraphQLSchema, OperationDefinitionNode } from "graphql";
import { ApolloNextSSRRawPluginConfig, Config } from "./config";
export declare type ApolloNextSSRPluginConfig = ClientSideBasePluginConfig & Config;
export declare class ApolloNextSSRVisitor extends ClientSideBaseVisitor<ApolloNextSSRRawPluginConfig, ApolloNextSSRPluginConfig> {
    private _externalImportPrefix;
    private imports;
    constructor(schema: GraphQLSchema, fragments: LoadedFragment[], rawConfig: ApolloNextSSRRawPluginConfig, documents: Types.DocumentFile[]);
    getImports(): string[];
    private getDocumentNodeVariable;
    private _buildOperationPageQuery;
    protected buildOperation(node: OperationDefinitionNode, documentVariableName: string, operationType: string, operationResultType: string, operationVariablesTypes: string): string;
}
//# sourceMappingURL=visitor.d.ts.map