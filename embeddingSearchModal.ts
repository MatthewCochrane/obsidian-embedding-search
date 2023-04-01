import {App, SuggestModal, TFile} from "obsidian";


/**
 * Returns a function that debounces an asynchronous function call. The debounced function delays invoking
 * the provided async function until after `timeout` milliseconds have elapsed since the last time the
 * debounced function was called. If the debounced function is called again before `timeout` milliseconds
 * have elapsed, the timer is reset.
 *
 * @template T - An array of arguments that will be passed to the provided async function.
 * @template V - The return type of the provided async function.
 *
 * @param {(...args: [...T]) => Promise<V>} cb - The async function to debounce.
 * @param {number} timeout - The number of milliseconds to wait before invoking the async function.
 *
 * @returns {(...args: [...T]) => Promise<V>} - The debounced function.
 */
export function asyncDebounce<T extends unknown[], V>(cb: (...args: [...T]) => Promise<V>, timeout: number): (...args: [...T]) => Promise<V> {
	let timer: number | null = null;
	return async (...args: [...T]): Promise<V> => {
		if (timer) {
			clearTimeout(timer);
		}

		return new Promise<V>((resolve) => {
			timer = window.setTimeout(async () => {
				timer = null;
				resolve(await cb(...args));
			}, timeout);
		});
	};
}


/**
 * A modal that displays a list of notes with similar content to a search query.
 * Allows the user to choose a note and opens it in the current pane.
 * Uses a debounced search to avoid flooding the search backend with requests.
 *
 * @extends SuggestModal<{ note: TFile; similarity: number }>
 */
export class EmbeddingSearchModal extends SuggestModal<{ note: TFile; similarity: number }> {
	private readonly performEmbeddingSearch: (query: string) => Promise<{ note: TFile; similarity: number }[]>;
	private readonly debouncedEmbeddingSearch: (query: string) => Promise<{ note: TFile; similarity: number }[]>;

	constructor(app: App, performEmbeddingSearch: (query: string) => Promise<{ note: TFile; similarity: number }[]>) {
		super(app);
		this.performEmbeddingSearch = performEmbeddingSearch;
		this.debouncedEmbeddingSearch = asyncDebounce(this.performEmbeddingSearch, 1000);
	}

	async onChooseSuggestion(item: { note: TFile; similarity: number }, _evt: MouseEvent | KeyboardEvent): Promise<void> {
		await this.app.workspace.getLeaf(false).openFile(item.note);
	}

	async getSuggestions(query: string): Promise<{ note: TFile; similarity: number }[]> {
		return this.debouncedEmbeddingSearch(query);
	}

	renderSuggestion(value: { note: TFile; similarity: number }, el: HTMLElement) {
		el.createEl('div', { text: value?.note?.basename + " (similarity: " + value?.similarity?.toFixed(4) + ")" });
	}
}
