// Highlighted HTML for the "Sign in with 0dot" example shown in the
// developers desk (src/components/frontpage/FrontPage.tsx). Computed once at
// module load via top-level await — this module is only ever imported by a
// server component, so it never reaches the client bundle, and the sample is
// fixed editorial content rather than per-request data.
import { codeToHtml } from "shiki";

const DEV_SAMPLE = `// 1. Send people to the consent screen
GET https://0dot.in/oauth/authorize
    ?response_type=code
    &client_id=YOUR_CLIENT_ID
    &redirect_uri=https://yourapp.com/callback
    &scope=profile:read posts:read
    &state=…
    &code_challenge=…&code_challenge_method=S256

// 2. Exchange the code, then call the API
const me = await fetch("https://0dot.in/api/v1/users/me", {
  headers: { Authorization: \`Bearer \${accessToken}\` },
}).then((r) => r.json());

me.username; // "dot"`;

// Dual light/dark theme: emits both palettes as CSS variables on every token
// (--shiki-light/--shiki-dark, plus --shiki-light-bg/--shiki-dark-bg on the
// root <pre>) instead of baking in one fixed palette — front-page.css's
// `.fpCode pre` rules pick between them with the same OS-preference-then-
// explicit-[data-theme]-override cascade globals.css uses for every other
// color token.
export const DEV_SAMPLE_HTML = await codeToHtml(DEV_SAMPLE, {
  lang: "js",
  themes: { light: "github-light", dark: "github-dark" },
  defaultColor: false,
});
