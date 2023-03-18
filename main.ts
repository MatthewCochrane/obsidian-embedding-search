import {App, Plugin, PluginManifest, TFile} from 'obsidian';
import {EmbeddingSearchModal} from "./embeddingSearchModal";
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
    private settings: EmbeddingSearchPluginSettings

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


    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        const getNoteFromPath = (notePath: string) => this.app.metadataCache.getFirstLinkpathDest(
            notePath,
            ''
        ) as TFile;
        this.embeddingsHelper = new EmbeddingHelper(getNoteFromPath.bind(this), app);
    }

    async onload() {
        // Load existing embeddings
        await this.loadSettings();
        this.setOpenApiKey(this.settings.openApiKey);

        // Add commands and event handlers
        this.addCommand({
            id: 'embedding-search',
            name: 'Embedding Search',
            callback: () => this.embeddingSearch(),
        });

        this.addSettingTab(new EmbeddingSearchSettingTab(this.app, this));

        // These instanceof checks make sense.  We only want files, not folders.
        // TAbstractFile can be a file or a folder.
        // this.registerEvent(
        // 	this.app.vault.on('create', (file) => {
        // 		if (file instanceof TFile) this.updateEmbedding(file);
        // 	})
        // );
        //
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) this.updateEmbedding(file);
            })
        );
        //
        // this.registerEvent(
        // 	this.app.vault.on('delete', (file) => {
        // 		if (file instanceof TFile) this.removeEmbedding(file);
        // 	})
        // );

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

    async updateEmbedding(note: TFile) {
        await this.embeddingsHelper.updateEmbedding(this.settings.noteEmbeddings, note);
        await this.saveSettings();
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
}
