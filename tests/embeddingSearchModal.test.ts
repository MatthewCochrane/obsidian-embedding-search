import {TFile} from "obsidian";
import {EmbeddingSearchModal} from "../embeddingSearchModal";

jest.useFakeTimers();
jest.mock('obsidian');

describe('EmbeddingSearchModal', () => {
    let appMock: any;
    let performEmbeddingSearch: jest.Mock;
    let modal: EmbeddingSearchModal;

    beforeEach(() => {
        appMock = {
            workspace: {
                getLeaf: jest.fn().mockReturnValue({openFile: jest.fn()}),
            },
        };
        performEmbeddingSearch = jest.fn();
        modal = new EmbeddingSearchModal(appMock, performEmbeddingSearch);
    });

    it('should debounce embedding search', async () => {
        const query = 'test query';
        const suggestions = [
            {note: new TFile(), similarity: 0.8},
            {note: new TFile(), similarity: 0.9},
        ];
        performEmbeddingSearch.mockResolvedValue(suggestions);

        const promise = modal.getSuggestions(query);
        await jest.advanceTimersByTime(1000);

        expect(performEmbeddingSearch).toHaveBeenCalledWith(query);
        expect(await promise).toEqual(suggestions);
    });

    it('should open a file when a suggestion is chosen', async () => {
        const item = {note: new TFile(), similarity: 0.8};
        const event = new MouseEvent('click');

        await modal.onChooseSuggestion(item, event);

        expect(appMock.workspace.getLeaf).toHaveBeenCalledWith(true);
        expect(appMock.workspace.getLeaf().openFile).toHaveBeenCalledWith(item.note);
    });

    it('should render a suggestion', () => {
        const value = {note: new TFile(), similarity: 0.8};
        value.note.basename = 'test-file';
        const el = document.createElement('div');
        el.createEl = jest.fn();

        modal.renderSuggestion(value, el);

        expect(el.createEl).toHaveBeenCalledWith("div", {"text": "test-file (similarity: 0.8000)"});
    });
});
