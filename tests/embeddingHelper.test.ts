import {EmbeddingHelper} from "../embeddingHelper";
import {CreateEmbeddingResponse, OpenAIApi} from "openai";
import {TFile} from "obsidian";
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

    describe('searchWithEmbeddings', () => {
        let embeddingHelper: EmbeddingHelper;
        let openai: OpenAIApi;

        const noteEmbeddings = {
            'path/to/note1': {notePath: 'path/to/note1', embeddings: [0.1, 0.2, 0.3]},
            'path/to/note2': {notePath: 'path/to/note2', embeddings: [0.4, 0.5, 0.6]},
        };
        const query = 'sample query';
        const limit = 2;

        beforeEach(() => {
            openai = new OpenAIApi();
            embeddingHelper = new EmbeddingHelper((path: string) => {
                const file = new TFile();
                file.path = path;
                const pathParts = path.split("/");
                file.basename = pathParts[pathParts.length-1];
                file.extension = '';
                return file;
            }, 'text-embedding-ada-002');
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
            expect(results[0].note).toMatchObject({basename: 'note2', extension: ''});
            expect(results[0].similarity).toBeCloseTo(0.9982, 4);
            expect(results[1].note).toMatchObject({basename: 'note1', extension: ''});
            expect(results[1].similarity).toBeCloseTo(0.9594, 4);
        });

        it('should limit the number of search results', async () => {
            const limitedResults = await embeddingHelper.searchWithEmbeddings(noteEmbeddings, query, 1);

            expect(limitedResults.length).toBe(1);
            expect(limitedResults[0].note).toMatchObject({basename: 'note2', extension: ''});
            expect(limitedResults[0].similarity).toBeCloseTo(0.9982, 4);
        });
    });

});
