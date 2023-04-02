import {App, EditorPosition, MarkdownView, Plugin, PluginManifest, TFile} from 'obsidian';
import {asyncDebounce, EmbeddingSearchModal} from "./embeddingSearchModal";
import {EmbeddingHelper, NoteEmbedding} from "./embeddingHelper";
import {EmbeddingSearchSettingTab} from "./embeddingSearchSettingTab";

const {Configuration, OpenAIApi} = require("openai");

interface EmbeddingSearchPluginSettings {
    openApiKey: string;
    noteEmbeddings: { [key: string]: NoteEmbedding };
}

const DEFAULT_SETTINGS: Partial<EmbeddingSearchPluginSettings> = {
    openApiKey: "",
    noteEmbeddings: {}
};


export default class EmbeddingSearchPlugin extends Plugin {
    private readonly embeddingsHelper: EmbeddingHelper;
    private settings: EmbeddingSearchPluginSettings;
    private debouncedFileUpdates: Map<string, (...args: any[]) => Promise<void>>;

    public getOpenApiKey() {
        if (this.settings.openApiKey) {
            return "<KEY_SAVED>";
        }
        return "";
    }

    public setOpenApiKey(openApiKey: string) {
        this.settings.openApiKey = openApiKey;
        // Set up the OpenAI API key
        const configuration = new Configuration({
            apiKey: openApiKey,
        });
        this.embeddingsHelper.openai = new OpenAIApi(configuration);
    }

    /**
     * Returns an array of all indexed note file paths.
     *
     * @returns {string[]} An array of note file paths.
     */
    public getIndexedFiles() {
        return Object.values(this.settings.noteEmbeddings).map(noteEmbedding => noteEmbedding.notePath);
    }

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        const getNoteFromPath = (notePath: string) => this.app.metadataCache.getFirstLinkpathDest(
            notePath,
            ''
        ) as TFile;
        this.embeddingsHelper = new EmbeddingHelper(getNoteFromPath.bind(this), app);
        this.debouncedFileUpdates = new Map();
    }

    private readonly UPDATE_TIMEOUT_MS = 20000;

    async onload() {
        let pluginLoaded = false;

        // Load existing embeddings
        await this.loadSettings();
        this.setOpenApiKey(this.settings.openApiKey);

        // Add commands and event handlers
        this.addCommand({
            id: 'embedding-search',
            name: 'Embedding Search',
            callback: () => this.embeddingSearch(),
        });

        this.addCommand({
            id: 'get-in-context',
            name: 'Get Meaning In Context',
            callback: () => this.getMeaningInContext(),
        });

        this.addSettingTab(new EmbeddingSearchSettingTab(this.app, this));

        // These instanceof checks make sense.  We only want files, not folders.
        // TAbstractFile can be a file or a folder.
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (pluginLoaded && file instanceof TFile) this.updateEmbedding(file);
            })
        );

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (!pluginLoaded || !(file instanceof TFile)) return;
                if (!this.debouncedFileUpdates.has(file.path)) {
                    this.debouncedFileUpdates.set(
                        file.path,
                        asyncDebounce(this.updateEmbedding.bind(this, file), this.UPDATE_TIMEOUT_MS)
                    );
                }
                // Note we do not await it as we don't want to block.
                this.debouncedFileUpdates.get(file.path)?.();
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (pluginLoaded && file instanceof TFile) this.removeEmbedding(file);
            })
        );

        this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, event) => {
            // Check if there's a selection in the editor
            if (editor.somethingSelected()) {
                // Add a custom context menu item to the editor
                menu.addItem((item) => {
                    item.setTitle('Get Meaning In Context');
                    item.setIcon('my-icon-class');
                    item.onClick(() => this.getMeaningInContext());
                });
            }
        }));

        this.app.workspace.onLayoutReady(() => {
            pluginLoaded = true;
        });
    }

    async onunload() {
        await this.saveSettings();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async updateEmbedding(note: TFile, save: boolean = true) {
        await this.embeddingsHelper.updateEmbedding(this.settings.noteEmbeddings, note);
        if (save) {
            await this.saveSettings();
        }
    }

    async removeEmbedding(note: TFile) {
        if (note.path in this.settings.noteEmbeddings) {
            delete this.settings.noteEmbeddings[note.path];
            await this.saveSettings();
        }
    }

    async embeddingSearch() {
        const embeddingSearchModal = new EmbeddingSearchModal(
            this.app,
            this.embeddingsHelper.searchWithEmbeddings.bind(
                this.embeddingsHelper, this.settings.noteEmbeddings
            )
        );
        embeddingSearchModal.open();
    }

    getHighlightedText(): [string, EditorPosition?, EditorPosition?] {
        const activeLeaf = this.app.workspace.getLeaf(false);

        if (activeLeaf.view instanceof MarkdownView) {
            const editor = activeLeaf.view.editor;
            return [editor.getSelection(), editor.getCursor("from"), editor.getCursor("to")];
        }
        return ["", undefined, undefined];
    }

    getHighlightedTextInContext(): [string, string] {
        const PREFIX = "==";
        const POSTFIX = "==";

        const activeLeaf = this.app.workspace.getLeaf(false);

        if (!(activeLeaf.view instanceof MarkdownView)) {
            return ["", ""];
        }
        const editor = activeLeaf.view.editor;
        const selection = editor.getSelection()

        if (selection == "") return ["", ""];

        const fromPos = editor.getCursor("from");
        const toPos = editor.getCursor("to");
        const lines = editor.getValue().split("\n");

        lines[fromPos.line] = lines[fromPos.line]
        const insertAtIndex = (str: string, pos: number, strToInsert: string): string => str.slice(0, pos) + strToInsert + str.slice(pos);
        lines[fromPos.line] = insertAtIndex(lines[fromPos.line], fromPos.ch, PREFIX);
        lines[toPos.line] = insertAtIndex(lines[toPos.line], toPos.ch, POSTFIX);
        return [`${PREFIX}${selection}${POSTFIX}`, lines.join("\n")];
    }


    async getMeaningInContext() {
        const [selection, doc] = this.getHighlightedTextInContext();

        const meaning = await this.embeddingsHelper.getMeaningInContext(doc, selection);
        console.log("Meaning: " + meaning)


        // const embeddingSearchModal = new EmbeddingSearchModal(
        //     this.app,
        //     this.embeddingsHelper.searchWithEmbeddings.bind(
        //         this.embeddingsHelper, this.settings.noteEmbeddings
        //     )
        // );
        // embeddingSearchModal.open();
    }
}
