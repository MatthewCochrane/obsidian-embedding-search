import EmbeddingSearchPlugin from "./main";
import {App, PluginSettingTab, Setting} from "obsidian";
import {countTokens} from "gptoken";

export class EmbeddingSearchSettingTab extends PluginSettingTab {
    private readonly CALCULATING_TEXT = "Calculating...";
    private readonly CANCEL_TEXT = "Cancel";
    private readonly INDEX_VAULT_TEXT = 'Index Vault';

    private statusBarEl: HTMLElement;
    private indexingButton: HTMLElement;
    private progressText: HTMLElement;
    private cancelIndexing: boolean = false;

    constructor(app: App, private plugin: EmbeddingSearchPlugin) {
        super(app, plugin);
        this.statusBarEl = this.plugin.addStatusBarItem();
        console.log("EmbeddingSearchSettingTab Constructor")
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("OpenAPI Key")
            .setDesc("Enter your OpenAPI key")
            .addText((text) => text
                .setPlaceholder("Enter your OpenAPI key")
                .setValue(this.plugin.getOpenApiKey())
                .onChange(async (value) => {
                    this.plugin.setOpenApiKey(value);
                    await this.plugin.saveSettings();
                })
            );

        const indexingSetting = new Setting(containerEl)
            .setName('Index Entire Vault')
            .setDesc('Calculate embeddings for all markdown files in the vault.');

        indexingSetting.addButton(button => {
            button
                .setButtonText(this.indexingButton ? this.indexingButton.innerText : 'Start')
                .onClick(() => this.clickIndexVaultButton())
            this.indexingButton = button.buttonEl;
        });

        this.progressText = indexingSetting.descEl.createEl('p', {text: ''});
    }

    async clickIndexVaultButton() {
        if (this.indexingButton.innerText === this.CANCEL_TEXT) {
            this.cancelIndexing = true;
            return;
        } else if (this.indexingButton.innerText === this.CALCULATING_TEXT) {
            return;
        }

        await this.indexEntireVault();
    }


    async indexEntireVault() {

        this.indexingButton.innerText = this.CALCULATING_TEXT

        this.statusBarEl.setText("Indexing progress: 0%");

        // Get all markdown files in the vault
        const files = this.app.vault.getMarkdownFiles();

        // Calculate the total number of tokens in the vault
        let totalTokens = 0;
        for (const file of files) {
            const content = file.path + "\n" + await this.app.vault.read(file);
            totalTokens += countTokens(content);
        }

        // Estimate the cost
        const estimatedCost = totalTokens / 1000 * 0.0004; // Cost for Ada 2 embeddings

        // Prompt the user to confirm
        if (!confirm(`Estimated cost of indexing vault (${files.length} files with ${totalTokens} tokens): US$${estimatedCost.toFixed(2)}. Do you want to proceed?`)) {
            this.indexingButton.innerText = this.INDEX_VAULT_TEXT;
            this.progressText.setText('');
            return;
        }

        // Index files in batches
        const batchSize = 3;
        const alreadyIndexedFilePaths = this.plugin.getIndexedFiles();
        const filesToIndex = files.filter(file => !alreadyIndexedFilePaths.includes(file.path));
        const totalFiles = filesToIndex.length;

        this.cancelIndexing = false;
        this.indexingButton.innerText = this.CANCEL_TEXT;
        this.statusBarEl.setText("Indexing progress: 0%");

        let progress = 0;
        while (filesToIndex.length > 0 && !this.cancelIndexing) {
            const batch = filesToIndex.splice(0, batchSize);
            await Promise.all(batch.map(async (file) => {
                try {
                    await this.plugin.updateEmbedding(file, false);
                } catch (ex) {
                    console.log(ex);
                }

                progress++;

                // Update progress display
                this.displayProgress(progress, totalFiles);

                // Save progress periodically
                if (progress % 100 === 0) {
                    await this.plugin.saveSettings();
                }
            }));
        }

        if (!this.cancelIndexing) {
            // Save the final progress
            await this.plugin.saveSettings();
            this.statusBarEl.setText("Indexing complete");
        } else {
            this.statusBarEl.setText("Indexing cancelled");
        }

        this.indexingButton.innerText = this.INDEX_VAULT_TEXT;
        this.progressText.setText('');
        setTimeout(() => {
            this.statusBarEl.setText("");
        }, 5000);
    }

    private displayProgress(progress: number, totalFiles: number) {
        const percentage = Math.round((progress / totalFiles) * 100);
        this.statusBarEl.setText(`Indexing progress: ${percentage}%`);
        this.progressText.setText(`Indexing in progress: ${percentage}%`);
    }
}
