# GhostyPosty

GhostyPosty is an Obsidian plugin that connects to your Ghost blog and publishes content directly from your Obsidian vault. It allows you to maintain your content in Obsidian while easily publishing to Ghost with proper handling of images and links.

## Features

- Publish Obsidian notes to Ghost with a single click
- Use frontmatter properties to control publishing
- Automatic upload of images to your Ghost blog
- Conversion of internal Obsidian links to work on Ghost
- Status dashboard to monitor which notes are published
- Ribbon icon for quick access to publishing status

## Installation

### BRAT Installation

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, click "Add beta plugin"
3. Add the following URL: `https://github.com/DudeThatsErin/ghostyposty`
4. Enable the plugin in Obsidian's settings under "Community Plugins"

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/DudeThatsErin/ghostyposty/releases)
2. Extract the zip file into your Obsidian vault's `.obsidian/plugins` folder
3. Enable the plugin in Obsidian's settings under "Community Plugins"

### From Obsidian Community Plugins

*Coming soon*

## Setup

1. Open Obsidian settings
2. Navigate to "Community Plugins" → "GhostyPosty"
3. Enter your Ghost blog URL (e.g., `https://yourblog.ghost.io`)
4. Enter your Ghost Admin API key (see below for instructions on getting this)
5. Set up a proxy server to bypass CORS restrictions (see below)
6. Enter the proxy URL in the plugin settings (e.g., `http://localhost:9000`)
7. Set a folder to monitor for publishable files
8. Configure other options as needed

### Getting Your Ghost Admin API Key

1. Log in to your Ghost Admin panel
2. Go to "Settings" → "Integrations"
3. Click "+ Add custom integration"
4. Give it a name (e.g., "Obsidian GhostyPosty")
5. Click "Create"
6. Copy the "Admin API Key" (not the Content API Key)

## Usage

### Publishing with Frontmatter

To mark a note for publishing, add the following to your frontmatter:

```yaml
---
publish: true
---
```

Additional optional frontmatter properties:

```yaml
---
publish: true
title: "My Custom Title"  # Defaults to file name if not specified
status: "published"       # Options: "draft" (default), "published"
excerpt: "A brief summary of the post"
feature_image: "https://example.com/image.jpg"
slug: "custom-url-slug"   # URL slug for the post
tags: ["tag1", "tag2"]   # Or as string: "tag1, tag2"
---
```

Once published, GhostyPosty will add these properties to your frontmatter:

```yaml
ghost_post_id: "5f8d9c7e6b4a3c2d1e0f9a8b7" # Ghost's internal ID
ghost_url: "https://yourblog.com/my-post/"   # Published URL
```

### Publishing Methods

There are three ways to publish a note:

1. **Automatic publishing**: If you have the "Auto-publish" setting enabled, any file with `publish: true` in its frontmatter will be published automatically when saved.

2. **Command palette**: Use the command palette (Ctrl/Cmd+P) and search for "GhostyPosty: Publish current file to Ghost".

3. **Status dashboard**: Click the ghost icon in the ribbon to open the status dashboard, then click the "Publish" button next to any file.

### Images

Images in your notes will be automatically uploaded to your Ghost blog when publishing. You can use standard Markdown image syntax:

```markdown
![Alt text](path/to/image.jpg)
```

## CORS Restrictions and Proxy Server

### Understanding CORS Restrictions

The Ghost Admin API has Cross-Origin Resource Sharing (CORS) restrictions that prevent direct access from client applications like Obsidian plugins. This is a security feature of the Ghost API, but it means that GhostyPosty cannot directly communicate with your Ghost blog without a proxy server.

### Setting Up the Proxy Server

A simple proxy server script is included with the plugin. To use it:

1. Make sure you have Node.js installed on your computer
2. Open a terminal or command prompt
3. Navigate to the plugin directory (usually `.obsidian/plugins/GhostyPosty`)
4. Install the required dependencies:
   ```
   npm install express cors http-proxy-middleware
   ```
5. Start the proxy server:
   ```
   node proxy-server.js
   ```
6. The proxy server will start on port 9000 by default
7. In the GhostyPosty settings, set the Proxy URL to `http://localhost:9000`

