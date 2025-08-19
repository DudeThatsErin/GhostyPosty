const { Plugin, PluginSettingTab, Setting, Notice, Modal, TFile } = require('obsidian');

const DEFAULT_SETTINGS = {
    ghostUrl: '',
    adminApiKey: '',
    showNotifications: true,
    defaultStatus: 'draft',
    defaultVisibility: 'public',
    defaultTags: '',
    defaultFeatured: false
};

class GhostyPostyModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.postData = {
            title: '',
            excerpt: '',
            tags: '',
            status: 'draft',
            featured: false,
            visibility: 'public',
            featured_image: ''
        };
        this.isUpdate = false;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ghosty-modal');

        // Add CSS styles
        const style = contentEl.createEl('style');
        style.textContent = `
            .ghosty-modal { padding: 20px; max-width: 600px; }
            .ghosty-modal-header { display: flex; align-items: center; margin-bottom: 20px; gap: 10px; }
            .ghosty-modal-icon { font-size: 24px; }
            .ghosty-modal-title { margin: 0; color: var(--text-normal); }
            .ghosty-form-section { margin-bottom: 16px; }
            .ghosty-form-label { display: block; margin-bottom: 4px; font-weight: 600; color: var(--text-normal); }
            .ghosty-form-input, .ghosty-form-textarea, .ghosty-form-select { width: 100%; padding: 12px 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-family: inherit; min-height: 44px; }
            .ghosty-form-textarea { resize: vertical; min-height: 60px; }
            .ghosty-form-help { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
            .ghosty-form-row { display: flex; gap: 12px; }
            .ghosty-form-row .ghosty-form-section { flex: 1; }
            .ghosty-modal-buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
            .ghosty-modal-button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
            .ghosty-modal-button-cancel { background: var(--background-modifier-border); color: var(--text-normal); }
            .ghosty-modal-button-upload { background: var(--interactive-accent); color: var(--text-on-accent); }
            .ghosty-modal-button:hover { opacity: 0.8; }
        `;

        // Pre-fill with current file data and defaults
        const activeFile = this.app.workspace.getActiveFile();
        this.isUpdate = false;
        if (activeFile && activeFile.extension === 'md') {
            this.postData.title = activeFile.basename;
            // Set defaults from plugin settings
            this.postData.status = this.plugin.settings.defaultStatus;
            this.postData.visibility = this.plugin.settings.defaultVisibility;
            this.postData.featured = this.plugin.settings.defaultFeatured;
            this.postData.tags = this.plugin.settings.defaultTags;
            
            this.app.vault.read(activeFile).then(content => {
                const frontmatter = this.plugin.parseFrontmatter(content);
                if (frontmatter.ghost_id) {
                    this.isUpdate = true;
                    this.updateButtonText();
                    // Pre-fill from frontmatter (overrides defaults)
                    if (frontmatter.excerpt) this.postData.excerpt = frontmatter.excerpt;
                    if (frontmatter.tags) this.postData.tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : frontmatter.tags;
                    if (frontmatter.status) this.postData.status = frontmatter.status;
                    if (frontmatter.featured) this.postData.featured = frontmatter.featured;
                    if (frontmatter.visibility) this.postData.visibility = frontmatter.visibility;
                    if (frontmatter.featured_image) this.postData.featured_image = frontmatter.featured_image;
                }
                this.updateFormFields();
            });
        }

        // Header
        const header = contentEl.createDiv('ghosty-modal-header');
        header.createSpan('ghosty-modal-icon').textContent = '👻';
        header.createEl('h2', { text: 'Ghost Blog Manager', cls: 'ghosty-modal-title' });

        // Form
        const form = contentEl.createEl('form');

        // Title
        const titleSection = form.createDiv('ghosty-form-section');
        titleSection.createEl('label', { text: 'Title', cls: 'ghosty-form-label' });
        this.titleInput = titleSection.createEl('input', { 
            type: 'text', 
            placeholder: 'Enter post title',
            cls: 'ghosty-form-input',
            value: this.postData.title
        });
        this.titleInput.addEventListener('input', (e) => {
            this.postData.title = e.target.value;
        });

        // Excerpt
        const excerptSection = form.createDiv('ghosty-form-section');
        excerptSection.createEl('label', { text: 'Excerpt', cls: 'ghosty-form-label' });
        this.excerptInput = excerptSection.createEl('textarea', { 
            placeholder: 'Brief description of the post (optional)',
            cls: 'ghosty-form-textarea',
            value: this.postData.excerpt
        });
        this.excerptInput.addEventListener('input', (e) => {
            this.postData.excerpt = e.target.value;
        });

        // Featured Image
        const featuredImageSection = form.createDiv('ghosty-form-section');
        featuredImageSection.createEl('label', { text: 'Featured Image URL', cls: 'ghosty-form-label' });
        this.featuredImageInput = featuredImageSection.createEl('input', { 
            type: 'text', 
            placeholder: 'https://example.com/image.jpg',
            cls: 'ghosty-form-input',
            value: this.postData.featured_image
        });
        this.featuredImageInput.addEventListener('input', (e) => {
            this.postData.featured_image = e.target.value;
        });

        // Tags
        const tagsSection = form.createDiv('ghosty-form-section');
        tagsSection.createEl('label', { text: 'Tags', cls: 'ghosty-form-label' });
        this.tagsInput = tagsSection.createEl('input', { 
            type: 'text', 
            placeholder: 'obsidian, blogging, ghost',
            cls: 'ghosty-form-input',
            value: this.postData.tags
        });
        this.tagsInput.addEventListener('input', (e) => {
            this.postData.tags = e.target.value;
        });

        // Status and Visibility row
        const statusRow = form.createDiv('ghosty-form-row');
        
        const statusSection = statusRow.createDiv('ghosty-form-section');
        statusSection.createEl('label', { text: 'Status', cls: 'ghosty-form-label' });
        this.statusSelect = statusSection.createEl('select', { cls: 'ghosty-form-select' });
        ['draft', 'published', 'scheduled'].forEach(status => {
            const option = this.statusSelect.createEl('option', { value: status, text: status.charAt(0).toUpperCase() + status.slice(1) });
            if (status === this.postData.status) option.selected = true;
        });
        this.statusSelect.addEventListener('change', (e) => {
            this.postData.status = e.target.value;
        });

        const visibilitySection = statusRow.createDiv('ghosty-form-section');
        visibilitySection.createEl('label', { text: 'Visibility', cls: 'ghosty-form-label' });
        this.visibilitySelect = visibilitySection.createEl('select', { cls: 'ghosty-form-select' });
        ['public', 'members', 'paid'].forEach(visibility => {
            const option = this.visibilitySelect.createEl('option', { value: visibility, text: visibility.charAt(0).toUpperCase() + visibility.slice(1) });
            if (visibility === this.postData.visibility) option.selected = true;
        });
        this.visibilitySelect.addEventListener('change', (e) => {
            this.postData.visibility = e.target.value;
        });

        // Featured toggle
        const featuredSection = form.createDiv('ghosty-form-section');
        const featuredLabel = featuredSection.createEl('label', { cls: 'ghosty-form-label' });
        this.featuredInput = featuredLabel.createEl('input', { type: 'checkbox' });
        featuredLabel.createSpan().textContent = ' Featured Post';
        this.featuredInput.checked = this.postData.featured;
        this.featuredInput.addEventListener('change', (e) => {
            this.postData.featured = e.target.checked;
        });

        // Buttons
        const buttons = contentEl.createDiv('ghosty-modal-buttons');
        
        const cancelButton = buttons.createEl('button', { 
            text: 'Cancel', 
            type: 'button',
            cls: 'ghosty-modal-button ghosty-modal-button-cancel' 
        });
        
        this.uploadButton = buttons.createEl('button', { 
            text: 'Upload to Ghost', 
            type: 'submit',
            cls: 'ghosty-modal-button ghosty-modal-button-upload' 
        });

        this.uploadButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleUpload();
        });

        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    updateFormFields() {
        if (this.excerptInput) this.excerptInput.value = this.postData.excerpt;
        if (this.tagsInput) this.tagsInput.value = this.postData.tags;
        if (this.statusSelect) this.statusSelect.value = this.postData.status;
        if (this.visibilitySelect) this.visibilitySelect.value = this.postData.visibility;
        if (this.featuredInput) this.featuredInput.checked = this.postData.featured;
        if (this.featuredImageInput) this.featuredImageInput.value = this.postData.featured_image;
    }

    updateButtonText() {
        if (this.uploadButton) {
            this.uploadButton.textContent = this.isUpdate ? 'Update Post' : 'Upload to Ghost';
        }
    }

    async handleUpload() {
        if (!this.postData.title.trim()) {
            new Notice('Please enter a title');
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file to upload');
            return;
        }

        try {
            const content = await this.app.vault.read(activeFile);
            if (!content.trim()) {
                new Notice('The current file is empty');
                return;
            }

            const options = {
                excerpt: this.postData.excerpt,
                status: this.postData.status,
                featured: this.postData.featured,
                visibility: this.postData.visibility,
                featured_image: this.postData.featured_image
            };

            if (this.postData.tags && this.postData.tags.trim()) {
                options.tags = this.postData.tags.split(',').map(tag => ({ name: tag.trim() }));
            }

            await this.plugin.uploadToGhost(this.postData.title, content, options);
            this.close();
        } catch (error) {
            // Error already handled in uploadToGhost
        }
    }

    async handleDownload() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file to download to');
            return;
        }

        try {
            const content = await this.app.vault.read(activeFile);
            const frontmatter = this.plugin.parseFrontmatter(content);
            
            if (!frontmatter.ghost_id) {
                new Notice('No ghost_id found in frontmatter. Cannot download.');
                return;
            }

            await this.plugin.downloadFromGhost(frontmatter.ghost_id);
            this.close();
        } catch (error) {
            console.error('Download error:', error);
            new Notice(`Download failed: ${error.message}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class GhostyPostySettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'GhostyPosty Settings' });

        // Connection Settings
        containerEl.createEl('h3', { text: 'Connection' });
        
        new Setting(containerEl)
            .setName('Ghost URL')
            .setDesc('Your Ghost blog URL (e.g., https://yourblog.com)')
            .addText(text => text
                .setPlaceholder('https://yourblog.com')
                .setValue(this.plugin.settings.ghostUrl)
                .onChange(async (value) => {
                    this.plugin.settings.ghostUrl = value.replace(/\/$/, '');
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Admin API Key')
            .setDesc('Ghost Admin API Key (found in Ghost Admin > Integrations)')
            .addText(text => text
                .setPlaceholder('keyId:keySecret')
                .setValue(this.plugin.settings.adminApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.adminApiKey = value;
                    await this.plugin.saveSettings();
                }));

        // General Settings
        containerEl.createEl('h3', { text: 'General' });
        
        new Setting(containerEl)
            .setName('Show notifications')
            .setDesc('Show upload/download status notifications')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.showNotifications = value;
                    await this.plugin.saveSettings();
                }));

        // Default Upload Settings
        const defaultsContainer = containerEl.createDiv();
        defaultsContainer.createEl('h3', { text: 'Default Upload Settings' });
        
        const detailsEl = defaultsContainer.createEl('details');
        const summaryEl = detailsEl.createEl('summary');
        summaryEl.textContent = 'Configure default values for new posts';
        summaryEl.style.cursor = 'pointer';
        summaryEl.style.marginBottom = '10px';
        
        const defaultsContent = detailsEl.createDiv();
        
        new Setting(defaultsContent)
            .setName('Default status')
            .setDesc('Default status for new posts')
            .addDropdown(dropdown => dropdown
                .addOption('draft', 'Draft')
                .addOption('published', 'Published')
                .addOption('scheduled', 'Scheduled')
                .setValue(this.plugin.settings.defaultStatus)
                .onChange(async (value) => {
                    this.plugin.settings.defaultStatus = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(defaultsContent)
            .setName('Default visibility')
            .setDesc('Default visibility for new posts')
            .addDropdown(dropdown => dropdown
                .addOption('public', 'Public')
                .addOption('members', 'Members only')
                .addOption('paid', 'Paid members only')
                .setValue(this.plugin.settings.defaultVisibility)
                .onChange(async (value) => {
                    this.plugin.settings.defaultVisibility = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(defaultsContent)
            .setName('Default tags')
            .setDesc('Default tags for new posts (comma-separated)')
            .addText(text => text
                .setPlaceholder('obsidian, blogging, ghost')
                .setValue(this.plugin.settings.defaultTags)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(defaultsContent)
            .setName('Default featured post')
            .setDesc('Make new posts featured by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.defaultFeatured)
                .onChange(async (value) => {
                    this.plugin.settings.defaultFeatured = value;
                    await this.plugin.saveSettings();
                }));

        // Support & Links
        containerEl.createEl('h3', { text: 'Support & Links' });
        
        const supportContainer = containerEl.createDiv();
        supportContainer.style.marginBottom = '20px';
        
        const linkStyle = 'color: var(--interactive-accent); text-decoration: none; margin-right: 15px;';
        
        const ghostDocsLink = supportContainer.createEl('a', {
            text: '📚 Ghost API Documentation',
            href: 'https://ghost.org/docs/admin-api/'
        });
        ghostDocsLink.style.cssText = linkStyle;
        ghostDocsLink.setAttribute('target', '_blank');
        
        supportContainer.createEl('br');
        supportContainer.createEl('br');
        
        const obsidianLink = supportContainer.createEl('a', {
            text: '🔌 Obsidian Plugin Development',
            href: 'https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin'
        });
        obsidianLink.style.cssText = linkStyle;
        obsidianLink.setAttribute('target', '_blank');
    }
}

class GhostyPostyPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('ghost', 'Upload to Ghost', () => {
            new GhostyPostyModal(this.app, this).open();
        });

        this.addCommand({
            id: 'open-ghost-modal',
            name: 'Open Ghost upload modal',
            callback: () => {
                new GhostyPostyModal(this.app, this).open();
            }
        });

        this.addSettingTab(new GhostyPostySettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async uploadToGhost(title, content, options = {}) {
        if (!this.settings.ghostUrl || !this.settings.adminApiKey) {
            new Notice('Please configure Ghost URL and Admin API Key in settings');
            return;
        }

        const [keyId, keySecret] = this.settings.adminApiKey.split(':');
        if (!keyId || !keySecret) {
            new Notice('Invalid Admin API Key format. Expected: keyId:keySecret');
            return;
        }

        try {
            const jwt = await this.createJWT(keyId, keySecret);
            const frontmatter = this.parseFrontmatter(content);
            const existingGhostId = frontmatter.ghost_id;
            const cleanContent = this.removeFrontmatter(content);
            const htmlContent = this.markdownToHtml(cleanContent);
            
            const post = {
                title: title,
                lexical: this.htmlToLexical(htmlContent),
                status: options.status || 'draft',
                featured: options.featured || false,
                visibility: options.visibility || 'public'
            };

            if (options.excerpt && options.excerpt.trim()) {
                post.custom_excerpt = options.excerpt.trim();
            }

            if (options.featured_image && options.featured_image.trim()) {
                post.feature_image = options.featured_image.trim();
            }

            if (options.tags && Array.isArray(options.tags) && options.tags.length > 0) {
                post.tags = options.tags;
            }

            if (existingGhostId) {
                return await this.updateGhostPost(existingGhostId, post, jwt);
            }

            const response = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/posts/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Ghost ${jwt}`,
                    'Content-Type': 'application/json',
                    'Accept-Version': 'v5.0'
                },
                body: JSON.stringify({ posts: [post] })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorData}`);
            }

            const result = await response.json();
            const createdPost = result.posts[0];

            if (this.settings.showNotifications) {
                new Notice(`Post uploaded successfully: ${createdPost.title}`);
            }

            await this.addGhostDataToFrontmatter(createdPost);

            return createdPost;

        } catch (error) {
            console.error('Upload error:', error);
            new Notice(`Upload failed: ${error.message}`);
            throw error;
        }
    }

    async updateGhostPost(ghostId, post, jwt) {
        try {
            const getResponse = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/posts/${ghostId}/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Ghost ${jwt}`,
                    'Accept-Version': 'v5.0'
                }
            });

            if (!getResponse.ok) {
                throw new Error(`Failed to fetch existing post: ${getResponse.status}`);
            }

            const existingPost = await getResponse.json();
            post.updated_at = existingPost.posts[0].updated_at;
            post.mobiledoc = null;
            
            const updateResponse = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/posts/${ghostId}/`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Ghost ${jwt}`,
                    'Content-Type': 'application/json',
                    'Accept-Version': 'v5.0'
                },
                body: JSON.stringify({ posts: [post] })
            });

            if (!updateResponse.ok) {
                const errorData = await updateResponse.text();
                throw new Error(`HTTP ${updateResponse.status}: ${errorData}`);
            }

            const result = await updateResponse.json();
            
            if (this.settings.showNotifications) {
                new Notice(`Post updated successfully: ${result.posts[0].title}`);
            }

            return result.posts[0];

        } catch (error) {
            console.error('Update error:', error);
            new Notice(`Update failed: ${error.message}`);
            throw error;
        }
    }

    async downloadFromGhost(ghostId) {
        if (!this.settings.ghostUrl || !this.settings.adminApiKey) {
            new Notice('Please configure Ghost URL and Admin API Key in settings');
            return;
        }

        const [keyId, keySecret] = this.settings.adminApiKey.split(':');
        try {
            const jwt = await this.createJWT(keyId, keySecret);
            
            const response = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/posts/${ghostId}/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Ghost ${jwt}`,
                    'Accept-Version': 'v5.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch post: ${response.status}`);
            }

            const result = await response.json();
            const post = result.posts[0];
            const markdownContent = this.lexicalToMarkdown(post.lexical);
            
            const frontmatter = {
                ghost_id: post.id,
                title: post.title,
                excerpt: post.custom_excerpt || '',
                status: post.status,
                visibility: post.visibility,
                featured: post.featured,
                created_at: post.created_at,
                updated_at: post.updated_at,
                published_at: post.published_at
            };

            if (post.feature_image) {
                frontmatter.featured_image = post.feature_image;
            }

            if (post.tags && post.tags.length > 0) {
                frontmatter.tags = post.tags.map(tag => tag.name);
            }

            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile && activeFile.extension === 'md') {
                const newContent = this.addFrontmatterToContent(markdownContent, frontmatter);
                await this.app.vault.modify(activeFile, newContent);
                
                if (this.settings.showNotifications) {
                    new Notice(`Post downloaded successfully: ${post.title}`);
                }
            }

        } catch (error) {
            console.error('Download error:', error);
            new Notice(`Download failed: ${error.message}`);
            throw error;
        }
    }

    async createJWT(keyId, keySecret) {
        const header = { alg: 'HS256', typ: 'JWT', kid: keyId };
        const now = Math.floor(Date.now() / 1000);
        const payload = { iat: now, exp: now + (5 * 60), aud: '/admin/' };

        const encoder = new TextEncoder();
        const headerB64 = btoa(JSON.stringify(header)).replace(/[+\/=]/g, m => ({'+':'-', '/':'_', '=':''}[m]));
        const payloadB64 = btoa(JSON.stringify(payload)).replace(/[+\/=]/g, m => ({'+':'-', '/':'_', '=':''}[m]));
        
        const message = `${headerB64}.${payloadB64}`;
        const key = await crypto.subtle.importKey('raw', encoder.encode(keySecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
        const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+\/=]/g, m => ({'+':'-', '/':'_', '=':''}[m]));
        
        return `${message}.${signatureB64}`;
    }

    markdownToHtml(markdown) {
        let html = markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/!\[([^\]]*)\]\(([^\)]*)\)/gim, '<img alt="$1" src="$2" />')
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>')
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');
        
        if (!html.startsWith('<')) {
            html = '<p>' + html + '</p>';
        }
        
        return html;
    }

    htmlToLexical(html) {
        const lexicalDoc = {
            root: {
                children: [],
                direction: null,
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        };

        const content = html.replace(/<\/?p>/g, '');
        const paragraphs = content.split(/<br\s*\/?>\s*<br\s*\/?>/);
        
        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;
            
            const children = this.parseInlineFormatting(paragraph);
            if (children.length > 0) {
                lexicalDoc.root.children.push({
                    children: children,
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "paragraph",
                    version: 1
                });
            }
        }
        
        return JSON.stringify(lexicalDoc);
    }

    parseInlineFormatting(text) {
        const children = [];
        let currentText = text;
        
        // Simple text node for now
        if (currentText.trim()) {
            children.push({
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: currentText.trim(),
                type: "text",
                version: 1
            });
        }
        
        return children;
    }

    lexicalToMarkdown(lexicalJson) {
        try {
            const lexical = JSON.parse(lexicalJson);
            let markdown = '';
            
            for (const node of lexical.root.children) {
                if (node.type === 'paragraph') {
                    const text = node.children.map(child => child.text || '').join('');
                    markdown += text + '\n\n';
                } else if (node.type === 'heading') {
                    const text = node.children.map(child => child.text || '').join('');
                    const level = node.tag === 'h1' ? '#' : node.tag === 'h2' ? '##' : '###';
                    markdown += `${level} ${text}\n\n`;
                }
            }
            
            return markdown.trim();
        } catch (error) {
            console.error('Error converting lexical to markdown:', error);
            return '';
        }
    }

    parseFrontmatter(content) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontmatterRegex);
        
        if (!match) return {};
        
        try {
            const frontmatterText = match[1];
            const frontmatter = {};
            
            frontmatterText.split('\n').forEach(line => {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    
                    if (value.startsWith('[') && value.endsWith(']')) {
                        frontmatter[key] = value.slice(1, -1).split(',').map(item => item.trim());
                    } else if (value === 'true') {
                        frontmatter[key] = true;
                    } else if (value === 'false') {
                        frontmatter[key] = false;
                    } else {
                        frontmatter[key] = value;
                    }
                }
            });
            
            return frontmatter;
        } catch (error) {
            console.error('Error parsing frontmatter:', error);
            return {};
        }
    }

    removeFrontmatter(content) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        return content.replace(frontmatterRegex, '').trim();
    }

    addFrontmatterToContent(content, frontmatter) {
        let yamlContent = '---\n';
        
        for (const [key, value] of Object.entries(frontmatter)) {
            if (Array.isArray(value)) {
                yamlContent += `${key}: [${value.join(', ')}]\n`;
            } else {
                yamlContent += `${key}: ${value}\n`;
            }
        }
        
        yamlContent += '---\n\n';
        return yamlContent + content;
    }

    async addGhostDataToFrontmatter(ghostPost) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') return;

        const content = await this.app.vault.read(activeFile);
        const existingFrontmatter = this.parseFrontmatter(content);
        
        const updatedFrontmatter = {
            ...existingFrontmatter,
            ghost_id: ghostPost.id,
            status: ghostPost.status,
            visibility: ghostPost.visibility,
            featured: ghostPost.featured,
            created_at: ghostPost.created_at,
            updated_at: ghostPost.updated_at
        };

        if (ghostPost.custom_excerpt) {
            updatedFrontmatter.excerpt = ghostPost.custom_excerpt;
        }

        if (ghostPost.feature_image) {
            updatedFrontmatter.featured_image = ghostPost.feature_image;
        }

        if (ghostPost.tags && ghostPost.tags.length > 0) {
            updatedFrontmatter.tags = ghostPost.tags.map(tag => tag.name);
        }

        const cleanContent = this.removeFrontmatter(content);
        const newContent = this.addFrontmatterToContent(cleanContent, updatedFrontmatter);
        
        await this.app.vault.modify(activeFile, newContent);
    }
}

module.exports = GhostyPostyPlugin;
