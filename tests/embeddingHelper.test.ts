import {EmbeddingHelper} from "../embeddingHelper";
import {CreateEmbeddingResponse, OpenAIApi} from "openai";
import {App, TFile} from "obsidian";
import {AxiosResponse} from "axios";


describe('EmbeddingHelper', () => {

    describe('cosineSimilarity', () => {
        it('should return 1 for identical arrays', () => {
            const a = [1, 2, 3];
            const b = [1, 2, 3];
            const result = EmbeddingHelper.cosineSimilarity(a, b);
            expect(result).toEqual(1);
        });

        it('should return 0 for orthogonal arrays', () => {
            const a = [1, 0, 0];
            const b = [0, 1, 0];
            const result = EmbeddingHelper.cosineSimilarity(a, b);
            expect(result).toEqual(0);
        });

        it('should return a value between 0 and 1 for non-identical arrays', () => {
            const a = [1, 2, 3];
            const b = [4, 5, 6];
            const result = EmbeddingHelper.cosineSimilarity(a, b);
            expect(result).toBeGreaterThan(0);
            expect(result).toBeLessThan(1);
        });

        it('should throw an error if arrays have different lengths', () => {
            const a = [1, 2, 3];
            const b = [1, 2];
            expect(EmbeddingHelper.cosineSimilarity(a, b)).toBeNaN();
        });
    });

    describe('splitStringIntoMaxTokens', () => {
        test('splits a string into parts with no more than maxTokens tokens', () => {
            const input = 'This is an example sentence to try encoding out on!';
            const maxTokens = 5;
            const result = EmbeddingHelper.splitStringIntoMaxTokens(input, maxTokens);
            expect(result.length).toBeGreaterThan(0);
            expect(result.join('')).toEqual(input);
        });

        test('splits a string with one token into one part', () => {
            const input = 'hello';
            const maxTokens = 5;
            const result = EmbeddingHelper.splitStringIntoMaxTokens(input, maxTokens);
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(input);
        });

        test('handles empty input string', () => {
            const input = '';
            const maxTokens = 5;
            const result = EmbeddingHelper.splitStringIntoMaxTokens(input, maxTokens);
            expect(result.length).toBe(0);
        });

        test('handles maxTokens as 1', () => {
            const input = 'Hello, world!';
            const maxTokens = 1;
            const result = EmbeddingHelper.splitStringIntoMaxTokens(input, maxTokens);
            expect(result.length).toBeGreaterThan(0);
            expect(result.join('')).toEqual(input);
        });

        test('handles maxTokens equal to or greater than the number of tokens in the input string', () => {
            const input = 'This is another test case!';
            const maxTokens = 50;
            const result = EmbeddingHelper.splitStringIntoMaxTokens(input, maxTokens);
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(input);
        });
    });

    describe('searchWithEmbeddings', () => {
        let embeddingHelper: EmbeddingHelper;
        let openai: OpenAIApi;
        let app: App;

        const noteEmbeddings = {
            'path/to/note1': {notePath: 'path/to/note1', embeddings: [[0.1, 0.2, 0.3]]},
            'path/to/note2': {notePath: 'path/to/note2', embeddings: [[0.4, 0.5, 0.6], [0.7, 0.8, 0.9]]},
        };
        const query = 'sample query';
        const limit = 2;

        beforeEach(() => {
            openai = new OpenAIApi();
            app = new App();
            embeddingHelper = new EmbeddingHelper((path: string) => {
                const file = new TFile();
                file.path = path;
                const pathParts = path.split("/");
                file.basename = pathParts[pathParts.length - 1];
                file.extension = '';
                return file;
            }, app, 'text-embedding-ada-002');
            embeddingHelper.openai = openai;

            const mockEmbeddingResponse: AxiosResponse<CreateEmbeddingResponse> = {
                data: {
                    object: 'list',
                    model: 'text-embedding-ada-002',
                    usage: {
                        prompt_tokens: 0,
                        total_tokens: 0,
                    },
                    data: [{index: 0, object: 'embedding', embedding: [0.7, 0.8, 0.9]}],
                },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            };
            jest.spyOn(OpenAIApi.prototype, 'createEmbedding').mockResolvedValue(mockEmbeddingResponse);
        });

        it('should call createEmbedding with the correct parameters', async () => {
            await embeddingHelper.searchWithEmbeddings(noteEmbeddings, query, limit);
            expect(openai.createEmbedding).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: [query],
            });
        });

        it('should return the correct search results', async () => {
            const results = await embeddingHelper.searchWithEmbeddings(noteEmbeddings, query, limit);

            expect(results.length).toBe(2);
            expect(results[0].note).toMatchObject({basename: 'note2'});
            expect(results[0].similarity).toBeCloseTo(0.99999, 4);
            expect(results[1].note).toMatchObject({basename: 'note1'});
            expect(results[1].similarity).toBeCloseTo(0.9594, 4);
        });

        it('should limit the number of search results', async () => {
            const limitedResults = await embeddingHelper.searchWithEmbeddings(noteEmbeddings, query, 1);

            expect(limitedResults.length).toBe(1);
            expect(limitedResults[0].note).toMatchObject({basename: 'note2'});
            expect(limitedResults[0].similarity).toBeCloseTo(0.99999, 4);
        });
    });

});
