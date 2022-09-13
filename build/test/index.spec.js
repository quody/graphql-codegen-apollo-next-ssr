"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@graphql-codegen/testing");
const index_1 = require("../src/index");
const graphql_1 = require("graphql");
const plugin_helpers_1 = require("@graphql-codegen/plugin-helpers");
const typescript_1 = require("@graphql-codegen/typescript");
const typescript_operations_1 = require("@graphql-codegen/typescript-operations");
describe("Apollo Next SSr", () => {
    let spyConsoleError;
    beforeEach(() => {
        spyConsoleError = jest.spyOn(console, "warn");
        spyConsoleError.mockImplementation();
    });
    afterEach(() => {
        spyConsoleError.mockRestore();
    });
    const schema = (0, graphql_1.buildClientSchema)(require("./schema.json"));
    const basicDoc = (0, graphql_1.parse)(/* GraphQL */ `
    query test {
      feed {
        id
        commentCount
        repository {
          full_name
          html_url
          owner {
            avatar_url
          }
        }
      }
    }
  `);
    const validateTypeScript = (output, testSchema, documents, config, playground = false) => __awaiter(void 0, void 0, void 0, function* () {
        const tsOutput = yield (0, typescript_1.plugin)(testSchema, documents, config, {
            outputFile: "",
        });
        const tsDocumentsOutput = yield (0, typescript_operations_1.plugin)(testSchema, documents, config, { outputFile: "" });
        const merged = (0, plugin_helpers_1.mergeOutputs)([tsOutput, tsDocumentsOutput, output]);
        (0, testing_1.validateTs)(merged, undefined, true, false, playground);
        return merged;
    });
    describe("Imports", () => {
        it("should import nextjs dependencies", () => __awaiter(void 0, void 0, void 0, function* () {
            const docs = [{ location: "", document: basicDoc }];
            const content = (yield (0, index_1.plugin)(schema, docs, {}, {
                outputFile: "graphql.tsx",
            }));
            expect(content.prepend).toContain("import { NextPage } from 'next';");
            expect(content.prepend).toContain("import { NextRouter, useRouter } from 'next/router'");
            yield validateTypeScript(content, schema, docs, {});
        }));
        it("should import apollo v2 dependencies", () => __awaiter(void 0, void 0, void 0, function* () {
            const docs = [{ location: "", document: basicDoc }];
            const content = (yield (0, index_1.plugin)(schema, docs, {}, {
                outputFile: "graphql.tsx",
            }));
            expect(content.prepend).toContain("import gql from 'graphql-tag';");
            expect(content.prepend).toContain("import { QueryHookOptions, useQuery } from '@apollo/react-hooks';");
            expect(content.prepend).toContain("import * as Apollo from 'apollo-client';");
            yield validateTypeScript(content, schema, docs, {});
        }));
        it("should import custom apollo  dependencies", () => __awaiter(void 0, void 0, void 0, function* () {
            const docs = [{ location: "", document: basicDoc }];
            const content = (yield (0, index_1.plugin)(schema, docs, {
                apolloImportFrom: "client",
            }, {
                outputFile: "graphql.tsx",
            }));
            expect(content.prepend).toContain("import gql from 'graphql-tag';");
            expect(content.prepend).toContain("import * as Apollo from 'client';");
            yield validateTypeScript(content, schema, docs, {});
        }));
        it("should import custom  apollo-client v3 dependencies", () => __awaiter(void 0, void 0, void 0, function* () {
            const docs = [{ location: "", document: basicDoc }];
            const content = (yield (0, index_1.plugin)(schema, docs, {
                reactApolloVersion: 3,
            }, {
                outputFile: "graphql.tsx",
            }));
            expect(content.prepend).toContain("import * as Apollo from '@apollo/client';");
            expect(content.prepend).not.toContain("import { QueryHookOptions, useQuery } from '@apollo/react-hooks';");
            yield validateTypeScript(content, schema, docs, {});
        }));
        it("should import DocumentNode when using noGraphQLTag", () => __awaiter(void 0, void 0, void 0, function* () {
            const docs = [{ location: "", document: basicDoc }];
            const content = (yield (0, index_1.plugin)(schema, docs, {
                noGraphQLTag: true,
            }, {
                outputFile: "graphql.tsx",
            }));
            expect(content.prepend).toContain(`import { DocumentNode } from 'graphql';`);
            expect(content.prepend).not.toContain(`import gql from 'graphql-tag';`);
            yield validateTypeScript(content, schema, docs, {});
        }));
        it(`should use gql import from gqlImport config option`, () => __awaiter(void 0, void 0, void 0, function* () {
            const docs = [{ location: "", document: basicDoc }];
            const content = (yield (0, index_1.plugin)(schema, docs, { gqlImport: "graphql.macro#gql" }, {
                outputFile: "graphql.tsx",
            }));
            expect(content.prepend).toContain(`import { gql } from 'graphql.macro';`);
            yield validateTypeScript(content, schema, docs, {});
        }));
    });
    describe("Next Apollo ssr", () => {
        it("Should generate getServerPage and withPage for query", () => __awaiter(void 0, void 0, void 0, function* () {
            const documents = (0, graphql_1.parse)(/* GraphQL */ `
        query feed {
          feed {
            id
            commentCount
            repository {
              full_name
              html_url
              owner {
                avatar_url
              }
            }
          }
        }

        mutation submitRepository($name: String) {
          submitRepository(repoFullName: $name) {
            id
          }
        }
      `);
            const docs = [{ location: "", document: documents }];
            const content = (yield (0, index_1.plugin)(schema, docs, {}, {
                outputFile: "graphql.tsx",
            }));
            expect(content.content).toBeSimilarStringTo(`
export async function getServerPageFeed
    (options: Omit<Apollo.QueryOptions<FeedQueryVariables>, 'query'>, apolloClient: Apollo.ApolloClient<NormalizedCacheObject> ){
        
        
        const data = await apolloClient.query<FeedQuery>({ ...options, query: FeedDocument });
        
        const apolloState = apolloClient.cache.extract();

        return {
            props: {
                apolloState: apolloState,
                data: data?.data,
                error: data?.error ?? data?.errors ?? null,
            },
        };
      }`);
            expect(content.content).toBeSimilarStringTo(`export type PageFeedComp = React.FC<{data?: FeedQuery, error?: Apollo.ApolloError}>;`);
            expect(content.content).toBeSimilarStringTo(`
    export const withPageFeed = (optionsFunc?: (router: NextRouter)=> QueryHookOptions<FeedQuery, FeedQueryVariables>) => (WrappedComponent:PageFeedComp) : NextPage  => (props) => {
                const router = useRouter()
                const options = optionsFunc ? optionsFunc(router) : {};
                const {data, error } = useQuery(FeedDocument, options)    
                return <WrappedComponent {...props} data={data} error={error} /> ;
                   
            }; `);
            expect(content.content).not.toBeSimilarStringTo(`
    export const useFeed`);
            yield validateTypeScript(content, schema, docs, {});
        }));
    });
    it("Should exclude mutations", () => __awaiter(void 0, void 0, void 0, function* () {
        const documents = (0, graphql_1.parse)(/* GraphQL */ `
      query feed {
        feed {
          id
          commentCount
          repository {
            full_name
            html_url
            owner {
              avatar_url
            }
          }
        }
      }

      mutation submitRepository($name: String) {
        submitRepository(repoFullName: $name) {
          id
        }
      }
    `);
        const docs = [{ location: "", document: documents }];
        const content = (yield (0, index_1.plugin)(schema, docs, {}, {
            outputFile: "graphql.tsx",
        }));
        expect(content.content).not.toContain(`getServerPageSubmitRepository`);
        yield validateTypeScript(content, schema, docs, {});
    }));
    it("Should generate getServerPage with custom `apolloStateKey`", () => __awaiter(void 0, void 0, void 0, function* () {
        const documents = (0, graphql_1.parse)(/* GraphQL */ `
      query feed {
        feed {
          id
          commentCount
          repository {
            full_name
            html_url
            owner {
              avatar_url
            }
          }
        }
      }
    `);
        const docs = [{ location: "", document: documents }];
        const content = (yield (0, index_1.plugin)(schema, docs, {
            apolloStateKey: "__APOLLO_STATE__",
        }, {
            outputFile: "graphql.tsx",
        }));
        expect(content.content).toBeSimilarStringTo(`
    export async function getServerPageFeed
    (options: Omit<Apollo.QueryOptions<FeedQueryVariables>, 'query'>, apolloClient: Apollo.ApolloClient<NormalizedCacheObject> ){
        
      const data = await apolloClient.query<FeedQuery>({ ...options, query: FeedDocument });

      const apolloState = apolloClient.cache.extract();

      return {
        props: {
          __APOLLO_STATE__: apolloState,
          data: data?.data,
          error: data?.error ?? data?.errors ?? null,
        },
      };
    }`);
        yield validateTypeScript(content, schema, docs, {});
    }));
});
