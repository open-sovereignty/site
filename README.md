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
| `landscape.html` | Technology landscape (coming soon) |

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

## References

- [EU Cloud Sovereignty Framework v1.2.1 (PDF)](https://commission.europa.eu/document/download/09579818-64a6-4dd5-9577-446ab6219113_en)
