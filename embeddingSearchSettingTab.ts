import EmbeddingSearchPlugin from "./main";
import {App, PluginSettingTab, Setting} from "obsidian";

export class EmbeddingSearchSettingTab extends PluginSettingTab {
    plugin: EmbeddingSearchPlugin;

    constructor(app: App, plugin: EmbeddingSearchPlugin) {
        super(app, plugin);
        this.plugin = plugin;
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
    }
}
