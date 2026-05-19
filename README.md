# Open Digital Sovereignty

Educational site documenting open digital sovereignty principles and self-assessment tools aligned with recognised frameworks.

**Live site:** [https://open-sovereignty.github.io/site/](https://open-sovereignty.github.io/site/)

## Local preview

From the repository root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Structure

| Path | Description |
|------|-------------|
| `index.html` | Home — principles and pillars |
| `assessment/` | Sovereignty self-assessments |
| `assessment/eu-csf.html` | EU Cloud Sovereignty Framework quiz |
| `landscape.html` | Technology landscape (EU CSF objectives) |
| `data/sovereignty-landscape.json` | Landscape categories and technology entries |

## Deployment

Pushes to `main` deploy automatically via GitHub Actions.

### One-time setup (required)

If the deploy job fails with `Failed to create deployment (status: 404)`, Pages is not enabled yet:

1. **Organisation** (if `open-sovereignty` restricts Pages):  
   [Organisation Settings → Pages](https://github.com/organizations/open-sovereignty/settings/pages) — allow GitHub Pages for repositories.

2. **Repository**:  
   [site → Settings → Pages](https://github.com/open-sovereignty/site/settings/pages)

   - Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
   - Save. GitHub creates the `github-pages` environment.

3. Re-run the workflow: **Actions → Deploy to GitHub Pages → Run workflow**, or push an empty commit.

**Live URL:** https://open-sovereignty.github.io/site/

> Private repos need a paid GitHub plan for Pages. Public repos work on the free tier.

## Technology landscape

Entries live in [`data/sovereignty-landscape.json`](data/sovereignty-landscape.json). Each category maps to an EU Cloud Sovereignty Framework objective (`SOV-1` … `SOV-8`).

To add a technology, append an item to the relevant category's `items` array:

```json
{
  "name": "Example Project",
  "logo": "example.svg",
  "url": "https://example.org",
  "summary": "One-line description for the tile tooltip.",
  "tags": ["open-source", "eu"]
}
```

### Logos

Logos live in `assets/logos/`. There are two sources:

- **Manual SVGs** committed to the repo (`assets/logos/`). Used for EU/policy items and projects not covered by Simple Icons.
- **Simple Icons** — well-known brand logos (Kubernetes, Ansible, Linux, etc.) are fetched automatically from [cdn.simpleicons.org](https://simpleicons.org) during the GitHub Actions build and stored in `_site/assets/logos/`. Simple Icons SVGs are released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Trademarks belong to their respective owners.

When no logo is available or a file fails to load, the tile falls back to a coloured initials badge.

To add a logo for a new entry, place an SVG in `assets/logos/` and reference it via the `"logo"` field. Aim for a 24 × 24 viewBox with clean fills.

## References

- [EU Cloud Sovereignty Framework v1.2.1 (PDF)](https://commission.europa.eu/document/download/09579818-64a6-4dd5-9577-446ab6219113_en)
