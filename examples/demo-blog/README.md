# TechPulse Blog — Demo Website

A second demo website for testing multi-site analytics tracking.

## Site Details
- **Site ID**: `site_blog`
- **Theme**: Tech blog with tutorials, reviews, and about pages
- **Pages**: index.html, tutorials.html, reviews.html, about.html

## Running

```bash
cd examples/demo-blog
npx serve .
# or
python3 -m http.server 8081
```

Then open `http://localhost:8081` and browse pages to generate tracking events for `site_blog`.

## Switching Sites in Dashboard

1. Go to **Settings** → **Manage Sites** → **Add Site** with name "TechPulse Blog" and domain "localhost:8081"
2. Or use the **site switcher** in the top navbar to switch between sites
