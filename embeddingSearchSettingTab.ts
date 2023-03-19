import EmbeddingSearchPlugin from "./main";
import {App, PluginSettingTab, Setting} from "obsidian";
import {countTokens} from "gptoken";

export class EmbeddingSearchSettingTab extends PluginSettingTab {

    constructor(app: App, private plugin: EmbeddingSearchPlugin) {
        super(app, plugin);
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("OpenAPI Key")
            .setDesc("Enter your OpenAPI key")
            .addText((text) =>
                text
                    .setPlaceholder("Enter your OpenAPI key")
                    .setValue(this.plugin.getOpenApiKey())
                    .onChange(async (value) => {
                        this.plugin.setOpenApiKey(value);
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Index Entire Vault')
            .setDesc('Calculate embeddings for all markdown files in the vault.')
            .addButton(button => button
                .setButtonText('Index Vault')
                .onClick(() => this.indexEntireVault())
            );
    }

    async indexEntireVault() {
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
            return;
        }

        // Index files in batches
        const batchSize = 3;
        const alreadyIndexedFilePaths = this.plugin.getIndexedFiles();
        const filesToIndex = files.filter(file => !alreadyIndexedFilePaths.includes(file.path));
        const totalFiles = filesToIndex.length;

        let progress = 0;
        while (filesToIndex.length > 0) {
            const batch = filesToIndex.splice(0, batchSize);
            await Promise.all(batch.map(async (file) => {
                try {
                    await this.plugin.updateEmbedding(file, false);
                } catch (ex) {
                    console.log(ex);
                }

                progress++;

                // Update progress display
                EmbeddingSearchSettingTab.displayProgress(progress, totalFiles);

                // Save progress periodically
                if (progress % 100 === 0) {
                    await this.plugin.saveSettings();
                }
            }));
        }

        // Save the final progress
        await this.plugin.saveSettings();
    }

    private static displayProgress(progress: number, totalFiles: number) {
        const percentage = Math.round((progress / totalFiles) * 100);
        console.log(`Progress: ${progress}/${totalFiles} (${percentage}%)`);
    }
}
