// This file contains mocks and so not everything is used.
// noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols

export class TFile {
    basename: string;
    extension: string;
}

export class TAbstractFile {
    vault: any;
    path: string;
    name: string;
    parent: any;
}

export class SuggestModal<T> {
    limit: number;
    emptyStateText: string;
    inputEl: HTMLInputElement;
    resultContainerEl: HTMLElement;

    constructor(private app: any) {
    }

    setPlaceholder(placeholder: string): void {
    }

    setInstructions(instructions: any[]): void {
    }

    onNoSuggestion(): void {
    }

    selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void {
    }

    getSuggestions(query: string): T[] | Promise<T[]> {
        return [];
    }

    renderSuggestion(value: T, el: HTMLElement): any {
    }

    onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): any {
    }
}

export class App {
    workspace: any;
}