### Proxy Server Options

You can customize the proxy server by editing the `proxy-server.js` file:

- Change the port by modifying the `PORT` constant
- Add authentication or additional security as needed

### Alternative Solutions

If you prefer not to run a local proxy server, you can use a browser extension like CORS Unblock when using Obsidian. However, the proxy server approach is recommended for more reliable operation.

## Frequently Asked Questions (FAQ)

### Common Error Messages

#### "CORS restrictions prevent direct access to the Ghost Admin API"

**Cause**: The Ghost Admin API has security restrictions that prevent it from being accessed directly from client applications like Obsidian plugins.

**Solution**:
1. Set up the included proxy server (see [Setting Up the Proxy Server](#setting-up-the-proxy-server))
2. Enter the proxy URL in the plugin settings (e.g., `http://localhost:9000`)
3. Try publishing again

#### "Failed to initialize Ghost API. Check your settings."

**Cause**: The plugin couldn't connect to your Ghost blog with the provided credentials.

**Solution**:
1. Verify your Ghost URL is correct (e.g., `https://yourblog.ghost.io` not `https://yourblog.ghost.io/ghost`)
2. Check that your Admin API key is valid and has not expired
3. Ensure your Ghost blog is online and accessible

#### "Network error occurred during request"

**Cause**: The plugin couldn't establish a network connection to either your proxy server or Ghost blog.

**Solution**:
1. Check if your proxy server is running (if configured)
2. Verify your internet connection
3. Ensure your Ghost blog is online and accessible
4. Check if there are any firewalls blocking the connection

#### "Image upload failed"

**Cause**: The plugin couldn't upload an image to your Ghost blog.

**Solution**:
1. Ensure your proxy server is running (image uploads always require a proxy)
2. Check that the image file exists and is not corrupted
3. Verify that your Ghost API key has permission to upload images
4. Check if your Ghost blog has enough storage space

#### "Invalid JSON response"

**Cause**: The Ghost API or proxy server returned a response that couldn't be parsed as JSON.

**Solution**:
1. Check your proxy server logs for errors
2. Verify that your Ghost blog is functioning correctly
3. Try restarting the proxy server

#### "Request failed (401): Unauthorized"

**Cause**: The Ghost API rejected your authentication credentials.

**Solution**:
1. Verify that your Admin API key is correct and has not expired
2. Ensure you're using the Admin API key, not the Content API key
3. Check that your Ghost user account has the necessary permissions

### General Troubleshooting

1. **Restart the proxy server**: Sometimes simply restarting the proxy server can resolve connection issues.

2. **Check proxy server logs**: If you're experiencing issues, check the terminal where the proxy server is running for error messages.

3. **Verify Ghost version**: This plugin is designed for Ghost v5.0+. If you're using an older version, you may encounter compatibility issues.

4. **Clear Obsidian cache**: In some cases, clearing Obsidian's cache can resolve persistent issues.

5. **Update the plugin**: Make sure you're using the latest version of GhostyPosty, as bugs are fixed and improvements are made regularly.

Both relative and absolute paths (within your vault) are supported.

### Internal Links

Internal links to other notes will be converted to links on your Ghost blog. The link will use the filename (without extension) as the slug:

```markdown
[Link text](path/to/another-note.md)
```

Will become:

```html
<a href="/another-note">Link text</a>
```

### Status Dashboard

Click the ghost icon in the ribbon to open the status dashboard. This shows all markdown files in your monitored folder and their publishing status:

- Not published
- Marked for publishing
- Draft
- Published

From this dashboard, you can:
- Publish or update files
- View published posts on your Ghost blog

## Troubleshooting

### Common Issues

- **API Connection Errors**: Ensure your Ghost URL is correct and includes the protocol (https://)
- **Authentication Errors**: Verify your Admin API key is correct and has proper permissions
- **Image Upload Failures**: Check that your Ghost blog has sufficient storage space

## Support

If you encounter any issues or have feature requests, please open an issue on the [GitHub repository](https://github.com/ghostyposty/obsidian-ghosty-posty/issues).

## License

This project is licensed under the MIT License - see the LICENSE file for details.