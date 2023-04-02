import {App, TFile} from "obsidian";
import {OpenAIApi} from "openai";
import {decode, encode} from "gptoken";

export interface EmbeddingSearchResult {
    note: TFile,
    similarity: number
}

export interface NoteEmbedding {
    notePath: string;
    embeddings: number[][];
}

export class EmbeddingHelper {
    private _openai: OpenAIApi;

    constructor(private readonly getNoteFromPath: (path: string) => TFile,
                private readonly app: App,
                private readonly model: string = 'text-embedding-ada-002',
                private readonly maxTokens: number = 8191) {
        // Only exists to set the private members
    }

    set openai(value: OpenAIApi) {
        this._openai = value;
    }

    /**
     * Calculates the cosine similarity between two numeric arrays a and b.
     *
     * Cosine similarity is a measure of similarity between two non-zero vectors of an inner product space that
     * measures the cosine of the angle between them. It is often used to compare the similarity of text documents
     * in natural language processing.
     *
     * @param {number[]} a - The first numeric array.
     * @param {number[]} b - The second numeric array.
     * @returns {number} The cosine similarity between the two arrays.
     */
    static cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, aVal, i) => sum + aVal * b[i], 0);
        const aMagnitude = Math.sqrt(a.reduce((sum, aVal) => sum + aVal * aVal, 0));
        const bMagnitude = Math.sqrt(b.reduce((sum, bVal) => sum + bVal * bVal, 0));

        return dotProduct / (aMagnitude * bMagnitude);
    }

    /**
     * Searches for notes with embeddings most similar to the given query, up to the specified limit.
     *
     * @param noteEmbeddings An object containing note paths as keys and their corresponding embeddings as values.
     * @param query The search query to find relevant notes.
     * @param limit The maximum number of search results to return.
     * @returns A promise that resolves to an array of `EmbeddingSearchResult` objects, sorted by similarity to the query.
     */
    async searchWithEmbeddings(noteEmbeddings: { [key: string]: NoteEmbedding },
                               query: string, limit: number): Promise<EmbeddingSearchResult[]> {
        if (query.trim() == "") return [];

        // Convert the query to an embedding
        const queryEmbedding = await this._openai.createEmbedding({
            model: this.model,
            input: [query],
        });

        // Calculate the similarity between the query and note embeddings
        const similarities = Object.values(noteEmbeddings).map(({notePath, embeddings}) =>
            // Always use the max similarity found in each file.
            embeddings.map(embedding => ({
                note: this.getNoteFromPath(notePath),
                similarity: EmbeddingHelper.cosineSimilarity(
                    queryEmbedding.data.data[0].embedding,
                    embedding
                ),
            })).reduce((acc, cur) => (cur.similarity > acc.similarity) ? cur : acc)
        );

        // Sort the results by similarity
        return similarities.sort(
            (a, b) => b.similarity - a.similarity
        ).slice(0, limit);
    }

    async updateEmbedding(noteEmbeddings: { [key: string]: NoteEmbedding },
                          note: TFile) {
        if (note.extension !== 'md') return;

        const noteContent = note.path + "\n" + await this.app.vault.read(note);
        // Reducing maxTokens by a bit just to 'be safe'
        const noteParts = EmbeddingHelper.splitStringIntoMaxTokens(noteContent, this.maxTokens - 100)
        const embeddingsResponse = await this._openai.createEmbedding({
            model: this.model,
            input: noteParts,
        });

        noteEmbeddings[note.path] = {
            notePath: note.path,
            embeddings: embeddingsResponse.data.data.map(data => data.embedding),
        };
    }

    static splitStringIntoMaxTokens(input: string, maxTokens: number): string[] {
        const encodedInput = encode(input);
        const chunks = [];

        for (let i = 0; i < encodedInput.length; i += maxTokens) {
            const chunk = encodedInput.slice(i, i + maxTokens);
            chunks.push(chunk);
        }

        return chunks.map(decode);
    }

    async getMeaningInContext(fullText: string, selection: string) : Promise<string> {
        const chatCompletion = await this._openai.createChatCompletion({
            messages: [{
                role: "user",
                content: `${fullText}

---

Explain the meaning of the highlighted phrase (${selection}) in the context of the document above.`
            }],
            model: "gpt-3.5-turbo",
        });
        return chatCompletion.data.choices[0].message?.content || "";
    }
}
