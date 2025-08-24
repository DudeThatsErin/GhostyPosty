const { Plugin, PluginSettingTab, Setting, Notice, Modal, TFile } = require('obsidian');

const DEFAULT_SETTINGS = {
    ghostUrl: '',
    adminApiKey: '',
    showNotifications: true,
    defaultStatus: 'draft',
    defaultVisibility: 'public',
    defaultTags: '',
    defaultFeatured: false,
    yamlFieldNames: {
        ghost_id: 'ghost_id',
        excerpt: 'excerpt',
        status: 'status',
        visibility: 'visibility',
        featured: 'featured',
        featured_image: 'banner',
        created_at: 'created_at',
        updated_at: 'updated_at',
        published_at: 'published_at'
    }
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
        this.eventListeners = []; // Track event listeners for cleanup
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ghosty-modal');

        // Modal styles are now in external style.css file

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
            
            try {
                const content = await this.app.vault.read(activeFile);
                const frontmatter = this.plugin.parseFrontmatter(content);
                if (frontmatter.ghost_id) {
                    this.isUpdate = true;
                    // Pre-fill from frontmatter (overrides defaults)
                    if (frontmatter.excerpt) this.postData.excerpt = frontmatter.excerpt;
                    if (frontmatter.tags) this.postData.tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : frontmatter.tags;
                    if (frontmatter.status) this.postData.status = frontmatter.status;
                    if (frontmatter.featured !== undefined) this.postData.featured = frontmatter.featured;
                    if (frontmatter.visibility) this.postData.visibility = frontmatter.visibility;
                    if (frontmatter[this.plugin.settings.yamlFieldNames.featured_image]) this.postData.featured_image = frontmatter[this.plugin.settings.yamlFieldNames.featured_image];
                }
            } catch (error) {
                console.error('Error reading file:', error);
            }    
            setTimeout(() => {
                this.updateFormFields();
                this.updateButtonText();
            }, 10);
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

            const result = await this.plugin.uploadToGhost(this.postData.title, content, options);
            
            // Update frontmatter with modal changes
            if (result) {
                await this.updateFrontmatterFromModal();
            }
            
            this.close();
        } catch (error) {
            // Error already handled in uploadToGhost
        }
    }

    async updateFrontmatterFromModal() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') return;

        const content = await this.app.vault.read(activeFile);
        const existingFrontmatter = this.plugin.parseFrontmatter(content);
        
        const updatedFrontmatter = {
            ...existingFrontmatter,
            title: this.postData.title,
            excerpt: this.postData.excerpt || '',
            status: this.postData.status,
            visibility: this.postData.visibility,
            featured: this.postData.featured
        };

        if (this.postData.tags && this.postData.tags.trim()) {
            updatedFrontmatter.tags = this.postData.tags.split(',').map(tag => tag.trim());
        }

        const cleanContent = this.plugin.removeFrontmatter(content);
        const newContent = this.plugin.addFrontmatterToContent(cleanContent, updatedFrontmatter);
        
        await this.app.vault.modify(activeFile, newContent);
        
        // Rename file if title changed
        if (this.postData.title && this.postData.title !== activeFile.basename) {
            const newPath = activeFile.path.replace(activeFile.name, `${this.postData.title}.md`);
            await this.app.vault.rename(activeFile, newPath);
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
        
        // Clean up all DOM elements and their event listeners
        contentEl.empty();
        
        // Clear references to prevent memory leaks
        this.titleInput = null;
        this.excerptInput = null;
        this.tagsInput = null;
        this.statusSelect = null;
        this.visibilitySelect = null;
        this.featuredInput = null;
        this.uploadButton = null;
        this.eventListeners = [];
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

        // Support & Links Section
        this.createAccordionSection(containerEl, 'Support & Links', () => {
            const supportContainer = containerEl.createDiv();
            supportContainer.className = 'support-container';
            
            const buyMeACoffeeBtn = supportContainer.createEl('a', { 
                text: '☕ Buy Me a Coffee',
                href: 'https://buymeacoffee.com/erinskidds'
            });
            buyMeACoffeeBtn.className = 'support-link coffee-link';
            
            const githubBtn = supportContainer.createEl('a', { 
                text: '⭐ Star on GitHub',
                href: 'https://github.com/DudeThatsErin/GhostyPosty'
            });
            githubBtn.className = 'support-link github-link';
            
            const issuesBtn = supportContainer.createEl('a', { 
                text: '🐛 Report Issues',
                href: 'https://github.com/DudeThatsErin/GhostyPosty/issues'
            });
            issuesBtn.className = 'support-link issues-link';
            
            const discordBtn = supportContainer.createEl('a', { 
                text: '💬 Discord Support',
                href: 'https://discord.gg/XcJWhE3SEA'
            });
            discordBtn.className = 'support-link discord-link';
        });

        // Connection Settings
        this.createAccordionSection(containerEl, 'Connection', () => {
        
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
                .setName('Admin API key')
                .setDesc('Ghost Admin API Key (found in Ghost Admin > Integrations)')
                .addText(text => text
                    .setPlaceholder('keyId:keySecret')
                    .setValue(this.plugin.settings.adminApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.adminApiKey = value;
                        await this.plugin.saveSettings();
                    }));
        });

        // General Settings
        this.createAccordionSection(containerEl, 'General', () => {
        
            new Setting(containerEl)
                .setName('Show notifications')
                .setDesc('Show upload/download status notifications')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.showNotifications)
                    .onChange(async (value) => {
                        this.plugin.settings.showNotifications = value;
                        await this.plugin.saveSettings();
                    }));
        });

        // YAML Field Names
        this.createAccordionSection(containerEl, 'YAML Field Names', () => {
            new Setting(containerEl)
                .setName('Ghost ID field')
                .setDesc('YAML field name for Ghost post ID')
                .addText(text => text
                    .setPlaceholder('ghost_id')
                    .setValue(this.plugin.settings.yamlFieldNames.ghost_id)
                    .onChange(async (value) => {
                        this.plugin.settings.yamlFieldNames.ghost_id = value || 'ghost_id';
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Excerpt field')
                .setDesc('YAML field name for post excerpt')
                .addText(text => text
                    .setPlaceholder('excerpt')
                    .setValue(this.plugin.settings.yamlFieldNames.excerpt)
                    .onChange(async (value) => {
                        this.plugin.settings.yamlFieldNames.excerpt = value || 'excerpt';
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Status field')
                .setDesc('YAML field name for post status')
                .addText(text => text
                    .setPlaceholder('status')
                    .setValue(this.plugin.settings.yamlFieldNames.status)
                    .onChange(async (value) => {
                        this.plugin.settings.yamlFieldNames.status = value || 'status';
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Visibility field')
                .setDesc('YAML field name for post visibility')
                .addText(text => text
                    .setPlaceholder('visibility')
                    .setValue(this.plugin.settings.yamlFieldNames.visibility)
                    .onChange(async (value) => {
                        this.plugin.settings.yamlFieldNames.visibility = value || 'visibility';
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Featured field')
                .setDesc('YAML field name for featured post flag')
                .addText(text => text
                    .setPlaceholder('featured')
                    .setValue(this.plugin.settings.yamlFieldNames.featured)
                    .onChange(async (value) => {
                        this.plugin.settings.yamlFieldNames.featured = value || 'featured';
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Featured image field')
                .setDesc('YAML field name for featured image URL')
                .addText(text => text
                    .setPlaceholder('banner')
                    .setValue(this.plugin.settings.yamlFieldNames.featured_image)
                    .onChange(async (value) => {
                        this.plugin.settings.yamlFieldNames.featured_image = value || 'banner';
                        await this.plugin.saveSettings();
                    }));
        });

        // Default Upload Settings
        this.createAccordionSection(containerEl, 'Default Upload Settings', () => {
        
            new Setting(containerEl)
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

            new Setting(containerEl)
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

            new Setting(containerEl)
                .setName('Default tags')
                .setDesc('Default tags for new posts (comma-separated)')
                .addText(text => text
                    .setPlaceholder('obsidian, blogging, ghost')
                    .setValue(this.plugin.settings.defaultTags)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultTags = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Default featured post')
                .setDesc('Make new posts featured by default')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.defaultFeatured)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultFeatured = value;
                        await this.plugin.saveSettings();
                    }));
        });
    }

    createAccordionSection(containerEl, title, contentCallback) {
        const accordionContainer = containerEl.createDiv('accordion-section');
        
        const header = accordionContainer.createDiv('accordion-header');
        header.className = 'accordion-header';
        
        const headerText = header.createSpan();
        headerText.textContent = title;
        
        const arrow = header.createSpan('accordion-arrow');
        arrow.textContent = '▼';
        arrow.className = 'accordion-arrow';
        
        const content = accordionContainer.createDiv('accordion-content');
        content.className = 'accordion-content';
        
        let isExpanded = true;
        
        const toggleAccordion = () => {
            isExpanded = !isExpanded;
            
            if (isExpanded) {
                content.classList.add('expanded');
                content.classList.remove('collapsed');
                arrow.classList.add('expanded');
                arrow.classList.remove('collapsed');
                header.classList.add('expanded');
                header.classList.remove('collapsed');
            } else {
                content.classList.add('collapsed');
                content.classList.remove('expanded');
                arrow.classList.add('collapsed');
                arrow.classList.remove('expanded');
                header.classList.add('collapsed');
                header.classList.remove('expanded');
            }
        };
        
        header.addEventListener('click', toggleAccordion);
        
        // Hover effects are now handled by CSS
        
        const tempContainer = containerEl.createDiv();
        const originalCreateEl = containerEl.createEl;
        containerEl.createEl = tempContainer.createEl.bind(tempContainer);
        
        contentCallback();
        
        containerEl.createEl = originalCreateEl;
        
        while (tempContainer.firstChild) {
            content.appendChild(tempContainer.firstChild);
        }
        
        tempContainer.remove();
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

    onunload() {
        // Clean up any remaining resources
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async uploadToGhost(title, content, options = {}) {
        console.log('=== UPLOAD TO GHOST STARTED ===');
        console.log('Title:', title);
        console.log('Content length:', content ? content.length : 'undefined');
        console.log('Options:', options);
        
        try {
            console.log('Starting Ghost upload process...');
            
            if (!this.settings.ghostUrl || !this.settings.adminApiKey) {
                new Notice('Please configure Ghost URL and Admin API Key in settings');
                return;
            }

            const [keyId, keySecret] = this.settings.adminApiKey.split(':');
            if (!keyId || !keySecret) {
                new Notice('Invalid Admin API Key format. Expected: keyId:keySecret');
                return;
            }
            
            // Store credentials for JWT regeneration
            this.currentKeyId = keyId;
            this.currentKeySecret = keySecret;
            
            let jwt = await this.createJWT(keyId, keySecret);
            console.log('JWT created successfully');
            
            // Extract Ghost ID from frontmatter if it exists
            const frontmatter = this.parseFrontmatter(content);
            const ghostId = frontmatter.ghost_id;
            
            if (ghostId) {
                console.log('Existing Ghost ID:', ghostId);
            }
            
            console.log('Processing markdown to HTML...');
            // Remove frontmatter before processing content
            const cleanContent = this.removeFrontmatter(content);
            const html = await this.markdownToHtml(cleanContent);
            console.log('HTML conversion completed, length:', html.length);
            
            console.log('Generating Lexical JSON...');
            const lexicalJson = this.markdownToLexical(cleanContent);
            console.log('Lexical conversion completed, length:', lexicalJson.length);
            
            // Ensure HTML is a string to avoid the html.match error
            const safeHtml = typeof html === 'string' ? html : String(html || '');
            console.log('Safe HTML content type:', typeof safeHtml, 'length:', safeHtml.length);
            console.log('HTML content preview:', safeHtml.substring(0, 200) + '...');
            
            // Process featured image if present
            let featureImage = null;
            console.log('Processing featured image...');
            if (options.featured_image) {
                // Clean up the path - remove markdown image syntax if present
                let imagePath = options.featured_image;
                console.log('Original featured image path:', imagePath);
                
                // Remove quotes and exclamation marks more aggressively
                imagePath = imagePath.replace(/["']/g, ''); // Remove all quotes
                imagePath = imagePath.replace(/^!+/, ''); // Remove leading exclamation marks
                
                // Remove markdown image syntax if present
                if (imagePath.match(/\[\[.*\]\]/)) {
                    imagePath = imagePath.replace(/\[\[(.*?)\]\]/, '$1');
                }
                
                console.log('Cleaned featured image path:', imagePath);
                
                // Upload the image to Ghost if it's a local path
                console.log('Uploading featured image to Ghost...');
                try {
                    featureImage = await this.uploadImageToGhost(imagePath);
                } catch (error) {
                    console.error('Featured image upload failed:', error.message);
                    // If it's not a local file, it might be a URL
                    if (imagePath.startsWith('http')) {
                        featureImage = imagePath;
                    } else {
                        // Skip featured image on error to prevent blocking the post upload
                        console.log('Skipping featured image due to upload error');
                        featureImage = null;
                    }
                }
            }
            
            // Convert to proper Lexical format that Ghost expects
            const lexicalContent = this.htmlToGhostLexical(safeHtml);
            
            console.log('Lexical content being created:', JSON.stringify(lexicalContent, null, 2));
            console.log('HTML content length:', safeHtml.length);
            console.log('HTML preview:', safeHtml.substring(0, 200));
            console.log('safeHtml type:', typeof safeHtml);
            
            // Try without lexical field first to isolate the issue
            const ghostPost = {
                title: String(options.title || options.filename || 'Untitled Post'),
                status: options.status || 'draft',
                visibility: options.visibility || 'public',
                featured: options.featured || false,
                html: String(safeHtml || ''), // Ensure HTML is always a string
                // lexical: String(lexicalContent || ''), // Temporarily removed to test
                feature_image: featureImage,
                custom_excerpt: options.excerpt,
                tags: options.tags ? options.tags.map(tag => ({ name: tag })) : []
            };    
            
            if (options.slug) {
                ghostPost.slug = options.slug;
            }
            
            console.log('Ghost post object created with visibility:', ghostPost.visibility);
            console.log('Options visibility:', options.visibility);
            console.log('HTML content length being sent:', safeHtml.length);
            console.log('HTML content preview:', safeHtml.substring(0, 300));
            
            if (featureImage) {
                ghostPost.feature_image = featureImage;
            }
            
            if (options.excerpt) {
                ghostPost.custom_excerpt = options.excerpt;
            }
            
            if (options.tags && options.tags.length > 0) {
                ghostPost.tags = options.tags;
            }
            
            if (ghostId) {
                console.log('Updating existing post with ID:', ghostId);
                try {
                    return await this.updateGhostPost(ghostId, ghostPost, jwt);
                } catch (error) {
                    console.log('Update failed, falling back to creating new post:', error.message);
                    return await this.createGhostPost(ghostPost, jwt);
                }
            } else {
                console.log('Creating new post...');
                return await this.createGhostPost(ghostPost, jwt);
            }
        } catch (error) {
            console.error('Upload error:', error);
            new Notice(`Upload failed: ${error.message}`);
            throw error;
        }
    }
    
    async createGhostPost(post, jwt) {
        try {
            console.log('Creating new Ghost post...');
            console.log('Post payload:', JSON.stringify(post, null, 2));
            
            const response = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/posts/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Ghost ${jwt}`,
                    'Content-Type': 'application/json',
                    'Accept-Version': 'v5.0'
                },
                body: JSON.stringify({ posts: [post] })
            });

            console.log('Create response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Create failed with error:', errorData);
                throw new Error(`HTTP ${response.status}: ${errorData}`);
            }

            const result = await response.json();
            const createdPost = result.posts[0];
            console.log('Post created successfully:', createdPost.id);

            if (this.settings.showNotifications) {
                new Notice(`Post uploaded successfully: ${createdPost.title}`);
            }

            console.log('Adding Ghost data to frontmatter...');
            await this.addGhostDataToFrontmatter(createdPost);
            console.log('Frontmatter update completed');

            return createdPost;
        } catch (error) {
            console.error('Create post error:', error);
            throw error;
        }
    }

    async updateGhostPost(ghostId, post, jwt) {
        try {
            console.log('Starting update process for Ghost ID:', ghostId);
            
            // Get the existing post to copy its metadata
            console.log('Fetching existing post data...');
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
            const existing = existingPost.posts[0];
            
            // Log comparison for debugging
            console.log('Existing post title:', existing.title);
            console.log('New post title:', post.title);
            
            // Use lexical format for updates
            console.log('USING LEXICAL FORMAT FOR UPDATE...');
            
            // Prepare the update payload without lexical field to test
            const updatePayload = {
                html: String(post.html || ''), // Ensure HTML is always a string
                // lexical: String(post.lexical || ''), // Temporarily removed to test
                title: String(post.title || post.filename || 'Untitled Post'),
                status: post.status || existing.status || 'draft',
                visibility: post.visibility || existing.visibility || 'public',
                featured: post.featured !== undefined ? post.featured : existing.featured,
                updated_at: existing.updated_at // Required for updates
            };
            
            // Add slug support for URL updates
            if (post.slug) {
                updatePayload.slug = post.slug;
            }
            
            // Copy over metadata from existing post
            if (post.feature_image) updatePayload.feature_image = post.feature_image;
            else if (existing.feature_image) updatePayload.feature_image = existing.feature_image;
            
            if (post.custom_excerpt) updatePayload.custom_excerpt = post.custom_excerpt;
            else if (existing.custom_excerpt) updatePayload.custom_excerpt = existing.custom_excerpt;
            
            if (post.tags) updatePayload.tags = post.tags;
            else if (existing.tags) updatePayload.tags = existing.tags;
            
            console.log('Update payload:', JSON.stringify(updatePayload, null, 2));
            
            console.log('Force update payload:', JSON.stringify(updatePayload, null, 2));
            
            // Update the existing post
            const updateResponse = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/posts/${ghostId}/`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Ghost ${jwt}`,
                    'Content-Type': 'application/json',
                    'Accept-Version': 'v5.0'
                },
                body: JSON.stringify({ posts: [updatePayload] })
            });
            
            console.log('Update response status:', updateResponse.status);

            if (!updateResponse.ok) {
                const errorData = await updateResponse.text();
                console.error('Update failed with error:', errorData);
                console.error('Failed payload was:', JSON.stringify({ posts: [updatePayload] }, null, 2));
                throw new Error(`HTTP ${updateResponse.status}: ${errorData}`);
            }
            
            const updateResult = await updateResponse.json();
            console.log('Raw Ghost response:', JSON.stringify(updateResult, null, 2));
            const updatedPost = updateResult.posts[0];
            
            console.log('VERIFICATION - Updated post HTML length:', updatedPost.html ? updatedPost.html.length : 'NULL');
            console.log('VERIFICATION - Updated post content preview:', updatedPost.html ? updatedPost.html.substring(0, 200) : 'NO CONTENT');
            
            
            console.log('Post updated successfully with ID:', updatedPost.id);
            
            if (this.settings.showNotifications) {
                new Notice(`Post updated successfully: ${updatedPost.title}`);
            }
            
            return updatedPost;

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

        try {
            const jwt = await this.getFreshJWT();
            
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
            // Create update payload - only include fields that have changed
            const updatePayload = {
                title: post.title,
                status: post.status,
                visibility: post.visibility,
                featured: post.featured,
                updated_at: post.updated_at,
                published_at: post.published_at
            };

            if (post.feature_image) {
                updatePayload.feature_image = post.feature_image;
            }

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
        try {
            // Convert hex secret to buffer
            const secretBuffer = new Uint8Array(keySecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            
            const header = { alg: 'HS256', typ: 'JWT', kid: keyId };
            const now = Math.floor(Date.now() / 1000);
            const payload = { 
                iat: now, 
                exp: now + (15 * 60), 
                aud: '/admin/'
            };

            const encoder = new TextEncoder();
            const headerB64 = this.base64UrlEncode(JSON.stringify(header));
            const payloadB64 = this.base64UrlEncode(JSON.stringify(payload));
            
            const message = `${headerB64}.${payloadB64}`;
            const key = await crypto.subtle.importKey(
                'raw', 
                secretBuffer, 
                { name: 'HMAC', hash: 'SHA-256' }, 
                false, 
                ['sign']
            );
            
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
            const signatureB64 = this.base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
            
            return `${message}.${signatureB64}`;
        } catch (error) {
            console.error('JWT creation error:', error);
            throw new Error(`Failed to create JWT: ${error.message}`);
        }
    }

    base64UrlEncode(str) {
        return btoa(str)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    async getFreshJWT() {
        // Always generate a fresh JWT to avoid expiration issues
        if (!this.currentKeyId || !this.currentKeySecret) {
            const [keyId, keySecret] = this.settings.adminApiKey.split(':');
            this.currentKeyId = keyId;
            this.currentKeySecret = keySecret;
        }
        return await this.createJWT(this.currentKeyId, this.currentKeySecret);
    }

    async uploadImageToGhost(imageName) {
        try {
            console.log(`Starting upload for image: ${imageName}`);
            
            // Check if this is actually an image file
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
            const extension = imageName.split('.').pop()?.toLowerCase();
            
            if (!extension || !imageExtensions.includes(extension)) {
                console.log(`Skipping non-image file: ${imageName} (extension: ${extension})`);
                return null;
            }
            
            const vault = this.app.vault;
            
            // Try multiple ways to find the image
            let imageFile = vault.getAbstractFileByPath(imageName);
            if (!imageFile) {
                imageFile = vault.getFiles().find(file => file.name === imageName);
            }
            if (!imageFile) {
                imageFile = vault.getFiles().find(file => file.path.endsWith(imageName));
            }
            if (!imageFile) {
                // Try with assets/ prefix
                imageFile = vault.getAbstractFileByPath(`assets/${imageName}`);
            }
            
            if (!imageFile) {
                console.error(`Image not found in vault: ${imageName}`);
                console.log('Available files:', vault.getFiles().map(f => f.path));
                return null;
            }

            console.log(`Found image file: ${imageFile.path}`);
            const imageBuffer = await vault.readBinary(imageFile);
            console.log(`Read image buffer, size: ${imageBuffer.byteLength} bytes`);
            
            const formData = new FormData();
            const blob = new Blob([imageBuffer], { type: this.getMimeType(imageFile.extension) });
            formData.append('file', blob, imageFile.name);
            formData.append('purpose', 'image');

            const keyId = this.settings.adminApiKey.split(':')[0];
            const keySecret = this.settings.adminApiKey.split(':')[1];
            const jwt = await this.createJWT(keyId, keySecret);

            console.log(`Uploading to Ghost: ${this.settings.ghostUrl}/ghost/api/admin/images/upload/`);
            
            // Create AbortController for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('Upload timeout reached, aborting request...');
                controller.abort();
            }, 60000); // 60 second timeout
            
            const response = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/images/upload/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Ghost ${jwt}`
                },
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            console.log(`Upload response status: ${response.status}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Upload failed: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Upload result:', result);
            return result.images[0].url;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`Image upload timed out after 60 seconds: ${imageName}`);
                console.error('Consider reducing image size or checking network connection');
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error(`Network error uploading image ${imageName}:`, error.message);
                console.error('Check your internet connection and Ghost URL configuration');
            } else {
                console.error(`Failed to upload image ${imageName}:`, error);
            }
            return null;
        }
    }

    getMimeType(extension) {
        const mimeTypes = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        };
        return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
    }

    async markdownToHtml(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            console.warn('Invalid markdown input:', typeof markdown);
            return '';
        }
        
        // Initialize image replacements map
        this.imageReplacements = {};
        
        // First, upload any Obsidian images and replace with Ghost URLs
        // Handle both ![[image.png]] and ![[assets/banners/image.png]] formats
        const imageRegex = /!\[\[([^\]]+)\]\]/g;
        let processedMarkdown = markdown;
        const matches = [...markdown.matchAll(imageRegex)];
        
        for (const match of matches) {
            let imageName = match[1];
            
            // Clean up the image name - remove any nested brackets or extra formatting
            imageName = imageName.replace(/!\[\[|\]\]/g, '');
            
            try {
                console.log(`Attempting to upload image: ${imageName}`);
                const imageUrl = await this.uploadImageToGhost(imageName);
                if (imageUrl) {
                    console.log(`Successfully uploaded ${imageName} -> ${imageUrl}`);
                    // Store the mapping for Lexical converter
                    this.imageReplacements[imageName] = imageUrl;
                    // Replace with proper markdown image syntax
                    const altText = imageName.replace(/\.[^/.]+$/, ""); // Remove extension for alt text
                    processedMarkdown = processedMarkdown.replace(match[0], `![${altText}](${imageUrl})`);
                } else {
                    console.warn(`Failed to get URL for image: ${imageName}`);
                    processedMarkdown = processedMarkdown.replace(match[0], `![${imageName}](#image-not-found)`);
                }
            } catch (error) {
                console.error(`Failed to upload image ${imageName}:`, error);
                processedMarkdown = processedMarkdown.replace(match[0], `![${imageName}](#image-upload-failed)`);
            }
        }
        
        // Use a proper markdown to HTML converter approach
        let html = processedMarkdown;
        
        // Convert headings
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Convert bold and italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert links
        html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');
        
        // Convert images
        html = html.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1">');
        
        // Fix any remaining Obsidian-style image links that weren't properly converted
        html = html.replace(/!<a href="([^"]+)">([^<]+)<\/a>/g, '<img src="$1" alt="$2">');
        
        // Convert code blocks - process line by line to avoid greedy matching
        const lines = html.split('\n');
        const processedLines = [];
        let inCodeBlock = false;
        let codeLines = [];
        let codeLanguage = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('```')) {
                if (!inCodeBlock) {
                    // Starting code block
                    inCodeBlock = true;
                    codeLanguage = line.substring(3).trim();
                    codeLines = [];
                } else {
                    // Ending code block
                    inCodeBlock = false;
                    const codeContent = codeLines.join('\n');
                    processedLines.push(`<pre><code>${codeContent}</code></pre>`);
                    codeLines = [];
                }
            } else if (inCodeBlock) {
                codeLines.push(line);
            } else {
                processedLines.push(line);
            }
        }
        
        html = processedLines.join('\n');
        
        // Convert inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Convert blockquotes
        html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');
        
        // Convert horizontal rules
        html = html.replace(/^---$/gm, '<hr>');
        
        // Convert unordered lists - handle both - and * bullets
        html = html.replace(/^[-*+]\s+(.*)$/gm, '<ul-li>$1</ul-li>');
        console.log('After unordered list conversion:', html.substring(0, 400));
        
        // Convert ordered lists  
        html = html.replace(/^\d+\.\s+(.*)$/gm, '<ol-li>$1</ol-li>');
        console.log('After ordered list conversion:', html.substring(0, 400));
        
        // Group consecutive list items using a more robust approach
        const htmlLinesForLists = html.split('\n');
        const processedLinesForLists = [];
        let currentUlItems = [];
        let currentOlItems = [];
        
        for (let i = 0; i < htmlLinesForLists.length; i++) {
            const line = htmlLinesForLists[i].trim();
            
            if (line.match(/^<ul-li>/)) {
                currentUlItems.push(line.replace(/<ul-li>(.*)<\/ul-li>/, '<li>$1</li>'));
            } else {
                if (currentUlItems.length > 0) {
                    processedLinesForLists.push(`<ul>${currentUlItems.join('')}</ul>`);
                    currentUlItems = [];
                }
                
                if (line.match(/^<ol-li>/)) {
                    currentOlItems.push(line.replace(/<ol-li>(.*)<\/ol-li>/, '<li>$1</li>'));
                } else {
                    if (currentOlItems.length > 0) {
                        processedLinesForLists.push(`<ol>${currentOlItems.join('')}</ol>`);
                        currentOlItems = [];
                    }
                    if (line) processedLinesForLists.push(line);
                }
            }
        }
        
        console.log('Current UL items before final processing:', currentUlItems);
        console.log('Current OL items before final processing:', currentOlItems);
        
        // Handle any remaining list items
        if (currentUlItems.length > 0) {
            processedLinesForLists.push(`<ul>${currentUlItems.join('')}</ul>`);
        }
        if (currentOlItems.length > 0) {
            processedLinesForLists.push(`<ol>${currentOlItems.join('')}</ol>`);
        }
        
        html = processedLinesForLists.join('\n');
        console.log('After improved list grouping:', html.substring(0, 600));
        console.log('Full processed lines for lists:', processedLinesForLists.slice(0, 10));
        
        // Process line by line to maintain structure, but preserve list groupings
        const htmlLines = html.split('\n');
        const structuredLines = [];
        
        for (let i = 0; i < htmlLines.length; i++) {
            const line = htmlLines[i].trim();
            if (!line) continue;
            
            // Skip if already a block element (including our grouped lists)
            if (line.match(/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|img)/)) {
                structuredLines.push(line);
            } else if (!line.match(/^<(ul-li|ol-li)/)) {
                // Only wrap in paragraphs if not a list item marker
                structuredLines.push(`<p>${line}</p>`);
            }
        }
        
        html = structuredLines.join('\n\n');
        
        // Final cleanup to ensure valid HTML with proper spacing
        html = html.replace(/\n\n\n+/g, '\n\n'); // Remove triple+ line breaks but keep double
        
        console.log('Final HTML before lexical conversion:', html);
        
        // Ensure all HTML is properly formatted
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            if (doc.body) {
                // If we have parsing errors, stick with the original HTML
                const errors = doc.getElementsByTagName('parsererror');
                if (errors.length === 0) {
                    // No parsing errors, use the cleaned HTML
                    console.log('HTML successfully parsed and cleaned');
                }
            }
        } catch (e) {
            console.warn('HTML cleanup failed:', e);
            // If parsing fails, continue with the original HTML
        }
        
        return html;
    }

    htmlToLexical(html) {
        // Convert HTML to Lexical format that Ghost can understand
        const lexical = {
            root: {
                children: [{
                    type: "html",
                    version: 1,
                    html: html
                }],
                direction: "ltr",
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        };
        
        return JSON.stringify(lexical);
    }

    markdownToMobiledoc(markdown) {
        // Use the existing HTML and wrap it in a single HTML card
        // This is the most reliable way to get content into Ghost
        const html = this.markdownToHtml(markdown);
        
        const mobiledoc = {
            version: "0.3.1",
            atoms: [],
            cards: [
                ["html", {
                    html: html
                }]
            ],
            markups: [],
            sections: [
                [10, 0] // Reference to the HTML card
            ]
        };
        
        return JSON.stringify(mobiledoc);
    }

    markdownToLexical(markdown) {
        // Convert markdown to Lexical JSON format with proper formatting
        // First, process images to replace with uploaded URLs
        const processedMarkdown = markdown.replace(/!\[\[([^\]]+)\]\]/g, (match, imageName) => {
            // Check if we have an uploaded URL for this image
            if (this.imageReplacements && this.imageReplacements[imageName]) {
                return `![${imageName}](${this.imageReplacements[imageName]})`;
            }
            return `[Image: ${imageName}]`;
        });
        
        const lines = processedMarkdown.split('\n');
        const children = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.trim() === '') {
                children.push({
                    children: [],
                    direction: null,
                    format: "",
                    indent: 0,
                    type: "paragraph",
                    version: 1
                });
            } else if (line.startsWith('# ')) {
                children.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: line.substring(2),
                        type: "text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "heading",
                    version: 1,
                    tag: "h1"
                });
            } else if (line.startsWith('## ')) {
                children.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: line.substring(3),
                        type: "text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "heading",
                    version: 1,
                    tag: "h2"
                });
            } else if (line.startsWith('### ')) {
                children.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: line.substring(4),
                        type: "text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "heading",
                    version: 1,
                    tag: "h3"
                });
            } else if (line.startsWith('```')) {
                // Handle code blocks
                const codeLines = [];
                const language = line.substring(3).trim() || 'javascript';
                i++; // Skip opening ```
                while (i < lines.length && !lines[i].startsWith('```')) {
                    codeLines.push(lines[i]);
                    i++;
                }
                children.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: codeLines.join('\n'),
                        type: "text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "code",
                    version: 1,
                    language: language
                });
            } else if (line.match(/^\d+\.\s/)) {
                // Handle numbered lists
                const listItems = [];
                while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
                    const itemText = lines[i].replace(/^\d+\.\s/, '');
                    listItems.push({
                        children: this.parseInlineFormatting(itemText),
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "listitem",
                        version: 1,
                        value: listItems.length + 1
                    });
                    i++;
                }
                i--; // Adjust for loop increment
                children.push({
                    children: listItems,
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "list",
                    version: 1,
                    listType: "number",
                    start: 1,
                    tag: "ol"
                });
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                // Handle bullet lists
                const listItems = [];
                while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
                    const itemText = lines[i].substring(2);
                    listItems.push({
                        children: this.parseInlineFormatting(itemText),
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "listitem",
                        version: 1,
                        value: 1
                    });
                    i++;
                }
                i--; // Adjust for loop increment
                children.push({
                    children: listItems,
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "list",
                    version: 1,
                    listType: "bullet",
                    start: 1,
                    tag: "ul"
                });
            } else if (line.startsWith('> ')) {
                // Handle blockquotes - collect multiple quote lines
                const quoteLines = [];
                while (i < lines.length && lines[i].startsWith('> ')) {
                    quoteLines.push(lines[i].substring(2));
                    i++;
                }
                i--; // Adjust for loop increment
                
                children.push({
                    children: this.parseInlineFormatting(quoteLines.join(' ')),
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "quote",
                    version: 1
                });
            } else if (line === '---' || line === '***' || line === '___') {
                // Handle horizontal rules
                children.push({
                    type: "horizontalrule",
                    version: 1
                });
            } else if (line.match(/!\[([^\]]*)\]\(([^\)]+)\)/)) {
                // Handle standard markdown images ![alt](url)
                const match = line.match(/!\[([^\]]*)\]\(([^\)]+)\)/);
                const altText = match[1] || "Image";
                const imageUrl = match[2];
                
                children.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: altText,
                        type: "text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "image",
                    version: 1,
                    src: imageUrl,
                    altText: altText
                });
            } else if (line.trim()) {
                // Handle regular paragraphs with inline formatting
                children.push({
                    children: this.parseInlineFormatting(line),
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "paragraph",
                    version: 1
                });
            }
        }
        
        const lexical = {
            root: {
                children: children,
                direction: "ltr",
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        };
        
        return JSON.stringify(lexical);
    }

    parseInlineFormatting(text) {
        if (!text || text.trim() === '') {
            return [{
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "",
                type: "text",
                version: 1
            }];
        }

        const result = [];
        let currentIndex = 0;
        
        // Find all formatting patterns
        const patterns = [
            { regex: /\*\*(.*?)\*\*/g, format: 1, type: 'bold' },      // Bold
            { regex: /\*(.*?)\*/g, format: 2, type: 'italic' },        // Italic
            { regex: /`(.*?)`/g, format: 16, type: 'code' },           // Inline code
            { regex: /\[([^\]]+)\]\(([^)]+)\)/g, format: 0, type: 'link' } // Links
        ];
        
        // Find all matches with their positions
        const matches = [];
        patterns.forEach(pattern => {
            let match;
            const regex = new RegExp(pattern.regex.source, 'g');
            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[1],
                    url: match[2] || null, // For links
                    format: pattern.format,
                    type: pattern.type,
                    fullMatch: match[0]
                });
            }
        });
        
        // Sort matches by position
        matches.sort((a, b) => a.start - b.start);
        
        // Remove overlapping matches (keep first one)
        const cleanMatches = [];
        let lastEnd = 0;
        
        matches.forEach(match => {
            if (match.start >= lastEnd) {
                cleanMatches.push(match);
                lastEnd = match.end;
            }
        });
        
        if (cleanMatches.length === 0) {
            // No formatting found, return plain text
            return [{
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: text,
                type: "text",
                version: 1
            }];
        }
        
        // Build text nodes with markup references
        let textOffset = 0;
        for (const range of cleanMatches) {
            // Add plain text before this match
            if (range.start > textOffset) {
                const plainText = text.substring(textOffset, range.start);
                if (plainText) {
                    result.push({
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: plainText,
                        type: "text",
                        version: 1
                    });
                }
            }
            
            // Add the formatted node
            if (range.type === 'link') {
                result.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: range.content,
                        type: "text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "link",
                    version: 1,
                    url: range.url,
                    target: null,
                    title: null
                });
            } else {
                result.push({
                    detail: 0,
                    format: range.format,
                    mode: "normal",
                    style: "",
                    text: range.content,
                    type: "text",
                    version: 1
                });
            }
            
            textOffset = range.end;
        }
        
        // Add any remaining plain text
        if (textOffset < text.length) {
            const remainingText = text.substring(textOffset);
            if (remainingText.trim()) {
                result.push({
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: remainingText,
                    type: "text",
                    version: 1
                });
            }
        }
        
        return result.length > 0 ? result : [{
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: text,
            type: "text",
            version: 1
        }];
    }

    async processImages(markdown) {
        console.log('Processing images in markdown...');
        
        // Find all Obsidian-style image references ![[image.png]]
        const imageMatches = markdown.match(/!\[\[([^\]]+)\]\]/g);
        if (!imageMatches) {
            console.log('No images found in markdown');
            return markdown;
        }
        
        console.log('Found images:', imageMatches);
        let processedMarkdown = markdown;
        
        for (const match of imageMatches) {
            const imageName = match.match(/!\[\[([^\]]+)\]\]/)[1];
            console.log('Processing image:', imageName);
            
            try {
                // Upload the image to Ghost
                const uploadedUrl = await this.uploadImageToGhost(imageName);
                console.log('Uploaded image URL:', uploadedUrl);
                
                // Replace the Obsidian syntax with standard markdown
                const standardMarkdown = `![${imageName}](${uploadedUrl})`;
                processedMarkdown = processedMarkdown.replace(match, standardMarkdown);
                console.log('Replaced', match, 'with', standardMarkdown);
                
            } catch (error) {
                console.error('Failed to upload image:', imageName, error);
                // Keep the original reference if upload fails
            }
        }
        
        console.log('Processed markdown with uploaded images');
        return processedMarkdown;
    }

    async uploadImageToGhost(imagePath) {
        console.log('Starting upload for image:', imagePath);
        
        try {
            // Check if it's a URL
            if (imagePath.startsWith('http')) {
                console.log('Image is already a URL:', imagePath);
                return imagePath;
            }
            
            // Handle local file paths
            let fullPath = imagePath;
            
            // If it's a relative path, make it absolute
            if (!imagePath.startsWith('/') && !imagePath.match(/^[A-Za-z]:/)) {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    const activeFolder = activeFile.parent;
                    fullPath = activeFolder.path + '/' + imagePath;
                }
            }
            
            console.log('Looking for image file:', fullPath);
            
            // Try to find the file in the vault
            let file = this.app.vault.getAbstractFileByPath(fullPath);
            
            // If not found, try searching in the entire vault
            if (!file) {
                const allFiles = this.app.vault.getFiles();
                file = allFiles.find(f => f.name === imagePath || f.path.endsWith(imagePath));
                if (file) {
                    console.log('Found image in vault at:', file.path);
                    fullPath = file.path;
                }
            }
            
            if (!file) {
                throw new Error(`Image file not found: ${fullPath}`);
            }
            
            console.log('Found image file:', fullPath);
            
            // Read the file as array buffer
            const buffer = await this.app.vault.readBinary(file);
            console.log('Read image buffer, size:', buffer.byteLength, 'bytes');
            
            // Skip very large images (>10MB) for featured images to prevent timeouts
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (buffer.byteLength > maxSize) {
                console.log(`Image too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB), skipping upload`);
                throw new Error(`Image too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB (max: 10MB)`);
            }
            
            // Create form data for upload
            const formData = new FormData();
            
            // Determine MIME type based on file extension
            const extension = file.name.toLowerCase().split('.').pop();
            let mimeType = 'application/octet-stream'; // default
            
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'svg': 'image/svg+xml',
                'bmp': 'image/bmp',
                'tiff': 'image/tiff',
                'tif': 'image/tiff'
            };
            
            if (mimeTypes[extension]) {
                mimeType = mimeTypes[extension];
            }
            
            console.log('Image MIME type:', mimeType, 'for extension:', extension);
            
            const blob = new Blob([buffer], { type: mimeType });
            formData.append('file', blob, file.name);
            
            // Generate JWT for authentication
            const jwt = await this.getFreshJWT();
            
            console.log('Uploading to Ghost:', `${this.settings.ghostUrl}/ghost/api/admin/images/upload/`);
            
            // Upload to Ghost with timeout for large files
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch(`${this.settings.ghostUrl}/ghost/api/admin/images/upload/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Ghost ${jwt}`,
                    'Accept-Version': 'v5.0'
                },
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log('Upload response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload failed:', errorText);
                throw new Error(`Upload failed: ${response.status} ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Upload result:', result);
            
            if (result.images && result.images.length > 0) {
                const uploadedUrl = result.images[0].url;
                console.log('Successfully uploaded', file.name, '->', uploadedUrl);
                return uploadedUrl;
            } else {
                throw new Error('No image URL returned from Ghost');
            }
            
        } catch (error) {
            console.error('Image upload error:', error);
            throw error;
        }
    }

    htmlToMobiledoc(html) {
        // Convert HTML to proper mobiledoc markup format for WYSIWYG rendering
        const mobiledoc = {
            version: "0.3.1",
            atoms: [],
            cards: [],
            markups: [],
            sections: []
        };
        
        // Parse HTML and convert to mobiledoc sections
        const lines = html.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Handle headers
            if (trimmed.match(/^<h([1-6])>(.*?)<\/h[1-6]>$/)) {
                const match = trimmed.match(/^<h([1-6])>(.*?)<\/h[1-6]>$/);
                const level = parseInt(match[1]);
                const text = match[2];
                mobiledoc.sections.push([1, `h${level}`, [[0, [], 0, text]]]);
            }
            // Handle paragraphs with formatting
            else if (trimmed.match(/^<p>(.*?)<\/p>$/)) {
                const content = trimmed.match(/^<p>(.*?)<\/p>$/)[1];
                const textNodes = this.parseHtmlToMobiledocNodes(content, mobiledoc.markups);
                mobiledoc.sections.push([1, "p", textNodes]);
            }
            // Handle blockquotes
            else if (trimmed.match(/^<blockquote>(.*?)<\/blockquote>$/)) {
                const content = trimmed.match(/^<blockquote>(.*?)<\/blockquote>$/)[1];
                const textNodes = this.parseHtmlToMobiledocNodes(content, mobiledoc.markups);
                mobiledoc.sections.push([1, "blockquote", textNodes]);
            }
            // Handle list items
            else if (trimmed.match(/^<li>(.*?)<\/li>$/)) {
                const content = trimmed.match(/^<li>(.*?)<\/li>$/)[1];
                const textNodes = this.parseHtmlToMobiledocNodes(content, mobiledoc.markups);
                mobiledoc.sections.push([3, "ul", [textNodes]]);
            }
            // Handle code blocks
            else if (trimmed.match(/^<pre><code>(.*?)<\/code><\/pre>$/)) {
                const content = trimmed.match(/^<pre><code>(.*?)<\/code><\/pre>$/)[1];
                mobiledoc.cards.push(["code", { code: content }]);
                mobiledoc.sections.push([10, mobiledoc.cards.length - 1]);
            }
            // Handle horizontal rules
            else if (trimmed === '<hr>') {
                mobiledoc.cards.push(["hr", {}]);
                mobiledoc.sections.push([10, mobiledoc.cards.length - 1]);
            }
            // Handle images
            else if (trimmed.match(/^<img\s+src="([^"]+)".*?>$/)) {
                const match = trimmed.match(/^<img\s+src="([^"]+)".*?>$/);
                const src = match[1];
                mobiledoc.cards.push(["image", { src: src }]);
                mobiledoc.sections.push([10, mobiledoc.cards.length - 1]);
            }
            // Fallback: treat as paragraph
            else {
                const textNodes = this.parseHtmlToMobiledocNodes(trimmed, mobiledoc.markups);
                mobiledoc.sections.push([1, "p", textNodes]);
            }
        }
        
        return JSON.stringify(mobiledoc);
    }

    parseHtmlToMobiledocNodes(html, markups) {
        // Parse HTML content and convert to mobiledoc text nodes with markups
        const nodes = [];
        let currentPos = 0;
        
        // Simple regex-based parsing for basic formatting
        const patterns = [
            { regex: /<strong>(.*?)<\/strong>/g, tag: 'strong' },
            { regex: /<em>(.*?)<\/em>/g, tag: 'em' },
            { regex: /<code>(.*?)<\/code>/g, tag: 'code' },
            { regex: /<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g, tag: 'a' }
        ];
        
        let text = html;
        const formatRanges = [];
        
        // Find all formatting ranges
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.regex.exec(html)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                const content = pattern.tag === 'a' ? match[2] : match[1];
                const href = pattern.tag === 'a' ? match[1] : null;
                
                formatRanges.push({
                    start,
                    end,
                    tag: pattern.tag,
                    content,
                    href,
                    originalMatch: match[0]
                });
            }
        }
        
        // Sort by start position
        formatRanges.sort((a, b) => a.start - b.start);
        
        // Remove HTML tags to get plain text
        let plainText = html.replace(/<[^>]+>/g, '');
        
        if (formatRanges.length === 0) {
            // No formatting, return simple text node
            return [[0, [], 0, plainText]];
        }
        
        // Build text nodes with markup references
        let textOffset = 0;
        for (const range of formatRanges) {
            // Add plain text before this markup
            if (range.start > currentPos) {
                const beforeText = plainText.substring(0, range.content.length);
                if (beforeText && textOffset === 0) {
                    // Text before first markup
                    const beforeContent = plainText.substring(0, plainText.indexOf(range.content));
                    if (beforeContent) {
                        nodes.push([0, [], 0, beforeContent]);
                        textOffset += beforeContent.length;
                    }
                }
            }
            
            // Add the formatted node
            if (range.tag === 'a') {
                nodes.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: range.content,
                        type: "text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "link",
                    version: 1,
                    url: range.href,
                    target: null,
                    title: null
                });
            } else {
                nodes.push({
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: range.content,
                    type: "text",
                    version: 1
                });
            }
            
            currentPos = range.end;
        }
        
        // Add any remaining plain text
        if (currentPos < text.length) {
            const remainingText = text.substring(currentPos);
            if (remainingText.trim()) {
                nodes.push({
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: remainingText,
                    type: "text",
                    version: 1
                });
            }
        }
        
        return nodes.length > 0 ? nodes : [{
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: plainText,
            type: "text",
            version: 1
        }];
    }

    htmlToGhostLexical(html) {
        const lexical = {
            root: {
                children: [],
                direction: "ltr",
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        };
        
        // Parse HTML into Ghost-compatible Lexical nodes
        const lines = html.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Handle headers
            if (trimmed.match(/^<h([1-6])>(.*?)<\/h[1-6]>$/)) {
                const match = trimmed.match(/^<h([1-6])>(.*?)<\/h[1-6]>$/);
                const level = parseInt(match[1]);
                const text = match[2];
                
                lexical.root.children.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: text,
                        type: "extended-text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "extended-heading",
                    version: 1,
                    tag: `h${level}`
                });
            }
            // Handle horizontal rules
            else if (trimmed === '<hr>' || trimmed === '<hr/>' || trimmed === '<hr />') {
                lexical.root.children.push({
                    type: "horizontalrule",
                    version: 1
                });
            }
            // Handle images
            else if (trimmed.match(/^<img\s+src="([^"]+)".*?>$/)) {
                const srcMatch = trimmed.match(/src="([^"]+)"/);
                const altMatch = trimmed.match(/alt="([^"]*)"/);
                const src = srcMatch ? srcMatch[1] : '';
                const alt = altMatch ? altMatch[1] : '';
                
                lexical.root.children.push({
                    type: "image",
                    version: 1,
                    src: src,
                    altText: alt,
                    title: "",
                    showCaption: false,
                    caption: {
                        editorState: {
                            root: {
                                children: [],
                                direction: "ltr",
                                format: "",
                                indent: 0,
                                type: "root",
                                version: 1
                            }
                        }
                    }
                });
            }
            // Handle paragraphs with formatting
            else if (trimmed.match(/^<p>(.*?)<\/p>$/)) {
                const content = trimmed.match(/^<p>(.*?)<\/p>$/)[1];
                const textNodes = this.parseHtmlToLexicalNodes(content);
                
                if (textNodes.length > 0) {
                    lexical.root.children.push({
                        children: textNodes,
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1
                    });
                }
            }
            // Handle blockquotes
            else if (trimmed.match(/^<blockquote>(.*?)<\/blockquote>$/)) {
                const content = trimmed.match(/^<blockquote>(.*?)<\/blockquote>$/)[1];
                const plainText = content.replace(/<[^>]+>/g, '');
                
                if (plainText.trim()) {
                    lexical.root.children.push({
                        children: [{
                            detail: 0,
                            format: 0,
                            mode: "normal",
                            style: "",
                            text: plainText,
                            type: "extended-text",
                            version: 1
                        }],
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "extended-quote",
                        version: 1
                    });
                }
            }
            // Handle ordered lists
            else if (trimmed.match(/^<ol>(.*?)<\/ol>$/s)) {
                const olContent = trimmed.match(/^<ol>(.*?)<\/ol>$/s)[1];
                const listItems = olContent.match(/<li>(.*?)<\/li>/gs) || [];
                
                const lexicalItems = listItems.map((item, index) => {
                    const itemContent = item.match(/<li>(.*?)<\/li>/s)[1];
                    const nodes = this.parseHtmlToLexicalNodes(itemContent);
                    return {
                        children: nodes,
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "listitem",
                        version: 1,
                        value: index + 1
                    };
                });
                
                lexical.root.children.push({
                    children: lexicalItems,
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "list",
                    version: 1,
                    listType: "number",
                    start: 1,
                    tag: "ol"
                });
            }
            // Handle unordered lists
            else if (trimmed.match(/^<ul>(.*?)<\/ul>$/s)) {
                const ulContent = trimmed.match(/^<ul>(.*?)<\/ul>$/s)[1];
                const listItems = ulContent.match(/<li>(.*?)<\/li>/gs) || [];
                
                const lexicalItems = listItems.map((item, index) => {
                    const itemContent = item.match(/<li>(.*?)<\/li>/s)[1];
                    const nodes = this.parseHtmlToLexicalNodes(itemContent);
                    return {
                        children: nodes,
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "listitem",
                        version: 1,
                        value: index + 1
                    };
                });
                
                lexical.root.children.push({
                    children: lexicalItems,
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "list",
                    version: 1,
                    listType: "bullet",
                    start: 1,
                    tag: "ul"
                });
            }
            // Handle code blocks
            else if (trimmed.match(/^<pre><code>(.*?)<\/code><\/pre>$/s)) {
                const codeContent = trimmed.match(/^<pre><code>(.*?)<\/code><\/pre>$/s)[1];
                
                lexical.root.children.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: codeContent,
                        type: "extended-text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "extended-codeblock",
                    version: 1,
                    language: "javascript"
                });
            }
            // Handle list items (fallback for individual items)
            else if (trimmed.match(/^<li>/)) {
                const plainText = trimmed.replace(/<[^>]+>/g, '');
                // Use parseHtmlToLexicalNodes to preserve inline formatting in list items
                const nodes = this.parseHtmlToLexicalNodes(trimmed.replace(/<\/?li>/g, ''));
                
                // Check if last child is a list, if not create new list
                const lastChild = lexical.root.children[lexical.root.children.length - 1];
                if (lastChild && lastChild.type === "list") {
                    // Calculate proper list item value based on current list length
                    const listItemValue = lastChild.children.length + 1;
                    const listItem = {
                        children: nodes,
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "listitem",
                        version: 1,
                        value: listItemValue
                    };
                    lastChild.children.push(listItem);
                } else {
                    const listItem = {
                        children: nodes,
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "listitem",
                        version: 1,
                        value: 1
                    };
                    lexical.root.children.push({
                        children: [listItem],
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "list",
                        version: 1,
                        listType: "bullet",
                        start: 1,
                        tag: "ul"
                    });
                }
            }
            // Handle other content as paragraphs
            else {
                const plainText = trimmed.replace(/<[^>]+>/g, '');
                if (plainText.trim()) {
                    // Use parseHtmlToLexicalNodes to preserve inline formatting
                    const nodes = this.parseHtmlToLexicalNodes(trimmed);
                    lexical.root.children.push({
                        children: nodes,
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1
                    });
                }
            }
        }
        
        return JSON.stringify(lexical);
    }

    parseHtmlToLexicalNodes(html) {
        const nodes = [];
        
        // Parse HTML with proper text and formatting extraction
        let currentPos = 0;
        const htmlLength = html.length;
        
        while (currentPos < htmlLength) {
            // Find the next tag
            const tagStart = html.indexOf('<', currentPos);
            
            if (tagStart === -1) {
                // No more tags, add remaining text (preserve spaces)
                const remainingText = html.substring(currentPos);
                if (remainingText.length > 0) {
                    nodes.push({
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: remainingText,
                        type: "extended-text",
                        version: 1
                    });
                }
                break;
            }
            
            // Add text before the tag (preserve spaces)
            if (tagStart > currentPos) {
                const beforeText = html.substring(currentPos, tagStart);
                if (beforeText.length > 0) {
                    nodes.push({
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: beforeText,
                        type: "extended-text",
                        version: 1
                    });
                }
            }
            
            // Find the end of the tag
            const tagEnd = html.indexOf('>', tagStart);
            if (tagEnd === -1) break;
            
            const tagContent = html.substring(tagStart, tagEnd + 1);
            
            // Handle different tag types
            if (tagContent.startsWith('<strong>')) {
                const closeTag = html.indexOf('</strong>', tagEnd);
                if (closeTag !== -1) {
                    const boldText = html.substring(tagEnd + 1, closeTag);
                    nodes.push({
                        detail: 0,
                        format: 1, // Bold format
                        mode: "normal",
                        style: "",
                        text: boldText,
                        type: "extended-text",
                        version: 1
                    });
                    currentPos = closeTag + 9; // Skip past </strong>
                    continue;
                }
            } else if (tagContent.startsWith('<em>')) {
                const closeTag = html.indexOf('</em>', tagEnd);
                if (closeTag !== -1) {
                    const italicText = html.substring(tagEnd + 1, closeTag);
                    nodes.push({
                        detail: 0,
                        format: 2, // Italic format
                        mode: "normal",
                        style: "",
                        text: italicText,
                        type: "extended-text",
                        version: 1
                    });
                    currentPos = closeTag + 5; // Skip past </em>
                    continue;
                }
            } else if (tagContent.startsWith('<code>')) {
                const closeTag = html.indexOf('</code>', tagEnd);
                if (closeTag !== -1) {
                    const codeText = html.substring(tagEnd + 1, closeTag);
                    nodes.push({
                        detail: 0,
                        format: 16, // Code format
                        mode: "normal",
                        style: "",
                        text: codeText,
                        type: "extended-text",
                        version: 1
                    });
                    currentPos = closeTag + 7; // Skip past </code>
                    continue;
                }
            } else if (tagContent.startsWith('<a href=')) {
                const hrefMatch = tagContent.match(/href="([^"]+)"/);
                const closeTag = html.indexOf('</a>', tagEnd);
                if (hrefMatch && closeTag !== -1) {
                    const linkText = html.substring(tagEnd + 1, closeTag);
                    const href = hrefMatch[1];
                    
                    // Use the simpler link format from your example
                    nodes.push({
                        children: [{
                            detail: 0,
                            format: 0,
                            mode: "normal",
                            style: "",
                            text: linkText,
                            type: "extended-text",
                            version: 1
                        }],
                        direction: "ltr",
                        format: "",
                        indent: 0,
                        type: "link", // Changed from "extended-link" to "link"
                        version: 1,
                        rel: "noopener",
                        target: "_new",
                        title: null,
                        url: href
                    });
                    currentPos = closeTag + 4; // Skip past </a>
                    continue;
                }
            }
            
            // Skip unknown tags
            currentPos = tagEnd + 1;
        }
        
        // Return at least one text node if no content was parsed
        return nodes.length > 0 ? nodes : [{
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: html.replace(/<[^>]+>/g, ''),
            type: "extended-text",
            version: 1
        }];
    }

    parseHtmlToMobiledocNodes(html, markups) {
        const nodes = [];
        let text = html;
        
        // Find formatting patterns
        const formatRanges = [];
        
        // Bold
        text.replace(/<strong>(.*?)<\/strong>/g, (match, content, offset) => {
            formatRanges.push({
                start: offset,
                end: offset + content.length,
                content: content,
                tag: 'strong'
            });
            return content;
        });
        
        // Italic
        text.replace(/<em>(.*?)<\/em>/g, (match, content, offset) => {
            formatRanges.push({
                start: offset,
                end: offset + content.length,
                content: content,
                tag: 'em'
            });
            return content;
        });
        
        // Links
        text.replace(/<a href="([^"]+)">(.*?)<\/a>/g, (match, href, content, offset) => {
            formatRanges.push({
                start: offset,
                end: offset + content.length,
                content: content,
                tag: 'a',
                href: href
            });
            return content;
        });
        
        // Remove HTML tags for plain text
        const plainText = text.replace(/<[^>]+>/g, '');
        
        if (formatRanges.length === 0) {
            return [[0, [], 0, plainText]];
        }
        
        // Sort ranges by start position
        formatRanges.sort((a, b) => a.start - b.start);
        
        // Build text nodes with markup references
        let textOffset = 0;
        for (const range of formatRanges) {
            const markupIndex = markups.length;
            
            if (range.tag === 'a') {
                markups.push(['a', ['href', range.href]]);
            } else {
                markups.push([range.tag]);
            }
            
            // Add text before this markup
            const beforeText = plainText.substring(textOffset, plainText.indexOf(range.content, textOffset));
            if (beforeText) {
                nodes.push([0, [], 0, beforeText]);
                textOffset += beforeText.length;
            }
            
            // Add formatted text
            nodes.push([0, [markupIndex], 0, range.content]);
            textOffset += range.content.length;
        }
        
        // Add any remaining text
        if (textOffset < plainText.length) {
            const remainingText = plainText.substring(textOffset);
            if (remainingText.trim()) {
                nodes.push([0, [], 0, remainingText]);
            }
        }
        
        return nodes.length > 0 ? nodes : [[0, [], 0, plainText]];
    }

    parseHtmlToGhostNodes(html) {
        // Parse HTML content into Ghost-compatible text nodes with formatting
        const nodes = [];
        
        // Handle bold text
        if (html.includes('<strong>')) {
            const parts = html.split(/(<strong>.*?<\/strong>)/);
            for (const part of parts) {
                if (part.match(/<strong>(.*?)<\/strong>/)) {
                    const text = part.match(/<strong>(.*?)<\/strong>/)[1];
                    nodes.push({
                        detail: 0,
                        format: 1, // Bold format
                        mode: "normal",
                        style: "",
                        text: text,
                        type: "extended-text",
                        version: 1
                    });
                } else if (part.trim()) {
                    const plainText = part.replace(/<[^>]+>/g, '');
                    if (plainText) {
                        nodes.push({
                            detail: 0,
                            format: 0,
                            mode: "normal",
                            style: "",
                            text: plainText,
                            type: "extended-text",
                            version: 1
                        });
                    }
                }
            }
        }
        // Handle italic text
        else if (html.includes('<em>')) {
            const parts = html.split(/(<em>.*?<\/em>)/);
            for (const part of parts) {
                if (part.match(/<em>(.*?)<\/em>/)) {
                    const text = part.match(/<em>(.*?)<\/em>/)[1];
                    nodes.push({
                        detail: 0,
                        format: 3, // Italic format
                        mode: "normal",
                        style: "",
                        text: text,
                        type: "extended-text",
                        version: 1
                    });
                } else if (part.trim()) {
                    const plainText = part.replace(/<[^>]+>/g, '');
                    if (plainText) {
                        nodes.push({
                            detail: 0,
                            format: 0,
                            mode: "normal",
                            style: "",
                            text: plainText,
                            type: "extended-text",
                            version: 1
                        });
                    }
                }
            }
        }
        // Handle links
        else if (html.includes('<a ')) {
            const linkMatch = html.match(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/);
            if (linkMatch) {
                const url = linkMatch[1];
                const text = linkMatch[2];
                nodes.push({
                    children: [{
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: text,
                        type: "extended-text",
                        version: 1
                    }],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "link",
                    version: 1,
                    rel: "noreferrer",
                    target: null,
                    title: null,
                    url: url
                });
            }
        }
        // Plain text
        else {
            const plainText = html.replace(/<[^>]+>/g, '');
            if (plainText.trim()) {
                nodes.push({
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: plainText,
                    type: "extended-text",
                    version: 1
                });
            }
        }
        
        return nodes;
    }

    parseFrontmatter(content) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontmatterRegex);
        
        if (!match) return {};
        
        try {
            const frontmatterText = match[1];
            const frontmatter = {};
            const lines = frontmatterText.split('\n');
            let currentKey = null;
            let currentArray = [];
            let inArray = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                if (line.startsWith('- ') && inArray) {
                    // Array item
                    currentArray.push(line.substring(2).trim());
                } else if (line.includes(':')) {
                    // Finish previous array if needed
                    if (inArray && currentKey) {
                        frontmatter[currentKey] = currentArray;
                        currentArray = [];
                        inArray = false;
                    }
                    
                    const colonIndex = line.indexOf(':');
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    currentKey = key;
                    
                    if (!value || value === '') {
                        // Check if next line starts with '- ' for array
                        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
                            inArray = true;
                            currentArray = [];
                        } else {
                            frontmatter[key] = '';
                        }
                    } else if (value.startsWith('[') && value.endsWith(']')) {
                        frontmatter[key] = value.slice(1, -1).split(',').map(item => item.trim().replace(/["']/g, ''));
                    } else if (value === 'true') {
                        frontmatter[key] = true;
                    } else if (value === 'false') {
                        frontmatter[key] = false;
                    } else {
                        // Preserve original value including quotes for banner/featured_image fields
                        if (key === 'banner' || key === 'featured_image') {
                            frontmatter[key] = value;
                        } else {
                            frontmatter[key] = value.replace(/["']/g, '');
                        }
                    }
                }
            }
            
            // Finish last array if needed
            if (inArray && currentKey) {
                frontmatter[currentKey] = currentArray;
            }
            
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
                yamlContent += `${key}:\n`;
                for (const item of value) {
                    yamlContent += `  - ${item}\n`;
                }
            } else if (key === 'banner' || key === 'featured_image') {
                // Preserve the exact format from parsing
                yamlContent += `${key}: ${value}\n`;
            } else if (typeof value === 'string' && (value.includes(':') || value.includes('"'))) {
                yamlContent += `${key}: "${value}"\n`;
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
        
        // Rename file if title changed
        if (ghostPost.title && ghostPost.title !== activeFile.basename) {
            const newPath = activeFile.path.replace(activeFile.name, `${ghostPost.title}.md`);
            await this.app.vault.rename(activeFile, newPath);
        }
    }
}

module.exports = GhostyPostyPlugin;
