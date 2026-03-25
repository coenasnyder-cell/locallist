# locallist
Local List

## Setup

### Google Sign-In

To enable Google Sign-In in this project:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth 2.0 Client ID**.
5. Set the application type (e.g., Web application) and add your authorized redirect URIs.
6. Copy the **Client ID** and **Client Secret** and add them to your environment configuration:

```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

7. Make sure the **Google Identity** API (also known as the Google Sign-In API) is enabled in your project.
8. If sign-in is still failing, verify:
   - The redirect URI in your app matches exactly what is registered in Google Cloud Console.
   - Your OAuth consent screen is configured and published (or your test users are added).
   - Cookies and third-party access are allowed in your browser.

### GitHub Copilot in VS Code

If GitHub Copilot is not working in VS Code:

1. **Install the extension**: Open VS Code Extensions (`Ctrl+Shift+X`), search for `GitHub Copilot`, and install it. This workspace already recommends it via `.vscode/extensions.json`.
2. **Sign in to GitHub**: Open the Command Palette (`Ctrl+Shift+P`), run `GitHub Copilot: Sign In`, and authenticate with your GitHub account.
3. **Check your subscription**: Copilot requires an active GitHub Copilot subscription or access through an organization.
4. **Enable Copilot**: Ensure Copilot is enabled in VS Code settings. This workspace sets `github.copilot.enable` to `true` for all file types via `.vscode/settings.json`.
5. **Reload VS Code**: After installing or signing in, reload the window (`Ctrl+Shift+P` → `Developer: Reload Window`).
6. **Check network/proxy**: If behind a corporate proxy, configure VS Code's proxy settings under `File > Preferences > Settings > Application > Proxy`.
7. **Git integration**: For Copilot's git features, ensure the Git extension is active and your repository is initialized (`git init`) with a remote configured.
