// App configuration and version (single source of truth)
// When updating version: Change only here
// Deploy: bump version when code/SW changes; bump assetVersion when Netlify assets change (or both).

const APP_CONFIG = {
    version: "1.4.34",

    /** Bumped when media on the assets Netlify site changes; appended to game asset URLs. */
    assetVersion: "1.4.34",
    
    // Base URL for externally hosted game assets (images, sounds, etc.).
    // Example (Netlify): "https://tiddeligames-assets.netlify.app"    
    assetBaseUrl: "https://tiddeligames-assets.netlify.app",
    
};

